import crypto from "node:crypto";
import type { WebhookEnvelope } from "./types";

/**
 * Redis-backed webhook queue (PLAN.md §5.3). Pure of app imports — Redis,
 * fetch and the clock are injected — so it can be exercised in tests and
 * in the failure-test harness exactly as it runs in production.
 *
 * - enqueue() is an RPUSH; GBX callbacks never wait on the network.
 * - One drain loop posts batches of ≤50 every 250 ms, signed per request.
 * - The head batch stays in Redis until a 2xx; retries back off 1s … 60s.
 *   Event ids never change between attempts, so a retry of something the
 *   tournament already stored is a no-op there.
 * - After an hour of failures the batch moves to a dead-letter list and
 *   the queue moves on; layer ③ recovers it from the per-match archive.
 * - Every event is also appended to a per-match archive (14 days), which
 *   is what layer ③ serves back.
 */

export interface QueueRedis {
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  incr(key: string): Promise<number>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

export const KEYS = {
  queue: "bnl:tournament:webhook:queue",
  dead: "bnl:tournament:webhook:dead",
  seq: (externalMatchId: string) =>
    `bnl:tournament:webhook:seq:${externalMatchId}`,
  archive: (externalMatchId: string) =>
    `bnl:tournament:webhook:archive:${externalMatchId}`,
};

export const BATCH_SIZE = 50;
export const TICK_MS = 250;
export const MAX_BACKOFF_MS = 60_000;
export const GIVE_UP_AFTER_MS = 60 * 60 * 1000;
export const ARCHIVE_TTL_SECONDS = 14 * 24 * 60 * 60;

export function signBody(secret: string, rawBody: string, t: number): string {
  const v1 = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

export function backoffMs(failures: number): number {
  return Math.min(1000 * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);
}

export class WebhookQueue {
  private failures = 0;
  private firstFailureAt: number | null = null;
  private nextAttemptAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  constructor(
    private readonly redis: QueueRedis,
    private readonly opts: {
      url: string;
      secret: string;
      fetch: FetchLike;
      now?: () => number;
      log?: (
        level: "info" | "warn" | "error",
        msg: string,
        extra?: object,
      ) => void;
    },
  ) {}

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  private log(level: "info" | "warn" | "error", msg: string, extra?: object) {
    this.opts.log?.(level, msg, extra);
  }

  /** Allocates the next seq for a match — atomic, survives restarts. */
  nextSeq(externalMatchId: string): Promise<number> {
    return this.redis.incr(KEYS.seq(externalMatchId));
  }

  async enqueue(envelope: WebhookEnvelope): Promise<void> {
    const json = JSON.stringify(envelope);
    const archive = KEYS.archive(envelope.externalMatchId);
    await this.redis.rpush(archive, json);
    await this.redis.expire(archive, ARCHIVE_TTL_SECONDS);
    await this.redis.rpush(KEYS.queue, json);
  }

  async archived(externalMatchId: string): Promise<WebhookEnvelope[]> {
    const rows = await this.redis.lrange(KEYS.archive(externalMatchId), 0, -1);
    return rows.map((r) => JSON.parse(r) as WebhookEnvelope);
  }

  /**
   * One delivery attempt of the head batch, if due. Returns what happened;
   * the loop calls this every tick.
   */
  async drainOnce(): Promise<
    "idle" | "waiting" | "sent" | "failed" | "gave-up"
  > {
    if (this.draining) return "waiting";
    if (this.now() < this.nextAttemptAt) return "waiting";
    this.draining = true;
    try {
      const rows = await this.redis.lrange(KEYS.queue, 0, BATCH_SIZE - 1);
      if (rows.length === 0) return "idle";

      const body = `{"events":[${rows.join(",")}]}`;
      let ok = false;
      let status = 0;
      try {
        const res = await this.opts.fetch(this.opts.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BNL-Signature": signBody(
              this.opts.secret,
              body,
              Math.floor(this.now() / 1000),
            ),
          },
          body,
        });
        ok = res.ok;
        status = res.status;
      } catch (err) {
        this.log("warn", "Tournament webhook request failed", {
          error: (err as Error).message,
        });
      }

      if (ok) {
        await this.redis.ltrim(KEYS.queue, rows.length, -1);
        if (this.failures > 0) {
          this.log("info", "Tournament webhook delivery recovered", {
            failures: this.failures,
          });
        }
        this.failures = 0;
        this.firstFailureAt = null;
        this.nextAttemptAt = 0;
        return "sent";
      }

      this.failures++;
      this.firstFailureAt ??= this.now();
      if (this.now() - this.firstFailureAt >= GIVE_UP_AFTER_MS) {
        await this.redis.rpush(KEYS.dead, ...rows);
        await this.redis.ltrim(KEYS.queue, rows.length, -1);
        this.log("error", "Tournament webhook gave up on a batch", {
          events: rows.length,
          status,
        });
        this.failures = 0;
        this.firstFailureAt = null;
        this.nextAttemptAt = 0;
        return "gave-up";
      }
      this.nextAttemptAt = this.now() + backoffMs(this.failures);
      this.log("warn", "Tournament webhook delivery failed, backing off", {
        status,
        failures: this.failures,
        retryInMs: backoffMs(this.failures),
      });
      return "failed";
    } finally {
      this.draining = false;
    }
  }

  start() {
    if (this.timer) return;
    const tick = async () => {
      try {
        await this.drainOnce();
      } catch (err) {
        this.log("error", "Tournament webhook drain error", {
          error: (err as Error).message,
        });
      } finally {
        this.timer = setTimeout(tick, TICK_MS);
      }
    };
    this.timer = setTimeout(tick, TICK_MS);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
