import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession, SessionState } from "../../core/session.service";
import * as transferService from "../../services/transfer.service";
import * as payeeService from "../../services/payee.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { formatCurrency } from "../../utils/format";
import { SessionService } from "../../core/session.service";
import {
  createAmountKeyboard,
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getModuleLogger } from "../../utils/logger";

/**
 * Interface for email transfer session state
 */
interface EmailTransferSessionState extends SessionState {
  currentAction: "sendemail";
  step: "email" | "amount" | "purpose" | "confirm";
  email?: string;
  amount?: number;
  purposeCode?: string;
}

// Create module logger
const logger = getModuleLogger("email-transfer-command");

/**
 * Command to send funds to an email address
 */
export class EmailTransferCommand extends BaseTransferCommand {
  name = "email";
  description = "Send funds to an email address";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "transfer:method:email";
  }

  /**
   * Start the email transfer flow
   */
  protected async startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    try {
      // Initialize state with send email command
      this.updateSessionData<EmailTransferSessionState>(chatId, {
        currentAction: "sendemail",
        step: "email",
      });

      // Try to fetch user's saved payees
      const payeesResponse = await payeeService.getPayees(session.token);

      // Create a keyboard with buttons for each payee
      const payeeKeyboard: TelegramBot.InlineKeyboardButton[][] = [];

      if (payeesResponse?.data?.length > 0) {
        // Group buttons in rows of 2
        for (let i = 0; i < payeesResponse.data.length; i += 2) {
          const row: TelegramBot.InlineKeyboardButton[] = [];

          // Add first button in this row
          const payee1 = payeesResponse.data[i];
          const displayName1 = payee1.nickName || payee1.email;
          row.push({
            text: displayName1,
            callback_data: `payee:${payee1.email}`,
          });

          // Add second button if it exists
          if (i + 1 < payeesResponse.data.length) {
            const payee2 = payeesResponse.data[i + 1];
            const displayName2 = payee2.nickName || payee2.email;
            row.push({
              text: displayName2,
              callback_data: `payee:${payee2.email}`,
            });
          }

          payeeKeyboard.push(row);
        }
      }

      // Add a cancel button at the bottom
      payeeKeyboard.push([
        { text: "❌ Cancel", callback_data: "transfer:cancel" },
      ]);

      // Prepare message text
      let message = "📧 *Email Transfer*\n\n";
      message +=
        payeesResponse?.data?.length > 0
          ? "Please select a saved payee or enter an email address:"
          : "Please enter the recipient's email address:";

      // Send message with payee keyboard
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: payeeKeyboard,
        },
      });
    } catch (error: any) {
      logger.error("Error starting email transfer flow:", error);
      handleApiErrorResponse(
        bot,
        chatId,
        error as Error,
        "transfer:method:email"
      );

      // Fallback to simple prompt without payees
      this.updateSessionData<EmailTransferSessionState>(chatId, {
        currentAction: "sendemail",
        step: "email",
      });

      const message =
        "📧 *Email Transfer*\n\nPlease enter the recipient's email address:";
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
          ],
        },
      });
    }
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

    // Handle payee selection
    if (data.startsWith("payee:")) {
      const email = data.substring(6); // Extract email from payee:email
      await this.processEmailInput(bot, chatId, email);
      return;
    }

    // Handle purpose selection
    if (data.startsWith("purpose:")) {
      const purposeCode = data.split(":")[1];
      await this.processPurposeSelection(bot, chatId, purposeCode);
      return;
    }

    // Other callbacks handled by parent class
    await super.handleCallback(bot, query);
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

    // Handle email transfer method selection
    if (callbackData === "transfer:method:email") {
      await this.startTransferFlow(bot, chatId, session);
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
        await this.processAmountSelection(bot, chatId, amount);
      }
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
    const state = this.getSessionData<EmailTransferSessionState>(chatId);

    if (!state || state.currentAction !== "sendemail") return;

    switch (state.step) {
      case "email":
        await this.processEmailInput(bot, chatId, text);
        break;

      case "amount":
        await this.processAmountInput(bot, chatId, text);
        break;
    }
  }

  /**
   * Process email input
   */
  private async processEmailInput(
    bot: TelegramBot,
    chatId: number,
    email: string
  ): Promise<void> {
    // Validate email
    if (!this.isValidEmail(email)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid email address.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
          ],
        },
      });
      return;
    }

    // Update state with email
    this.updateSessionData<EmailTransferSessionState>(chatId, {
      email,
      step: "amount",
    });

    // Prompt for amount
    bot.sendMessage(
      chatId,
      `📧 *Send to ${email}*\n\n` + "Please select or enter an amount in USDC:",
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
    const state = this.getSessionData<EmailTransferSessionState>(chatId);
    if (!state?.email) return;

    // Update state with amount and move to purpose selection
    this.updateSessionData<EmailTransferSessionState>(chatId, {
      amount,
      step: "purpose",
    });

    // Prompt for purpose using the purpose code keyboard
    bot.sendMessage(
      chatId,
      `📝 *Transfer Details*\n\n` +
        `Recipient: ${state.email}\n` +
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
    const state = this.getSessionData<EmailTransferSessionState>(chatId);
    if (!state?.email || !state.amount) return;

    // Update state with purpose code
    this.updateSessionData<EmailTransferSessionState>(chatId, {
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
    const state = this.getSessionData<EmailTransferSessionState>(chatId);
    if (!state?.email || !state.amount) return;

    try {
      // Check if user has sufficient balance
      const session = SessionService.getSession(chatId);
      if (!session) return;

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
        `To: ${state.email}\n` +
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
      handleApiErrorResponse(bot, chatId, error, "transfer:method:email");

      // Reset state
      this.clearSessionData(chatId);
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
    const state = this.getSessionData<EmailTransferSessionState>(chatId);
    if (!state?.email || !state.amount) return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your transfer...*",
        { parse_mode: "Markdown" }
      );

      // Execute transfer
      const result = await transferService.sendToEmail(
        session.token,
        state.email,
        state.amount.toString(),
        "USDC",
        state.purposeCode || "self" // Use purpose code if set, default to 'self'
      );

      // Reset state
      this.clearSessionData(chatId);

      // Send success message
      const successMessage =
        `✅ *Transfer Successful!*\n\n` +
        `You've sent ${formatCurrency(state.amount, "USDC")} to ${
          state.email
        }\n` +
        `Reference ID: ${result.id}\n\n` +
        `The recipient will be notified via email.`;

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
      handleApiErrorResponse(bot, chatId, error, "transfer:method:email");

      // Reset state
      this.clearSessionData(chatId);
    }
  }

  /**
   * Get user-friendly display text for purpose code
   */
  private getPurposeDisplay(purposeCode: string): string {
    switch (purposeCode) {
      case "self":
        return "Self";
      case "salary":
        return "Salary";
      case "gift":
        return "Gift";
      case "reimbursement":
        return "Reimbursement";
      default:
        return "Other";
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
