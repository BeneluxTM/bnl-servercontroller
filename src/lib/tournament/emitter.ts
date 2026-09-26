import type { GbxClientManager } from "@/lib/managers/gbxclient-manager";
import type { Scores } from "@/types/gbx/scores";
import type { LiveInfo } from "@/types/live";
import crypto from "node:crypto";
import type { WebhookQueue } from "./queue";
import {
  mapEnded,
  matchEnded,
  pickBanCompleted,
  roundEnded,
  snapshotPreEndRound,
  type PreEndRoundSnapshot,
} from "./serialize";
import type { PickBanCompletedData, WebhookEventType } from "./types";

export const LISTENER_ID = "bnl-tournament-webhooks";

type Log = (
  level: "info" | "warn" | "error",
  msg: string,
  extra?: object,
) => void;

/**
 * Turns one server's GBX events into layer-① webhook events (PLAN.md §5.2)
 * through the manager's public addListeners API — the same one the live
 * WS route uses — so no controller behaviour changes.
 *
 * Handlers only enqueue (a Redis RPUSH); nothing here waits on the
 * tournament, so a hung endpoint can't slow a GBX callback down.
 */
export function attachEmitter(
  manager: GbxClientManager,
  queue: WebhookQueue,
  deps: { isEliminated: (matchPoints: number) => boolean; log: Log },
) {
  const serverId = manager.getServerId();
  let pre: PreEndRoundSnapshot | null = null;
  let eliminatedThisMatch = new Set<string>();
  // The pick/ban phase (and its "pickBanCompleted" emit from the match
  // plugin) finishes before the new match's externalMatchId exists — hold
  // it here and send it right after "match.started" gives us one.
  let pendingPickBan: PickBanCompletedData | null = null;

  const live = () => manager.info.liveInfo;
  const isRoundBased = () => live().type !== "timeattack";

  const emit = (type: WebhookEventType, data: unknown) => {
    // Captured synchronously: the match this event belongs to is the one
    // current when the callback fired, not whatever is current later.
    const externalMatchId = manager.currentMatchId;
    if (!externalMatchId) {
      deps.log("warn", `Dropped ${type}: no current match on server`, {
        serverId,
      });
      return;
    }
    const occurredAt = new Date().toISOString();
    const eventId = crypto.randomUUID();
    void (async () => {
      const seq = await queue.nextSeq(externalMatchId);
      await queue.enqueue({
        eventId,
        seq,
        type,
        serverId,
        externalMatchId,
        occurredAt,
        data,
      });
    })().catch((err) =>
      deps.log("error", `Failed to queue ${type}`, {
        serverId,
        error: (err as Error).message,
      }),
    );
  };

  const eliminated = (matchPoints: number) =>
    live().type === "reversecup" && deps.isEliminated(matchPoints);

  manager.addListeners(LISTENER_ID, {
    beginMatch: (info: LiveInfo) => {
      pre = null;
      eliminatedThisMatch = new Set();
      emit("match.started", {
        mode: info.mode,
        type: info.type,
        maps: info.maps ?? [],
        pointsLimit: info.pointsLimit ?? null,
        players: Object.values(info.players ?? {}).map((p) => ({
          login: p.login,
          accountId: p.accountId,
          name: p.name,
        })),
      });
      if (pendingPickBan) {
        emit("pickban.completed", pendingPickBan);
        pendingPickBan = null;
      }
    },

    // Fired by the `match` plugin (src/plugins/match/index.ts) once its
    // pick/ban phase resolves — before this match has an externalMatchId,
    // so buffer it rather than emit() it directly.
    pickBanCompleted: (maps: Parameters<typeof pickBanCompleted>[0]) => {
      pendingPickBan = pickBanCompleted(maps);
    },

    beginMap: (mapUid: string) => {
      pre = null;
      const index = live().maps.indexOf(mapUid);
      emit("map.started", { mapUid, index: index >= 0 ? index : null });
    },

    scores: (scores: Scores) => {
      const info = live();
      switch (scores.section) {
        case "PreEndRound": {
          // Same guard as the controller's own saveRoundRecords.
          if (info.isWarmUp || info.isPaused || !isRoundBased()) {
            pre = null;
            return;
          }
          // The controller bumps roundNumber 0 → 1 right after this
          // listener runs; mirror that so round 1 isn't sent as 0.
          const roundNumber = Math.max(1, manager.roundNumber ?? 1);
          pre = snapshotPreEndRound(scores, info.currentMap, roundNumber);
          return;
        }
        case "EndRound": {
          if (!pre) return; // warm-up, pause, or time attack
          const { data, eliminated: out } = roundEnded(pre, scores, eliminated);
          pre = null;
          emit("round.ended", data);
          for (const p of out) {
            if (eliminatedThisMatch.has(p.accountId)) continue;
            eliminatedThisMatch.add(p.accountId);
            emit("player.eliminated", {
              login: p.login,
              accountId: p.accountId,
              name: p.name,
              mapUid: data.mapUid,
              roundNumber: data.roundNumber,
            });
          }
          return;
        }
        case "EndMap":
          emit("map.ended", mapEnded(scores, info.currentMap));
          return;
        case "EndMatch":
          emit("match.ended", matchEnded(scores));
          return;
      }
    },
  });
}
