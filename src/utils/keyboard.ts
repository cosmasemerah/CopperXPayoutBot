import TelegramBot from "node-telegram-bot-api";
import { WalletBalance } from "../types";

/**
 * Generate a standardized callback data string
 * @param module The module/feature (e.g., "menu", "wallet", "transfer")
 * @param action The action to perform (e.g., "select", "confirm", "cancel")
 * @param params Optional additional parameters
 * @returns A standardized callback data string
 */
export function createCallbackData(
  module: string,
  action: string,
  ...params: string[]
): string {
  if (params.length === 0) {
    return `${module}:${action}`;
  }
  return `${module}:${action}:${params.join(":")}`;
}

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
      {
        text: "💰 Balance",
        callback_data: createCallbackData("menu", "balance"),
      },
      { text: "📤 Send", callback_data: createCallbackData("menu", "send") },
    ],
    [
      {
        text: "💵 Deposit",
        callback_data: createCallbackData("menu", "deposit"),
      },
      {
        text: "🏧 Withdraw",
        callback_data: createCallbackData("menu", "withdraw"),
      },
    ],
    [
      {
        text: "📋 History",
        callback_data: createCallbackData("menu", "history"),
      },
      {
        text: "👤 Profile",
        callback_data: createCallbackData("menu", "profile"),
      },
    ],
    [
      {
        text: "🔑 Set Default Wallet",
        callback_data: createCallbackData("menu", "setdefaultwallet"),
      },
      {
        text: "📋 KYC Status",
        callback_data: createCallbackData("menu", "kyc"),
      },
    ],
    [{ text: "❓ Help", callback_data: createCallbackData("menu", "help") }],
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

/**
 * Create a keyboard with a single "Back to Menu" button
 * @returns An inline keyboard with a back to menu button
 */
export function createBackToMenuKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      {
        text: "📋 Back to Menu",
        callback_data: createCallbackData("return", "menu"),
      },
    ],
  ];
}

/**
 * Create a keyboard with common action buttons after displaying information
 * @param actions Array of actions to include (e.g., ["balance", "retry"])
 * @returns An inline keyboard with specified action buttons and back to menu
 */
export function createActionKeyboard(
  actions: string[]
): TelegramBot.InlineKeyboardButton[][] {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  const actionButtons: TelegramBot.InlineKeyboardButton[] = [];

  // Create action buttons based on requested actions
  actions.forEach((action) => {
    switch (action) {
      case "balance":
        actionButtons.push({
          text: "🔍 View Balance",
          callback_data: createCallbackData("menu", "balance"),
        });
        break;
      case "history":
        actionButtons.push({
          text: "📜 View History",
          callback_data: createCallbackData("menu", "history"),
        });
        break;
      case "retry":
        // The retry callback should be handled by the specific handler
        actionButtons.push({
          text: "🔄 Try Again",
          callback_data: createCallbackData("action", "retry"),
        });
        break;
      case "deposit":
        actionButtons.push({
          text: "📥 Deposit",
          callback_data: createCallbackData("menu", "deposit"),
        });
        break;
      case "send":
        actionButtons.push({
          text: "📤 Send",
          callback_data: createCallbackData("menu", "send"),
        });
        break;
      case "profile":
        actionButtons.push({
          text: "👤 Profile",
          callback_data: createCallbackData("menu", "profile"),
        });
        break;
      case "kyc":
        actionButtons.push({
          text: "📋 KYC Status",
          callback_data: createCallbackData("menu", "kyc"),
        });
        break;
      case "setdefaultwallet":
        actionButtons.push({
          text: "🔑 Set Default Wallet",
          callback_data: createCallbackData("menu", "setdefaultwallet"),
        });
        break;
      case "support":
        actionButtons.push({
          text: "📞 Support",
          callback_data: createCallbackData("action", "support"),
        });
        break;
    }
  });

  // Add action buttons (up to 2 per row)
  if (actionButtons.length > 0) {
    // Split buttons into rows of 2
    for (let i = 0; i < actionButtons.length; i += 2) {
      const row = actionButtons.slice(i, i + 2);
      keyboard.push(row);
    }
  }

  // Always add back to menu button
  keyboard.push([
    {
      text: "📋 Back to Menu",
      callback_data: createCallbackData("return", "menu"),
    },
  ]);

  return keyboard;
}

/**
 * Create a keyboard for error messages
 * @param retryCallback The callback data for retry action
 * @returns An inline keyboard with retry and back to menu buttons
 */
export function createErrorActionKeyboard(
  retryCallback: string
): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "🔄 Try Again", callback_data: retryCallback },
      {
        text: "📋 Back to Menu",
        callback_data: createCallbackData("return", "menu"),
      },
    ],
  ];
}
