import type { DbClient } from "@gcp/db";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../core/errors";
import type { ServerRegistry } from "../core/server/server-registry";
import { parse } from "../http/errors";
import type { WebhookQueue } from "./queue";

// Game events bnl-tournament's live stream gets: best-effort and lossy by design
const FORWARDED = [
  "beginMatch",
  "beginMap",
  "beginRound",
  "checkpoint",
  "finish",
  "giveUp",
  "startLine",
  "endMap",
] as const;

const serverParams = z.object({ serverId: z.string().min(1) });
const matchParams = serverParams.extend({ matchId: z.string().min(1) });

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// `Authorization: Bearer <key>`: a plain shared secret, like the service token
function isAuthorized(request: FastifyRequest, apiKey: string): boolean {
  const [scheme, value] = (request.headers.authorization ?? "").split(" ");
  return scheme === "Bearer" && !!value && safeEqual(value, apiKey);
}

export interface TournamentRoutesOptions {
  registry: ServerRegistry;
  db: DbClient;
  queue: WebhookQueue | null;
  apiKey: string;
}

/**
 * What bnl-tournament calls on this service: the live stream (layer 2) and
 * the match discovery and results used to recover a match it missed (layer 3).
 */
export async function tournamentRoutes(
  app: FastifyInstance,
  opts: TournamentRoutesOptions,
) {
  const { registry, db, queue, apiKey } = opts;

  app.addHook("onRequest", async (request) => {
    if (!apiKey || !isAuthorized(request, apiKey)) {
      throw new AppError(
        "Unauthorized",
        "Missing or invalid tournament API key",
      );
    }
  });

  // Matches of one server since `?since=` (ISO, default 24 h ago)
  app.get("/api/tournament/servers/:serverId/matches", async (req) => {
    const { serverId } = parse(serverParams, req.params);
    const sinceParam = (req.query as { since?: string }).since;
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (Number.isNaN(since.getTime())) {
      throw new AppError("BadRequest", "Invalid since");
    }
    const matches = await db.matches.findMany({
      where: { serverId, createdAt: { gte: since }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, mode: true, createdAt: true },
    });
    return { serverId, matches };
  });

  // The archived webhook events of one match, plus the recorder's own rows as a cross-check
  app.get(
    "/api/tournament/servers/:serverId/matches/:matchId/results",
    async (req, reply) => {
      const { serverId, matchId } = parse(matchParams, req.params);
      const match = await db.matches.findFirst({
        where: { id: matchId, serverId },
        select: { id: true, mode: true, serverId: true, createdAt: true },
      });
      if (!match) return reply.status(404).send({ error: "Match not found" });

      const [records, events] = await Promise.all([
        db.records.findMany({
          where: { matchId },
          orderBy: [{ round: "asc" }, { createdAt: "asc" }],
          select: {
            login: true,
            mapUid: true,
            round: true,
            time: true,
            points: true,
            checkpoints: true,
          },
        }),
        queue?.archived(matchId) ?? Promise.resolve([]),
      ]);
      return { match, events, records };
    },
  );

  app.get(
    "/api/tournament/ws/:serverId",
    { websocket: true },
    (socket, request) => {
      const { serverId } = request.params as { serverId: string };
      const runtime = registry.find(serverId);
      if (!runtime) return socket.close(4404, "Unknown server");

      const send = (type: string, data: unknown) => {
        if (socket.readyState !== socket.OPEN) return;
        socket.send(
          JSON.stringify({
            type,
            serverId,
            externalMatchId: runtime.state.currentMatchId,
            at: new Date().toISOString(),
            data,
          }),
        );
      };

      const offs = FORWARDED.map((event) =>
        (
          runtime.events.on as (
            e: string,
            l: (data: unknown) => void,
          ) => () => void
        )(event, (data) => send(event, data)),
      );
      send("hello", { currentMap: runtime.state.liveInfo.currentMap });
      socket.once("close", () => offs.forEach((off) => off()));
    },
  );
}
