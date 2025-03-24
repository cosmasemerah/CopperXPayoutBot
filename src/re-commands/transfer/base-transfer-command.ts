import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { requireAuth } from "../../re-core/middleware";
import { getSession, updateSessionState, ExtendedSession } from "../../session";

// Create module logger
// const logger = getModuleLogger("base-transfer-command");

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
    const session = getSession(chatId);

    if (!session) return;

    // Each subclass should implement this method if they need to process user input
    // This is just a placeholder that provides a standard interface
  }

  /**
   * Send a cancellation message
   */
  protected async sendCancelMessage(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    // Clear the current action
    updateSessionState(chatId, { currentAction: undefined });

    bot.sendMessage(
      chatId,
      "❌ *Transfer Cancelled*\n\nYour transfer has been cancelled.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
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
