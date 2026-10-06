import "next/dist/server/node-environment-baseline";
import next from "next";
import { setHttpServer, setWebSocketServer } from "next-ws/server";
import { Server } from "node:http";
import { parse } from "node:url";
import { WebSocketServer } from "ws";
import { logger } from "./lib/logger";

const httpServer = new Server();
setHttpServer(httpServer);
const webSocketServer = new WebSocketServer({ noServer: true });
setWebSocketServer(webSocketServer);

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, customServer: true, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpServer
    .on("request", async (req, res) => {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    })
    .listen(port, () => {
      const meta = {
        type: "server",
        module: "startup",
      };
      logger.info({ meta }, `Server is running on http://localhost:${port}`);
    });
});
