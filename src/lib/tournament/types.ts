/**
 * BNL tournament bridge — wire types for layer-① webhook events.
 *
 * These mirror @beneluxtm/bnl-contracts (events.ts, webhook.ts) in
 * bnl-tournament, which validates every payload with zod on arrival. They
 * are duplicated here rather than imported so this fork gains no new
 * dependency (adding one would edit package.json — see PLAN.md D10: new
 * files only, plus one line in instrumentation.ts).
 */

export type WebhookEventType =
  | "match.started"
  | "map.started"
  | "round.ended"
  | "map.ended"
  | "player.eliminated"
  | "match.ended";

export interface WebhookEnvelope<T = unknown> {
  /** Generated once at emit time; reused on every retry (idempotency). */
  eventId: string;
  /** Per-match monotonic, starting at 1 (gap detection). */
  seq: number;
  type: WebhookEventType;
  serverId: string;
  externalMatchId: string;
  occurredAt: string;
  data: T;
}

export interface EventPlayerRef {
  login: string;
  accountId: string;
  name: string;
}

export interface RoundPlayerResult extends EventPlayerRef {
  rank: number;
  roundPoints: number;
  mapPoints: number;
  matchPoints: number;
  /** ms; null = no finish */
  time: number | null;
  checkpoints: number[];
  eliminated: boolean;
}

export interface MatchStartedData {
  mode: string;
  type: string;
  maps: string[];
  pointsLimit: number | null;
  players: EventPlayerRef[];
}

export interface MapStartedData {
  mapUid: string;
  index: number | null;
}

export interface RoundEndedData {
  mapUid: string;
  roundNumber: number;
  players: RoundPlayerResult[];
}

export interface MapEndedData {
  mapUid: string;
  players: (EventPlayerRef & {
    rank: number;
    mapPoints: number;
    matchPoints: number;
  })[];
}

export interface PlayerEliminatedData extends EventPlayerRef {
  mapUid: string;
  roundNumber: number;
}

export interface MatchEndedData {
  players: (EventPlayerRef & { rank: number; matchPoints: number })[];
}
