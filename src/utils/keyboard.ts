import TelegramBot from "node-telegram-bot-api";
import { WalletBalance, SourceOfFunds } from "../types/wallet";
import { getPurposeCodes } from "./helpers";
import { getNetworkName } from "./constants";

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
    const networkName = getNetworkName(wallet.network);
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
 * Create a keyboard with wallet options for deposit
 * @param wallets Array of wallet objects
 * @returns An inline keyboard markup with wallet options for deposit
 */
export function createDepositWalletSelectionKeyboard(
  wallets: any[]
): TelegramBot.InlineKeyboardButton[][] {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

  wallets.forEach((wallet) => {
    const networkName = getNetworkName(wallet.network);
    const isDefault = wallet.isDefault ? " (Default)" : "";
    const buttonText = `${networkName}${isDefault}`;

    keyboard.push([
      {
        text: buttonText,
        callback_data: `deposit:wallet:${wallet.id}:${wallet.network}`,
      },
    ]);
  });

  // Add cancel button
  keyboard.push([
    {
      text: "❌ Cancel",
      callback_data: "deposit:cancel",
    },
  ]);

  return keyboard;
}

/**
 * Create a keyboard with QR code, cancel, and main menu options for deposit
 * @param walletId The wallet ID for generating QR code
 * @returns An inline keyboard markup with QR code and navigation buttons
 */
export function createDepositActionsKeyboard(
  walletId: string
): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      {
        text: "📱 Generate QR Code",
        callback_data: `deposit:qrcode:${walletId}`,
      },
    ],
    [
      {
        text: "❌ Cancel",
        callback_data: "deposit:cancel",
      },
      {
        text: "« Back to Menu",
        callback_data: "menu:main",
      },
    ],
  ];
}

/**
 * Create a keyboard with action buttons for QR code response
 * @param network The network of the wallet
 * @returns An inline keyboard markup with navigation buttons
 */
export function createQRCodeResponseKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      {
        text: "📥 New Deposit",
        callback_data: "menu:deposit",
      },
      {
        text: "💰 Balance",
        callback_data: "menu:balance",
      },
    ],
    [
      {
        text: "« Back to Menu",
        callback_data: "menu:main",
      },
    ],
  ];
}

/**
 * Create a keyboard for the main menu
 * @returns An inline keyboard markup for the main menu
 */
export function createMainMenuKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "👤 Profile", callback_data: "action:profile" },
      { text: "💰 Balance", callback_data: "action:balance" },
    ],
    [
      { text: "💼 Wallets", callback_data: "action:wallets" },
      { text: "💸 Send", callback_data: "action:transfer" },
    ],
    [
      { text: "📥 Deposit", callback_data: "menu:deposit" },
      { text: "⏱️ History", callback_data: "menu:history" },
    ],
    [
      { text: "🏦 Withdraw to Bank", callback_data: "transfer:method:bank" },
      { text: "👥 Payees", callback_data: "menu:listpayees" },
    ],
    [
      { text: "🆔 KYC", callback_data: "action:kyc" },
      { text: "⭐ Default Wallet", callback_data: "action:settings" },
    ],
    [
      { text: "❓ Help", callback_data: "menu:help" },
      { text: "🚪 Logout", callback_data: "action:logout" },
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
      { text: "🔗 Send to Wallet", callback_data: "send:wallet" },
    ],
    [{ text: "« Back to Menu", callback_data: "menu:main" }],
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
        text: "« Back to Menu",
        callback_data: "menu:main",
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
          text: "⚙ Set Default Wallet",
          callback_data: createCallbackData("menu", "setdefaultwallet"),
        });
        break;
      case "refreshbalance":
        actionButtons.push({
          text: "🔄 Refresh Balance",
          callback_data: createCallbackData("action", "refreshbalance"),
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
      text: "« Back to Menu",
      callback_data: "menu:main",
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
        text: "« Back to Menu",
        callback_data: "menu:main",
      },
    ],
  ];
}

