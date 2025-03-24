import TelegramBot from "node-telegram-bot-api";
import { SessionService } from "../../core/session.service";
import { getModuleLogger } from "../../utils/logger";
import { NotificationCommand } from "../notification-command";
import { BaseAuthCommand } from "./base-auth-command";

// Create module logger
const logger = getModuleLogger("logout-command");

/**
 * Logout command implementation
 */
export class LogoutCommand extends BaseAuthCommand {
  name = "logout";
  description = "Sign out from your Copperx account";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "action:logout";
  }

  /**
   * Start the auth flow for Logout
   */
  protected async startAuthFlow(
    bot: TelegramBot,
    chatId: number,
    _msg: TelegramBot.Message
  ): Promise<void> {
    if (SessionService.getSession(chatId)) {
      // Clean up notification subscriptions first
      try {
        NotificationCommand.removeNotificationsOnLogout(chatId);
        logger.info(`Notifications removed for user ${chatId}`);
      } catch (error: any) {
        logger.error(`Error removing notifications:`, error);
      }

      // Then delete the session
      SessionService.deleteSession(chatId);

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
   * Process callback data for this command
   */
  protected async processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    if (callbackData === "action:logout") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
