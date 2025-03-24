import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { getSession, deleteSession } from "../../session";
import { getModuleLogger } from "../../re-utils/logger";
import { NotificationCommand } from "../notification-command";

// Create module logger
const logger = getModuleLogger("logout-command");

/**
 * Logout command implementation
 */
export class LogoutCommand implements BotCommand {
  name = "logout";
  description = "Sign out from your Copperx account";

  /**
   * Execute logout command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    if (getSession(chatId)) {
      // Clean up notification subscriptions first
      try {
        NotificationCommand.removeNotificationsOnLogout(chatId);
        logger.info(`Notifications removed for user ${chatId}`);
      } catch (error: any) {
        logger.error(`Error removing notifications:`, error);
      }

      // Then delete the session
      deleteSession(chatId);

      bot.sendMessage(chatId, "You have been successfully logged out. 👋", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Login Again", callback_data: "action:login" }],
          ],
        },
      });
    } else {
      bot.sendMessage(chatId, "You are not logged in.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Login", callback_data: "action:login" }],
          ],
        },
      });
    }
  }

  /**
   * Handle callback queries related to logout
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "action:logout") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
