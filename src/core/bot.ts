import TelegramBot from "node-telegram-bot-api";
import { config } from "../config";
import { commandRegistry } from "./command";
import { SessionService } from "./session.service";
import { SESSION_REFRESH_INTERVAL } from "../utils/constants";
import { getModuleLogger } from "../utils/logger";

// Create module logger
const logger = getModuleLogger("bot");

/**
 * Start Telegram bot
 */
export function startBot(): TelegramBot {
  logger.info("Starting Telegram bot...");

  // Initialize the bot
  const bot = new TelegramBot(config.botToken, {
    polling: true,
    filepath: false, // Disable automatic file downloading
  });

  // Log bot info
  bot
    .getMe()
    .then((info) => {
      logger.info(`Bot started: @${info.username} (ID: ${info.id})`);
    })
    .catch((err) => {
      logger.error("Failed to get bot info:", err);
    });

  // Setup global error handler
  bot.on("polling_error", (err) => {
    logger.error("Polling error:", err);
  });

  // Set up scheduled session refresh
  setInterval(() => {
    SessionService.scanAndRefreshSessions();
  }, SESSION_REFRESH_INTERVAL);

  // Register command handlers
  const commands = commandRegistry.getCommands();
  logger.info(`Registering ${commands.length} commands`);

  for (const command of commands) {
    logger.debug(`Registering command: /${command.name}`);
    bot.onText(command.pattern as RegExp, (msg) => {
      try {
        command.execute(bot, msg);
      } catch (error: any) {
        logger.error(`Error executing command /${command.name}:`, error);
        bot.sendMessage(
          msg.chat.id,
          `❌ An error occurred while processing your command. Please try again later.`
        );
      }
    });
  }

  // Add unified callback query handler
  bot.on("callback_query", (query) => {
    if (!query.data) return;

    try {
      const handler = commandRegistry.findCallbackHandler(query.data);
      if (handler && handler.handleCallback) {
        handler.handleCallback(bot, query);
      } else {
        logger.warn(`No handler found for callback data: ${query.data}`);
      }
    } catch (error: any) {
      logger.error(`Error handling callback query:`, error);
      bot.answerCallbackQuery(query.id, {
        text: "An error occurred. Please try again.",
        show_alert: true,
      });
    }
  });

  // Error handling for bot API errors
  bot.on("error", (error) => {
    logger.error(`Bot error:`, error);
  });

  return bot;
}
