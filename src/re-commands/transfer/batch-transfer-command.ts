import TelegramBot from "node-telegram-bot-api";
import { BaseTransferCommand } from "./base-transfer-command";
import { ExtendedSession } from "../../session";
import * as transferService from "../../services/transfer.service";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { formatCurrency } from "../../utils/format";
import { getSession, updateSessionState } from "../../session";
import {
  createConfirmationKeyboard,
  createPurposeCodeKeyboard,
} from "../../re-utils/keyboard";
import { getModuleLogger } from "../../re-utils/logger";
import { PurposeCode, BatchTransferResponse } from "../../types";

// Create module logger
const logger = getModuleLogger("batch-transfer-command");

// Interface for recipient in batch transfer
interface BatchRecipient {
  email: string;
  amount: number;
  purposeCode?: string;
}

// Interface for batch transfer state
interface BatchTransferState {
  recipients: BatchRecipient[];
  purposeCode: string;
  step: "upload" | "confirm";
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
    // Initialize state
    updateSessionState(chatId, {
      currentAction: "sendbatch",
      data: {
        transferState: {
          recipients: [],
          purposeCode: PurposeCode.SELF,
          step: "upload",
        },
      },
    });

    const message =
      "📊 *Batch Transfer*\n\n" +
      "You can send funds to multiple recipients at once by typing the recipient information directly.\n\n" +
      "Type recipient information with one recipient per line:\n" +
      "```\n" +
      "recipient1@example.com,10\n" +
      "recipient2@example.com,20,gift\n" +
      "```\n\n" +
      "The purpose code (optional) can be: self, salary, gift, reimbursement.\n\n" +
      "Please paste your recipient list or send /cancel to abort.";

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
        ],
      },
    });
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
      await this.processPurposeSelection(bot, chatId, session, purposeCode);
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
    const chatId = msg.chat.id;
    const session = getSession(chatId);

    if (!session || !session.state || !session.state.currentAction) return;

    if (session.state.currentAction !== "sendbatch") return;

    const state = session.state.data?.transferState as BatchTransferState;
    if (!state) return;

    // Handle cancel command
    if (msg.text === "/cancel") {
      await this.sendCancelMessage(bot, chatId);
      return;
    }

    if (state.step === "upload") {
      // Handle direct text input with recipient list
      if (msg.text && msg.text.includes(",")) {
        // No need to check for header as this is direct user input
        await this.processDirectTextInput(bot, chatId, session, msg.text);
        return;
      }

      // Invalid input
      bot.sendMessage(
        chatId,
        "⚠️ Please paste recipients list in format 'email,amount' or 'email,amount,purpose' (one per line).",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
            ],
          },
        }
      );
    }
  }

  /**
   * Process direct text input for batch transfers
   * Format: email,amount[,purpose] (one recipient per line)
   */
  private async processDirectTextInput(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    text: string
  ): Promise<void> {
    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🔄 *Processing your recipient list...*",
        { parse_mode: "Markdown" }
      );

      // Split into lines and filter out empty lines
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        bot.editMessageText("⚠️ No valid recipients found in your input.", {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
            ],
          },
        });
        return;
      }

      // Process each line to extract recipients
      const recipients: BatchRecipient[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length < 2) {
          errors.push(
            `Line ${
              i + 1
            }: Invalid format, should be 'email,amount' or 'email,amount,purpose'`
          );
          continue;
        }

        const email = parts[0].trim();
        const amount = parseFloat(parts[1].trim());
        let purposeCode = PurposeCode.SELF; // Default purpose

        // Check if purpose is specified
        if (parts.length >= 3) {
          const specifiedPurpose = parts[2].trim().toLowerCase();

          // Map input purpose to PurposeCode
          switch (specifiedPurpose) {
            case "self":
              purposeCode = PurposeCode.SELF;
              break;
            case "salary":
              purposeCode = PurposeCode.SALARY;
              break;
            case "gift":
              purposeCode = PurposeCode.GIFT;
              break;
            case "reimbursement":
              purposeCode = PurposeCode.REIMBURSEMENT;
              break;
            default:
              errors.push(
                `Line ${
                  i + 1
                }: Unknown purpose '${specifiedPurpose}', using default`
              );
              purposeCode = PurposeCode.SELF;
          }
        }

        // Validate email
        if (!this.isValidEmail(email)) {
          errors.push(`Line ${i + 1}: Invalid email '${email}'`);
          continue;
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Line ${i + 1}: Invalid amount '${parts[1]}'`);
          continue;
        }

        // Add valid recipient with purpose
        recipients.push({
          email,
          amount,
          purposeCode,
        });
      }

      // Check if we have any valid recipients
      if (recipients.length === 0) {
        bot.editMessageText(
          "⚠️ No valid recipients found in your input. Please check the format and try again.",
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
              ],
            },
          }
        );
        return;
      }

      // Update state with recipients
      updateSessionState(chatId, {
        data: {
          transferState: {
            recipients,
            purposeCode: PurposeCode.SELF, // Default global purpose
            step: "confirm",
          },
        },
      });

      // Skip global purpose selection if individual purposes were provided
      const hasMixedPurposes = recipients.some(
        (r) => r.purposeCode !== recipients[0].purposeCode
      );

      if (hasMixedPurposes) {
        // If we have mixed purposes, go straight to confirmation
        await this.showBatchConfirmation(
          bot,
          chatId,
          session,
          loadingMsg.message_id
        );
      } else {
        // Otherwise show purpose selection for all transfers
        const purposeMessage =
          "🎯 *Select Transfer Purpose*\n\n" +
          "Please select the purpose of this batch transfer:";

        const purposeKeyboard = createPurposeCodeKeyboard("purpose");

        bot.editMessageText(purposeMessage, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: purposeKeyboard,
          },
        });
      }

      // Log errors if any
      if (errors.length > 0) {
        const errorMessage =
          "⚠️ *Validation Warnings*\n\n" +
          "The following issues were found in your input:\n" +
          errors.join("\n");

        bot.sendMessage(chatId, errorMessage, { parse_mode: "Markdown" });
      }
    } catch (error: any) {
      logger.error(`Text input processing error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:batch");

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });
    }
  }

  /**
   * Process purpose selection
   */
  private async processPurposeSelection(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    purposeCode: string,
    existingMessageId?: number
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as BatchTransferState;
    if (!state || !state.recipients || state.recipients.length === 0) return;

    // Update state with purpose code
    updateSessionState(chatId, {
      data: {
        transferState: {
          ...state,
          purposeCode,
          recipients: state.recipients.map((r) => ({
            ...r,
            purposeCode: purposeCode as PurposeCode,
          })),
        },
      },
    });

    // Show batch transfer confirmation
    await this.showBatchConfirmation(bot, chatId, session, existingMessageId);
  }

  /**
   * Show batch transfer confirmation
   */
  private async showBatchConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession,
    existingMessageId?: number
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as BatchTransferState;
    if (!state || !state.recipients || state.recipients.length === 0) return;

    try {
      // Calculate total amount
      const totalAmount = state.recipients.reduce(
        (sum, recipient) => sum + recipient.amount,
        0
      );

      // Check if user has sufficient balance
      const balanceCheck = await transferService.checkSufficientBalance(
        session.token,
        totalAmount.toString()
      );

      if (!balanceCheck.hasSufficientBalance) {
        const insufficientBalanceMessage =
          `⚠️ *Insufficient Balance*\n\n` +
          `You don't have enough USDC to complete this batch transfer.\n` +
          `Total Amount: ${formatCurrency(totalAmount, "USDC")}\n` +
          `Available: ${formatCurrency(balanceCheck.balance, "USDC")}`;

        if (existingMessageId) {
          bot.editMessageText(insufficientBalanceMessage, {
            chat_id: chatId,
            message_id: existingMessageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Deposit", callback_data: "action:deposit" }],
                [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
              ],
            },
          });
        } else {
          bot.sendMessage(chatId, insufficientBalanceMessage, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Deposit", callback_data: "action:deposit" }],
                [{ text: "❌ Cancel", callback_data: "transfer:cancel" }],
              ],
            },
          });
        }
        return;
      }

      // Format recipient list for display (limit to 5 for readability)
      const recipientList = state.recipients
        .slice(0, 5)
        .map((r) => {
          const purposeDisplay = this.getPurposeDisplay(
            r.purposeCode || state.purposeCode
          );
          return `- ${r.email}: ${formatCurrency(r.amount, "USDC")}${
            r.purposeCode && r.purposeCode !== state.purposeCode
              ? ` (${purposeDisplay})`
              : ""
          }`;
        })
        .join("\n");

      const additionalRecipients =
        state.recipients.length > 5
          ? `\n...and ${state.recipients.length - 5} more recipients`
          : "";

      const message =
        `📊 *Batch Transfer Confirmation*\n\n` +
        `Recipients: ${state.recipients.length}\n` +
        `Total Amount: ${formatCurrency(totalAmount, "USDC")}\n` +
        `Default Purpose: ${this.getPurposeDisplay(state.purposeCode)}\n\n` +
        `Recipients Preview:\n${recipientList}${additionalRecipients}`;

      if (existingMessageId) {
        bot.editMessageText(message, {
          chat_id: chatId,
          message_id: existingMessageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createConfirmationKeyboard(
              "transfer:confirm",
              "transfer:cancel"
            ),
          },
        });
      } else {
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
    } catch (error: any) {
      logger.error(`Balance check error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:batch");

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
   * Process batch transfer confirmation
   */
  private async processBatchConfirmation(
    bot: TelegramBot,
    chatId: number,
    session: ExtendedSession
  ): Promise<void> {
    // Get current state
    const state = session.state?.data?.transferState as BatchTransferState;
    if (!state || !state.recipients || state.recipients.length === 0) return;

    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "🕒 *Processing your batch transfer...*",
        { parse_mode: "Markdown" }
      );

      // Prepare batch requests
      const requests = state.recipients.map((recipient, index) => ({
        requestId: `batch-${index}`,
        request: {
          email: recipient.email,
          amount: (recipient.amount * 100000000).toFixed(0), // Convert to API format
          purposeCode: recipient.purposeCode || state.purposeCode, // Use individual purpose if specified, else global
          currency: "USDC",
        },
      }));

      // Execute batch transfer
      const result: BatchTransferResponse =
        await transferService.sendBatchTransfers(session.token, requests);

      // Check for any errors in the batch
      const hasErrors = result.responses.some((res) => res.error);

      // Calculate total amount
      const totalAmount = state.recipients.reduce(
        (sum, recipient) => sum + recipient.amount,
        0
      );

      // Reset state
      updateSessionState(chatId, { currentAction: undefined, data: {} });

      // Send success message
      let successMessage = `✅ *Batch Transfer ${
        hasErrors ? "Partially" : "Fully"
      } Successful!*\n\n`;

      if (hasErrors) {
        // Count successful transfers
        const successCount = result.responses.filter(
          (res) => !res.error
        ).length;
        successMessage += `${successCount} out of ${state.recipients.length} payments were processed successfully.\n`;
      } else {
        successMessage += `You've sent payments to ${state.recipients.length} recipients.\n`;
      }

      successMessage += `Total Amount: ${formatCurrency(
        totalAmount,
        "USDC"
      )}\n\n`;
      successMessage += `All successful recipients will be notified via email.`;

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

      // If there were errors, send a detailed error message
      if (hasErrors) {
        const errorDetails = result.responses
          .filter((res) => res.error)
          .map((res) => {
            const recipient = state.recipients.find(
              (_r, i) => `batch-${i}` === res.requestId
            );
            return `- ${recipient?.email}: ${
              res.error?.message || "Unknown error"
            }`;
          })
          .join("\n");

        bot.sendMessage(
          chatId,
          `⚠️ *Some transfers failed*\n\nThe following transfers could not be completed:\n${errorDetails}`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (error: any) {
      logger.error(`Batch transfer error:`, error);
      handleApiErrorResponse(bot, chatId, error, "transfer:method:batch");

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
