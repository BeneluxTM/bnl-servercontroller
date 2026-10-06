import TournamentMatchList from "@/components/tournament/matches";
import { hasPermission } from "@/lib/auth";
import { routePermissions, routes } from "@/routes";
import { redirect } from "next/navigation";
export default async function TournamentPage() {
  if (!(await hasPermission(routePermissions.tournament)))
    redirect(routes.dashboard);
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Tournament matches</h1>
        <p className="text-muted-foreground">
          Assign a server to a scheduled match, or choose Unassigned to remove
          it. Times are shown in Amsterdam time.
        </p>
      </div>
      <TournamentMatchList />
    </div>
  );
}
