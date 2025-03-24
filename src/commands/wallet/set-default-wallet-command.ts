import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { requireAuth } from "../../core/middleware";
import * as walletService from "../../services/wallet.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { getModuleLogger } from "../../utils/logger";
import { Wallet } from "../../types/wallet";

// Create module logger
const logger = getModuleLogger("set-default-wallet-command");

/**
 * Set Default Wallet command implementation
 */
export class SetDefaultWalletCommand implements BotCommand {
  name = "setdefault";
  description = "Set your default wallet for transactions";

  /**
   * Execute set default wallet command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Show loading message
        const loadingMsg = await bot.sendMessage(
          chatId,
          "⚙️ *Loading your wallets...*",
          { parse_mode: "Markdown" }
        );

        // Fetch wallets
        const wallets = await walletService.getWallets(session.token);

        if (wallets.length === 0) {
          bot.editMessageText("❌ You don't have any wallets available.", {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
              ],
            },
          });
          return;
        }

        // Format wallet selection message
        let message = "⚙️ *Set Default Wallet*\n\n";
        message += "Please select the wallet you want to set as default:\n\n";

        // Create wallet selection keyboard
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        wallets.forEach((wallet: Wallet) => {
          const isDefault = wallet.isDefault ? " (Current Default)" : "";
          // Use network as the display name since name doesn't exist
          const walletName = `${wallet.network}${isDefault}`;

          keyboard.push([
            {
              text: walletName,
              callback_data: `setdefault:wallet:${wallet.id}`,
            },
          ]);
        });

        // Add cancel button
        keyboard.push([
          { text: "❌ Cancel", callback_data: "setdefault:cancel" },
        ]);

        // Update the loading message with wallet selection
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
      } catch (error: any) {
        logger.error(`Wallet fetch error:`, error);
        handleApiErrorResponse(
          bot,
          chatId,
          error as Error,
          "action:setdefault"
        );
      }
    });
  }

  /**
   * Handle callback queries related to setting default wallet
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

    if (
      callbackData === "action:setdefault" ||
      callbackData === "wallet:setdefault"
    ) {
      this.execute(bot, query.message as TelegramBot.Message);
      return;
    }

    // Handle wallet selection
    if (callbackData.startsWith("setdefault:wallet:")) {
      const walletId = callbackData.split(":")[2];

      requireAuth(bot, chatId, async (session) => {
        try {
          // Show loading message
          const loadingMsg = await bot.sendMessage(
            chatId,
            "⏳ *Setting default wallet...*",
            { parse_mode: "Markdown" }
          );

          // Set default wallet
          await walletService.setDefaultWallet(session.token, walletId);

          // Display success message
          bot.editMessageText(
            "✅ *Default Wallet Updated*\n\n" +
              "Your default wallet has been successfully updated. " +
              "This wallet will now be used for transactions unless you specify otherwise.",
            {
              chat_id: chatId,
              message_id: loadingMsg.message_id,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "💰 View Balance",
                      callback_data: "action:balance",
                    },
                  ],
                  [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
                ],
              },
            }
          );
        } catch (error: any) {
          logger.error(`Set default wallet error:`, error);
          handleApiErrorResponse(
            bot,
            chatId,
            error as Error,
            "action:setdefault"
          );
        }
      });
    }

    // Handle cancellation
    if (callbackData === "setdefault:cancel") {
      bot.sendMessage(chatId, "⚙️ Default wallet setting canceled.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
          ],
        },
      });
    }
  }
}
