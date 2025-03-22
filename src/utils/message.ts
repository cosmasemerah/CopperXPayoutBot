import TelegramBot from "node-telegram-bot-api";
import {
  createActionKeyboard,
  createErrorActionKeyboard,
  createQRCodeResponseKeyboard,
} from "./keyboard";
import { getNetworkName } from "./networkConstants";
import QRCode from "qrcode";
import { logger } from "./logger";

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
