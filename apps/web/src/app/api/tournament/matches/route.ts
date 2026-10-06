import { apiRoute } from "@/lib/api-route";
import { getTournamentMatches } from "@/services/tournament";
export const GET = apiRoute(() => getTournamentMatches());
