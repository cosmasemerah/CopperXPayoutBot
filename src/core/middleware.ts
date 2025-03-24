import TelegramBot from "node-telegram-bot-api";
import { SessionService, ExtendedSession } from "./session.service";

// TODO: Future migration will use the following import instead:
// import { ExtendedSession, SessionActionType } from "../re-types/session";

/**
 * Middleware to ensure user is authenticated before executing a command
 * @param bot The Telegram bot instance
 * @param chatId The chat ID of the user
 * @param callback Function to execute if user is authenticated
 */
export function requireAuth(
  bot: TelegramBot,
  chatId: number,
  callback: (session: ExtendedSession) => void
): void {
  const session = SessionService.getSession(chatId);
  if (!session) {
    sendAuthRequiredMessage(bot, chatId);
    return;
  }
  callback(session);
}

/**
 * Sends a standard authentication required message to the user
 * @param bot The Telegram bot instance
 * @param chatId The chat ID of the user
 */
export function sendAuthRequiredMessage(
  bot: TelegramBot,
  chatId: number
): void {
  bot.sendMessage(
    chatId,
    "⚠️ You need to be logged in to perform this action.\nPlease use /login to authenticate.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔑 Login", callback_data: "action:login" }],
        ],
      },
    }
  );
}

/**
 * Middleware to ensure user has a valid flow state before continuing
 * @param bot The Telegram bot instance
 * @param chatId The chat ID of the user
 * @param expectedAction The expected current action in the session state
 * @param callback Function to execute if the flow state is valid
 */
export function requireFlowState(
  bot: TelegramBot,
  chatId: number,
  expectedAction: string,
  callback: (session: ExtendedSession) => void
): void {
  const session = SessionService.getSession(chatId);

  // First check authentication
  if (!session) {
    sendAuthRequiredMessage(bot, chatId);
    return;
  }

  // Then check flow state
  if (!session.state || session.state.currentAction !== expectedAction) {
    bot.sendMessage(
      chatId,
      "⚠️ This operation is no longer valid. Please start over.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
          ],
        },
      }
    );
    return;
  }

  callback(session);
}
