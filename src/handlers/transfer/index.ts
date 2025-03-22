import TelegramBot from "node-telegram-bot-api";
import { getSession } from "../../session";
import { createAmountKeyboard } from "../../utils/keyboard";
import { registerEmailTransferHandlers } from "./email.transfer.handler";
import { registerWalletTransferHandlers } from "./wallet.transfer.handler";
import { registerDepositHandlers } from "./deposit.handler";
import { registerBankWithdrawalHandlers } from "./bank.withdrawal.handler";
import { registerBatchTransferHandlers } from "./batch.transfer.handler";
import {
  registerHistoryHandlers,
  displayTransactionHistory,
} from "./history.handler";
import { registerTransferMenuHandlers } from "./menu.handler";

/**
 * Register all transfer-related handlers
 * @param bot The Telegram bot instance
 */
export function registerTransferHandlers(bot: TelegramBot): void {
  // Register individual handlers
  registerEmailTransferHandlers(bot);
  registerWalletTransferHandlers(bot);
  registerDepositHandlers(bot);
  registerBankWithdrawalHandlers(bot);
  registerHistoryHandlers(bot);
  registerTransferMenuHandlers(bot);
  registerBatchTransferHandlers(bot);

  // Handle transfer menu callbacks
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      bot.deleteMessage(chatId, messageId);
      return;
    }

    // Handle transfer menu callbacks
    if (callbackData.startsWith("menu:transfer:")) {
      const action = callbackData.split(":")[2];
      bot.answerCallbackQuery(query.id);

      switch (action) {
        case "email":
          bot.sendMessage(
            chatId,
            "📧 *Send via Email*\n\n" +
              "Please enter the recipient's email address:",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "sendemail:cancel" }],
                ],
              },
            }
          );
          break;

        case "wallet":
          bot.sendMessage(
            chatId,
            "🔑 *Send to Wallet*\n\n" +
              "Please enter the recipient's wallet address:",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "sendwallet:cancel" }],
                ],
              },
            }
          );
          break;

        case "deposit":
          bot.sendMessage(
            chatId,
            "💳 *Deposit Funds*\n\n" +
              "Please select or enter an amount in USDC to deposit:",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createAmountKeyboard("deposit"),
              },
            }
          );
          break;

        case "withdraw":
          bot.sendMessage(
            chatId,
            "🏦 *Withdraw to Bank*\n\n" +
              "Please select or enter an amount in USDC to withdraw:\n\n" +
              "_Note: Your bank account details must be configured on the Copperx platform. " +
              "If you haven't set up your bank account yet, please visit https://copperx.io._",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createAmountKeyboard("withdrawbank"),
              },
            }
          );
          break;

        case "history":
          bot.sendMessage(
            chatId,
            "📜 *Transaction History*\n\n" +
              "Loading your transaction history...",
            {
              parse_mode: "Markdown",
            }
          );
          await displayTransactionHistory(bot, chatId, session.token, 1);
          break;
      }
    }
  });
}
