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

  // Global command handler for all commands
  bot.onText(/^\/([a-zA-Z0-9_]+)(@\w+)?(\s+(.*))?$/, (msg, match) => {
    if (!match) return;

    const commandName = match[1].toLowerCase();
    const command = commandRegistry.getCommand(commandName);

    if (command) {
      logger.info(
        `Executing command: /${commandName} from user ${msg.from?.id}`
      );
      try {
        command.execute(bot, msg).catch((err) => {
          logger.error(`Error executing command /${commandName}:`, err);
          bot.sendMessage(
            msg.chat.id,
            `❌ An error occurred while processing your command. Please try again later.`
          );
        });
      } catch (error: any) {
        logger.error(`Error executing command /${commandName}:`, error);
        bot.sendMessage(
          msg.chat.id,
          `❌ An error occurred while processing your command. Please try again later.`
        );
      }
    } else {
      logger.warn(`Unknown command: /${commandName}`);
      // Optionally send a message about unknown command
      // bot.sendMessage(msg.chat.id, `Command /${commandName} not recognized. Use /help to see available commands.`);
    }
  });

  // For backwards compatibility, also register individual command handlers
  for (const command of commands) {
    logger.debug(`Also registering command pattern for: /${command.name}`);
    if (command.pattern) {
      bot.onText(command.pattern, (msg) => {
        try {
          command.execute(bot, msg);
        } catch (error: any) {
          logger.error(`Error executing command /${command.name}:`, error);
        }
      });
    }
  }

  // Add unified callback query handler
  bot.on("callback_query", (query) => {
    if (!query.data) return;

    try {
      const handler = commandRegistry.findCallbackHandler(query.data);
      if (handler && handler.handleCallback) {
        logger.debug(
          `Processing callback: ${query.data} with handler: ${handler.name}`
        );
        handler.handleCallback(bot, query).catch((err) => {
          logger.error(
            `Error in handler.handleCallback for ${query.data}:`,
            err
          );
          bot.answerCallbackQuery(query.id, {
            text: "An error occurred while processing your request.",
            show_alert: true,
          });
        });
      } else {
        logger.warn(`No handler found for callback data: ${query.data}`);
        bot.answerCallbackQuery(query.id, {
          text: "This action is not available at the moment.",
          show_alert: true,
        });
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
