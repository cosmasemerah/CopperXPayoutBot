import { startBot } from "./core/bot";
import { startServer } from "./server";
import { registerAllCommands } from "./core/commands";
import { getModuleLogger } from "./utils/logger";

// Create module logger
const logger = getModuleLogger("main");

// Add global unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", { reason, promise });
  // Don't crash the application
});

// Initialize bot and register commands
function init() {
  // Start the bot
  const bot = startBot();

  // Register all commands
  registerAllCommands(bot);

  // Start HTTP server
  startServer();

  logger.info("Application started successfully");
}

// Execute initialization
init();
