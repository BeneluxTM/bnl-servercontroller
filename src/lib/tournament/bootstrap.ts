import "server-only";

import { appGlobals } from "@/lib/global";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { isEliminated } from "@/lib/utils";
import { attachEmitter } from "./emitter";
import { WebhookQueue } from "./queue";
import { tournamentConfig } from "./service-auth";

const meta = { type: "tournament", module: "bootstrap" };

const state = globalThis as unknown as {
  __bnlTournamentBridge?: {
    queue: WebhookQueue;
    attached: Set<string>;
    scan: NodeJS.Timeout;
  };
};

/** The running queue, for the layer-③ archive route. Null when disabled. */
export function getTournamentQueue(): WebhookQueue | null {
  return state.__bnlTournamentBridge?.queue ?? null;
}

/**
 * Called once from instrumentation.ts (the single edited line, PLAN.md
 * D10). Starts the webhook queue and attaches an emitter to every server
 * manager — including ones created later, found by a periodic scan of the
 * app's manager registry.
 */
export async function start(servers: { id: string }[]) {
  if (state.__bnlTournamentBridge) return;
  if (!tournamentConfig.WEBHOOK_URL || !tournamentConfig.WEBHOOK_SECRET) {
    logger.info(
      { meta },
      "BNL tournament webhooks disabled (TOURNAMENT_WEBHOOK_URL/SECRET not set)",
    );
    return;
  }

  const redis = await getRedisClient();
  const log = (level: "info" | "warn" | "error", msg: string, extra?: object) =>
    logger[level]({ meta, ...extra }, msg);
  const queue = new WebhookQueue(redis, {
    url: tournamentConfig.WEBHOOK_URL,
    secret: tournamentConfig.WEBHOOK_SECRET,
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
    log,
  });
  const attached = new Set<string>();

  const attachAll = () => {
    for (const [serverId, manager] of Object.entries(
      appGlobals.gbxClients ?? {},
    )) {
      if (attached.has(serverId)) continue;
      attachEmitter(manager, queue, { isEliminated, log });
      attached.add(serverId);
      logger.info({ meta, serverId }, "BNL tournament emitter attached");
    }
  };

  attachAll();
  const missing = servers.filter((s) => !attached.has(s.id));
  if (missing.length) {
    logger.warn(
      { meta, servers: missing.map((s) => s.id) },
      "Servers without a manager yet — will attach when they appear",
    );
  }
  queue.start();
  state.__bnlTournamentBridge = {
    queue,
    attached,
    scan: setInterval(attachAll, 30_000),
  };
  logger.info(
    { meta, url: tournamentConfig.WEBHOOK_URL },
    "BNL tournament webhooks started",
  );
}
