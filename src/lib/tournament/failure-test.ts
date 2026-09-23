/**
 * BNL failure-test harness (PLAN.md §8.5). Drives the REAL emitter and
 * queue (./emitter, ./queue) with a simulated game server playing a
 * deterministic reverse-cup match, into a real bnl-tournament, and prints
 * the resulting standings from its public API. Run each scenario against
 * its own tournament match and compare: standings must be identical.
 *
 *   npx tsx src/lib/tournament/failure-test.ts <scenario>
 *
 * Scenarios:
 *   baseline   normal delivery
 *   kill       slow match (2 s/round); kill + restart the tournament
 *              process from outside meanwhile — ① retries must cover it
 *   replay     after the match, re-post every batch verbatim (eventId dedupe)
 *   reorder    bypass the queue; post all events in reverse order (seq)
 *   sever-ws   close the layer-② socket mid-match and refuse reconnects
 *              for SEVER_MS — ② is lossy, ① unaffected
 *   blackhole  the ingest endpoint never answers; the queue clock is
 *              fast-forwarded past the 1 h give-up, then ③ (the stand-in
 *              servercontroller below, serving the same per-match archive)
 *              must restore everything via tournament's reconciliation
 *
 * Env: TOURNAMENT_URL, TOURNAMENT_WEBHOOK_SECRET, TOURNAMENT_API_KEY,
 *      REDIS_URI, SERVER_ID, MATCH_ID, PLAYERS ("accountId:name,..."),
 *      FAKE_SC_PORT (stand-in servercontroller, default 3098), SEVER_MS,
 *      START_DELAY_MS (wait before play, so layer ② can connect).
 *
 * Not for production: it writes to the same Redis keys the emitter uses.
 */
import Redis from "ioredis";
import { EventEmitter } from "node:events";
import http from "node:http";
import { WebSocketServer } from "ws";
import { attachEmitter } from "./emitter";
import { KEYS, WebhookQueue, signBody } from "./queue";

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`Missing env ${k}`);
  return v;
};
const TOURNAMENT_URL = env("TOURNAMENT_URL", "http://localhost:3011");
const SECRET = env("TOURNAMENT_WEBHOOK_SECRET");
const API_KEY = env("TOURNAMENT_API_KEY");
const SERVER_ID = env("SERVER_ID");
const MATCH_ID = env("MATCH_ID");
const SC_PORT = Number(env("FAKE_SC_PORT", "3098"));
const SEVER_MS = Number(env("SEVER_MS", "60000"));
// Time for bnl-tournament's layer-② socket to (re)connect to the stand-in
// servercontroller before play starts — its reconnect backoff caps at 30 s.
const START_DELAY_MS = Number(env("START_DELAY_MS", "0"));
const PLAYERS = env("PLAYERS")
  .split(",")
  .map((s) => {
    const [accountId, name] = s.split(":");
    return {
      accountId,
      name,
      login: Buffer.from(accountId).toString("base64url").slice(0, 22),
    };
  });
const scenario = process.argv[2] ?? "baseline";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(`[${scenario}]`, ...a);

// ---------------------------------------------------------------------
// Simulated game server: a fake GbxClientManager firing the same events
// ---------------------------------------------------------------------

const REPARTITION: Record<number, number[]> = {
  4: [0, 4, 7, 10],
  3: [2, 6, 10],
  2: [4, 8],
};
const DNF_LOSS = 12;

function simulatedRounds() {
  // Deterministic: finishing order rotates each round; the last-placed
  // player DNFs every third round.
  const points = new Map(PLAYERS.map((p) => [p.accountId, 100]));
  const alive = () => PLAYERS.filter((p) => points.get(p.accountId)! > 0);
  const eliminatedOrder: string[] = [];
  const rounds: {
    results: {
      p: (typeof PLAYERS)[number];
      time: number | null;
      lost: number;
    }[];
  }[] = [];
  let n = 0;
  while (alive().length > 1 && n < 200) {
    const field = alive();
    const order = field.map((_, i) => field[(i + n) % field.length]);
    const table = REPARTITION[field.length] ?? REPARTITION[2];
    const results = order.map((p, i) => {
      const dnf = i === order.length - 1 && n % 3 === 2;
      const lost = dnf ? DNF_LOSS : table[i];
      return { p, time: dnf ? null : 50_000 + i * 250 + n, lost };
    });
    for (const r of results) {
      const left = points.get(r.p.accountId)! - r.lost;
      points.set(r.p.accountId, left);
      if (left <= 0) eliminatedOrder.push(r.p.accountId);
    }
    rounds.push({ results });
    n++;
  }
  return { rounds, points, eliminatedOrder };
}

