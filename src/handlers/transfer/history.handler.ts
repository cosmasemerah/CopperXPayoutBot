import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as transferService from "../../services/transfer.service";
import { createActionKeyboard } from "../../utils/keyboard";
import { config } from "../../config";
import { TransferResponse, TransferStatus, TransferType } from "../../types";

// Define the HistoryState interface for pagination
interface HistoryState {
  page: number;
  totalPages: number;
}

/**
 * Register history handlers
 * @param bot The Telegram bot instance
 */
export function registerHistoryHandlers(bot: TelegramBot): void {
  // History command handler
  bot.onText(/\/history/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view your transaction history.\nPlease use /login to authenticate."
      );
      return;
    }

    // Set initial state for history view
    updateSessionState(chatId, {
      currentAction: "history" as const,
      data: { page: 1, totalPages: 1 },
    });

    // Fetch and display transaction history
    await displayTransactionHistory(bot, chatId, session.token, 1);
  });

  // Handle history callbacks
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

    // Handle history flow callbacks
    if (callbackData.startsWith("history:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "history") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as HistoryState;

      // Handle pagination
      if (action === "page") {
        const newPage = parseInt(parts[2]);
        if (newPage >= 1 && newPage <= data.totalPages) {
          bot.answerCallbackQuery(query.id);
          await displayTransactionHistory(bot, chatId, session.token, newPage);
        }
      }
      // Handle return to menu
      else if (action === "menu") {
        bot.answerCallbackQuery(query.id);
        updateSessionState(chatId, {});
        bot.editMessageText("📋 *Main Menu*\n\nWhat would you like to do?", {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "💸 Send", callback_data: "menu:send" },
                { text: "🏧 Withdraw", callback_data: "menu:withdraw" },
              ],
              [
                { text: "📊 Balance", callback_data: "menu:balance" },
                { text: "📜 History", callback_data: "menu:history" },
              ],
              [{ text: "❓ Help", callback_data: "menu:help" }],
            ],
          },
        });
      }
    }
  });
}

/**
 * Display transaction history with pagination
 * @param bot The Telegram bot instance
 * @param chatId The chat ID
 * @param token The user's authentication token
 * @param page The page number to display
 */
export async function displayTransactionHistory(
  bot: TelegramBot,
  chatId: number,
  token: string,
  page: number
): Promise<void> {
  try {
    // Fetch transaction history from the API
    const response = await transferService.getTransferHistory(token, page);
    const { data: transactions, count, limit } = response;
    const totalPages = Math.ceil(count / limit);

    // Update session state with total pages
    updateSessionState(chatId, {
      currentAction: "history" as const,
      data: { page, totalPages },
    });

    // Format transaction history message
    let message = "📜 *Transaction History*\n\n";

    if (transactions.length === 0) {
      message += "No transactions found.";
    } else {
      transactions.forEach((tx: TransferResponse) => {
        const emoji = tx.type === TransferType.DEPOSIT ? "⬇️" : "⬆️";
        const statusEmoji = tx.status === TransferStatus.SUCCESS ? "✅" : "⏳";
        message += `${emoji} *${tx.type.toUpperCase()}*\n`;
        message += `Amount: ${tx.amount} ${tx.currency}\n`;
        message += `Status: ${statusEmoji} ${tx.status}\n`;
        message += `Date: ${new Date(tx.createdAt).toLocaleString()}\n\n`;
      });
    }

    message += `\nPage ${page} of ${totalPages}`;

    // Create pagination keyboard
    const keyboard = createActionKeyboard(["history"]);
    keyboard.push([{ text: "« Back to Menu", callback_data: "history:menu" }]);

    // Send or edit message with transaction history
    const messageOptions = {
      parse_mode: "Markdown" as const,
      reply_markup: {
        inline_keyboard: keyboard,
      },
    };

    try {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: (await bot.sendMessage(chatId, "Loading...")).message_id,
        ...messageOptions,
      });
    } catch (error) {
      // If message editing fails, send a new message
      await bot.sendMessage(chatId, message, messageOptions);
    }
  } catch (error: any) {
    console.error("Error fetching transaction history:", error);
    let errorMessage = "Failed to fetch transaction history";

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    await bot.sendMessage(
      chatId,
      `❌ ${errorMessage}. Please try again later or visit ${config.supportLink}`
    );
  }
}
