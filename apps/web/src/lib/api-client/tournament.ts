import type { TournamentMatches } from "@/types/tournament";
import { apiGet } from "./http";
export function getTournamentMatches(signal?: AbortSignal) {
  return apiGet<TournamentMatches>("/api/tournament/matches", undefined, {
    signal,
  });
}
