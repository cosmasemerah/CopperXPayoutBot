import TelegramBot from "node-telegram-bot-api";
import { getSession } from "../session";
import * as walletService from "../services/wallet.service";
import { formatWalletBalances } from "../utils/format";

// Store wallet ID input state
const awaitingWalletId = new Map<number, boolean>();

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
        "⚠️ You need to be logged in to view your wallet balances.\nPlease use /login to authenticate."
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
        bot.sendMessage(
          chatId,
          "💰 *Wallet Balances*\n\n" +
            "You don't have any wallets yet.\n" +
            "Please visit https://copperx.io to create a wallet.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Format wallet balances using the utility function
      const balanceMessage = formatWalletBalances(walletBalances, networkNames);

      // Add a hint for setting default wallet
      const messageWithHint =
        balanceMessage +
        "\nUse /setdefaultwallet to change your default wallet.";

      bot.sendMessage(chatId, messageWithHint, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Wallet balances fetch error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to fetch your wallet balances. Please try again later."
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
        "⚠️ You need to be logged in to set your default wallet.\nPlease use /login to authenticate."
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
        bot.sendMessage(
          chatId,
          "⚠️ You don't have any wallets yet.\nPlease visit https://copperx.io to create a wallet."
        );
        return;
      }

      // Display available wallets
      let walletMessage =
        "Please select a wallet ID to set as default by replying with the wallet ID:\n\n";

      for (const wallet of walletBalances) {
        // Get network name
        const networkName =
          networkNames[wallet.network] || `Network ${wallet.network}`;

        walletMessage += `Network: ${networkName} (${wallet.network})\n`;
        walletMessage += `Current Default: ${
          wallet.isDefault ? "Yes" : "No"
        }\n`;
        walletMessage += `Wallet ID: ${wallet.walletId}\n\n`;
      }

      bot.sendMessage(chatId, walletMessage);

      // Set awaiting wallet ID state
      awaitingWalletId.set(chatId, true);
    } catch (error) {
      console.error("Wallet fetch error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to fetch your wallets. Please try again later."
      );
    }
  });

  // Handle wallet ID input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands
    if (!text || text.startsWith("/")) return;

    // Handle wallet ID input
    if (awaitingWalletId.get(chatId)) {
      awaitingWalletId.delete(chatId);

      const session = getSession(chatId);
      if (!session) {
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      try {
        // Set default wallet
        await walletService.setDefaultWallet(session.token, text);

        // Log the response for debugging
        console.log("Default wallet set successfully for wallet ID:", text);

        bot.sendMessage(
          chatId,
          "✅ Default wallet set successfully! Use /balance to view your updated wallets."
        );
      } catch (error) {
        console.error("Set default wallet error:", error);
        bot.sendMessage(
          chatId,
          "❌ Failed to set default wallet. Please verify the wallet ID and try again with /setdefaultwallet."
        );
      }
    }
  });
}
