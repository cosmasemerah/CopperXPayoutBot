import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession } from "../../session";
import * as transferService from "../../services/transfer.service";
import * as payeeService from "../../services/payee.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { formatCurrency } from "../../re-utils/format";
import { getSession, updateSessionState } from "../../session";
import {
  createAmountKeyboard,
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../re-utils/keyboard";
import { getModuleLogger } from "../../re-utils/logger";

// Create module logger
const logger = getModuleLogger("email-transfer-command");

// Extended interface for email transfer state
interface EmailTransferState {
  email?: string;
  amount?: number;
  purposeCode?: string;
  step: "email" | "amount" | "purpose" | "confirm";
}

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
      updateSessionState(chatId, {
        currentAction: "sendemail",
        data: {
          transferState: {
            step: "email",
          },
        },
      });

      // Try to fetch user's saved payees
      const payeesResponse = await payeeService.getPayees(session.token);

      // Create a keyboard with buttons for each payee
      const payeeKeyboard: TelegramBot.InlineKeyboardButton[][] = [];

      if (
        payeesResponse &&
        payeesResponse.data &&
        payeesResponse.data.length > 0
      ) {
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

      if (
        payeesResponse &&
        payeesResponse.data &&
        payeesResponse.data.length > 0
      ) {
        message += "Please select a saved payee or enter an email address:";
      } else {
        message += "Please enter the recipient's email address:";
      }

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
      updateSessionState(chatId, {
        currentAction: "sendemail",
        data: {
          transferState: {
            step: "email",
          },
        },
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
    callbackQuery: TelegramBot.CallbackQuery
  ): Promise<void> {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId) return;

    const data = callbackQuery.data;
    const session = getSession(chatId);

    if (!data) return;

    // Handle payee selection
    if (data.startsWith("payee:")) {
      const email = data.substring(6); // Extract email from payee:email
      if (session) {
        await this.processEmailInput(bot, chatId, session, email);
      } else {
        // Handle case when session is undefined
        bot.sendMessage(chatId, "⚠️ Session expired. Please start over.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
            ],
          },
        });
      }
      return;
    }

    // Handle purpose selection
    if (data.startsWith("purpose:")) {
      if (session) {
        const purposeCode = data.split(":")[1];
        await this.processPurposeSelection(bot, chatId, session, purposeCode);
      } else {
        // Handle case when session is undefined
        bot.sendMessage(chatId, "⚠️ Session expired. Please start over.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Main Menu", callback_data: "menu:main" }],
            ],
          },
        });
      }
      return;
    }

    // Other callbacks handled by parent class
    await super.handleCallback(bot, callbackQuery);
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

    // Handle payee selection from keyboard
    if (callbackData.startsWith("select:payee:")) {
      const email = callbackData.substring("select:payee:".length);
      await this.processEmailInput(bot, chatId, session, email);
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

    if (session.state.currentAction !== "sendemail") return;

    const state = session.state.data?.transferState as EmailTransferState;
    if (!state) return;

    switch (state.step) {
      case "email":
        await this.processEmailInput(bot, chatId, session, text);
        break;

      case "amount":
        await this.processAmountInput(bot, chatId, session, text);
        break;
    }
  }

  /**
   * Process email input
   */
  private async processEmailInput(
    bot: TelegramBot,
    chatId: number,
    _session: ExtendedSession,
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
    updateSessionState(chatId, {
      data: {
        transferState: {
          email,
          step: "amount",
        },
      },
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
    const state = session.state?.data?.transferState as EmailTransferState;
    if (!state || !state.email) return;

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
    session: ExtendedSession,
    purposeCode: string
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as EmailTransferState;
    if (!state || !state.email || !state.amount) return;

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
    const state = session.state?.data?.transferState as EmailTransferState;
    if (!state || !state.email || !state.amount) return;

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
      updateSessionState(chatId, { currentAction: undefined, data: {} });
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
   * Process transfer confirmation
   */
  private async processTransferConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as EmailTransferState;
    if (!state || !state.email || !state.amount) return;

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
      updateSessionState(chatId, { currentAction: undefined, data: {} });

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
      updateSessionState(chatId, { currentAction: undefined, data: {} });
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
