import type { Player, Scores } from "@/types/gbx/scores";
import type {
  EventPlayerRef,
  MapEndedData,
  MatchEndedData,
  PickBanCompletedData,
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
 * The `match` plugin's own pick/ban result — deliberately duck-typed, not
 * imported from src/plugins/match (which is server-only), so this stays a
 * pure, independently-testable mapping like the rest of this file.
 */
export function pickBanCompleted(
  maps: readonly { uid: string; pickedBy: string; bannedBy: string; index: number }[],
): PickBanCompletedData {
  return {
    maps: maps.map((m) => ({
      mapUid: m.uid,
      outcome: m.pickedBy ? "picked" : "banned",
      by: m.pickedBy || m.bannedBy || null,
      pickIndex: m.pickedBy ? m.index : null,
    })),
  };
}