function gbxPlayer(
  p: (typeof PLAYERS)[number],
  extra: Record<string, unknown>,
) {
  return {
    login: p.login,
    accountid: p.accountId,
    name: p.name,
    team: -1,
    rank: 0,
    roundpoints: 0,
    mappoints: 0,
    matchpoints: 0,
    bestracetime: 0,
    bestracecheckpoints: [],
    bestlaptime: 0,
    bestlapcheckpoints: [],
    prevracetime: -1,
    prevracecheckpoints: [],
    ...extra,
  };
}

async function playMatch(
  manager: EventEmitter & Record<string, unknown>,
  externalMatchId: string,
  roundDelayMs: number,
  onRound?: (n: number) => Promise<void> | void,
) {
  const { rounds } = simulatedRounds();
  const scores = (section: string, players: unknown[]) => ({
    responseid: "",
    section,
    useteams: false,
    winnerteam: -1,
    winnerplayer: "",
    teams: [],
    players,
  });
  const live = (manager.info as { liveInfo: Record<string, unknown> }).liveInfo;
  manager.currentMatchId = externalMatchId;
  manager.roundNumber = 0;
  manager.emit("beginMatch", {
    ...live,
    players: Object.fromEntries(
      PLAYERS.map((p) => [
        p.login,
        { login: p.login, accountId: p.accountId, name: p.name },
      ]),
    ),
  });
  manager.emit("beginMap", "bnl-ft-map-A");

  const pts = new Map(PLAYERS.map((p) => [p.accountId, 100]));
  for (const [i, round] of rounds.entries()) {
    const pre = round.results.map((r, rank) =>
      gbxPlayer(r.p, {
        rank: rank + 1,
        roundpoints: -r.lost,
        prevracetime: r.time ?? -1,
        prevracecheckpoints: r.time ? [Math.round(r.time / 2)] : [],
        matchpoints: pts.get(r.p.accountId),
      }),
    );
    manager.emit("scores", scores("PreEndRound", pre));
    for (const r of round.results)
      pts.set(r.p.accountId, pts.get(r.p.accountId)! - r.lost);
    manager.roundNumber =
      (manager.roundNumber as number) === 0 ? 1 : manager.roundNumber;
    const end = PLAYERS.map((p) => {
      const left = pts.get(p.accountId)!;
      return gbxPlayer(p, {
        rank: 0,
        matchpoints: left <= 0 ? -2000 - (PLAYERS.indexOf(p) + 1) : left,
        prevracetime: round.results.find((r) => r.p === p)?.time ?? -1,
      });
    });
    manager.emit("scores", scores("EndRound", end));
    manager.roundNumber = (manager.roundNumber as number) + 1;
    manager.emit("checkpoint", {
      login: PLAYERS[0].login,
      accountid: PLAYERS[0].accountId,
      racetime: 25_000,
      checkpointinrace: 0,
    });
    await onRound?.(i + 1);
    await sleep(roundDelayMs);
  }

  // Final ranks: survivor first, then reverse elimination order.
  const { eliminatedOrder } = simulatedRounds();
  const survivor = PLAYERS.find((p) => !eliminatedOrder.includes(p.accountId))!;
  const ranking = [survivor.accountId, ...[...eliminatedOrder].reverse()];
  manager.emit(
    "scores",
    scores(
      "EndMatch",
      ranking.map((acc, i) =>
        gbxPlayer(PLAYERS.find((p) => p.accountId === acc)!, {
          rank: i + 1,
          matchpoints: i === 0 ? pts.get(acc) : -2000 - i,
        }),
      ),
    ),
  );
  return rounds.length;
}

