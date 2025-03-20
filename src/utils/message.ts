import TelegramBot from "node-telegram-bot-api";
import { createActionKeyboard, createErrorActionKeyboard } from "./keyboard";

/**
 * Send a success message with navigation options
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message text
 * @param actions Array of action buttons to include
 * @returns Promise with the sent message
 */
export function sendSuccessMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  actions: string[] = []
): Promise<TelegramBot.Message> {
  return bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: createActionKeyboard(actions),
    },
  });
}

/**
 * Send an error message with retry option
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The error message text
 * @param retryCallback The callback data for retry action
 * @returns Promise with the sent message
 */
export function sendErrorMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  retryCallback: string
): Promise<TelegramBot.Message> {
  return bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: createErrorActionKeyboard(retryCallback),
    },
  });
}

/**
 * Update an existing message to show confirmation of action
 * @param bot The Telegram bot instance
 * @param chatId The chat ID
 * @param messageId The message ID to edit
 * @param message The new confirmation message
 * @param actions Array of action buttons to include
 */
export function updateToConfirmation(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  message: string,
  actions: string[] = []
): Promise<boolean | TelegramBot.Message> {
  return bot.editMessageText(message, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: createActionKeyboard(actions),
    },
  });
}

/**
 * Send a message that requires confirmation (Yes/No)
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param message The message text
 * @param confirmCallback The callback prefix for confirmation
 * @returns Promise with the sent message
 */
export function sendConfirmationMessage(
  bot: TelegramBot,
  chatId: number,
  message: string,
  confirmCallback: string
): Promise<TelegramBot.Message> {
  return bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Yes", callback_data: `${confirmCallback}:yes` },
          { text: "❌ No", callback_data: `${confirmCallback}:no` },
        ],
      ],
    },
  });
}
