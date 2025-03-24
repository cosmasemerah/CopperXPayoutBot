import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession } from "../../session";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { formatCurrency, formatAddress } from "../../utils/format";
import { getSession, updateSessionState } from "../../session";
import {
  createAmountKeyboard,
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../re-utils/keyboard";
import { getModuleLogger } from "../../re-utils/logger";
import { PurposeCode } from "../../types";

// Create module logger
const logger = getModuleLogger("wallet-transfer-command");

// Interface for wallet transfer state
interface WalletTransferState {
  walletAddress?: string;
  amount?: number;
  network?: string;
  purposeCode?: string;
  step: "address" | "network" | "amount" | "purpose" | "confirm";
}

/**
 * Command to send funds to a wallet address
 */
export class WalletTransferCommand extends BaseTransferCommand {
  name = "wallet";
  description = "Send funds to a wallet address";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "transfer:method:wallet";
  }

  /**
   * Start the wallet transfer flow
   */
  protected async startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    _session: ExtendedSession
  ): Promise<void> {
    // Initialize state
    updateSessionState(chatId, {
      currentAction: "sendwallet",
      data: {
        transferState: {
          step: "address",
        },
      },
    });

    bot.sendMessage(
      chatId,
      "🔑 *Send to Wallet*\n\n" +
        "Please enter the recipient's wallet address:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
          ],
        },
      }
    );
  }

  /**
   * Process callback data
   */
  protected async processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery,
    session: ExtendedSession
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    // Handle wallet transfer method selection
    if (callbackData === "transfer:method:wallet") {
      await this.startTransferFlow(bot, chatId, session);
      return;
    }

    // Handle network selection
    if (callbackData.startsWith("network:")) {
      const network = callbackData.split(":")[1];
      await this.processNetworkSelection(bot, chatId, session, network);
      return;
    }

    // Handle amount selection from keyboard
    if (callbackData.startsWith("amount:")) {
      const amountPart = callbackData.split(":")[1];

      if (amountPart === "custom") {
        bot.sendMessage(
          chatId,
          "💰 Please enter the amount you want to send:",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
              ],
            },
          }
        );
        return;
      }

      const amount = parseFloat(amountPart);
      if (!isNaN(amount)) {
        await this.processAmountSelection(bot, chatId, session, amount);
      }
      return;
    }

    // Handle purpose selection
    if (callbackData.startsWith("purpose:")) {
      const purposeCode = callbackData.split(":")[1];
      await this.processPurposeSelection(bot, chatId, session, purposeCode);
      return;
    }

    // Handle transfer confirmation
    if (callbackData === "transfer:confirm") {
      await this.processTransferConfirmation(bot, chatId, session);
      return;
    }

    // Handle transfer cancellation
    if (callbackData === "transfer:cancel") {
      await this.sendCancelMessage(bot, chatId);
      return;
    }
  }

  /**
   * Handle user input for multi-step flow
   */
  async handleUserInput(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const session = getSession(chatId);

    if (!session || !session.state || !session.state.currentAction) return;

    if (session.state.currentAction !== "sendwallet") return;

    const state = session.state.data?.transferState as WalletTransferState;
    if (!state) return;

    switch (state.step) {
      case "address":
        await this.processWalletAddressInput(bot, chatId, session, text);
        break;

      case "amount":
        await this.processAmountInput(bot, chatId, session, text);
        break;
    }
  }

  /**
   * Process wallet address input
   */
  private async processWalletAddressInput(
    bot: TelegramBot,
    chatId: number,
    _session: ExtendedSession,
    walletAddress: string
  ): Promise<void> {
    // Validate wallet address (basic check, could be enhanced)
    if (!this.isValidWalletAddress(walletAddress)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid wallet address.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
          ],
        },
      });
      return;
    }

    try {
      // Update state with wallet address
      updateSessionState(chatId, {
        data: {
          transferState: {
            walletAddress,
            step: "network",
          },
        },
      });

      // Get available networks
      const networks = ["ethereum", "polygon", "base", "arbitrum"];

      // Create network selection keyboard
      const networkKeyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (const network of networks) {
        networkKeyboard.push([
          {
            text: network.charAt(0).toUpperCase() + network.slice(1),
            callback_data: `network:${network}`,
          },
        ]);
      }

      // Add cancel button
      networkKeyboard.push([
        { text: "❌ Cancel", callback_data: "transfer:cancel" },
      ]);

      // Prompt for network selection
      bot.sendMessage(
        chatId,
        `🔑 *Send to Wallet*\n\n` +
          `Wallet Address: ${formatAddress(walletAddress)}\n\n` +
          `Please select the network:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: networkKeyboard,
          },
        }
      );
    } catch (error: any) {
      logger.error(`Network fetch error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:wallet");

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });
    }
  }

  /**
   * Process network selection
   */
  private async processNetworkSelection(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    network: string
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as WalletTransferState;
    if (!state || !state.walletAddress) return;

    // Update state with network
    updateSessionState(chatId, {
      data: {
        transferState: {
          ...state,
          network,
          step: "amount",
        },
      },
    });

    // Prompt for amount
    bot.sendMessage(
      chatId,
      `🔑 *Send to Wallet on ${network}*\n\n` +
        `Address: ${formatAddress(state.walletAddress)}\n\n` +
        `Please select or enter an amount in USDC:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createAmountKeyboard(),
        },
      }
    );
  }

  /**
   * Process amount input
   */
  private async processAmountInput(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    amountText: string
  ): Promise<void> {
    const amount = parseFloat(amountText);

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(
        chatId,
        "⚠️ Please enter a valid amount greater than 0.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
            ],
          },
        }
      );
      return;
    }

    await this.processAmountSelection(bot, chatId, session, amount);
  }

  /**
   * Process amount selection from keyboard or input
   */
  private async processAmountSelection(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    amount: number
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as WalletTransferState;
    if (!state || !state.walletAddress || !state.network) return;

    // Update state with amount and move to purpose selection
    updateSessionState(chatId, {
      data: {
        transferState: {
          ...state,
          amount,
          step: "purpose",
        },
      },
    });

    // Prompt for purpose using the purpose code keyboard
    bot.sendMessage(
      chatId,
      `📝 *Transfer Details*\n\n` +
        `Address: ${formatAddress(state.walletAddress)}\n` +
        `Network: ${state.network}\n` +
        `Amount: ${formatCurrency(amount, "USDC")}\n\n` +
        `Please select the purpose of this transfer:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createPurposeCodeKeyboard("purpose"),
        },
      }
    );
  }

  /**
   * Process purpose selection
   */
  private async processPurposeSelection(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    purposeCode: string
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as WalletTransferState;
    if (!state || !state.walletAddress || !state.amount || !state.network)
      return;

    // Update state with purpose code
    updateSessionState(chatId, {
      data: {
        transferState: {
          ...state,
          purposeCode,
          step: "confirm",
        },
      },
    });

    // Show confirmation
    await this.showTransferConfirmation(bot, chatId, session);
  }

  /**
   * Show transfer confirmation
   */
  private async showTransferConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as WalletTransferState;
    if (!state || !state.walletAddress || !state.amount || !state.network)
      return;

    try {
      // Check if user has sufficient balance
      const balanceCheck = await transferService.checkSufficientBalance(
        session.token,
        state.amount.toString()
      );

      if (!balanceCheck.hasSufficientBalance) {
        bot.sendMessage(
          chatId,
          `⚠️ *Insufficient Balance*\n\n` +
            `You don't have enough USDC to complete this transfer.\n` +
            `Amount: ${formatCurrency(state.amount, "USDC")}\n` +
            `Available: ${formatCurrency(balanceCheck.balance, "USDC")}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Deposit", callback_data: "action:deposit" }],
                [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
              ],
            },
          }
        );
        return;
      }

      // Get purpose code display text
      const purposeDisplay = state.purposeCode
        ? this.getPurposeDisplay(state.purposeCode)
        : "Self"; // Default

      const message =
        `💰 *Transfer Confirmation*\n\n` +
        `From: Your Copperx Account\n` +
        `To: ${formatAddress(state.walletAddress)}\n` +
        `Network: ${state.network}\n` +
        `Amount: ${formatCurrency(state.amount, "USDC")}\n` +
        `Purpose: ${purposeDisplay}`;

      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createConfirmationKeyboard(
            "transfer:confirm",
            "transfer:cancel"
          ),
        },
      });
    } catch (error: any) {
      logger.error(`Balance check error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:wallet");

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });
    }
  }

  /**
   * Get user-friendly display text for purpose code
   */
  private getPurposeDisplay(purposeCode: string): string {
    switch (purposeCode) {
      case PurposeCode.SELF:
        return "Self";
      case PurposeCode.SALARY:
        return "Salary";
      case PurposeCode.GIFT:
        return "Gift";
      case PurposeCode.REIMBURSEMENT:
        return "Reimbursement";
      default:
        return "Other";
    }
  }

  /**
   * Process transfer confirmation
   */
  private async processTransferConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as WalletTransferState;
    if (!state || !state.walletAddress || !state.amount || !state.network)
      return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your transfer...*",
        { parse_mode: "Markdown" }
      );

      // Execute transfer with purpose code
      const result = await transferService.sendToWallet(
        session.token,
        state.walletAddress,
        state.amount.toString(),
        "USDC",
        state.network,
        state.purposeCode || PurposeCode.SELF // Use purpose code if set, default to 'self'
      );

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });

      // Get purpose code display text
      const purposeDisplay = state.purposeCode
        ? this.getPurposeDisplay(state.purposeCode)
        : "Self"; // Default

      // Send success message
      const successMessage =
        `✅ *Transfer Successful!*\n\n` +
        `You've sent ${formatCurrency(state.amount, "USDC")} to ${formatAddress(
          state.walletAddress
        )} on ${state.network}\n` +
        `Purpose: ${purposeDisplay}\n` +
        `Reference ID: ${result.id}`;

      bot.deleteMessage(chatId, loadingMsg.message_id);
      bot.sendMessage(chatId, successMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 View Balance", callback_data: "action:balance" }],
            [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
          ],
        },
      });
    } catch (error: any) {
      logger.error(`Transfer error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:wallet");

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });
    }
  }

  /**
   * Validate wallet address format (basic check)
   */
  private isValidWalletAddress(address: string): boolean {
    // Basic validation for Ethereum-style addresses
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}