// ---------------------------------------------------------------------
// Stand-in servercontroller: layer ③ and layer ② endpoints
// ---------------------------------------------------------------------

function startFakeServercontroller(
  queue: WebhookQueue,
  externalMatchId: string,
  startedAt: Date,
) {
  let refuseWs = false;
  const auth = (h: string | undefined) => h === `Bearer ${API_KEY}`;
  const server = http.createServer(async (req, res) => {
    if (!auth(req.headers.authorization)) {
      res.writeHead(401).end();
      return;
    }
    const url = new URL(req.url!, "http://x");
    const json = (body: unknown) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === `/api/tournament/servers/${SERVER_ID}/matches`) {
      json({
        serverId: SERVER_ID,
        matches: [
          { id: externalMatchId, mode: "reversecup", createdAt: startedAt },
        ],
      });
    } else if (
      url.pathname ===
      `/api/tournament/servers/${SERVER_ID}/matches/${externalMatchId}/results`
    ) {
      json({
        match: { id: externalMatchId },
        events: await queue.archived(externalMatchId),
        records: [],
      });
    } else {
      res.writeHead(404).end();
    }
  });
  const wss = new WebSocketServer({ noServer: true });
  // Only sockets opened for this scenario's server get its broadcasts.
  const sockets = new Set<import("ws").WebSocket>();
  let wsConnects = 0;
  server.on("upgrade", (req, socket, head) => {
    const forThisServer = req.url === `/api/tournament/ws/${SERVER_ID}`;
    if (refuseWs || !auth(req.headers.authorization) || !forThisServer) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wsConnects++;
      sockets.add(ws);
      ws.on("close", () => sockets.delete(ws));
    });
  });
  server.listen(SC_PORT);
  return {
    broadcast: (type: string, data: unknown) => {
      for (const ws of sockets)
        ws.send(
          JSON.stringify({
            type,
            serverId: SERVER_ID,
            externalMatchId,
            at: new Date().toISOString(),
            data,
          }),
        );
    },
    sever: () => {
      refuseWs = true;
      for (const ws of sockets) ws.terminate();
    },
    heal: () => (refuseWs = false),
    wsConnects: () => wsConnects,
    close: () => {
      for (const ws of sockets) ws.terminate();
      server.close();
    },
  };
}

// ---------------------------------------------------------------------

async function standings() {
  const res = await fetch(`${TOURNAMENT_URL}/api/v1/matches/${MATCH_ID}`);
  if (!res.ok) return null;
  const m = (await res.json()) as {
    state: string;
    participants: {
      name: string;
      finalRank: number | null;
      leaguePoints: number | null;
      pointsRemaining: number | null;
    }[];
  };
  return {
    state: m.state,
    table: m.participants
      .map(
        (p) =>
          `${p.name}:${p.finalRank}/${p.leaguePoints}/${p.pointsRemaining}`,
      )
      .sort()
      .join(" "),
  };
}

async function waitForCompleted(timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < until) {
    last = await standings().catch(() => null);
    if (last?.state === "COMPLETED") return last;
    await sleep(1000);
  }
  return last;
}

