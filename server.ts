import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as IOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const io = new IOServer(server, {
    cors: { origin: process.env.NEXTAUTH_URL ?? "*" }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
      // no-op: presence/live updates will hook in here later
    });
  });

  // expose io so server-side code can emit live updates when wired up
  (globalThis as typeof globalThis & { io?: IOServer }).io = io;

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (${dev ? "development" : "production"})`);
  });
});
