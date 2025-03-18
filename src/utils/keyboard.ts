import TelegramBot from "node-telegram-bot-api";
import { WalletBalance } from "../types";

/**
 * Create a simple Yes/No inline keyboard
 * @param callbackPrefix The prefix for callback data (e.g., "sendemail")
 * @returns An inline keyboard markup with Yes and No buttons
 */
export function createYesNoKeyboard(
  callbackPrefix: string
): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      {
        text: "✅ Yes",
        callback_data: `${callbackPrefix}:yes`,
      },
      {
        text: "❌ No",
        callback_data: `${callbackPrefix}:no`,
      },
    ],
  ];
}

/**
 * Create a keyboard with wallet options for selection
 * @param wallets Array of wallet balances
 * @param callbackPrefix The prefix for callback data (e.g., "wallet")
 * @returns An inline keyboard markup with wallet options
 */
export function createWalletSelectionKeyboard(
  wallets: WalletBalance[],
  callbackPrefix: string
): TelegramBot.InlineKeyboardButton[][] {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

  wallets.forEach((wallet) => {
    const networkName = wallet.network || "Unknown";
    const isDefault = wallet.isDefault ? " (Default)" : "";
    const buttonText = `${networkName}${isDefault}`;

    keyboard.push([
      {
        text: buttonText,
        callback_data: `${callbackPrefix}:select:${wallet.walletId}`,
      },
    ]);
  });

  // Add cancel button
  keyboard.push([
    {
      text: "❌ Cancel",
      callback_data: `${callbackPrefix}:cancel`,
    },
  ]);

  return keyboard;
}

/**
 * Create a keyboard with predefined amount options
 * @param callbackPrefix The prefix for callback data (e.g., "sendemail")
 * @returns An inline keyboard markup with amount options and custom input option
 */
export function createAmountKeyboard(
  callbackPrefix: string
): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "$10", callback_data: `${callbackPrefix}:amount:10` },
      { text: "$50", callback_data: `${callbackPrefix}:amount:50` },
      { text: "$100", callback_data: `${callbackPrefix}:amount:100` },
    ],
    [
      { text: "$250", callback_data: `${callbackPrefix}:amount:250` },
      { text: "$500", callback_data: `${callbackPrefix}:amount:500` },
      { text: "$1000", callback_data: `${callbackPrefix}:amount:1000` },
    ],
    [
      {
        text: "✏️ Custom Amount",
        callback_data: `${callbackPrefix}:amount:custom`,
      },
    ],
    [
      {
        text: "❌ Cancel",
        callback_data: `${callbackPrefix}:cancel`,
      },
    ],
  ];
}

/**
 * Create a keyboard for the main menu options
 * @returns An inline keyboard markup with main menu options
 */
export function createMainMenuKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "💰 Balance", callback_data: "menu:balance" },
      { text: "📤 Send", callback_data: "menu:send" },
    ],
    [
      { text: "📋 History", callback_data: "menu:history" },
      { text: "👤 Profile", callback_data: "menu:profile" },
    ],
  ];
}

/**
 * Create a keyboard for send options
 * @returns An inline keyboard markup with send options
 */
export function createSendOptionsKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "📧 Send to Email", callback_data: "send:email" },
      { text: "🔑 Send to Wallet", callback_data: "send:wallet" },
    ],
    [
      { text: "🏦 Withdraw to Bank", callback_data: "send:bank" },
      { text: "↩️ Back to Menu", callback_data: "send:back" },
    ],
  ];
}
