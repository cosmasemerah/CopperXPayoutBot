import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { requireAuth } from "../../re-core/middleware";
import * as authService from "../../services/auth.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { config } from "../../config";
import { getModuleLogger } from "../../re-utils/logger";
import { KYCResponse, KYCStatus } from "../../re-types/auth";

// Create module logger
const logger = getModuleLogger("kyc-command");

/**
 * KYC command implementation
 */
export class KYCCommand implements BotCommand {
  name = "kyc";
  description = "Check your KYC/KYB verification status";

  /**
   * Execute KYC command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Show loading message
        const loadingMsg = await bot.sendMessage(
          chatId,
          "🔍 *Checking your verification status...*",
          { parse_mode: "Markdown" }
        );

        // Fetch KYC status
        const kycResponse: KYCResponse = await authService.getKYCStatus(
          session.token
        );

        // Format KYC status message
        let message = "🔑 *KYC/KYB Verification Status*\n\n";

        if (kycResponse.data && kycResponse.data.length > 0) {
          // Find the most recent KYC record (typically only one should exist)
          const latestKyc = kycResponse.data.reduce((latest, current) => {
            // Use kycDetail.updatedAt for comparison
            return new Date(current.kycDetail.updatedAt) >
              new Date(latest.kycDetail.updatedAt)
              ? current
              : latest;
          }, kycResponse.data[0]);

          message += `*Status:* ${this.formatStatus(latestKyc.status)}\n`;
          message += `*Type:* ${latestKyc.type || "Individual"}\n`;
          message += `*Last Updated:* ${new Date(
            latestKyc.kycDetail.updatedAt
          ).toLocaleDateString()}\n\n`;

          if (latestKyc.status === KYCStatus.REJECTED) {
            message += `*Reason:* ${
              latestKyc.statusUpdates || "No reason provided"
            }\n\n`;
            message +=
              "Please submit a new KYC application on the Copperx website.\n";
          } else if (latestKyc.status === KYCStatus.PENDING) {
            message +=
              "Your verification is being processed. This usually takes 1-2 business days.\n";
          } else if (latestKyc.status === KYCStatus.APPROVED) {
            message += "✅ Your account is fully verified!\n";
          }
        } else {
          message += "*Status:* Not Started\n\n";
          message +=
            "You haven't started the KYC process yet. Please visit the Copperx website to begin verification.\n";
        }

        // Provide support link
        message += `\nNeed help? Contact support at ${config.supportLink}`;

        // Update the loading message with actual data
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Verify on Website",
                  url: "https://app.copperx.io/kyc",
                },
              ],
              [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
            ],
          },
        });
      } catch (error: any) {
        logger.error(`KYC status fetch error:`, error);
        handleApiErrorResponse(bot, chatId, error, "action:kyc");
      }
    });
  }

  /**
   * Format KYC status for display
   */
  private formatStatus(status: KYCStatus): string {
    switch (status) {
      case KYCStatus.APPROVED:
        return "✅ Approved";
      case KYCStatus.PENDING:
        return "⏳ Pending";
      case KYCStatus.REJECTED:
        return "❌ Rejected";
      case KYCStatus.EXPIRED:
        return "⚠️ Expired";
      default:
        return "❓ Unknown";
    }
  }

  /**
   * Handle callback queries related to KYC
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "action:kyc" || callbackData === "menu:kyc") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
