import { isEliminated } from "../core/live/points";
import type { Logger } from "../core/logger";
import type { ServerRegistry } from "../core/server/server-registry";
import { attachEmitter } from "./emitter";
import { WebhookQueue, type QueueRedis } from "./queue";

export interface TournamentBridgeConfig {
  // bnl-tournament's POST /api/v1/ingest/events; empty turns the webhooks off
  webhookUrl: string;
  webhookSecret: string;
}

/**
 * Sends every server's match events to bnl-tournament through a Redis-backed
 * queue. Servers added later get an emitter when their runtime is created.
 * Returns the queue (for the results route), or null when disabled.
 */
export function startTournamentBridge(deps: {
  registry: ServerRegistry;
  redis: QueueRedis;
  config: TournamentBridgeConfig;
  log: Logger;
}): { queue: WebhookQueue; stop: () => void } | null {
  const { registry, redis, config, log } = deps;
  if (!config.webhookUrl || !config.webhookSecret) {
    log.info(
      "BNL tournament webhooks disabled (TOURNAMENT_WEBHOOK_URL/SECRET not set)",
    );
    return null;
  }

  const bridgeLog = log.child({ module: "tournament" });
  const write = (
    level: "info" | "warn" | "error",
    msg: string,
    extra?: object,
  ) => bridgeLog[level]({ ...extra }, msg);
  const queue = new WebhookQueue(redis, {
    url: config.webhookUrl,
    secret: config.webhookSecret,
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
    log: write,
  });

  const detach = new Map<string, () => void>();
  const attach = (serverId: string) => {
    const runtime = registry.find(serverId);
    if (!runtime || detach.has(serverId)) return;
    detach.set(
      serverId,
      attachEmitter(runtime, queue, { isEliminated, log: write }),
    );
    bridgeLog.info({ serverId }, "BNL tournament emitter attached");
  };

  registry.list().forEach((runtime) => attach(runtime.serverId));
  const offAdded = registry.events.on("runtimeAdded", attach);
  const offRemoved = registry.events.on("runtimeRemoved", (serverId) => {
    detach.get(serverId)?.();
    detach.delete(serverId);
  });
  queue.start();
  bridgeLog.info({ url: config.webhookUrl }, "BNL tournament webhooks started");

  return {
    queue,
    stop: () => {
      offAdded();
      offRemoved();
      detach.forEach((off) => off());
      queue.stop();
    },
  };
}
