import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import {
  ExtendedSession,
  SessionService,
  SessionState,
} from "../../core/session.service";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { formatCurrency, formatAddress } from "../../utils/format";
import {
  createAmountKeyboard,
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getModuleLogger } from "../../utils/logger";
import { PurposeCode } from "../../types";
import { requireAuth } from "../../core/middleware";

// Create module logger
const logger = getModuleLogger("wallet-transfer-command");

/**
 * Interface for wallet transfer session state
 */
interface WalletTransferSessionState extends SessionState {
  currentAction: "sendwallet";
  step: "address" | "amount" | "purpose" | "confirm";
  walletAddress?: string;
  amount?: number;
  purposeCode?: string;
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
    this.updateSessionData<WalletTransferSessionState>(chatId, {
      currentAction: "sendwallet",
      step: "address",
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
   * Handle callback queries
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const data = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    // Handle amount selection
    if (data.startsWith("amount:")) {
      requireAuth(bot, chatId, async () => {
        const amountPart = data.split(":")[1];

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
          await this.processAmountSelection(bot, chatId, amount);
        }
      });
      return;
    }

    // Handle transfer cancellation
    if (data === "transfer:cancel") {
      requireAuth(bot, chatId, async () => {
        await this.sendCancelMessage(bot, chatId);
      });
      return;
    }

    // Handle purpose selection
    if (data.startsWith("purpose:")) {
      requireAuth(bot, chatId, async () => {
        const purposeCode = data.split(":")[1];
        await this.processPurposeSelection(bot, chatId, purposeCode);
      });
      return;
    }

    // Handle transfer confirmation
    if (data === "transfer:confirm") {
      requireAuth(bot, chatId, async (session: ExtendedSession) => {
        await this.processTransferConfirmation(bot, chatId, session);
      });
      return;
    }

    // If none of the above, let parent class handle it
    await super.handleCallback(bot, query);
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
    const state = this.getSessionData<WalletTransferSessionState>(chatId);

    if (!state || state.currentAction !== "sendwallet") return;

    switch (state.step) {
      case "address":
        await this.processWalletAddressInput(bot, chatId, text);
        break;

      case "amount":
        await this.processAmountInput(bot, chatId, text);
        break;
    }
  }

  /**
   * Process wallet address input
   */
  private async processWalletAddressInput(
    bot: TelegramBot,
    chatId: number,
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
      // Update state with wallet address and go directly to amount step
      this.updateSessionData<WalletTransferSessionState>(chatId, {
        currentAction: "sendwallet",
        walletAddress,
        step: "amount", // Changed from "network" to "amount"
      });

      // Prompt for amount directly instead of network selection
      bot.sendMessage(
        chatId,
        `🔑 *Send to Wallet*\n\n` +
          `Wallet Address: ${formatAddress(walletAddress)}\n\n` +
          `Please select or enter an amount in USDC:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createAmountKeyboard(),
          },
        }
      );
    } catch (error: any) {
      logger.error(`Transfer setup error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:wallet");

      // Reset state
      this.clearSessionData(chatId);
    }
  }

  /**
   * Process amount input
   */
  private async processAmountInput(
    bot: TelegramBot,
    chatId: number,
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

    await this.processAmountSelection(bot, chatId, amount);
  }

  /**
   * Process amount selection from keyboard or input
   */
  private async processAmountSelection(
    bot: TelegramBot,
    chatId: number,
    amount: number
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<WalletTransferSessionState>(chatId);
    if (!state || !state.walletAddress) return;

    // For API calls, get the session
    const session = SessionService.getSession(chatId);
    if (!session) return;

    // Update state with amount and move to purpose selection
    this.updateSessionData<WalletTransferSessionState>(chatId, {
      currentAction: "sendwallet",
      amount,
      step: "purpose",
    });

    // Prompt for purpose using the purpose code keyboard
    bot.sendMessage(
      chatId,
      `📝 *Transfer Details*\n\n` +
        `Address: ${formatAddress(state.walletAddress)}\n` +
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
    purposeCode: string
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<WalletTransferSessionState>(chatId);
    if (!state || !state.walletAddress || !state.amount) return;

    // Update state with purpose code
    this.updateSessionData<WalletTransferSessionState>(chatId, {
      currentAction: "sendwallet",
      purposeCode,
      step: "confirm",
    });

    // Show confirmation
    await this.showTransferConfirmation(bot, chatId);
  }

  /**
   * Show transfer confirmation
   */
  private async showTransferConfirmation(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<WalletTransferSessionState>(chatId);
    if (!state || !state.walletAddress || !state.amount) return;

    try {
      // Get the session for API calls
      const session = SessionService.getSession(chatId);
      if (!session) return;

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
      this.clearSessionData(chatId);
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
    const state = this.getSessionData<WalletTransferSessionState>(chatId);
    if (!state || !state.walletAddress || !state.amount) return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your transfer...*",
        { parse_mode: "Markdown" }
      );

      // Execute transfer with purpose code - no need to specify network since it's handled by the API
      const result = await transferService.sendToWallet(
        session.token,
        state.walletAddress,
        state.amount.toString(),
        "USDC",
        state.purposeCode || PurposeCode.SELF // Use purpose code if set, default to 'self'
      );

      // Reset state
      this.clearSessionData(chatId);

      // Get purpose code display text
      const purposeDisplay = state.purposeCode
        ? this.getPurposeDisplay(state.purposeCode)
        : "Self"; // Default

      // Send success message
      const successMessage =
        `✅ *Transfer Successful!*\n\n` +
        `You've sent ${formatCurrency(state.amount, "USDC")} to ${formatAddress(
          state.walletAddress
        )}\n` +
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
      this.clearSessionData(chatId);
    }
  }

  /**
   * Validate wallet address format (basic check)
   */
  private isValidWalletAddress(address: string): boolean {
    // Basic validation for Ethereum-style addresses
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Process callback data (needed to implement BaseTransferCommand)
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
  }
}
