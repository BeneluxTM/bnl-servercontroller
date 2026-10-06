# BNL tournament bridge

The GBX service reports match events to bnl-tournament and answers its recovery calls. Code in `apps/gbx-service/src/tournament`; it is off until the variables below are set.

| Variable | Purpose |
|---|---|
| `TOURNAMENT_WEBHOOK_URL` | bnl-tournament's `POST /api/v1/ingest/events`. Empty turns the webhooks off. |
| `TOURNAMENT_WEBHOOK_SECRET` | Shared HMAC secret signing the webhooks. |
| `TOURNAMENT_API_KEY` | Bearer key bnl-tournament sends to `/api/tournament/*`. Empty leaves those routes unregistered. |

## What it does

- **Webhooks:** `match.started`, `map.started`, `round.ended`, `player.eliminated`, `map.ended`, `match.ended` and the pick/ban events `pickban.started`, `pickban.picked`, `pickban.banned` and `pickban.completed`, built from the runtime's event bus. They go through a Redis queue (batches, signed, retried with backoff, dead-lettered after an hour) and are archived per match for 14 days.
- **`GET /api/tournament/servers/:serverId/matches?since=`**: the server's matches since a date, to find a match bnl-tournament never heard about.
- **`GET /api/tournament/servers/:serverId/matches/:matchId/results`**: the archived events plus the recorder's own round rows.
- **`GET /api/tournament/ws/:serverId`** (WebSocket): checkpoints, finishes and round starts, best effort.

bnl-tournament's `SERVERCONTROLLER_URL` must point at the GBX service (port 3100), not the web app: these routes moved with the game connection.

## Pick and ban

All four events come from the `match` plugin's plugin events (`ctx.emit`, SDK 3): `pickBanStarted`, `pickBanMapPicked`, `pickBanMapBanned` and `pickBanCompleted`. They need a `match` plugin version that emits them.

- **Live steps** (`started`, `picked`, `banned`) go out as they happen. The phase runs before the match proper starts, so they carry the match id the server has at that moment, which is not the id of the match played afterwards.
- **`pickban.completed`** finishes before the new match has an id, so it is held and sent right after that match's `match.started`. `pickIndex` is 0-based; the plugin's `position` counts from 1.

Not checked against a real server (see `docs/real-server-testing.md`): the unit tests cover the emitter, queue and routes with fakes.
