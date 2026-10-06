"use client";
import { assignTournamentServer } from "@/actions/tournament";
import { DataTable } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTournamentMatches } from "@/hooks/use-tournament-matches";
import { queryKeys } from "@/lib/api-client/query";
import type { TournamentMatch, TournamentMatches } from "@/types/tournament";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

function Assignment({
  match,
  servers,
}: {
  match: TournamentMatch;
  servers: TournamentMatches["servers"];
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(z.object({ server: z.string().min(1) })),
    defaultValues: { server: match.serverId ?? "unassigned" },
  });
  const pending = form.formState.isSubmitting;
  const selected = form.watch("server");
  const known = servers.some((server) => server.id === match.serverId);
  const options = [
    { value: "unassigned", label: "Unassigned" },
    ...servers.map((server) => ({ value: server.id, label: server.name })),
  ];
  if (match.serverId && !known)
    options.push({
      value: match.serverId,
      label: `Other server (${match.serverId.slice(0, 8)})`,
    });
  return (
    <Form {...form}>
      <form
        className="flex min-w-72 items-end gap-3"
        onSubmit={form.handleSubmit(async ({ server }) => {
          try {
            const result = await assignTournamentServer({
              matchId: match.id,
              serverId: server === "unassigned" ? null : server,
              expectedServerId: match.serverId,
            });
            if (result.error) throw new Error(result.error);
            toast.success(
              server === "unassigned" ? "Server unassigned" : "Server assigned",
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Assignment failed",
            );
          } finally {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.tournamentMatches,
            });
          }
        })}
      >
        <FormField
          control={form.control}
          name="server"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Assigned server</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={pending || !match.canAssign}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={
            pending ||
            !match.canAssign ||
            selected === (match.serverId ?? "unassigned")
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function TournamentMatchList() {
  const query = useTournamentMatches();
  const [season, setSeason] = useState("all");
  const [stage, setStage] = useState("all");
  const [server, setServer] = useState("all");
  const matches = query.data?.matches ?? [];
  const servers = query.data?.servers ?? [];
  const filtered = matches.filter(
    (match) =>
      (season === "all" || match.season.id === season) &&
      (stage === "all" || match.stage === stage) &&
      (server === "all" ||
        (server === "unassigned"
          ? !match.serverId
          : match.serverId === server)),
  );
  const columns: ColumnDef<TournamentMatch>[] = [
    {
      id: "match",
      accessorFn: (match) =>
        [match.label, ...match.participants].filter(Boolean).join(" "),
      header: "Match",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.label || `${row.original.stage.toLowerCase()} match`}
          </div>
          <div className="text-sm text-muted-foreground">
            {row.original.participants.join(" · ") || "Players to be decided"}
          </div>
        </div>
      ),
    },
    {
      id: "season",
      accessorFn: (match) =>
        `${match.season.name} ${match.division?.name ?? ""}`,
      header: "Season / division",
    },
    { accessorKey: "stage", header: "Stage" },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled",
      cell: ({ row }) =>
        row.original.scheduledAt
          ? new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Amsterdam",
            }).format(new Date(row.original.scheduledAt))
          : "Not scheduled yet",
    },
    {
      id: "assignment",
      header: "Server",
      cell: ({ row }) => (
        <Assignment
          key={`${row.original.id}:${row.original.serverId}:${row.original.canAssign}`}
          match={row.original}
          servers={servers}
        />
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filter
          label="Season"
          value={season}
          onChange={setSeason}
          options={[
            { value: "all", label: "All seasons" },
            ...Array.from(
              new Map(
                matches.map((match) => [match.season.id, match.season]),
              ).values(),
            ).map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <Filter
          label="Stage"
          value={stage}
          onChange={setStage}
          options={[
            { value: "all", label: "All stages" },
            ...Array.from(new Set(matches.map((match) => match.stage))).map(
              (value) => ({ value, label: value }),
            ),
          ]}
        />
        <Filter
          label="Server assignment"
          value={server}
          onChange={setServer}
          options={[
            { value: "all", label: "All servers" },
            { value: "unassigned", label: "Unassigned" },
            ...servers.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {query.error ? (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      ) : (
        <>
          {query.data && !servers.length && (
            <p className="text-muted-foreground">
              You have no servers available to assign.
            </p>
          )}
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={query.isLoading}
            filter
            pagination
          />
          {!query.isLoading && !filtered.length && (
            <p className="text-muted-foreground">
              No scheduled matches match these filters.
            </p>
          )}
        </>
      )}
    </div>
  );
}
