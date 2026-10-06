/** BNL tournament bridge: the emitter and the delivery queue, without a game server. */
import assert from "node:assert/strict";
import { test } from "vitest";
import { TypedEventBus } from "../../src/core/events";
import { attachEmitter } from "../../src/tournament/emitter";
import {
  GIVE_UP_AFTER_MS,
  KEYS,
  WebhookQueue,
  backoffMs,
  type QueueRedis,
} from "../../src/tournament/queue";
import type { WebhookEnvelope } from "../../src/tournament/types";

class MemoryRedis implements QueueRedis {
  lists = new Map<string, string[]>();
  counters = new Map<string, number>();
  private list(k: string) {
    if (!this.lists.has(k)) this.lists.set(k, []);
    return this.lists.get(k)!;
  }
  async rpush(k: string, ...v: string[]) {
    return this.list(k).push(...v);
  }
  async lrange(k: string, start: number, stop: number) {
    const l = this.list(k);
    return l.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async ltrim(k: string, start: number) {
    this.lists.set(k, this.list(k).slice(start));
  }
  async expire() {}
  async incr(k: string) {
    const n = (this.counters.get(k) ?? 0) + 1;
    this.counters.set(k, n);
    return n;
  }
}

const player = (n: number, extra: Record<string, unknown> = {}) => ({
  login: `login${n}`,
  accountid: `acc-${n}`,
  name: `P${n}`,
  team: -1,
  rank: n,
  roundpoints: 0,
  mappoints: 0,
  matchpoints: 100 - n,
  bestracetime: 0,
  bestracecheckpoints: [],
  bestlaptime: 0,
  bestlapcheckpoints: [],
  prevracetime: 50_000 + n,
  prevracecheckpoints: [10_000, 20_000],
  ...extra,
});
const scores = (section: string, players: ReturnType<typeof player>[]) => ({
  responseid: "",
  section,
  useteams: false,
  winnerteam: -1,
  winnerplayer: "",
  teams: [],
  players,
});

function fakeRuntime() {
  return {
    serverId: "srv-1",
    events: new TypedEventBus<Record<string, unknown[]>>(),
    state: {
      currentMatchId: "ext-1" as string | null,
      roundNumber: 0 as number | null,
      liveInfo: {
        type: "reversecup",
        mode: "Trackmania/TM_ReverseCup_Online",
        currentMap: "mapA",
        maps: ["mapA", "mapB"],
        isWarmUp: false,
        isPaused: false,
        players: {},
      },
    },
  };
}

async function setup() {
  const redis = new MemoryRedis();
  const posted: WebhookEnvelope[][] = [];
  let respond = 202;
  let clock = 1_800_000_000_000;
  const queue = new WebhookQueue(redis, {
    url: "http://tournament/ingest",
    secret: "s",
    now: () => clock,
    fetch: async (_url, init) => {
      posted.push(JSON.parse(init.body).events);
      return { ok: respond < 300, status: respond };
    },
  });
  const manager = fakeRuntime();
  attachEmitter(manager as never, queue, {
    isEliminated: (p) => -10000 < p && p <= -2000,
    log: () => {},
  });
  const flush = () => new Promise((r) => setImmediate(r));
  return {
    redis,
    queue,
    manager,
    posted,
    flush,
    setResponse: (s: number) => (respond = s),
    advance: (ms: number) => (clock += ms),
  };
}

const queued = (redis: MemoryRedis) =>
  (redis.lists.get(KEYS.queue) ?? []).map(
    (j) => JSON.parse(j) as WebhookEnvelope,
  );

test("a round becomes one round.ended with PreEndRound times and EndRound standings", async () => {
  const { redis, manager, flush } = await setup();
  manager.events.emit(
    "scores",
    scores("PreEndRound", [
      player(1, { roundpoints: 0 }),
      player(2, { prevracetime: -1, roundpoints: 4 }),
    ]),
  );
  manager.events.emit(
    "scores",
    scores("EndRound", [player(1), player(2, { prevracetime: 0 })]),
  );
  await flush();
  const [e] = queued(redis);
  assert.equal(e.type, "round.ended");
  assert.equal(e.seq, 1);
  assert.equal(e.externalMatchId, "ext-1");
  const data = e.data as {
    roundNumber: number;
    players: {
      time: number | null;
      roundPoints: number;
      matchPoints: number;
    }[];
  };
  assert.equal(data.roundNumber, 1, "round 0 → 1, as the controller does");
  assert.equal(data.players[0].time, 50_001);
  assert.equal(data.players[1].time, null, "-1 = no finish");
  assert.equal(data.players[1].roundPoints, 4, "round points from PreEndRound");
  assert.equal(data.players[1].matchPoints, 98);
});

test("warm-up and paused rounds are not emitted", async () => {
  const { redis, manager, flush } = await setup();
  const live = manager.state.liveInfo;
  live.isWarmUp = true;
  manager.events.emit("scores", scores("PreEndRound", [player(1)]));
  manager.events.emit("scores", scores("EndRound", [player(1)]));
  live.isWarmUp = false;
  live.isPaused = true;
  manager.events.emit("scores", scores("PreEndRound", [player(1)]));
  manager.events.emit("scores", scores("EndRound", [player(1)]));
  await flush();
  assert.equal(queued(redis).length, 0);
});

test("elimination emits player.eliminated once per match", async () => {
  const { redis, manager, flush } = await setup();
  for (let i = 0; i < 2; i++) {
    manager.events.emit(
      "scores",
      scores("PreEndRound", [player(1), player(2)]),
    );
    manager.events.emit(
      "scores",
      scores("EndRound", [player(1), player(2, { matchpoints: -2003 })]),
    );
  }
  await flush();
  const types = queued(redis).map((e) => e.type);
  assert.deepEqual(types, ["round.ended", "player.eliminated", "round.ended"]);
  assert.deepEqual(
    queued(redis).map((e) => e.seq),
    [1, 2, 3],
    "seq is monotonic",
  );
});

test("match lifecycle events, and nothing without a current match", async () => {
  const { redis, manager, flush } = await setup();
  manager.events.emit("beginMatch", {
    mode: "m",
    type: "reversecup",
    maps: ["mapA"],
    pointsLimit: 100,
    players: { login1: { login: "login1", accountId: "acc-1", name: "P1" } },
  });
  manager.events.emit("beginMap", "mapA");
  manager.events.emit("scores", scores("EndMap", [player(1)]));
  manager.events.emit("scores", scores("EndMatch", [player(1)]));
  manager.state.currentMatchId = null;
  manager.events.emit("scores", scores("EndMatch", [player(1)]));
  await flush();
  assert.deepEqual(
    queued(redis).map((e) => e.type),
    ["match.started", "map.started", "map.ended", "match.ended"],
  );
  assert.deepEqual((queued(redis)[1].data as { index: number }).index, 0);
});

test("pick/ban completes before the match has an id; sent right after match.started", async () => {
  const { redis, manager, flush } = await setup();
  manager.state.currentMatchId = null; // pick/ban always finishes before this exists
  manager.events.emit("pluginEvent", {
    plugin: "match",
    name: "pickBanCompleted",
    payload: {
      mode: "player",
      picked: [
        {
          uid: "mapA",
          name: "A",
          filename: "A.Map.Gbx",
          position: 1,
          by: "Alice",
        },
      ],
      banned: [{ uid: "mapB", name: "B", filename: "B.Map.Gbx", by: "Bob" }],
    },
  });
  await flush();
  assert.equal(queued(redis).length, 0, "buffered, not sent without a match");

  manager.state.currentMatchId = "ext-2";
  manager.events.emit("beginMatch", {
    mode: "m",
    type: "reversecup",
    maps: ["mapA"],
    pointsLimit: 100,
    players: {},
  });
  await flush();
  assert.deepEqual(
    queued(redis).map((e) => e.type),
    ["match.started", "pickban.completed"],
  );
  const [, pickban] = queued(redis);
  assert.equal(pickban.externalMatchId, "ext-2");
  assert.deepEqual(pickban.data, {
    maps: [
      { mapUid: "mapA", outcome: "picked", by: "Alice", pickIndex: 1 },
      { mapUid: "mapB", outcome: "banned", by: "Bob", pickIndex: null },
    ],
  });
});

test("pick/ban events from other plugins or with a broken payload are ignored", async () => {
  const { redis, manager, flush } = await setup();
  manager.events.emit("pluginEvent", {
    plugin: "other",
    name: "pickBanCompleted",
    payload: {},
  });
  manager.events.emit("pluginEvent", {
    plugin: "match",
    name: "pickBanCompleted",
    payload: "x",
  });
  manager.events.emit("beginMatch", {
    mode: "m",
    type: "reversecup",
    maps: [],
    players: {},
  });
  await flush();
  assert.deepEqual(
    queued(redis).map((e) => e.type),
    ["match.started"],
  );
});

test("delivery: batches, retries reuse the same eventIds, then drains", async () => {
  const { redis, manager, queue, posted, flush, setResponse, advance } =
    await setup();
  for (let i = 0; i < 3; i++)
    manager.events.emit("scores", scores("EndMap", [player(1)]));
  await flush();
  setResponse(503);
  assert.equal(await queue.drainOnce(), "failed");
  assert.equal(await queue.drainOnce(), "waiting", "backing off");
  advance(backoffMs(1));
  setResponse(202);
  assert.equal(await queue.drainOnce(), "sent");
  assert.equal(posted.length, 2);
  assert.deepEqual(
    posted[0].map((e) => e.eventId),
    posted[1].map((e) => e.eventId),
    "the retry carries identical eventIds",
  );
  assert.equal(queued(redis).length, 0);
  assert.equal(await queue.drainOnce(), "idle");
});

test("delivery: gives up after an hour, dead-letters, keeps the archive", async () => {
  const { redis, manager, queue, flush, setResponse, advance } = await setup();
  manager.events.emit("scores", scores("EndMap", [player(1)]));
  await flush();
  setResponse(500);
  let outcome = "";
  for (let i = 0; i < 200 && outcome !== "gave-up"; i++) {
    outcome = await queue.drainOnce();
    advance(60_000);
  }
  assert.equal(outcome, "gave-up");
  assert.equal(queued(redis).length, 0);
  assert.equal(redis.lists.get(KEYS.dead)?.length, 1);
  assert.equal(
    (await queue.archived("ext-1")).length,
    1,
    "layer ③ can still serve it",
  );
  assert.ok(GIVE_UP_AFTER_MS === 3_600_000);
});

test("backoff doubles and caps at 60 s", () => {
  assert.deepEqual(
    [1, 2, 3, 7, 20].map(backoffMs),
    [1000, 2000, 4000, 60000, 60000],
  );
});
