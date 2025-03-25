import TelegramBot from "node-telegram-bot-api";
import { requireAuth } from "../../core/middleware";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { getModuleLogger } from "../../utils/logger";
import { ExtendedSession, SessionState } from "../../core/session.service";
import { TransferStatus, TransferType } from "../../types";
import { TransferResponse } from "../../types/transfer";
import { config } from "../../config";
import { BaseTransferCommand } from "./base-transfer-command";

// Create module logger
const logger = getModuleLogger("history-command");

/**
 * Interface for transaction history session state
 */
interface HistorySessionState extends SessionState {
  currentAction: "history";
  page: number;
  totalPages: number;
}

/**
 * History command implementation for viewing transaction history
 */
export class HistoryCommand extends BaseTransferCommand {
  name = "history";
  description = "View your transaction history";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "history:";
  }

  /**
   * Execute history command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Update session state
        this.updateSessionData<HistorySessionState>(chatId, {
          currentAction: "history",
          page: 1,
          totalPages: 1,
        });

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
          const state = this.getSessionData<HistorySessionState>(chatId);

          if (state && newPage >= 1 && newPage <= state.totalPages) {
            await this.displayTransactionHistory(bot, chatId, session, newPage);
          }
        } else if (action === "menu") {
          this.clearSessionData(chatId);
          bot.sendMessage(chatId, "Redirecting to main menu...", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
              ],
            },
          });
        } else {
          // Let the parent class handle other callbacks
          await super.handleCallback(bot, query);
        }
      });
    } else {
      // Let the parent class handle other callbacks
      await super.handleCallback(bot, query);
    }
  }

  /**
   * Start the transfer flow - Not used in HistoryCommand but required by BaseTransferCommand
   */
  protected async startTransferFlow(
    _bot: TelegramBot,
    _chatId: number,
    _session: ExtendedSession
  ): Promise<void> {
    // Not implemented for HistoryCommand as it doesn't start a transfer flow
  }

  /**
   * Process callback data - Override to handle specific history callbacks
   */
  protected async processCallback(
    _bot: TelegramBot,
    _query: TelegramBot.CallbackQuery,
    _session: ExtendedSession
  ): Promise<void> {
    // History command uses handleCallback directly instead
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
      this.updateSessionData<HistorySessionState>(chatId, {
        currentAction: "history",
        page,
        totalPages,
      });

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
      keyboard.push([{ text: "« Back to Menu", callback_data: "menu:main" }]);

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
}
