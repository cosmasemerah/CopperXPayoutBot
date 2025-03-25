import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { requireAuth } from "../../core/middleware";
import {
  SessionService,
  ExtendedSession,
  SessionState,
} from "../../core/session.service";

// Create module logger
// const logger = getModuleLogger("base-transfer-command");

/**
 * Base interface for transfer session state
 */
interface TransferSessionState extends SessionState {
  transferStep?: string;
  // Common transfer state properties that all transfer commands might use
}

/**
 * Base abstract class for all transfer commands
 * Provides common functionality and structure for transfer operations
 */
export abstract class BaseTransferCommand implements BotCommand {
  abstract name: string;
  abstract description: string;

  /**
   * Execute the transfer command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      await this.startTransferFlow(bot, chatId, session);
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

    // Check if callback data matches this command's prefix
    if (callbackData.startsWith(this.getCallbackPrefix())) {
      requireAuth(bot, chatId, async (session) => {
        await this.processCallback(bot, query, session);
      });
    }
  }

  /**
   * Get the callback prefix used by this command
   * For example, "transfer:email" for email transfers
   */
  protected abstract getCallbackPrefix(): string;

  /**
   * Start the specific transfer flow
   * This method should be implemented by each transfer command
   */
  protected abstract startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void>;

  /**
   * Process callback data for this command
   * This method should be implemented by each transfer command
   */
  protected abstract processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery,
    session: ExtendedSession
  ): Promise<void>;

  /**
   * Handle user text input for multi-step flows
   * This method should be implemented by each transfer command that needs to process user input
   */
  async handleUserInput(
    _bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const session = SessionService.getSession(chatId);

    if (!session) return;

    // Each subclass should implement this method if they need to process user input
    // This is just a placeholder that provides a standard interface
  }

  /**
   * Get session data with type safety
   * @param chatId The chat ID to get session data for
   * @returns The typed session data or undefined if not found
   */
  protected getSessionData<T extends TransferSessionState>(
    chatId: number
  ): T | undefined {
    const sessionState = SessionService.getSessionState(chatId);
    return sessionState?.data as T | undefined;
  }

  /**
   * Update session data with type safety
   * @param chatId The chat ID to update session data for
   * @param newData The new data to merge with existing session data
   */
  protected updateSessionData<T extends TransferSessionState>(
    chatId: number,
    newData: Partial<T>
  ): void {
    const sessionState = SessionService.getSessionState(chatId) || { data: {} };

    // Make sure we preserve the current action by default
    if (!newData.currentAction && sessionState.currentAction) {
      newData.currentAction = sessionState.currentAction;
    }

    const updatedData = { ...(sessionState.data as T), ...newData };
    SessionService.updateSessionState(chatId, {
      currentAction: newData.currentAction || sessionState.currentAction,
      data: updatedData,
    });
  }

  /**
   * Clear session data and reset state
   * @param chatId The chat ID to clear session data for
   */
  protected clearSessionData(chatId: number): void {
    SessionService.updateSessionState(chatId, {
      currentAction: undefined,
      data: {},
    });
  }

  /**
   * Send a cancellation message
   */
  protected async sendCancelMessage(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    // Clear the current action using the new helper method
    this.clearSessionData(chatId);

    bot.sendMessage(
      chatId,
      "❌ *Transfer Cancelled*\n\nYour transfer has been cancelled.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      }
    );
  }

  /**
   * Format a standard error message
   */
  protected formatErrorMessage(errorText: string): string {
    return `❌ *Error*\n\n${errorText}\n\nPlease try again or contact support if the issue persists.`;
  }
}
