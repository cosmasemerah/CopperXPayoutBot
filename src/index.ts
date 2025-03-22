import { startBot } from "./bot";
import { startServer } from "./server";

// Add global unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
  // Don't crash the application
});

// Start both the bot and HTTP server
startBot();
startServer();
