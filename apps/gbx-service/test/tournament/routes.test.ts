import type { DbClient } from "@gcp/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerRegistry } from "../../src/core/server/server-registry";
import { buildApp } from "../../src/http/app";
import { TicketVerifier } from "../../src/http/ws/ticket-verifier";
import { createHarness } from "../fakes/harness";
import { silentLogger } from "../fakes/logger";

const API_KEY = "tournament-key";
let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

async function setup(apiKey = API_KEY) {
  const h = await createHarness();
  const registry = new ServerRegistry({
    servers: h.servers,
    createRuntime: () => h.runtime,
    log: silentLogger,
  });
  registry.add(h.runtime.serverId);
  const db = {
    matches: {
      findMany: vi.fn(
        async (_args: { where: { createdAt: { gte: Date } } }) => [
          { id: "m1" },
        ],
      ),
      findFirst: vi.fn(async () => null),
    },
    records: { findMany: vi.fn(async () => []) },
  };
  const app = await buildApp({
    registry,
    log: silentLogger,
    serviceToken: "service-token-".padEnd(40, "x"),
    tickets: new TicketVerifier("ticket-secret-".padEnd(40, "y"), h.clock),
    tournament: { apiKey, db: db as unknown as DbClient, queue: null },
  });
  close = () => app.close();
  const get = (url: string, key: string | null = API_KEY) =>
    app.inject({
      method: "GET",
      url,
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });
  return { app, db, get, serverId: h.runtime.serverId };
}

describe("tournament routes", () => {
  it("rejects a missing or wrong key", async () => {
    const { get, serverId } = await setup();
    const url = `/api/tournament/servers/${serverId}/matches`;
    expect((await get(url, null)).statusCode).toBe(401);
    expect((await get(url, "nope")).statusCode).toBe(401);
  });

  it("is not registered without an API key", async () => {
    const { get, serverId } = await setup("");
    expect(
      (await get(`/api/tournament/servers/${serverId}/matches`)).statusCode,
    ).toBe(404);
  });

  it("lists the matches since a date", async () => {
    const { get, db, serverId } = await setup();
    const res = await get(
      `/api/tournament/servers/${serverId}/matches?since=2026-01-01T00:00:00Z`,
    );
    expect(res.json()).toEqual({ serverId, matches: [{ id: "m1" }] });
    expect(
      (
        db.matches.findMany.mock.calls[0]![0] as {
          where: { createdAt: { gte: Date } };
        }
      ).where.createdAt.gte,
    ).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("rejects an invalid since", async () => {
    const { get, serverId } = await setup();
    expect(
      (await get(`/api/tournament/servers/${serverId}/matches?since=soon`))
        .statusCode,
    ).toBe(400);
  });

  it("returns 404 for an unknown match", async () => {
    const { get, serverId } = await setup();
    const res = await get(
      `/api/tournament/servers/${serverId}/matches/nope/results`,
    );
    expect(res.statusCode).toBe(404);
  });
});
