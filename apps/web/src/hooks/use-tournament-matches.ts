import { queryKeys, unwrap } from "@/lib/api-client/query";
import { getTournamentMatches } from "@/lib/api-client/tournament";
import { useQuery } from "@tanstack/react-query";
export function useTournamentMatches() {
  return useQuery({
    queryKey: queryKeys.tournamentMatches,
    queryFn: ({ signal }) => unwrap(getTournamentMatches(signal)),
    staleTime: 10000,
    refetchInterval: 30000,
  });
}
