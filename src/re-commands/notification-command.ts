import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../re-core/command";
import { requireAuth } from "../re-core/middleware";
import { getModuleLogger } from "../re-utils/logger";
import * as notificationService from "../services/notification.service";
import { ExtendedSession } from "../session";
import { handleApiErrorResponse } from "../re-utils/error-handler";

// Create module logger
const logger = getModuleLogger("notification-command");

// Track active notification subscriptions by chat ID
const activeSubscriptions = new Map<number, any>();

/**
 * Notification command implementation
 * Handles subscription to deposit notifications
 */
export class NotificationCommand implements BotCommand {
  name = "notifications";
  description = "Manage deposit notifications";

  /**
   * Execute notification command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      await this.manageNotifications(bot, chatId, session);
    });
  }

  /**
   * Handle callback queries
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "action:notifications") {
      requireAuth(bot, chatId, async (session) => {
        await this.manageNotifications(bot, chatId, session);
      });
    }
  }

  /**
   * Manage notifications - enable or disable based on current status
   */
  private async manageNotifications(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    try {
      const isSubscribed = activeSubscriptions.has(chatId);

      if (isSubscribed) {
        // Unsubscribe if already subscribed
        this.unsubscribeFromNotifications(chatId);
        bot.sendMessage(
          chatId,
          "🔕 Deposit notifications have been turned off.\n\nYou can turn them back on anytime with /notifications.",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
              ],
            },
          }
        );
      } else {
        // Subscribe to notifications
        await this.subscribeToNotifications(bot, chatId, session);
      }
    } catch (error: any) {
      logger.error(`Notification management error:`, error);
      handleApiErrorResponse(bot, chatId, error, "action:notifications");
    }
  }

  /**
   * Subscribe to deposit notifications
   */
  private async subscribeToNotifications(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    try {
      // First show loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🔄 *Setting up deposit notifications...*",
        { parse_mode: "Markdown" }
      );

      // Set up notification subscription
      const channel = notificationService.subscribeToDepositNotifications(
        chatId,
        session.token,
        session.organizationId || "",
        bot
      );

      // Save the subscription if successful
      if (channel) {
        activeSubscriptions.set(chatId, channel);
        logger.info(`Deposit notifications set up for chat ${chatId}`);
      }

      // Delete the loading message
      bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {
        // Ignore errors if message already deleted
      });
    } catch (error: any) {
      logger.error(`Notification subscription error:`, error);
      handleApiErrorResponse(bot, chatId, error, "action:notifications");
    }
  }

  /**
   * Unsubscribe from deposit notifications
   */
  private unsubscribeFromNotifications(chatId: number): void {
    try {
      const channel = activeSubscriptions.get(chatId);
      if (channel) {
        // Unbind all events and unsubscribe
        channel.unbind_all?.();
        channel.unsubscribe?.();
        activeSubscriptions.delete(chatId);
        logger.info(`Deposit notifications removed for chat ${chatId}`);
      }
    } catch (error: any) {
      logger.error(`Notification unsubscribe error:`, error);
    }
  }

  /**
   * Initialize notifications on login
   * This should be called after user login is successful
   */
  public static async initNotificationsOnLogin(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    try {
      // Check if already subscribed
      if (activeSubscriptions.has(chatId)) {
        return;
      }

      const command = new NotificationCommand();
      await command.subscribeToNotifications(bot, chatId, session);
    } catch (error: any) {
      logger.error(`Notification initialization error:`, error);
    }
  }

  /**
   * Remove notifications on logout
   * This should be called when user logs out
   */
  public static removeNotificationsOnLogout(chatId: number): void {
    try {
      const command = new NotificationCommand();
      command.unsubscribeFromNotifications(chatId);
    } catch (error: any) {
      logger.error(`Notification removal error:`, error);
    }
  }
}
