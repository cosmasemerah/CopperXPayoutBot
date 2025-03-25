import TelegramBot from "node-telegram-bot-api";
import * as walletService from "../../services/wallet.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { getModuleLogger } from "../../utils/logger";
import { getNetworkName } from "../../utils/constants";
import { sendWalletQRCode } from "../../utils/message-templates";
import { Wallet } from "../../types/wallet";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession, SessionState } from "../../core/session.service";
import { requireAuth } from "../../core/middleware";

// Create module logger
const logger = getModuleLogger("deposit-command");

/**
 * Interface for deposit session state
 */
interface DepositSessionState extends SessionState {
  currentAction: "deposit";
  step: "wallet_selection" | "show_address";
  walletId?: string;
  network?: string;
  walletAddress?: string;
}

/**
 * Deposit command implementation for handling wallet deposits
 */
export class DepositCommand extends BaseTransferCommand {
  name = "deposit";
  description = "Deposit funds to your wallet";

  /**
   * Get the callback prefix used by this command
   */
  protected getCallbackPrefix(): string {
    return "deposit:";
  }

  /**
   * Start the deposit flow
   */
  protected async startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    try {
      // Fetch all user wallets
      const wallets = await walletService.getWallets(session.token);

      logger.info(`Fetched ${wallets.length} wallets for user`, { chatId });

      if (!wallets || wallets.length === 0) {
        bot.sendMessage(
          chatId,
          "⚠️ You don't have any wallets set up.\nPlease visit https://copperx.io to set up your wallets first."
        );
        return;
      }

      // Set session state for deposit flow
      this.updateSessionData<DepositSessionState>(chatId, {
        currentAction: "deposit",
        step: "wallet_selection",
      });

      // Create wallet list in the message for better visibility
      let message = "💰 *Deposit to Your Wallet*\n\n";
      message += "Please select which wallet you would like to deposit to:\n\n";

      wallets.forEach((wallet) => {
        const isDefault = wallet.isDefault ? " (Default)" : "";
        const networkName = getNetworkName(wallet.network, true);
        message += `- *${networkName}${isDefault}*\n  \`${wallet.walletAddress}\`\n\n`;
      });

      // Show wallet selection options
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: this.createDepositWalletSelectionKeyboard(wallets),
        },
      });
    } catch (error) {
      logger.error("Wallet fetch error:", { error });
      handleApiErrorResponse(bot, chatId, error as Error, "action:deposit");
    }
  }

  /**
   * Process callback data for this command
   */
  protected async processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery,
    session: ExtendedSession
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;
    const parts = callbackData.split(":");
    const action = parts[1];

    // Get current deposit state
    const state = this.getSessionData<DepositSessionState>(chatId);

    // Handle wallet selection
    if (action === "wallet" && parts.length >= 4) {
      const walletId = parts[2];
      const network = parts[3];

      try {
        // Fetch the wallet to get the address
        const wallets = await walletService.getWallets(session.token);
        const selectedWallet = wallets.find((w) => w.id === walletId);

        if (!selectedWallet) {
          bot.answerCallbackQuery(query.id, {
            text: "Wallet not found. Please try again.",
            show_alert: true,
          });
          return;
        }

        // Update state with selected wallet
        this.updateSessionData<DepositSessionState>(chatId, {
          step: "show_address",
          walletId: walletId,
          network: network,
          walletAddress: selectedWallet.walletAddress,
        });

        // Get network name for display
        const networkName = getNetworkName(network);

        // Format wallet address for display
        const walletAddress = selectedWallet.walletAddress;

        // Show wallet address with warning and QR code option
        bot.editMessageText(
          `📥 *Deposit to ${networkName} Wallet*\n\n` +
            `Please send *USDC only* to the following wallet address:\n\n` +
            `\`${walletAddress}\`\n\n` +
            `⚠️ *IMPORTANT:*\n` +
            `• Only deposit USDC tokens\n` +
            `• Make sure you are using the ${networkName} network\n` +
            `• Deposits from other networks may result in loss of funds\n\n` +
            `You will receive a notification when your deposit is confirmed.`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: this.createDepositActionsKeyboard(walletId),
            },
          }
        );
      } catch (error) {
        logger.error("Error processing wallet selection:", { error });
        handleApiErrorResponse(bot, chatId, error as Error, "action:deposit");
      }
    }
    // Handle QR code generation
    else if (action === "qrcode" && parts.length >= 3) {
      // Retrieve wallet address from state
      if (state?.walletAddress) {
        try {
          // Use the utility function to send QR code
          await sendWalletQRCode(
            bot,
            chatId,
            state.walletAddress,
            state.network
          );
        } catch (error) {
          logger.error("Error generating QR code:", { error });
          bot.sendMessage(
            chatId,
            "❌ Failed to generate QR code. Please try again later."
          );
        }
      } else {
        bot.answerCallbackQuery(query.id, {
          text: "Could not generate QR code. Wallet address not found.",
          show_alert: true,
        });
      }
    }
    // Handle cancellation
    else if (action === "cancel") {
      // Clear state
      this.clearSessionData(chatId);

      // Show cancellation message
      bot.editMessageText("🚫 Deposit operation cancelled.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📥 Try Again", callback_data: "menu:deposit" }],
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      });
    }
  }

  /**
   * Create wallet selection keyboard for deposit
   */
  private createDepositWalletSelectionKeyboard(
    wallets: Wallet[]
  ): TelegramBot.InlineKeyboardButton[][] {
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    // Add a button for each wallet
    wallets.forEach((wallet) => {
      const isDefault = wallet.isDefault ? " (Default)" : "";
      const networkName = getNetworkName(wallet.network, true);

      keyboard.push([
        {
          text: `${networkName}${isDefault}`,
          callback_data: `deposit:wallet:${wallet.id}:${wallet.network}`,
        },
      ]);
    });

    // Add cancel button
    keyboard.push([{ text: "❌ Cancel", callback_data: "deposit:cancel" }]);

    return keyboard;
  }

  /**
   * Create keyboard for deposit actions
   */
  private createDepositActionsKeyboard(
    walletId: string
  ): TelegramBot.InlineKeyboardButton[][] {
    return [
      [{ text: "📱 Get QR Code", callback_data: `deposit:qrcode:${walletId}` }],
      [{ text: "❌ Cancel", callback_data: "deposit:cancel" }],
    ];
  }

  /**
   * Handle callback queries
   * Override to handle menu:deposit callback
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    // Handle menu:deposit callback explicitly
    if (callbackData === "menu:deposit") {
      requireAuth(bot, chatId, async (session) => {
        await this.startTransferFlow(bot, chatId, session);
      });
      return;
    }

    // Let the parent class handle other callbacks
    await super.handleCallback(bot, query);
  }
}
