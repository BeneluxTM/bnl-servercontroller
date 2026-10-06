import { assignTournamentServer } from "@/actions/tournament";
import { canAssignServer } from "@/services/tournament";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    user: {
      id: "user",
      login: "admin",
      displayName: "Admin",
      admin: true,
      permissions: [],
      groups: [],
      servers: [],
      projects: [],
    },
  },
  servers: vi.fn(),
  audit: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/actions", () => ({
  doServerActionWithAuth: async (
    _roles: string[],
    action: (session: unknown) => Promise<unknown>,
  ) => ({ data: await action(mocks.session) }),
}));
vi.mock("@/lib/plugin-access", () => ({ getAdminServers: mocks.servers }));
vi.mock("@/actions/database/server-only/audit-logs", () => ({
  logAudit: mocks.audit,
}));
vi.mock("@/lib/config", () => ({
  default: {
    TOURNAMENT: { URL: "https://tournament.example", API_KEY: "secret" },
  },
}));
const serverId = "213e5ed9-532d-4749-a399-3d44448f67a9";
const matchId = "123e4567-e89b-42d3-a456-426614174000";
beforeEach(() => {
  mocks.session.user.admin = true;
  mocks.session.user.permissions = [];
  mocks.servers.mockResolvedValue([{ id: serverId, name: "Local" }]);
  mocks.audit.mockReset();
  mocks.fetch.mockReset();
  mocks.fetch.mockResolvedValue(Response.json({ serverId }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("tournament assignments", () => {
  it("uses the signed-in actor and records a successful assignment", async () => {
    await assignTournamentServer({ matchId, serverId, expectedServerId: null });
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe(
      `https://tournament.example/api/v1/servercontroller/matches/${matchId}/server`,
    );
    expect(options.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(options.body)).toEqual({
      serverId,
      expectedServerId: null,
      actorId: "user",
      actorName: "Admin",
    });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("rejects servers unavailable to this user before contacting the tournament", async () => {
    mocks.servers.mockResolvedValue([]);
    await expect(
      assignTournamentServer({ matchId, serverId, expectedServerId: null }),
    ).rejects.toThrow("cannot manage");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("cannot clear another user's assignment", async () => {
    mocks.session.user.admin = false;
    await expect(
      assignTournamentServer({
        matchId,
        serverId: null,
        expectedServerId: serverId,
      }),
    ).rejects.toThrow("cannot manage");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("surfaces assignment conflicts without recording a successful audit", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ error: "The assignment changed" }, { status: 409 }),
    );
    await expect(
      assignTournamentServer({ matchId, serverId, expectedServerId: null }),
    ).rejects.toThrow("assignment changed");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("allows direct and group server admins, but not moderators", () => {
    const session = {
      user: {
        admin: false,
        permissions: [],
        groups: [],
        projects: [],
        servers: [{ id: serverId, role: "Admin" }],
      },
    } as unknown as Session;
    expect(canAssignServer(session, serverId)).toBe(true);
    session.user.servers = [];
    session.user.permissions = [];
    session.user.groups = [
      { id: "group", role: "Admin", servers: [{ id: serverId }] },
    ] as Session["user"]["groups"];
    expect(canAssignServer(session, serverId)).toBe(true);
    session.user.permissions = [];
    session.user.groups[0].role = "Moderator";
    expect(canAssignServer(session, serverId)).toBe(false);
  });
});
