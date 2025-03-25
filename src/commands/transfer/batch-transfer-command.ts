import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import {
  ExtendedSession,
  SessionService,
  SessionState,
} from "../../core/session.service";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { formatCurrency } from "../../utils/format";
import {
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getModuleLogger } from "../../utils/logger";
import { PurposeCode } from "../../types";
import { BatchTransferResponseItem } from "../../types";

// Create module logger
const logger = getModuleLogger("batch-transfer-command");

/**
 * Interface defining recipient in batch transfer
 */
interface BatchRecipient {
  email: string;
  amount: number;
  purposeCode?: string;
}

/**
 * Interface for batch transfer session state
 */
interface BatchTransferSessionState extends SessionState {
  currentAction: "sendbatch";
  step: "upload" | "confirm";
  recipients: BatchRecipient[];
  purposeCode: string;
  currentRecipientIndex?: number;
}

/**
 * Command to send funds to multiple recipients at once
 */
export class BatchTransferCommand extends BaseTransferCommand {
  name = "batch";
  description = "Send funds to multiple recipients at once";

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "transfer:method:batch";
  }

  /**
   * Start the batch transfer flow
   */
  protected async startTransferFlow(
    bot: TelegramBot,
    chatId: number,
    _session: ExtendedSession
  ): Promise<void> {
    // Initialize state with send batch command
    this.updateSessionData<BatchTransferSessionState>(chatId, {
      currentAction: "sendbatch",
      step: "upload",
      recipients: [],
      purposeCode: PurposeCode.SELF,
    });

    bot.sendMessage(
      chatId,
      "📋 *Batch Transfer*\n\n" +
        "Please enter recipients in the following format, one per line:\n" +
        "`email@example.com,amount`\n\n" +
        "For example:\n" +
        "`john@example.com,10.5`\n" +
        "`jane@example.com,25`\n\n" +
        "Or you can upload a CSV file with the same format.",
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

    // Handle batch transfer method selection
    if (callbackData === "transfer:method:batch") {
      await this.startTransferFlow(bot, chatId, session);
      return;
    }

    // Handle purpose selection
    if (callbackData.startsWith("purpose:")) {
      const purposeCode = callbackData.split(":")[1];
      await this.processPurposeSelection(bot, chatId, purposeCode);
      return;
    }

    // Handle transfer confirmation
    if (callbackData === "transfer:confirm") {
      await this.processBatchConfirmation(bot, chatId, session);
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
    if (!msg.text && !msg.document) return;

    const chatId = msg.chat.id;
    const state = this.getSessionData<BatchTransferSessionState>(chatId);

    if (!state || state.currentAction !== "sendbatch") return;

    if (state.step === "upload") {
      // Handle document upload (CSV file)
      if (msg.document) {
        // File handling would go here - we'll skip the implementation for simplicity
        bot.sendMessage(
          chatId,
          "⚠️ CSV file processing is not implemented in this example.",
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

      // Handle text input (list of recipients)
      if (msg.text) {
        const session = SessionService.getSession(chatId);
        if (!session) return;

        await this.processDirectTextInput(bot, chatId, session, msg.text);
      }
    }
  }

  /**
   * Process direct text input (recipients list)
   */
  private async processDirectTextInput(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    text: string
  ): Promise<void> {
    // Parse input and validate recipients
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const recipients: BatchRecipient[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const parts = line.split(",");

      if (parts.length < 2) {
        errors.push(`Line ${i + 1}: Invalid format, expected "email,amount"`);
        continue;
      }

      const email = parts[0].trim();
      const amountStr = parts[1].trim();
      const amount = parseFloat(amountStr);

      // Validate email format
      if (!this.isValidEmail(email)) {
        errors.push(`Line ${i + 1}: Invalid email address "${email}"`);
        continue;
      }

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        errors.push(
          `Line ${
            i + 1
          }: Invalid amount "${amountStr}", must be a positive number`
        );
        continue;
      }

      // Add valid recipient
      recipients.push({
        email,
        amount,
        purposeCode: PurposeCode.SELF, // Default purpose code
      });
    }

    // If there are validation errors, show them and let the user try again
    if (errors.length > 0) {
      let errorMessage = "⚠️ *Validation Errors*\n\n";
      errorMessage += errors.join("\n");
      errorMessage +=
        "\n\nPlease fix these errors and submit your recipients again.";

      bot.sendMessage(chatId, errorMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
          ],
        },
      });
      return;
    }

    // Ensure we have at least one recipient
    if (recipients.length === 0) {
      bot.sendMessage(
        chatId,
        "⚠️ No valid recipients found. Please try again with at least one valid recipient.",
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

    try {
      // Calculate total amount to transfer
      const totalAmount = recipients.reduce(
        (sum, recipient) => sum + recipient.amount,
        0
      );

      // Check if user has sufficient balance
      const balanceCheck = await transferService.checkSufficientBalance(
        session.token,
        totalAmount.toString()
      );

      if (!balanceCheck.hasSufficientBalance) {
        bot.sendMessage(
          chatId,
          `⚠️ *Insufficient Balance*\n\n` +
            `You don't have enough USDC to complete this batch transfer.\n` +
            `Total Amount: ${formatCurrency(totalAmount, "USDC")}\n` +
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

      // Update state with recipients
      this.updateSessionData<BatchTransferSessionState>(chatId, {
        recipients,
        step: "confirm",
      });

      // Prompt for purpose selection
      bot.sendMessage(
        chatId,
        `📝 *Batch Transfer Details*\n\n` +
          `Recipients: ${recipients.length}\n` +
          `Total Amount: ${formatCurrency(totalAmount, "USDC")}\n\n` +
          `Please select the purpose for all transfers:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createPurposeCodeKeyboard("purpose"),
          },
        }
      );
    } catch (error: any) {
      logger.error(`Balance check error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:batch");

      // Reset state
      this.clearSessionData(chatId);
    }
  }

  /**
   * Process purpose selection
   */
  private async processPurposeSelection(
    bot: TelegramBot,
    chatId: number,
    purposeCode: string,
    existingMessageId?: number
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<BatchTransferSessionState>(chatId);
    if (!state || !state.recipients || state.recipients.length === 0) return;

    // Update all recipients with the selected purpose code
    const updatedRecipients = state.recipients.map((recipient) => ({
      ...recipient,
      purposeCode,
    }));

    // Update state with purpose code and updated recipients
    this.updateSessionData<BatchTransferSessionState>(chatId, {
      purposeCode,
      recipients: updatedRecipients,
    });

    // Show batch confirmation
    await this.showBatchConfirmation(bot, chatId, existingMessageId);
  }

  /**
   * Show batch transfer confirmation
   */
  private async showBatchConfirmation(
    bot: TelegramBot,
    chatId: number,
    existingMessageId?: number
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<BatchTransferSessionState>(chatId);
    if (!state || !state.recipients || state.recipients.length === 0) return;

    // Calculate total amount
    const totalAmount = state.recipients.reduce(
      (sum, recipient) => sum + recipient.amount,
      0
    );

    // Get purpose code display text
    const purposeDisplay = this.getPurposeDisplay(
      state.purposeCode || PurposeCode.SELF
    );

    // Prepare recipient summary
    let recipientsSummary = "";
    const maxToShow = 5; // Limit the number of recipients to show
    let i = 0;
    for (const recipient of state.recipients) {
      if (i++ >= maxToShow) {
        recipientsSummary += `... and ${
          state.recipients.length - maxToShow
        } more recipient(s)\n`;
        break;
      }
      recipientsSummary += `${recipient.email}: ${formatCurrency(
        recipient.amount,
        "USDC"
      )}\n`;
    }

    const message =
      `💰 *Batch Transfer Confirmation*\n\n` +
      `From: Your Copperx Account\n` +
      `Recipients: ${state.recipients.length}\n` +
      `Total Amount: ${formatCurrency(totalAmount, "USDC")}\n` +
      `Purpose: ${purposeDisplay}\n\n` +
      `Recipients Summary:\n${recipientsSummary}\n` +
      `Do you want to proceed with this batch transfer?`;

    const keyboard = createConfirmationKeyboard(
      "transfer:confirm",
      "transfer:cancel"
    );

    if (existingMessageId) {
      // Update existing message
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: existingMessageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } else {
      // Send new message
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
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
   * Process batch transfer confirmation
   */
  private async processBatchConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = this.getSessionData<BatchTransferSessionState>(chatId);
    if (!state || !state.recipients || state.recipients.length === 0) return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your batch transfer...*",
        { parse_mode: "Markdown" }
      );

      // Prepare the batch transfer request
      const batchData = state.recipients.map((recipient, index) => ({
        requestId: `batch-${index}`,
        request: {
          email: recipient.email,
          amount: recipient.amount.toString(),
          currency: "USDC",
          purposeCode:
            recipient.purposeCode || state.purposeCode || PurposeCode.SELF,
        },
      }));

      // Execute batch transfer
      const result = await transferService.sendBatchTransfers(
        session.token,
        batchData
      );

      // Type assertion to match the actual response structure
      const batchResults = result as unknown as BatchTransferResponseItem[];

      // Analyze results
      const successCount = batchResults.filter((item) => item.success).length;
      const failureCount = batchResults.filter((item) => !item.success).length;

      // Reset state
      this.clearSessionData(chatId);

      // Create a detailed message about success and failures
      let resultMessage =
        `✅ *Batch Transfer Results*\n\n` +
        `Total Recipients: ${state.recipients.length}\n` +
        `Successful: ${successCount}\n` +
        `Failed: ${failureCount}\n` +
        `Total Amount Sent: ${formatCurrency(
          batchResults
            .filter((item) => item.success)
            .reduce((sum: number, item) => sum + parseFloat(item.amount), 0),
          "USDC"
        )}\n\n`;

      // Add details about failed transfers if any
      if (failureCount > 0) {
        resultMessage += "Failed transfers:\n";
        batchResults
          .filter((item) => !item.success)
          .forEach((item) => {
            resultMessage += `- ${item.email}: ${
              item.message || "Unknown error"
            }\n`;
          });
      }

      bot.deleteMessage(chatId, loadingMsg.message_id);
      bot.sendMessage(chatId, resultMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 View Balance", callback_data: "action:balance" }],
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      });
    } catch (error: any) {
      logger.error(`Batch transfer error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:batch");

      // Reset state
      this.clearSessionData(chatId);
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
