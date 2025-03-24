import http from "http";
import { PORT } from "./utils/constants";

export function startServer() {
  const server = http.createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("CopperX Telegram Bot is running!\n");
  });

  server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT} for health checks`);
  });

  return server;
}
