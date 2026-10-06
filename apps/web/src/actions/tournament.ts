"use server";
import { logAudit } from "@/actions/database/server-only/audit-logs";
import { doServerActionWithAuth } from "@/lib/actions";
import { getAdminServers } from "@/lib/plugin-access";
import { routePermissions } from "@/routes";
import { canAssignServer, tournamentRequest } from "@/services/tournament";
import { ServerError } from "@/types/responses";
import { assignServerSchema } from "@/types/tournament";
import { z } from "zod";

export async function assignTournamentServer(
  input: z.infer<typeof assignServerSchema>,
) {
  return doServerActionWithAuth(
    routePermissions.tournament,
    async (session) => {
      const { matchId, serverId, expectedServerId } =
        assignServerSchema.parse(input);
      if (
        !canAssignServer(session, expectedServerId) ||
        (serverId &&
          !(await getAdminServers(session)).some(
            (server) => server.id === serverId,
          ))
      )
        throw new ServerError("You cannot manage this server.", "Unauthorized");
      const result = await tournamentRequest(
        `/${encodeURIComponent(matchId)}/server`,
        {
          serverId,
          expectedServerId,
          actorId: session.user.id,
          actorName: session.user.displayName || session.user.login,
        },
      );
      await logAudit(
        session.user.id,
        serverId ?? expectedServerId ?? matchId,
        "servers.tournament.assign",
        { matchId, serverId, previousServerId: expectedServerId },
      );
      return result;
    },
  );
}