/**
 * Create a keyboard with purpose code options
 * @param prefix The callback data prefix for the action (e.g., "sendemail", "bankwithdraw", etc.)
 * @returns Inline keyboard with purpose code options
 */
export function createPurposeCodeKeyboard(
  prefix: string
): TelegramBot.InlineKeyboardButton[][] {
  // Get purpose codes from the helper function
  const purposeCodes = getPurposeCodes();

  // Group buttons in rows of 2 for better display
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < purposeCodes.length; i += 2) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
    row.push({
      text: purposeCodes[i].label,
      callback_data: `${prefix}:purpose:${purposeCodes[i].code}`,
    });

    if (i + 1 < purposeCodes.length) {
      row.push({
        text: purposeCodes[i + 1].label,
        callback_data: `${prefix}:purpose:${purposeCodes[i + 1].code}`,
      });
    }
    keyboard.push(row);
  }

  // Add cancel button
  keyboard.push([{ text: "❌ Cancel", callback_data: `${prefix}:cancel` }]);

  return keyboard;
}

/**
 * Create a keyboard with source of funds options
 * @param prefix The callback data prefix for the action (e.g., "deposit", "withdraw", etc.)
 * @returns Inline keyboard with source of funds options
 */
export function createSourceOfFundsKeyboard(
  prefix: string
): TelegramBot.InlineKeyboardButton[][] {
  const sources = [
    { code: SourceOfFunds.SALARY, label: "Salary" },
    { code: SourceOfFunds.SAVINGS, label: "Savings" },
    { code: SourceOfFunds.INVESTMENT, label: "Investment" },
    { code: SourceOfFunds.BUSINESS_INCOME, label: "Business Income" },
    { code: SourceOfFunds.LOAN, label: "Loan" },
    { code: SourceOfFunds.LOTTERY, label: "Lottery" },
    { code: SourceOfFunds.OTHERS, label: "Others" },
  ];

  // Group buttons in rows of 2 for better display
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < sources.length; i += 2) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
    row.push({
      text: sources[i].label,
      callback_data: `${prefix}:source:${sources[i].code}`,
    });

    if (i + 1 < sources.length) {
      row.push({
        text: sources[i + 1].label,
        callback_data: `${prefix}:source:${sources[i + 1].code}`,
      });
    }
    keyboard.push(row);
  }

  // Add cancel button
  keyboard.push([{ text: "❌ Cancel", callback_data: `${prefix}:cancel` }]);

  return keyboard;
}

/**
 * Create wallet selection keyboard
 */
export function createWalletKeyboard(
  wallets: { id: string; name: string }[]
): TelegramBot.InlineKeyboardButton[][] {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = wallets.map(
    (wallet) => [
      { text: wallet.name, callback_data: `wallet:select:${wallet.id}` },
    ]
  );

  // Add cancel button
  keyboard.push([{ text: "↩️ Cancel", callback_data: "menu:main" }]);

  return keyboard;
}

/**
 * Create transfer method keyboard
 */
export function createTransferMethodKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [{ text: "📧 Email", callback_data: "transfer:method:email" }],
    [{ text: "🔗 Wallet Address", callback_data: "transfer:method:address" }],
    [{ text: "❌ Cancel", callback_data: "menu:main" }],
  ];
}

/**
 * Create amount selection keyboard
 */
export function createAmountKeyboard(): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "$5", callback_data: "amount:5" },
      { text: "$10", callback_data: "amount:10" },
      { text: "$25", callback_data: "amount:25" },
    ],
    [
      { text: "$50", callback_data: "amount:50" },
      { text: "$100", callback_data: "amount:100" },
      { text: "$200", callback_data: "amount:200" },
    ],
    [{ text: "Custom Amount", callback_data: "amount:custom" }],
    [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
  ];
}

/**
 * Create yes/no confirmation keyboard
 */
export function createConfirmationKeyboard(
  confirmAction: string,
  cancelAction: string
): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ Confirm", callback_data: confirmAction },
      { text: "❌ Cancel", callback_data: cancelAction },
    ],
  ];
}
