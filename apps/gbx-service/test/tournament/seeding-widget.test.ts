import type { DbClient } from "@gcp/db";
import { packPlugin } from "@tmcontrolpanel/plugin-sdk/cli";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerRegistry } from "../../src/core/server/server-registry";
import { buildApp } from "../../src/http/app";
import { TicketVerifier } from "../../src/http/ws/ticket-verifier";
import {
  SeedingWidgetBridge,
  type SeedingSnapshot,
} from "../../src/tournament/seeding-widget";
import { flush } from "../fakes/clock";
import { createHarness, MAP_B, player } from "../fakes/harness";
import { silentLogger } from "../fakes/logger";

const source = fileURLToPath(
  new URL("../../../../../bnl-tournament/plugins/bnl-seeding", import.meta.url),
);
let bytes: Promise<Uint8Array> | undefined;
function packageBytes() {
  bytes ??= (async () => {
    const outDir = mkdtempSync(join(tmpdir(), "bnl-seeding-test-"));
    try {
      return (await packPlugin(source, { outDir })).bytes;
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  })();
  return bytes;
}
function snapshot(
  revision = "one",
  generatedAt = "2026-10-06T20:00:00.000Z",
): SeedingSnapshot {
  return {
    serverId: "server-1",
    generatedAt,
    session: {
      matchId: "seeding-1",
      label: "Seeding session",
      revision,
      mapUids: ["map-a-uid", "map-b-uid"],
      standings: {
        season: { name: "Season 3", slug: "season-3" },
        roundsPerMap: 8,
        updatedAt: generatedAt,
        maps: [
          { slot: "A", name: "Map A" },
          { slot: "B", name: null },
        ],
        rows: [
          {
            position: 1,
            name: 'Nick <&> """',
            login: "p1",
            averageRank: 1,
            unresolvedTie: false,
            perMap: [
              { normalisedMs: 42000, rank: 1, runs: [42000] },
              { normalisedMs: null, rank: null, runs: [] },
            ],
          },
        ],
      },
    },
  };
}
const cleanups: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function setup() {
  const h = await createHarness({
    players: [player("p1")],
    packages: [{ bytes: await packageBytes() }],
  });
  cleanups.push(() => h.runtime.dispose());
  const registry = new ServerRegistry({
    servers: h.servers,
    createRuntime: () => h.runtime,
    log: silentLogger,
  });
  registry.add(h.runtime.serverId);
  const bridge = new SeedingWidgetBridge({
    registry,
    webhookUrl: "",
    apiKey: "",
    log: silentLogger,
  });
  cleanups.push(() => bridge.stop());
  return { h, registry, bridge };
}
const page = "plg.bnl-seeding.standings";

// This private plugin lives in the sibling tournament repository.
describe.skipIf(!existsSync(source))("BNL seeding SDK 3 package", () => {
  it("renders at Live Ranking's width, keeps undriven maps empty, and escapes script content", async () => {
    const { h, bridge } = await setup();
    bridge.accept("server-1", snapshot());
    await flush();
    expect(h.session.lastManialink(page)).toContain('size="55 5"');
    const update = h.session.lastManialink(`${page}-update`)!;
    expect(update).toContain('"title":"Seeding Ranking"');
    expect(update).not.toContain('"maps"');
    expect(update).toContain('"average":"1.00"');
    expect(h.session.lastManialink(page)).not.toContain('id="column');
    expect(update).not.toContain('"columns"');
    expect(h.session.lastManialink(page)).toContain(
      'pos="6.25 -1" z-index="0" size="4.5 3"',
    );
    expect(h.session.lastManialink(page)).toContain(
      'textsize="1.2" textfont="GameFontRegular"',
    );
    expect(h.session.lastManialink(page)).toContain("file://ZoneFlags/Login/");
    expect(update).toContain("\\u003c\\u0026\\u003e");
    expect(update).not.toContain("Nick <&>");
  });
  it("shows authoritative current-map positions while retaining live checkpoints and finishes", async () => {
    const { h, bridge } = await setup();
    const state = snapshot();
    state.session!.standings.rows[0]!.perMap = [
      { normalisedMs: 42000, rank: 4, runs: [42000] },
      { normalisedMs: 50000, rank: 2, runs: [50000] },
    ];
    bridge.accept("server-1", state);
    await flush();
    await h.clock.advance(150);
    const roundPage = "plg.bnl-seeding.live-round-update";
    const rounds = () =>
      h.session.widgetJson<
        { login: string; points: number; time: number; checkpoints: number[] }[]
      >(roundPage, "roundsJson")!;
    expect(rounds()[0]).toMatchObject({ login: "p1", points: 4, time: 0 });
    const waypoint = {
      time: 0,
      login: "p1",
      accountid: "acc-p1",
      racetime: 21000,
      laptime: 21000,
      stuntsscore: 0,
      checkpointinrace: 0,
      checkpointinlap: 0,
      isendrace: false,
      isendlap: false,
      curracecheckpoints: [21000],
      curlapcheckpoints: [],
      blockid: "",
      speed: 0,
    };
    h.runtime.events.emit("checkpoint", waypoint);
    await flush();
    await h.clock.advance(150);
    expect(rounds()[0]).toMatchObject({
      points: 4,
      time: 21000,
      checkpoints: [21000],
    });
    h.runtime.events.emit("finish", {
      ...waypoint,
      racetime: 42000,
      isendrace: true,
      curracecheckpoints: [21000, 42000],
    });
    await flush();
    await h.clock.advance(150);
    expect(rounds()[0]).toMatchObject({ points: 4, time: 42000 });
    expect(
      h.session.widgetJson<{ login: string; points: number }[]>(
        roundPage,
        "finishesJson",
      )![0],
    ).toMatchObject({ login: "p1", points: 0 });
    const calculated = structuredClone(state);
    calculated.generatedAt = "2026-10-06T20:01:00.000Z";
    calculated.session!.revision = "new-round";
    calculated.session!.standings.rows[0]!.perMap[0]!.rank = 3;
    bridge.accept("server-1", calculated);
    await flush();
    await h.clock.advance(150);
    expect(rounds()[0]).toMatchObject({ points: 3, time: 42000 });
    h.world.currentMap = MAP_B;
    await h.callback("ManiaPlanet.BeginMap", [MAP_B]);
    await h.clock.advance(150);
    expect(rounds()[0]).toMatchObject({ points: 2, time: 0 });
    const reset = structuredClone(calculated);
    reset.generatedAt = "2026-10-06T20:02:00.000Z";
    reset.session!.standings.rows = [];
    bridge.accept("server-1", reset);
    await flush();
    await h.clock.advance(150);
    expect(rounds()[0]!.points).toBe(0);
  });
  it("keeps the global average until recalculation, then ignores stale deliveries", async () => {
    const { h, bridge } = await setup();
    bridge.accept("server-1", snapshot());
    await flush();
    h.runtime.events.emit("endRound", {
      responseid: "",
      section: "EndRound",
      useteams: false,
      winnerteam: -1,
      winnerplayer: "",
      teams: [],
      players: [],
    });
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"1.00"',
    );
    bridge.accept("server-1", snapshot("one", "2026-10-06T20:00:01.000Z"));
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"1.00"',
    );
    const next = snapshot("two", "2026-10-06T20:00:02.000Z");
    next.session!.standings.rows[0]!.perMap[0] = {
      normalisedMs: 45000,
      rank: 2,
      runs: [42000, null],
    };
    next.session!.standings.rows[0]!.averageRank = 2.5;
    bridge.accept("server-1", next);
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"2.50"',
    );

    expect(h.session.lastManialink(`${page}-update`)).not.toContain(
      "Calculating…",
    );
    h.runtime.events.emit("live-endRound", h.runtime.state.liveInfo);
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).not.toContain(
      "Calculating…",
    );
    bridge.accept("server-1", snapshot());
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"2.50"',
    );
  });
  it("ignores warmup rounds and clears rows after a reset", async () => {
    const { h, bridge } = await setup();
    bridge.accept("server-1", snapshot());
    await flush();
    h.runtime.state.liveInfo.isWarmUp = true;
    h.runtime.events.emit("endRound", {
      responseid: "",
      section: "EndRound",
      useteams: false,
      winnerteam: -1,
      winnerplayer: "",
      teams: [],
      players: [],
    });
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).not.toContain(
      "Calculating…",
    );
    const reset = snapshot("reset", "2026-10-06T20:01:00.000Z");
    reset.session!.standings.rows = [];
    bridge.accept("server-1", reset);
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain('"rows":[]');
    expect(h.session.lastManialink(`${page}-update`)).not.toContain(
      '"average":"1.00"',
    );
  });
  it("requires authentication, validates payloads, and scopes updates to the route's server", async () => {
    const { h, registry, bridge } = await setup();
    const app = await buildApp({
      registry,
      log: silentLogger,
      serviceToken: "service-token",
      tickets: new TicketVerifier("secret", h.clock),
      tournament: {
        apiKey: "key",
        db: {} as DbClient,
        queue: null,
        seedingWidget: bridge,
      },
    });
    cleanups.push(() => app.close());
    const url = "/api/tournament/servers/server-1/seeding";
    expect(
      (await app.inject({ method: "POST", url, payload: snapshot() }))
        .statusCode,
    ).toBe(401);
    const post = (body: unknown, route = url) =>
      app.inject({
        method: "POST",
        url: route,
        payload: body as object,
        headers: { authorization: "Bearer key" },
      });
    expect((await post({})).statusCode).toBe(400);
    expect(
      (await post(snapshot(), "/api/tournament/servers/other/seeding"))
        .statusCode,
    ).toBe(400);
    expect((await post(snapshot())).statusCode).toBe(200);
    await flush();
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"1.00"',
    );
  });
  it("recovers through authenticated SDK event requests and releases subscriptions on stop", async () => {
    const { h, registry } = await setup();
    const fetchMock = vi.fn(
      async (_url: unknown, _options?: unknown) =>
        new Response(JSON.stringify(snapshot()), { status: 200 }),
    );
    const bridge = new SeedingWidgetBridge({
      registry,
      webhookUrl: "http://tournament/api/v1/ingest/events",
      apiKey: "key",
      log: silentLogger,
      fetch: fetchMock as typeof fetch,
    });
    cleanups.push(() => bridge.stop());
    h.runtime.events.emit("pluginEvent", {
      plugin: "bnl-seeding",
      name: "requestStandings",
      payload: {},
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/servercontroller/servers/server-1/seeding",
    );
    expect(h.session.lastManialink(`${page}-update`)).toContain(
      '"average":"1.00"',
    );
    bridge.stop();
    h.runtime.events.emit("pluginEvent", {
      plugin: "bnl-seeding",
      name: "requestStandings",
      payload: {},
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
