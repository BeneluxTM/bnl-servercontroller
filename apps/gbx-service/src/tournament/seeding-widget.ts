import { z } from "zod";
import type { Logger } from "../core/logger";
import type { ServerRegistry } from "../core/server/server-registry";

const finite = z.number().finite();
export const seedingSnapshotSchema = z.object({
  serverId: z.string().min(1),
  generatedAt: z.string().datetime(),
  session: z
    .object({
      matchId: z.string().min(1),
      label: z.string().nullable(),
      revision: z.string().min(1),
      mapUids: z.array(z.string().nullable()).max(32).default([]),
      standings: z.object({
        season: z.object({ slug: z.string(), name: z.string() }),
        roundsPerMap: z.number().int().positive(),
        updatedAt: z.string().datetime(),
        maps: z
          .array(z.object({ slot: z.string(), name: z.string().nullable() }))
          .max(32),
        rows: z
          .array(
            z.object({
              position: z.number().int().positive(),
              name: z.string(),
              login: z.string(),
              perMap: z
                .array(
                  z.object({
                    normalisedMs: finite.nullable(),
                    rank: z.number().int().positive().nullable(),
                    runs: z.array(finite.nullable()).max(100),
                  }),
                )
                .max(32),
              averageRank: finite,
              unresolvedTie: z.boolean(),
            }),
          )
          .max(1000),
      }),
    })
    .nullable(),
});
export type SeedingSnapshot = z.infer<typeof seedingSnapshotSchema>;

/** Host-only HTTP: plugins never receive service credentials or private network access. */
export class SeedingWidgetBridge {
  private readonly cache = new Map<string, SeedingSnapshot>();
  private readonly detach = new Map<string, () => void>();
  private readonly inflight = new Set<string>();
  private readonly requestedAt = new Map<string, number>();
  private readonly offs: (() => void)[];
  private stopped = false;
  constructor(
    private readonly deps: {
      registry: ServerRegistry;
      webhookUrl: string;
      apiKey: string;
      log: Logger;
      fetch?: typeof fetch;
    },
  ) {
    const attach = (id: string) => {
      const runtime = deps.registry.find(id);
      if (!runtime || this.detach.has(id)) return;
      this.detach.set(
        id,
        runtime.events.on("pluginEvent", (event) => {
          if (
            event.plugin === "bnl-seeding" &&
            event.name === "requestStandings"
          )
            void this.request(id);
        }),
      );
    };
    deps.registry.list().forEach((r) => attach(r.serverId));
    this.offs = [
      deps.registry.events.on("runtimeAdded", attach),
      deps.registry.events.on("runtimeRemoved", (id) => {
        this.detach.get(id)?.();
        this.detach.delete(id);
        this.cache.delete(id);
        this.requestedAt.delete(id);
      }),
    ];
  }
  accept(serverId: string, snapshot: SeedingSnapshot): boolean {
    const runtime = this.deps.registry.find(serverId);
    if (!runtime || this.stopped) return false;
    if (snapshot.serverId !== serverId)
      throw new Error("Snapshot server does not match route");
    const previous = this.cache.get(serverId);
    if (previous && previous.generatedAt > snapshot.generatedAt) return true;
    this.cache.set(serverId, snapshot);
    runtime.events.emit("pluginEvent", {
      plugin: "bnl-tournament",
      name: "seedingStandings",
      payload: snapshot,
    });
    return true;
  }
  private async request(serverId: string) {
    const cached = this.cache.get(serverId);
    if (cached) this.accept(serverId, cached);
    if (
      !this.deps.webhookUrl ||
      !this.deps.apiKey ||
      this.inflight.has(serverId) ||
      Date.now() - (this.requestedAt.get(serverId) ?? 0) < 5000
    )
      return;
    this.inflight.add(serverId);
    this.requestedAt.set(serverId, Date.now());
    try {
      const url = new URL(
        `/api/v1/servercontroller/servers/${encodeURIComponent(serverId)}/seeding`,
        this.deps.webhookUrl,
      );
      const response = await (this.deps.fetch ?? fetch)(url, {
        headers: { Authorization: `Bearer ${this.deps.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw new Error(`Seeding snapshot returned ${response.status}`);
      this.accept(serverId, seedingSnapshotSchema.parse(await response.json()));
    } catch (err) {
      if (!this.stopped)
        this.deps.log.warn(
          { err, serverId },
          "Could not refresh seeding widget",
        );
    } finally {
      this.inflight.delete(serverId);
    }
  }
  stop() {
    this.stopped = true;
    this.offs.forEach((off) => off());
    this.detach.forEach((off) => off());
    this.detach.clear();
    this.cache.clear();
  }
}
