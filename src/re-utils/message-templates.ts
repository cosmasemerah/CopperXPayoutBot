import TelegramBot from "node-telegram-bot-api";
import {
  createMainMenuKeyboard,
  createActionKeyboard,
} from "../utils/keyboard";

/**
 * Message templates for common user interactions
 */
export enum MessageTemplate {
  SUCCESS = "success",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CONFIRMATION = "confirmation",
}

/**
 * Send a success message with consistent formatting
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message content
 * @param actions Optional action buttons to include
 */
export function sendSuccessMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  actions?: string[]
): Promise<TelegramBot.Message> {
  const formattedMessage = `✅ ${message}`;
  return sendFormattedMessage(bot, chatId, formattedMessage, actions);
}

/**
 * Send an information message with consistent formatting
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message content
 * @param actions Optional action buttons to include
 */
export function sendInfoMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  actions?: string[]
): Promise<TelegramBot.Message> {
  const formattedMessage = `ℹ️ ${message}`;
  return sendFormattedMessage(bot, chatId, formattedMessage, actions);
}

/**
 * Send a warning message with consistent formatting
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message content
 * @param actions Optional action buttons to include
 */
export function sendWarningMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  actions?: string[]
): Promise<TelegramBot.Message> {
  const formattedMessage = `⚠️ ${message}`;
  return sendFormattedMessage(bot, chatId, formattedMessage, actions);
}

/**
 * Send an error message with consistent formatting
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The error message
 * @param retry Optional callback data for retry button
 */
export function sendErrorMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  retry?: string
): Promise<TelegramBot.Message> {
  const formattedMessage = `❌ ${message}`;

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  if (retry) {
    keyboard.push([{ text: "🔄 Try Again", callback_data: retry }]);
  }
  keyboard.push([{ text: "📋 Main Menu", callback_data: "menu:main" }]);

  return bot.sendMessage(chatId, formattedMessage, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}

/**
 * Send a confirmation message that requires user approval
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message content
 * @param confirmData Callback data for confirmation button
 * @param cancelData Callback data for cancel button
 */
export function sendConfirmationMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  confirmData: string,
  cancelData: string
): Promise<TelegramBot.Message> {
  const formattedMessage = `🔔 ${message}`;

  return bot.sendMessage(chatId, formattedMessage, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm", callback_data: confirmData },
          { text: "❌ Cancel", callback_data: cancelData },
        ],
      ],
    },
  });
}

/**
 * Helper function to send formatted messages with optional action buttons
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The formatted message
 * @param actions Optional action buttons to include
 */
function sendFormattedMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  actions?: string[]
): Promise<TelegramBot.Message> {
  const keyboard = actions
    ? createActionKeyboard(actions)
    : createMainMenuKeyboard();

  return bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
