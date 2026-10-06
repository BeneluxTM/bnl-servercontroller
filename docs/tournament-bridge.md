# BNL tournament bridge

The GBX service reports match events to bnl-tournament and answers its recovery calls. Code in `apps/gbx-service/src/tournament`; it is off until the variables below are set.

| Variable | Purpose |
|---|---|
| `TOURNAMENT_WEBHOOK_URL` | bnl-tournament's `POST /api/v1/ingest/events`. Empty turns the webhooks off. |
| `TOURNAMENT_WEBHOOK_SECRET` | Shared HMAC secret signing the webhooks. |
| `TOURNAMENT_API_KEY` | Bearer key bnl-tournament sends to `/api/tournament/*`. Empty leaves those routes unregistered. |

## What it does

- **Webhooks:** `match.started`, `map.started`, `round.ended`, `player.eliminated`, `map.ended` and `match.ended`, built from the runtime's event bus. They go through a Redis queue (batches, signed, retried with backoff, dead-lettered after an hour) and are archived per match for 14 days.
- **`GET /api/tournament/servers/:serverId/matches?since=`**: the server's matches since a date, to find a match bnl-tournament never heard about.
- **`GET /api/tournament/servers/:serverId/matches/:matchId/results`**: the archived events plus the recorder's own round rows.
- **`GET /api/tournament/ws/:serverId`** (WebSocket): checkpoints, finishes and round starts, best effort.

bnl-tournament's `SERVERCONTROLLER_URL` must point at the GBX service (port 3100), not the web app: these routes moved with the game connection.

## Not ported

`pickban.completed` is not sent. The match plugin now runs in a sandbox and cannot reach the event bus, so the emitter never learns the pick/ban result. Doing it needs a bus event or a plugin capability for it.

Not checked against a real server (see `docs/real-server-testing.md`): the unit tests cover the emitter, queue and routes with fakes.
