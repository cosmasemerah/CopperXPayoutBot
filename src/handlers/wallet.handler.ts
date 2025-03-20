import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../session";
import * as walletService from "../services/wallet.service";
import { formatWalletBalances } from "../utils/format";
import {
  createWalletSelectionKeyboard,
  createActionKeyboard,
} from "../utils/keyboard";
import {
  sendSuccessMessage,
  sendErrorMessage,
  updateToConfirmation,
} from "../utils/message";
import { config } from "../config";

// Network ID to name mapping
const networkNames: Record<string, string> = {
  "1": "Ethereum Mainnet",
  "10": "Optimism Mainnet",
  "56": "Binance Smart Chain Mainnet",
  "137": "Polygon Mainnet",
  "8453": "Base Mainnet",
  "42161": "Arbitrum One Mainnet",
  "23434": "Starknet",
};

/**
 * Register wallet handlers
 * @param bot The Telegram bot instance
 */
export function registerWalletHandlers(bot: TelegramBot): void {
  // Balance command handler
  bot.onText(/\/balance/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view your wallet balances.\nPlease use /login to authenticate.",
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

    try {
      // Fetch wallet balances
      const walletBalances = await walletService.getWalletBalances(
        session.token
      );

      // Log the response for debugging
      console.log(
        "Wallet balances API response:",
        JSON.stringify(walletBalances, null, 2)
      );

      if (walletBalances.length === 0) {
        sendSuccessMessage(
          bot,
          chatId,
          "💰 *Wallet Balances*\n\n" +
            "You don't have any wallets yet.\n" +
            "Please visit https://copperx.io to create a wallet.",
          []
        );
        return;
      }

      // Format wallet balances using the utility function
      const balanceMessage = formatWalletBalances(walletBalances, networkNames);

      // Add a hint for setting default wallet
      const messageWithHint =
        balanceMessage +
        "\nUse /setdefaultwallet to change your default wallet.";

      // Send with action buttons
      sendSuccessMessage(bot, chatId, messageWithHint, [
        "deposit",
        "send",
        "setdefaultwallet",
      ]);
    } catch (error: any) {
      console.error("Wallet balances fetch error:", error);
      sendErrorMessage(
        bot,
        chatId,
        `❌ Balance check failed: ${
          error.response?.data?.message ||
          "Could not retrieve your wallet balances"
        }. Try again or visit ${config.supportLink}`,
        "menu:balance"
      );
    }
  });

  // Set default wallet command handler
  bot.onText(/\/setdefaultwallet/, async (msg: TelegramBot.Message) => {
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
    } catch (error: any) {
      console.error("Wallet fetch error:", error);
      sendErrorMessage(
        bot,
        chatId,
        `❌ Wallet operation failed: ${
          error.response?.data?.message || "Could not retrieve your wallets"
        }. Try again or visit ${config.supportLink}`,
        "menu:setdefaultwallet"
      );
    }
  });

  // Handle callback queries for wallet selection
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Check if this is a wallet-related callback
    if (!callbackData.startsWith("wallet:")) return;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      bot.deleteMessage(chatId, messageId);
      return;
    }

    // Check if this is a setdefaultwallet action
    const sessionState = getSessionState(chatId);
    if (!sessionState || sessionState.currentAction !== "setdefaultwallet") {
      bot.answerCallbackQuery(query.id, {
        text: "This operation is no longer active.",
        show_alert: true,
      });
      return;
    }

    const parts = callbackData.split(":");
    const action = parts[1];

    // Handle cancellation
    if (action === "cancel") {
      bot.answerCallbackQuery(query.id, { text: "Operation cancelled" });
      updateSessionState(chatId, {});
      bot.deleteMessage(chatId, messageId);

      // Show main menu after cancellation
      bot.sendMessage(
        chatId,
        "Operation cancelled. What would you like to do?",
        {
          reply_markup: {
            inline_keyboard: createActionKeyboard(["balance"]),
          },
        }
      );
      return;
    }

    // Handle wallet selection
    if (action === "select") {
      const walletId = parts[2];

      try {
        // Set default wallet
        await walletService.setDefaultWallet(session.token, walletId);

        // Log success
        console.log("Default wallet set successfully for wallet ID:", walletId);

        // Acknowledge the callback
        bot.answerCallbackQuery(query.id, {
          text: "Default wallet updated successfully!",
          show_alert: false,
        });

        // Clear the session state
        updateSessionState(chatId, {});

        // Update the message to show success
        updateToConfirmation(
          bot,
          chatId,
          messageId,
          "✅ Default wallet set successfully! Use /balance to view your updated wallets.",
          ["balance"]
        );
      } catch (error: any) {
        console.error("Set default wallet error:", error);

        // Acknowledge the callback with error
        bot.answerCallbackQuery(query.id, {
          text: "Failed to set default wallet. Please try again.",
          show_alert: true,
        });

        // Clear the session state
        updateSessionState(chatId, {});

        // Update the message to show error
        bot.editMessageText(
          `❌ Default wallet update failed: ${
            error.response?.data?.message || "Could not set default wallet"
          }. Try again or visit ${config.supportLink}`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Try Again",
                    callback_data: "menu:setdefaultwallet",
                  },
                ],
                [{ text: "📋 Back to Menu", callback_data: "return:menu" }],
              ],
            },
          }
        );
      }
    }
  });
}
