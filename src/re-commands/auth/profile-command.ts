import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { requireAuth } from "../../re-core/middleware";
import * as authService from "../../services/auth.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { getModuleLogger } from "../../re-utils/logger";
import { User } from "../../re-types/auth";

// Create module logger
const logger = getModuleLogger("profile-command");

/**
 * Profile command implementation
 */
export class ProfileCommand implements BotCommand {
  name = "profile";
  description = "View your account profile information";

  /**
   * Execute profile command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Show loading message
        const loadingMsg = await bot.sendMessage(
          chatId,
          "👤 *Fetching your profile...*",
          { parse_mode: "Markdown" }
        );

        // Fetch profile info
        const profile: User = await authService.getUserProfile(session.token);

        // Format profile message
        let message = "👤 *Your Profile*\n\n";
        message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
        message += `*Email:* ${profile.email}\n`;
        message += `*Organization:* ${
          profile.organizationId || "Not provided"
        }\n`;
        message += `*Account Type:* ${profile.type || "Standard"}\n`;
        message += `*Created:* ${new Date(
          profile.createdAt
        ).toLocaleDateString()}\n\n`;

        // Update the loading message with actual data
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔑 KYC Status", callback_data: "action:kyc" },
                { text: "🏠 Main Menu", callback_data: "menu:main" },
              ],
            ],
          },
        });
      } catch (error: any) {
        logger.error(`Profile fetch error:`, error);
        handleApiErrorResponse(bot, chatId, error, "action:profile");
      }
    });
  }

  /**
   * Handle callback queries related to profile
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "action:profile" || callbackData === "menu:profile") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
