import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { SessionService, SessionState } from "../../core/session.service";

/**
 * Base interface for auth session state
 */
interface AuthSessionState extends SessionState {
  authStep?: string;
  // Common auth state properties that all auth commands might use
}

/**
 * Base abstract class for all auth commands
 * Provides common functionality and structure for authentication operations
 */
export abstract class BaseAuthCommand implements BotCommand {
  abstract name: string;
  abstract description: string;

  /**
   * Execute the auth command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.startAuthFlow(bot, chatId, msg);
  }

  /**
   * Handle callback queries
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    // Check if callback data matches this command's prefix
    if (callbackData.startsWith(this.getCallbackPrefix())) {
      await this.processCallback(bot, query);
    }
  }

  /**
   * Get the callback prefix used by this command
   * For example, "action:login" for login
   */
  protected abstract getCallbackPrefix(): string;

  /**
   * Start the specific auth flow
   * This method should be implemented by each auth command
   */
  protected abstract startAuthFlow(
    bot: TelegramBot,
    chatId: number,
    msg: TelegramBot.Message
  ): Promise<void>;

  /**
   * Process callback data for this command
   * This method should be implemented by each auth command
   */
  protected abstract processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void>;

  /**
   * Handle user text input for multi-step flows
   * This method should be implemented by each auth command that needs to process user input
   */
  async handleUserInput(
    _bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    if (!msg.text) return;

    // Each subclass should implement this method if they need to process user input
    // This is just a placeholder that provides a standard interface
  }

  /**
   * Get session data with type safety
   * @param chatId The chat ID to get session data for
   * @returns The typed session data or undefined if not found
   */
  protected getSessionData<T extends AuthSessionState>(
    chatId: number
  ): T | undefined {
    const sessionState = SessionService.getSessionState(chatId);
    return sessionState as T | undefined;
  }

  /**
   * Update session data with type safety
   * @param chatId The chat ID to update session data for
   * @param newData The new data to merge with existing session data
   */
  protected updateSessionData<T extends AuthSessionState>(
    chatId: number,
    newData: Partial<T>
  ): void {
    const currentState = SessionService.getSessionState(chatId) || {};
    SessionService.updateSessionState(chatId, {
      ...currentState,
      ...newData,
    });
  }

  /**
   * Clear session data and reset state
   * @param chatId The chat ID to clear session data for
   */
  protected clearSessionData(chatId: number): void {
    SessionService.updateSessionState(chatId, {
      currentAction: undefined,
    });
  }

  /**
   * Format a standard error message
   */
  protected formatErrorMessage(errorText: string): string {
    return `❌ *Error*\n\n${errorText}\n\nPlease try again or contact support if the issue persists.`;
  }
}
