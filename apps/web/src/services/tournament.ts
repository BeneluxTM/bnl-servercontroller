import { doServerActionWithAuth } from "@/lib/actions";
import config from "@/lib/config";
import { getAdminServers } from "@/lib/plugin-access";
import { hasPermissionSync } from "@/lib/utils";
import { routePermissions } from "@/routes";
import { ServerError } from "@/types/responses";
import {
  tournamentMatchSchema,
  type TournamentMatches,
} from "@/types/tournament";
import type { Session } from "next-auth";
import "server-only";
import { z } from "zod";

export function canAssignServer(session: Session, id: string | null) {
  return (
    !id ||
    hasPermissionSync(session, [
      `servers:${id}:admin`,
      `group:servers:${id}:admin`,
    ])
  );
}
export async function tournamentRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  if (!config.TOURNAMENT.URL || !config.TOURNAMENT.API_KEY)
    throw new ServerError("Tournament connection is not configured.");
  const response = await fetch(
    `${config.TOURNAMENT.URL.replace(/\/$/, "")}/api/v1/servercontroller/matches${path}`,
    {
      method: body ? "PATCH" : "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${config.TOURNAMENT.API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new ServerError(
      typeof data.error === "string"
        ? data.error
        : "Tournament request failed.",
    );
  return data;
}
export async function getTournamentMatches() {
  return doServerActionWithAuth<TournamentMatches>(
    routePermissions.tournament,
    async (session) => {
      const [raw, servers] = await Promise.all([
        tournamentRequest(""),
        getAdminServers(session),
      ]);
      const matches = z
        .array(tournamentMatchSchema)
        .parse(raw)
        .map((match) => ({
          ...match,
          canAssign: canAssignServer(session, match.serverId),
        }));
      return { matches, servers };
    },
  );
}
