import { getClient } from "@/lib/dbclient";
import { getTournamentQueue } from "@/lib/tournament/bootstrap";
import { isTournamentRequest } from "@/lib/tournament/service-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Layer ③ — the authoritative record of one match (PLAN.md D2, D4):
 * - `events`: every webhook event emitted for it, from the emitter's
 *   per-match archive, with their original eventIds — so replaying them
 *   into bnl-tournament deduplicates exactly;
 * - `records`: the controller's own per-round Records rows, an independent
 *   check on times and points. (Records are keyed per round number only,
 *   so on a multi-map match a later map's round can overwrite an earlier
 *   one's — treat them as a cross-check, not a replacement for events.)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string; matchId: string }> },
) {
  if (!isTournamentRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { serverId, matchId } = await params;
  const db = getClient();
  const match = await db.matches.findFirst({
    where: { id: matchId, serverId },
    select: { id: true, mode: true, serverId: true, createdAt: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const [records, events] = await Promise.all([
    db.records.findMany({
      where: { matchId },
      orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      select: {
        login: true,
        mapUid: true,
        round: true,
        time: true,
        points: true,
        checkpoints: true,
      },
    }),
    getTournamentQueue()?.archived(matchId) ?? Promise.resolve([]),
  ]);

  return NextResponse.json({ match, events, records });
}
