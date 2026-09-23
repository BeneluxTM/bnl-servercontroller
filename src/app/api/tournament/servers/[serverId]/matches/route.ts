import { getClient } from "@/lib/dbclient";
import { isTournamentRequest } from "@/lib/tournament/service-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Layer ③ discovery (PLAN.md §5.1): this server's matches since `?since=`
 * (ISO, default 24h ago), so bnl-tournament can recover a match it never
 * heard a single webhook about.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  if (!isTournamentRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { serverId } = await params;
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since" }, { status: 400 });
  }

  const matches = await getClient().matches.findMany({
    where: { serverId, createdAt: { gte: since }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, mode: true, createdAt: true },
  });
  return NextResponse.json({ serverId, matches });
}
