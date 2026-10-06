import type { LiveInfo, Scores } from "@gcp/shared";
import crypto from "node:crypto";
import type { ServerRuntime } from "../core/server/server-runtime";
import type { WebhookQueue } from "./queue";
import {
  mapEnded,
  matchEnded,
  pickBanCompleted,
  pickBanSelection,
  pickBanStarted,
  roundEnded,
  snapshotPreEndRound,
  type PreEndRoundSnapshot,
} from "./serialize";
import type { PickBanCompletedData, WebhookEventType } from "./types";

type Log = (
  level: "info" | "warn" | "error",
  msg: string,
  extra?: object,
) => void;

/**
 * Turns one server's game events into the webhook events bnl-tournament
 * ingests, from the runtime's event bus: the same one plugins and the live
 * sockets use, so no controller behaviour changes.
 *
 * Handlers only enqueue (a Redis RPUSH); nothing here waits on the
 * tournament, so a hung endpoint can't slow a game callback down.
 *
 * "pickban.completed" comes from the match plugin's own "pickBanCompleted"
 * plugin event.
 */
export function attachEmitter(
  runtime: Pick<ServerRuntime, "events" | "state" | "serverId">,
  queue: WebhookQueue,
  deps: { isEliminated: (matchPoints: number) => boolean; log: Log },
): () => void {
  const { serverId, state, events } = runtime;
  let pre: PreEndRoundSnapshot | null = null;
  let eliminatedThisMatch = new Set<string>();
  // The pick/ban phase finishes before the new match has an id: hold the
  // result and send it right after "match.started".
  let pendingPickBan: PickBanCompletedData | null = null;

  const live = () => state.liveInfo;
  const isRoundBased = () => live().type !== "timeattack";

  const emit = (type: WebhookEventType, data: unknown) => {
    // Captured synchronously: the match this event belongs to is the one
    // current when the callback fired, not whatever is current later.
    const externalMatchId = state.currentMatchId;
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

  const offs = [
    events.on("beginMatch", (info: LiveInfo) => {
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
    }),

    // The match plugin's pick/ban phase, live. It runs before the match proper starts, so
    // these carry the id the server has then; the result is held for the next match too.
    events.on("pluginEvent", (event) => {
      if (event.plugin !== "match") return;
      switch (event.name) {
        case "pickBanStarted": {
          const data = pickBanStarted(event.payload);
          if (data) emit("pickban.started", data);
          return;
        }
        case "pickBanMapPicked": {
          const data = pickBanSelection("pick", event.payload);
          if (data) emit("pickban.picked", data);
          return;
        }
        case "pickBanMapBanned": {
          const data = pickBanSelection("ban", event.payload);
          if (data) emit("pickban.banned", data);
          return;
        }
        case "pickBanCompleted":
          pendingPickBan = pickBanCompleted(event.payload);
          return;
      }
    }),

    events.on("beginMap", (mapUid: string) => {
      pre = null;
      const index = live().maps.indexOf(mapUid);
      emit("map.started", { mapUid, index: index >= 0 ? index : null });
    }),

    events.on("scores", (scores: Scores) => {
      const info = live();
      switch (scores.section) {
        case "PreEndRound": {
          // Same guard as the recorder's own claimRound.
          if (info.isWarmUp || info.isPaused || !isRoundBased()) {
            pre = null;
            return;
          }
          // The recorder bumps roundNumber 0 → 1 right after this
          // listener runs; mirror that so round 1 isn't sent as 0.
          const roundNumber = Math.max(1, state.roundNumber ?? 1);
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
    }),
  ];

  return () => offs.forEach((off) => off());
}
