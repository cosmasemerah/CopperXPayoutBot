import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState } from "../session";
import * as walletService from "../services/wallet.service";
import {
  createWalletSelectionKeyboard,
  createActionKeyboard,
} from "../utils/keyboard";
import { formatWalletBalances } from "../utils/format";
import { sendSuccessMessage, sendErrorMessage } from "../utils/message";

/**
 * Register wallet handlers
 * @param bot The Telegram bot instance
 */
export function registerWalletHandlers(bot: TelegramBot): void {
  // Balance command handler
  bot.onText(/\/balance/, handleBalanceCommand(bot));

  // Set default wallet command handler
  bot.onText(/\/setdefaultwallet/, handleSetDefaultWalletCommand(bot));

  // Handle callback queries for wallet selection
  bot.on("callback_query", handleWalletCallbacks(bot));
}

/**
 * Handler for /balance command
 * @param bot The Telegram bot instance
 * @returns A function that handles the balance command
 */
const handleBalanceCommand =
  (bot: TelegramBot) => async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view your balance.\nPlease use /login to authenticate.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
            ],
          },
        }
      );
      return;
    }

    // Fetch wallet balances and wallet data
    try {
      const [walletBalances, walletData] = await Promise.all([
        walletService.getWalletBalances(session.token),
        walletService.getWallets(session.token),
      ]);

      // Log the responses for debugging
      console.log(
        "Wallet balances API response:",
        JSON.stringify(walletBalances, null, 2)
      );
      console.log(
        "Wallet data API response:",
        JSON.stringify(walletData, null, 2)
      );

      if (walletBalances.length === 0) {
        sendSuccessMessage(
          bot,
          chatId,
          "📊 You don't have any wallet balances yet.\nPlease visit https://copperx.io to get started.",
          []
        );
        return;
      }

      // Format wallet balances using the utility function, passing both arrays
      const message = formatWalletBalances(walletBalances, walletData);

      // Add a hint for setting default wallet
      const messageWithHint =
        message + "\nUse /setdefaultwallet to change your default wallet.";

      // Send with action buttons
      sendSuccessMessage(bot, chatId, messageWithHint, [
        "refreshbalance",
        "setdefaultwallet",
        "deposit",
        "send",
      ]);
    } catch (error: any) {
      console.error("Wallet balances fetch error:", error);
      sendErrorMessage(
        bot,
        chatId,
        "Failed to retrieve your wallet balances. Please try again later.",
        "menu:balance"
      );
    }
  };

/**
 * Handler for /setdefaultwallet command
 * @param bot The Telegram bot instance
 * @returns A function that handles the setdefaultwallet command
 */
const handleSetDefaultWalletCommand =
  (bot: TelegramBot) => async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to set your default wallet.\nPlease use /login to authenticate.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
            ],
          },
        }
      );
      return;
    }

    // Fetch wallets first to display options
    try {
      const walletBalances = await walletService.getWalletBalances(
        session.token
      );

      // Log the response for debugging
      console.log(
        "Wallet list API response:",
        JSON.stringify(walletBalances, null, 2)
      );

      if (walletBalances.length === 0) {
        sendSuccessMessage(
          bot,
          chatId,
          "⚠️ You don't have any wallets yet.\nPlease visit https://copperx.io to create a wallet.",
          []
        );
        return;
      }

      // Set the session state for default wallet selection
      updateSessionState(chatId, {
        currentAction: "setdefaultwallet",
      });

      // Display wallets as inline keyboard
      bot.sendMessage(chatId, "Please select a wallet to set as default:", {
        reply_markup: {
          inline_keyboard: createWalletSelectionKeyboard(
            walletBalances,
            "wallet"
          ),
        },
      });
    } catch (error) {
      console.error("Error fetching wallets:", error);

      // Using the sendErrorMessage with a string for retryCallback
      sendErrorMessage(
        bot,
        chatId,
        "Failed to retrieve your wallets. Please try again later.",
        "menu:setdefaultwallet"
      );
    }
  };

/**
 * Handler for wallet callback queries
 * @param bot The Telegram bot instance
 * @returns A function that handles wallet-related callback queries
 */
const handleWalletCallbacks =
  (bot: TelegramBot) => async (query: TelegramBot.CallbackQuery) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Only handle wallet:* callbacks
    if (!data.startsWith("wallet:")) return;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "⚠️ You need to login first. Please use /login.",
        show_alert: true,
      });
      return;
    }

    // Check if the current action is valid for wallet selection
    const state = session.state || {};
    if (state.currentAction !== "setdefaultwallet") {
      bot.answerCallbackQuery(query.id, {
        text: "⚠️ Invalid action. Please start over.",
        show_alert: true,
      });
      return;
    }

    const parts = data.split(":");
    const action = parts[1];

    if (action === "select") {
      const walletId = parts[2];
      try {
        // Call API to set default wallet
        await walletService.setDefaultWallet(session.token, walletId);

        // Update message with success
        bot.editMessageText("✅ Default wallet updated successfully!", {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📊 View Balance",
                  callback_data: "action:refreshbalance",
                },
              ],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        });

        // Clear the session state
        updateSessionState(chatId, {
          currentAction: undefined,
        });
      } catch (error) {
        console.error("Error setting default wallet:", error);
        bot.answerCallbackQuery(query.id, {
          text: "❌ Failed to set default wallet. Please try again.",
          show_alert: true,
        });
      }
    } else if (action === "cancel") {
      // Clear the session state
      updateSessionState(chatId, {
        currentAction: undefined,
      });

      // Update message to show cancellation
      bot.editMessageText("Operation cancelled. What would you like to do?", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: createActionKeyboard(["balance"]),
        },
      });
    }
  };
