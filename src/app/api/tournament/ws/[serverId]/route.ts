import { getGbxClientManager } from "@/lib/managers/gbxclient-manager";
import { isTournamentRequest } from "@/lib/tournament/service-auth";

/**
 * Layer ② (PLAN.md §3.4, §5.4): the broadcast stream for bnl-tournament —
 * checkpoints, finishes, round starts. Best-effort and lossy by design;
 * nothing that decides a standing travels here. Mirrors
 * /api/ws/live/[id], with a shared-secret check instead of a user token.
 */

export function GET() {
  const headers = new Headers();
  headers.set("Connection", "Upgrade");
  headers.set("Upgrade", "websocket");
  return new Response("Upgrade Required", { status: 426, headers });
}

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

export async function UPGRADE(
  client: import("ws").WebSocket,
  _server: import("ws").WebSocketServer,
  request: import("next/server").NextRequest,
  context: import("next-ws/server").RouteContext<"/api/tournament/ws/[serverId]">,
) {
  const { serverId } = context.params;
  if (!serverId || !isTournamentRequest(request.headers.get("authorization"))) {
    client.close(4401, "Unauthorized");
    return;
  }

  const manager = await getGbxClientManager(serverId);
  const listenerId = `bnl-tournament-ws-${crypto.randomUUID()}`;
  const send = (type: string, data: unknown) => {
    if (client.readyState !== client.OPEN) return;
    client.send(
      JSON.stringify({
        type,
        serverId,
        externalMatchId: manager.currentMatchId,
        at: new Date().toISOString(),
        data,
      }),
    );
  };

  manager.addListeners(
    listenerId,
    Object.fromEntries(
      FORWARDED.map((event) => [event, (data: unknown) => send(event, data)]),
    ),
  );
  send("hello", { currentMap: manager.info.liveInfo.currentMap });

  const cleanup = () => manager.removeListeners(listenerId);
  client.on("close", cleanup);
  client.on("error", cleanup);
}