async function main() {
  const redis = new Redis(env("REDIS_URI", "redis://localhost:6540"));
  for (const k of await redis.keys("bnl:tournament:webhook:*"))
    await redis.del(k);

  const externalMatchId = `ft-${scenario}-${Date.now()}`;
  const startedAt = new Date();
  let clockOffset = 0;
  let blackhole = scenario === "blackhole";
  const posted: string[] = [];

  const queue = new WebhookQueue(redis, {
    url: `${TOURNAMENT_URL}/api/v1/ingest/events`,
    secret: SECRET,
    now: () => Date.now() + clockOffset,
    log: (level, msg, extra) => log(level, msg, extra ?? ""),
    fetch: async (url, init) => {
      if (blackhole) {
        // Accepts nothing, answers nothing — then the client's timeout.
        await sleep(2000);
        throw new Error("timeout (black-holed)");
      }
      posted.push(init.body);
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: res.ok, status: res.status };
    },
  });

  const manager = new EventEmitter() as EventEmitter & Record<string, unknown>;
  Object.assign(manager, {
    currentMatchId: null,
    roundNumber: 0,
    info: {
      liveInfo: {
        type: "reversecup",
        mode: "Trackmania/TM_ReverseCup_Online",
        currentMap: "bnl-ft-map-A",
        maps: ["bnl-ft-map-A"],
        isWarmUp: false,
        isPaused: false,
        pointsLimit: 100,
        players: {},
      },
    },
    getServerId: () => SERVER_ID,
    addListeners: (
      _id: string,
      l: Record<string, (...a: unknown[]) => void>,
    ) => {
      for (const [e, h] of Object.entries(l)) manager.on(e, h);
    },
  });
  attachEmitter(manager as never, queue, {
    isEliminated: (p) => -10000 < p && p <= -2000,
    log: (l, m) => log(l, m),
  });
  const sc = startFakeServercontroller(queue, externalMatchId, startedAt);
  manager.on("checkpoint", (d) => sc.broadcast("checkpoint", d));

  if (scenario !== "reorder") queue.start();
  if (START_DELAY_MS) {
    log(`waiting ${START_DELAY_MS / 1000}s for layer ② to connect`);
    await sleep(START_DELAY_MS);
  }

  const delay =
    scenario === "kill" ? 2000 : scenario === "sever-ws" ? 1500 : 150;
  const rounds = await playMatch(manager, externalMatchId, delay, async (n) => {
    if (scenario === "sever-ws" && n === 3) {
      log(`severing layer-② socket for ${SEVER_MS / 1000}s`);
      sc.sever();
      setTimeout(() => {
        sc.heal();
        log("layer-② socket allowed again");
      }, SEVER_MS);
    }
  });
  log(`played ${rounds} rounds`);
  await sleep(500);

  if (scenario === "reorder") {
    const events = (await queue.archived(externalMatchId)).reverse();
    for (let i = 0; i < events.length; i += 7) {
      const body = JSON.stringify({ events: events.slice(i, i + 7) });
      const res = await fetch(`${TOURNAMENT_URL}/api/v1/ingest/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BNL-Signature": signBody(
            SECRET,
            body,
            Math.floor(Date.now() / 1000),
          ),
        },
        body,
      });
      log("reordered batch →", res.status);
    }
  }

  if (scenario === "blackhole") {
    // Let it fail a few times for real, then jump the queue's clock past
    // the one-hour give-up instead of waiting an hour.
    await sleep(5000);
    clockOffset = 61 * 60 * 1000;
    const until = Date.now() + 120_000;
    while (Date.now() < until && (await redis.llen(KEYS.queue)) > 0)
      await sleep(500);
    log("queue gave up; dead-lettered:", await redis.llen(KEYS.dead));
    blackhole = false; // endpoint back — but the emitter has moved on
    log("waiting for tournament reconciliation (layer ③) to restore it…");
  } else {
    const until = Date.now() + 180_000;
    while (Date.now() < until && (await redis.llen(KEYS.queue)) > 0)
      await sleep(500);
  }

  if (scenario === "replay") {
    for (const body of posted) {
      const res = await fetch(`${TOURNAMENT_URL}/api/v1/ingest/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BNL-Signature": signBody(
            SECRET,
            body,
            Math.floor(Date.now() / 1000),
          ),
        },
        body,
      });
      const r = (await res.json()) as { accepted: number; duplicates: number };
      log(
        `replayed batch → accepted ${r.accepted}, duplicates ${r.duplicates}`,
      );
    }
  }

  const result = await waitForCompleted(
    scenario === "blackhole" ? 200_000 : 60_000,
  );
  if (scenario === "sever-ws")
    log("layer-② connections seen:", sc.wsConnects());
  console.log(`RESULT ${scenario} ${JSON.stringify(result)}`);
  queue.stop();
  sc.close();
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
