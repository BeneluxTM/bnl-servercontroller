import crypto from "node:crypto";

/**
 * BNL tournament bridge settings. Read from the environment here rather
 * than added to src/lib/config.ts, which would be an edit to an existing
 * file (PLAN.md D10).
 */
export const tournamentConfig = {
  /** bnl-tournament's POST /api/v1/ingest/events. Unset = emitter off. */
  WEBHOOK_URL: process.env.TOURNAMENT_WEBHOOK_URL || "",
  /** Shared HMAC secret for outgoing webhooks. */
  WEBHOOK_SECRET: process.env.TOURNAMENT_WEBHOOK_SECRET || "",
  /** Shared secret bnl-tournament sends to call this fork (layers ② and ③). */
  API_KEY: process.env.TOURNAMENT_API_KEY || "",
};

/**
 * Inbound check for /api/tournament/*: `Authorization: Bearer <key>`,
 * compared in constant time. A plain shared secret on purpose — the fork's
 * auth (next-auth) doesn't cross the service boundary (PLAN.md §5.4).
 */
export function isTournamentRequest(authorization: string | null): boolean {
  const key = tournamentConfig.API_KEY;
  if (!key || !authorization?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(key);
  return (
    given.length === expected.length && crypto.timingSafeEqual(given, expected)
  );
}
