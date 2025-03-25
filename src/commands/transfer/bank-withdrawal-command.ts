import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession, SessionState } from "../../core/session.service";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { formatCurrency } from "../../utils/format";
import {
  createAmountKeyboard,
  createConfirmationKeyboard,
} from "../../utils/keyboard";
import { getModuleLogger } from "../../utils/logger";
import { SessionService } from "../../core/session.service";

// Create module logger
const logger = getModuleLogger("bank-withdrawal-command");

/**
 * Interface for bank withdrawal session state
 */
export interface BankWithdrawalSessionState extends SessionState {
  currentAction: "withdrawbank";
  step: "amount" | "confirm";
  amount?: number;
}

/**
 * Command to withdraw funds to a bank account
 */
export class BankWithdrawalCommand extends BaseTransferCommand {
  name = "bank";
  description = "Withdraw funds to a bank account";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "transfer:method:bank";
  }

  /**
   * Start the bank withdrawal flow
   */
  protected async startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    _session: ExtendedSession
  ): Promise<void> {
    // Initialize state
    this.updateSessionData<BankWithdrawalSessionState>(chatId, {
      currentAction: "withdrawbank",
      step: "amount",
    });

    bot.sendMessage(
      chatId,
      "🏦 *Withdraw to Bank*\n\n" +
        "Please select or enter the amount in USD that you want to withdraw to your bank account:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createAmountKeyboard(),
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

    // Handle bank withdrawal method selection
    if (callbackData === "transfer:method:bank") {
      await this.startTransferFlow(bot, chatId, session);
      return;
    }

    // Handle amount selection from keyboard
    if (callbackData.startsWith("amount:")) {
      const amountPart = callbackData.split(":")[1];

      if (amountPart === "custom") {
        bot.sendMessage(
          chatId,
          "💰 Please enter the amount you want to withdraw:",
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
      return;
    }

    // Handle transfer confirmation
    if (callbackData === "transfer:confirm") {
      await this.processWithdrawalConfirmation(bot, chatId, session);
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
    const state = this.getSessionData<BankWithdrawalSessionState>(chatId);

    if (!state || state.currentAction !== "withdrawbank") return;

    switch (state.step) {
      case "amount":
        await this.processAmountInput(bot, chatId, msg.text);
        break;
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
    try {
      // Get the session for API calls
      const session = SessionService.getSession(chatId);
      if (!session) return;

      // Check if user has sufficient balance
      const balanceCheck = await transferService.checkSufficientBalance(
        session.token,
        amount.toString()
      );

      if (!balanceCheck.hasSufficientBalance) {
        bot.sendMessage(
          chatId,
          `⚠️ *Insufficient Balance*\n\n` +
            `You don't have enough funds to complete this withdrawal.\n` +
            `Amount: ${formatCurrency(amount, "USD")}\n` +
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

      // Update state with amount
      this.updateSessionData<BankWithdrawalSessionState>(chatId, {
        amount,
        step: "confirm",
      });

      // Show confirmation
      await this.showWithdrawalConfirmation(bot, chatId);
    } catch (error: any) {
      logger.error(`Balance check error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:bank");

      // Reset state
      this.clearSessionData(chatId);
    }
  }

  /**
   * Show withdrawal confirmation
   */
  private async showWithdrawalConfirmation(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<BankWithdrawalSessionState>(chatId);
    if (!state || !state.amount) return;

    const message =
      `🏦 *Bank Withdrawal Confirmation*\n\n` +
      `Amount: ${formatCurrency(state.amount, "USD")}\n\n` +
      `Funds will be sent to your registered bank account. Processing time may vary depending on your bank.`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: createConfirmationKeyboard(
          "transfer:confirm",
          "transfer:cancel"
        ),
      },
    });
  }

  /**
   * Process withdrawal confirmation
   */
  private async processWithdrawalConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<BankWithdrawalSessionState>(chatId);
    if (!state || !state.amount) return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your withdrawal request...*",
        { parse_mode: "Markdown" }
      );

      // Execute bank withdrawal
      const result = await transferService.withdrawToBank(
        session.token,
        state.amount.toString(),
        "USD"
      );

      // Reset state
      this.clearSessionData(chatId);

      // Send success message
      const successMessage =
        `✅ *Withdrawal Request Submitted*\n\n` +
        `You've requested to withdraw ${formatCurrency(
          state.amount,
          "USD"
        )} to your bank account.\n` +
        `Reference ID: ${result.id}\n\n` +
        `The funds will be processed and transferred to your registered bank account. ` +
        `This typically takes 1-3 business days depending on your bank.`;

      bot.deleteMessage(chatId, loadingMsg.message_id);
      bot.sendMessage(chatId, successMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 View Balance", callback_data: "action:balance" }],
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      });
    } catch (error: any) {
      logger.error(`Withdrawal error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:bank");

      // Reset state
      this.clearSessionData(chatId);
    }
  }
}
