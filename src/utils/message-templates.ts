import TelegramBot from "node-telegram-bot-api";
import {
  createMainMenuKeyboard,
  createActionKeyboard,
  createQRCodeResponseKeyboard,
} from "./keyboard";
import QRCode from "qrcode";
import { getNetworkName } from "./constants";
import { logger } from "./logger";

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

/**
 * Generate and send a QR code for a wallet address
 * @param bot The Telegram bot instance
 * @param chatId The chat ID to send the message to
 * @param walletAddress The wallet address to encode in the QR code
 * @param network The network of the wallet
 * @returns Promise that resolves when QR code is sent
 */
export function sendWalletQRCode(
  bot: TelegramBot,
  chatId: number,
  walletAddress: string,
  network: string | undefined
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Generate QR code using the qrcode package with margin options
    QRCode.toDataURL(
      walletAddress,
      { width: 250, margin: 4 },
      (err, qrCodeDataUrl) => {
        if (err) {
          logger.error("Error generating QR code:", { error: err });
          reject(err);
          return;
        }

        // Convert the data URL to a Buffer
        const base64Data = qrCodeDataUrl.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const photoBuffer = Buffer.from(base64Data, "base64");

        // Send QR code image using the Buffer
        bot
          .sendPhoto(chatId, photoBuffer, {
            caption: `QR Code for wallet address:\n\`${walletAddress}\`\n\nScan with your wallet app to deposit USDC on ${getNetworkName(
              network
            )} network.`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createQRCodeResponseKeyboard(),
            },
          })
          .then(() => resolve())
          .catch((error) => reject(error));
      }
    );
  });
}
