import type { ScoresPlayer as Player, Scores } from "@gcp/shared";
import type {
  EventPlayerRef,
  MapEndedData,
  MatchEndedData,
  PickBanBannedData,
  PickBanCompletedData,
  PickBanPickedData,
  PickBanStartedData,
  RoundEndedData,
  RoundPlayerResult,
} from "./types";

/**
 * Pure mappings from the GBX `Scores` callback to webhook payloads. No
 * server-only imports, so they can be unit-tested without a game server.
 */

export function playerRef(
  p: Pick<Player, "login" | "accountid" | "name">,
): EventPlayerRef {
  return { login: p.login, accountId: p.accountid, name: p.name };
}

/** GBX reports a missing finish as -1 (sometimes 0). */
export function finishTime(ms: number): number | null {
  return ms > 0 ? ms : null;
}

/**
 * What the PreEndRound section knows that EndRound may no longer: the
 * round's finish times, checkpoints and round points — the same fields
 * saveRoundRecords persists from PreEndRound.
 */
export type PreEndRoundSnapshot = {
  mapUid: string;
  roundNumber: number;
  byLogin: Map<
    string,
    { time: number | null; checkpoints: number[]; roundPoints: number }
  >;
};

export function snapshotPreEndRound(
  scores: Scores,
  mapUid: string,
  roundNumber: number,
): PreEndRoundSnapshot {
  return {
    mapUid,
    roundNumber,
    byLogin: new Map(
      scores.players.map((p) => [
        p.login,
        {
          time: finishTime(p.prevracetime),
          checkpoints: p.prevracecheckpoints ?? [],
          roundPoints: p.roundpoints,
        },
      ]),
    ),
  };
}

/**
 * round.ended = PreEndRound's times + EndRound's standings. Falls back to
 * EndRound's own prev* fields for anyone missing from the snapshot.
 */
export function roundEnded(
  pre: PreEndRoundSnapshot,
  end: Scores,
  isEliminated: (matchPoints: number) => boolean,
): { data: RoundEndedData; eliminated: RoundPlayerResult[] } {
  const players: RoundPlayerResult[] = end.players.map((p) => {
    const snap = pre.byLogin.get(p.login);
    return {
      ...playerRef(p),
      rank: p.rank,
      roundPoints: snap?.roundPoints ?? p.roundpoints,
      mapPoints: p.mappoints,
      matchPoints: p.matchpoints,
      time: snap ? snap.time : finishTime(p.prevracetime),
      checkpoints: snap?.checkpoints ?? p.prevracecheckpoints ?? [],
      eliminated: isEliminated(p.matchpoints),
    };
  });
  return {
    data: { mapUid: pre.mapUid, roundNumber: pre.roundNumber, players },
    eliminated: players.filter((p) => p.eliminated),
  };
}

export function mapEnded(scores: Scores, mapUid: string): MapEndedData {
  return {
    mapUid,
    players: scores.players.map((p) => ({
      ...playerRef(p),
      rank: p.rank,
      mapPoints: p.mappoints,
      matchPoints: p.matchpoints,
    })),
  };
}

export function matchEnded(scores: Scores): MatchEndedData {
  return {
    players: scores.players.map((p) => ({
      ...playerRef(p),
      rank: p.rank,
      matchPoints: p.matchpoints,
    })),
  };
}

/**
 * The `match` plugin's "pickBanCompleted" event: `picked` in match order with
 * their position, `banned` with who banned them. The payload comes from a
 * plugin, so anything malformed is skipped rather than trusted.
 */
export function pickBanCompleted(
  payload: unknown,
): PickBanCompletedData | null {
  const { picked, banned } = (payload ?? {}) as {
    picked?: unknown;
    banned?: unknown;
  };
  if (!Array.isArray(picked) || !Array.isArray(banned)) return null;
  const maps: PickBanCompletedData["maps"] = [];
  for (const m of picked) {
    if (typeof m?.uid !== "string") continue;
    maps.push({
      mapUid: m.uid,
      outcome: "picked",
      by: typeof m.by === "string" ? m.by : null,
      pickIndex: pickIndex(m.position),
    });
  }
  for (const m of banned) {
    if (typeof m?.uid !== "string") continue;
    maps.push({
      mapUid: m.uid,
      outcome: "banned",
      by: typeof m.by === "string" ? m.by : null,
      pickIndex: null,
    });
  }
  return { maps };
}

// The plugin counts positions from 1, the tournament's pickIndex from 0
function pickIndex(position: unknown): number | null {
  return typeof position === "number" && position >= 1 ? position - 1 : null;
}

type Raw = Record<string, unknown> | null | undefined;

/** The match plugin's "pickBanStarted" event. Null if the payload is malformed. */
export function pickBanStarted(payload: unknown): PickBanStartedData | null {
  const { mode, order, maps } = (payload ?? {}) as Raw & {
    mode?: unknown;
    order?: unknown;
    maps?: unknown;
  };
  if (typeof mode !== "string" || !Array.isArray(order) || !Array.isArray(maps))
    return null;
  return {
    mode,
    order: order.flatMap((step: Raw) =>
      step?.action === "pick" ||
      step?.action === "ban" ||
      step?.action === "random"
        ? [
            {
              action: step.action,
              seed: typeof step.seed === "number" ? step.seed : null,
            },
          ]
        : [],
    ),
    maps: maps.flatMap((m: Raw) =>
      typeof m?.uid === "string"
        ? [{ mapUid: m.uid, name: String(m.name ?? "") }]
        : [],
    ),
  };
}

/** "pickBanMapPicked" (picked) or "pickBanMapBanned" (banned). Null if malformed. */
export function pickBanSelection(
  action: "pick",
  payload: unknown,
): PickBanPickedData | null;
export function pickBanSelection(
  action: "ban",
  payload: unknown,
): PickBanBannedData | null;
export function pickBanSelection(action: "pick" | "ban", payload: unknown) {
  const { map, by, position, timedOut } = (payload ?? {}) as {
    map?: Raw;
    by?: unknown;
    position?: unknown;
    timedOut?: unknown;
  };
  if (typeof map?.uid !== "string" || typeof by !== "string") return null;
  const base = {
    mapUid: map.uid,
    name: String(map.name ?? ""),
    by,
    timedOut: timedOut === true,
  };
  return action === "pick" ? { ...base, pickIndex: pickIndex(position) } : base;
}
