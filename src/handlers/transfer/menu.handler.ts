import TelegramBot from "node-telegram-bot-api";
import { getSession } from "../../session";
import { createAmountKeyboard } from "../../utils/keyboard";
import { displayTransactionHistory } from "./history.handler";

/**
 * Register transfer menu handlers
 * @param bot The Telegram bot instance
 */
export function registerTransferMenuHandlers(bot: TelegramBot): void {
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
          // Trigger the /deposit command to start the deposit flow
          bot.processUpdate({
            update_id: Date.now(),
            message: {
              message_id: Date.now(),
              from: query.from,
              chat: { id: chatId, type: "private" },
              date: Math.floor(Date.now() / 1000),
              text: "/deposit",
            },
          });
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
