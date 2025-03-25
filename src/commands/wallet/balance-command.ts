import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { requireAuth } from "../../core/middleware";
import * as walletService from "../../services/wallet.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { formatCurrency } from "../../utils/format";
import { getModuleLogger } from "../../utils/logger";
import { WalletBalance, Wallet } from "../../types/wallet";
import { getNetworkName } from "../../utils/constants";

// Create module logger
const logger = getModuleLogger("balance-command");

/**
 * Balance command implementation
 */
export class BalanceCommand implements BotCommand {
  name = "balance";
  description = "Check your wallet balances";

  /**
   * Execute balance command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Show loading message
        const loadingMsg = await bot.sendMessage(
          chatId,
          "💰 *Fetching your balances...*",
          { parse_mode: "Markdown" }
        );

        // Fetch wallets and balances
        const wallets = await walletService.getWallets(session.token);
        const balances = await walletService.getWalletBalances(session.token);

        // Get default wallet
        const defaultWallet = wallets.find((wallet) => wallet.isDefault);

        // Format message
        let message = "💰 *Your Balances*\n\n";

        if (balances.length === 0) {
          message += "You don't have any balance yet.\n";
        } else {
          balances.forEach((balance: WalletBalance) => {
            const wallet = wallets.find(
              (w: Wallet) => w.id === balance.walletId
            );

            // Get proper network name from the constants utility
            const networkId = wallet ? wallet.network : balance.network;
            const networkName = getNetworkName(networkId, true); // Use full network name
            const isDefault = wallet?.isDefault ? " (Default)" : "";

            message += `*${networkName}${isDefault}*\n`;

            // Include wallet address in the message with backticks for easy copying
            if (wallet?.walletAddress) {
              message += `Address: \`${wallet.walletAddress}\`\n`;
            }

            // Check if balances array exists and has items
            if (balance.balances && balance.balances.length > 0) {
              // Iterate through balances for this wallet
              balance.balances.forEach((tokenBalance) => {
                message += `Balance: ${formatCurrency(
                  tokenBalance.balance,
                  tokenBalance.symbol
                )}\n`;
              });
            } else {
              message += "No balance information available\n";
            }
            message += "\n";
          });
        }

        // Add actions based on wallet status
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        // Transfer button
        keyboard.push([
          { text: "💸 Transfer", callback_data: "action:transfer" },
          { text: "📥 Deposit", callback_data: "menu:deposit" },
        ]);

        // Set default wallet button (if needed)
        if (wallets.length > 1 && !defaultWallet) {
          keyboard.push([
            {
              text: "⭐ Set Default Wallet",
              callback_data: "action:settings",
            },
          ]);
        }

        // Main menu button
        keyboard.push([{ text: "« Back to Menu", callback_data: "menu:main" }]);

        // Update the loading message with actual data
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
      } catch (error: any) {
        logger.error(`Balance fetch error:`, error);
        handleApiErrorResponse(bot, chatId, error as Error, "menu:balance");
      }
    });
  }

  /**
   * Handle callback queries related to balance
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "menu:balance" || callbackData === "action:balance") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}

/**
 * Wallets command implementation - shows wallet addresses by network
 */
export class WalletsCommand implements BotCommand {
  name = "wallets";
  description = "View your wallet addresses";

  /**
   * Execute wallets command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (session) => {
      try {
        // Show loading message
        const loadingMsg = await bot.sendMessage(
          chatId,
          "🔑 *Fetching your wallet addresses...*",
          { parse_mode: "Markdown" }
        );

        // Fetch wallets
        const wallets = await walletService.getWallets(session.token);

        // Format message
        let message = "🔑 *Your Wallet Addresses*\n\n";

        if (wallets.length === 0) {
          message += "You don't have any wallets yet.\n";
        } else {
          wallets.forEach((wallet: Wallet) => {
            // Get proper network name from the constants utility
            const networkName = getNetworkName(wallet.network, true); // Use full network name
            const isDefault = wallet.isDefault ? " ⭐(Default)" : "";

            message += `*${networkName}${isDefault}*\n`;

            // Display wallet address wrapped in backticks for easy copying
            if (wallet.walletAddress) {
              message += `\`${wallet.walletAddress}\`\n\n`;
            } else {
              message += "No address available\n\n";
            }
          });
        }

        // Add helpful footer
        message +=
          "_Addresses are formatted in code blocks for easy copying. Just tap on an address to copy it._";

        // Create keyboard with actions
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

        // Add useful actions
        keyboard.push([
          { text: "💰 View Balances", callback_data: "action:balance" },
          { text: "📥 Deposit", callback_data: "menu:deposit" },
        ]);

        // Set default wallet button (if needed)
        if (wallets.length > 1 && !wallets.some((wallet) => wallet.isDefault)) {
          keyboard.push([
            { text: "⭐ Set Default Wallet", callback_data: "action:settings" },
          ]);
        }

        // Main menu button
        keyboard.push([{ text: "« Back to Menu", callback_data: "menu:main" }]);

        // Update the loading message with actual data
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
      } catch (error: any) {
        logger.error(`Wallets fetch error:`, error);
        handleApiErrorResponse(bot, chatId, error as Error, "menu:wallets");
      }
    });
  }

  /**
   * Handle callback queries related to wallets
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "menu:wallets" || callbackData === "action:wallets") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
