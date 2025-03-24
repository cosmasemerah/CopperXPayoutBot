import TelegramBot from "node-telegram-bot-api";
import { requireAuth } from "../../core/middleware";
import * as authService from "../../services/auth.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { getModuleLogger } from "../../utils/logger";
import { User } from "../../types/auth";
import { BaseAuthCommand } from "./base-auth-command";
import { SessionState } from "../../core/session.service";

// Create module logger
const logger = getModuleLogger("profile-command");

/**
 * Interface for profile session state
 */
interface ProfileSessionState extends SessionState {
  currentAction: "login";
  profileAction: string;
}

/**
 * Profile command implementation
 */
export class ProfileCommand extends BaseAuthCommand {
  name = "profile";
  description = "View your account profile information";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "action:profile";
  }

  /**
   * Start the auth flow for Profile
   */
  protected async startAuthFlow(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    requireAuth(bot, chatId, async (session) => {
      try {
        // Update session state
        this.updateSessionData<ProfileSessionState>(chatId, {
          currentAction: "login",
          profileAction: "view",
        });

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
   * Process callback data for this command
   */
  protected async processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    if (callbackData === "action:profile" || callbackData === "menu:profile") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
