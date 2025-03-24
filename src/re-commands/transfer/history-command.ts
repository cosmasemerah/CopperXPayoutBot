import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { requireAuth } from "../../re-core/middleware";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { getModuleLogger } from "../../re-utils/logger";
import { ExtendedSession } from "../../session";
import { TransferResponse, TransferStatus, TransferType } from "../../types";
import { config } from "../../config";

// Create module logger
const logger = getModuleLogger("history-command");

/**
 * Interface for tracking the history pagination state
 */
interface HistoryState {
  page: number;
  totalPages: number;
}

/**
 * History command implementation for viewing transaction history
 */
export class HistoryCommand implements BotCommand {
  name = "history";
  description = "View your transaction history";

  /**
   * Execute history command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Update session state
        this.updateSessionState(session, { page: 1, totalPages: 1 });

        // Display transaction history
        await this.displayTransactionHistory(bot, chatId, session, 1);
      } catch (error) {
        logger.error("Error executing history command:", { error });
        handleApiErrorResponse(bot, chatId, error as Error, "menu:history");
      }
    });
  }

  /**
   * Handle callback queries related to history
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

    if (callbackData === "menu:history") {
      this.execute(bot, query.message as TelegramBot.Message);
      return;
    }

    if (callbackData.startsWith("history:")) {
      requireAuth(bot, chatId, async (session) => {
        const parts = callbackData.split(":");
        const action = parts[1];

        if (action === "page" && parts.length === 3) {
          const newPage = parseInt(parts[2]);
          const state = session.state?.data?.historyState as HistoryState;

          if (state && newPage >= 1 && newPage <= state.totalPages) {
            await this.displayTransactionHistory(bot, chatId, session, newPage);
          }
        } else if (action === "menu") {
          this.clearSessionState(session);
          bot.sendMessage(
            chatId,
            "📋 *Main Menu*\n\nWhat would you like to do?",
            {
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
            }
          );
        }
      });
    }
  }

  /**
   * Display transaction history with pagination
   * @param bot The Telegram bot instance
   * @param chatId The chat ID
   * @param session The user's session
   * @param page The page number to display
   */
  private async displayTransactionHistory(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    page: number
  ): Promise<void> {
    try {
      // Show loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "📜 *Loading Your Transaction History...*",
        { parse_mode: "Markdown" }
      );

      // Fetch transaction history from the API
      const response = await transferService.getTransferHistory(
        session.token,
        page
      );
      const { data: transactions, count, limit } = response;
      const totalPages = Math.ceil(count / limit);

      // Update session state with total pages
      this.updateSessionState(session, { page, totalPages });

      // Format transaction history message
      let message = "📜 *Transaction History*\n\n";

      if (transactions.length === 0) {
        message += "No transactions found.";
      } else {
        transactions.forEach((tx: TransferResponse) => {
          const emoji = tx.type === TransferType.DEPOSIT ? "⬇️" : "⬆️";
          const statusEmoji =
            tx.status === TransferStatus.SUCCESS ? "✅" : "⏳";
          message += `${emoji} *${tx.type.toUpperCase()}*\n`;
          message += `Amount: ${tx.amount} ${tx.currency}\n`;
          message += `Status: ${statusEmoji} ${tx.status}\n`;
          message += `Date: ${new Date(tx.createdAt).toLocaleString()}\n\n`;
        });
      }

      message += `\nPage ${page} of ${totalPages}`;

      // Create pagination keyboard
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      // Add pagination controls if there are multiple pages
      if (totalPages > 1) {
        const paginationRow: TelegramBot.InlineKeyboardButton[] = [];

        // Previous page button
        if (page > 1) {
          paginationRow.push({
            text: "◀️ Previous",
            callback_data: `history:page:${page - 1}`,
          });
        }

        // Next page button
        if (page < totalPages) {
          paginationRow.push({
            text: "Next ▶️",
            callback_data: `history:page:${page + 1}`,
          });
        }

        if (paginationRow.length > 0) {
          keyboard.push(paginationRow);
        }
      }

      // Add back to menu button
      keyboard.push([
        { text: "« Back to Menu", callback_data: "history:menu" },
      ]);

      // Update the loading message with actual data
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } catch (error: any) {
      logger.error("Error fetching transaction history:", error);
      let errorMessage = "Failed to fetch transaction history";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      bot.sendMessage(
        chatId,
        `❌ ${errorMessage}. Please try again later or visit ${config.supportLink}`
      );
    }
  }

  /**
   * Update session state for history command
   */
  private updateSessionState(
    session: ExtendedSession,
    historyState: HistoryState
  ): void {
    if (!session.state) {
      session.state = {};
    }

    // Use string literal "history" for compatibility with current session implementation
    session.state.currentAction = "history";
    session.state.data = {
      ...session.state.data,
      historyState,
    };
  }

  /**
   * Clear session state
   */
  private clearSessionState(session: ExtendedSession): void {
    if (session.state) {
      session.state.currentAction = undefined;
      if (session.state.data) {
        delete session.state.data.historyState;
      }
    }
  }
}
