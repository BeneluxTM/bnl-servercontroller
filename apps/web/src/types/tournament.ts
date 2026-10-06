import { z } from "zod";
export const tournamentMatchSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  stage: z.string(),
  scheduledAt: z.string().nullable(),
  serverId: z.string().nullable(),
  season: z.object({ id: z.string(), name: z.string() }),
  division: z.object({ name: z.string() }).nullable(),
  participants: z.array(z.string()),
});
export type TournamentMatch = z.infer<typeof tournamentMatchSchema> & {
  canAssign: boolean;
};
export type TournamentMatches = {
  matches: TournamentMatch[];
  servers: { id: string; name: string }[];
};
export const assignServerSchema = z.object({
  matchId: z.string().uuid(),
  serverId: z.string().uuid().nullable(),
  expectedServerId: z.string().nullable(),
});
