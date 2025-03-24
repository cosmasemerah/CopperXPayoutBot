import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { SessionService } from "../../core/session.service";
import * as payeeService from "../../services/payee.service";
import { CreatePayeeRequest, Payee } from "../../types";
import { createYesNoKeyboard } from "../../utils/keyboard";
import { handleApiErrorResponse } from "../../utils/error-handler";
import {
  sendConfirmationMessage,
  sendErrorMessage,
} from "../../utils/message-templates";
import { getModuleLogger } from "../../utils/logger";
import { requireAuth } from "../../core/middleware";

// Create module logger
const logger = getModuleLogger("payee-command");

// Define the AddPayeeState interface for the multi-step process
interface AddPayeeState {
  step: "email" | "nickname" | "confirm";
  email?: string;
  nickName?: string;
}

/**
 * PayeeCommand implementation for managing payees
 */
export class PayeeCommand implements BotCommand {
  name = "addpayee";
  description = "Add a new payee to your account";

  /**
   * Execute payee command based on the command name
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || "";

    // Use requireAuth middleware
    requireAuth(bot, chatId, (session) => {
      // Check which command is being executed
      if (text.startsWith("/addpayee")) {
        this.startAddPayeeFlow(bot, chatId);
      } else if (text.startsWith("/listpayees")) {
        this.listPayees(bot, chatId, session.token);
      } else if (text.startsWith("/removepayee")) {
        // Extract payee ID from command
        const match = text.match(/\/removepayee\s+(.+)/);
        if (match && match[1]) {
          this.initiateRemovePayee(bot, chatId, match[1]);
        } else {
          bot.sendMessage(
            chatId,
            "⚠️ Please provide a payee ID to remove.\nUsage: `/removepayee [payee_id]`",
            { parse_mode: "Markdown" }
          );
        }
      }
    });
  }

  /**
   * Handle callback queries related to payee operations
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    // Use requireAuth middleware
    if (callbackData.startsWith("payee:")) {
      requireAuth(bot, chatId, (session) => {
        const parts = callbackData.split(":");
        const action = parts[1];

        switch (action) {
          case "cancel":
            this.handleCancelOperation(bot, chatId, messageId);
            break;
          case "yes":
            this.handleConfirmAddPayee(bot, chatId, messageId, session.token);
            break;
          case "no":
            this.handleDeclineAddPayee(bot, chatId, messageId);
            break;
          case "remove":
            if (parts.length >= 3) {
              this.removePayee(bot, chatId, messageId, session.token, parts[2]);
            }
            break;
          case "removecancel":
            this.handleRemoveCancel(bot, chatId, messageId);
            break;
          default:
            logger.warn(`Unknown payee action: ${action}`);
            break;
        }
      });
    } else if (callbackData === "menu:addpayee") {
      requireAuth(bot, chatId, () => {
        this.startAddPayeeFlow(bot, chatId);
      });
    } else if (
      callbackData === "menu:payees" ||
      callbackData === "menu:listpayees"
    ) {
      requireAuth(bot, chatId, (session) => {
        this.listPayees(bot, chatId, session.token);
      });
    }
  }

  /**
   * Handle user input for the multi-step add payee flow
   */
  async handleUserInput(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = SessionService.getSessionState(chatId);
    if (!sessionState || sessionState.currentAction !== "addpayee") return;

    // Use requireAuth middleware
    requireAuth(bot, chatId, (_session) => {
      const data = sessionState.data as AddPayeeState;

      // Handle each step in the add payee flow
      switch (data.step) {
        case "email":
          this.processEmailInput(bot, chatId, text);
          break;
        case "nickname":
          this.processNicknameInput(bot, chatId, text, data);
          break;
        default:
          logger.warn(`Unknown add payee step: ${data.step}`);
          break;
      }
    });
  }

  /**
   * Start the add payee flow
   */
  private startAddPayeeFlow(bot: TelegramBot, chatId: number): void {
    SessionService.updateSessionState(chatId, {
      currentAction: "addpayee",
      data: { step: "email" } as AddPayeeState,
    });

    bot.sendMessage(
      chatId,
      "➕ *Add a New Payee*\n\nPlease enter the payee's email address:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
          ],
        },
      }
    );
  }

  /**
   * Process email input for add payee flow
   */
  private processEmailInput(
    bot: TelegramBot,
    chatId: number,
    email: string
  ): void {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      bot.sendMessage(
        chatId,
        "❌ Invalid email format. Please enter a valid email address:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
            ],
          },
        }
      );
      return;
    }

    // Update state with email and move to nickname step
    SessionService.updateSessionState(chatId, {
      currentAction: "addpayee",
      data: { step: "nickname", email } as AddPayeeState,
    });

    // Ask for nickname
    bot.sendMessage(
      chatId,
      `📝 Email: ${email}\n\nPlease enter a nickname for this payee:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
          ],
        },
      }
    );
  }

  /**
   * Process nickname input for add payee flow
   */
  private processNicknameInput(
    bot: TelegramBot,
    chatId: number,
    nickname: string,
    data: AddPayeeState
  ): void {
    // Validate nickname is not empty
    if (!nickname.trim()) {
      bot.sendMessage(
        chatId,
        "❌ Nickname cannot be empty. Please enter a nickname:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
            ],
          },
        }
      );
      return;
    }

    // Move to confirmation step
    SessionService.updateSessionState(chatId, {
      currentAction: "addpayee",
      data: {
        step: "confirm",
        email: data.email,
        nickName: nickname,
      } as AddPayeeState,
    });

    // Ask for confirmation
    bot.sendMessage(
      chatId,
      `⚠️ *Please Confirm Payee Details*\n\n` +
        `Email: ${data.email}\n` +
        `Nickname: ${nickname}\n\n` +
        `Do you want to add this payee?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createYesNoKeyboard("payee"),
        },
      }
    );
  }

  /**
   * List all payees for a user
   */
  private async listPayees(
    bot: TelegramBot,
    chatId: number,
    token: string
  ): Promise<void> {
    try {
      // Send loading message
      const loadingMsg = await bot.sendMessage(
        chatId,
        "Loading your payees... Please wait."
      );

      // Fetch payees
      const payeeResponse = await payeeService.getPayees(token);

      if (payeeResponse.data.length === 0) {
        bot.editMessageText(
          "📝 You don't have any saved payees yet. Add a payee to get started.",
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ Add Payee", callback_data: "menu:addpayee" }],
                [{ text: "« Back to Menu", callback_data: "menu:main" }],
              ],
            },
          }
        );
        return;
      }

      // Format payee list
      let message = "📋 *Your Saved Payees*\n\n";
      payeeResponse.data.forEach((payee: Payee, index: number) => {
        const displayName = payee.displayName || payee.email;
        message += `${index + 1}. ${displayName} - \`${payee.email}\`\n`;
        message += `   ID: \`${payee.id}\`\n\n`;
      });

      message +=
        "\nTo remove a payee, use the /removepayee command followed by the payee ID.";

      // Send result
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Add Payee", callback_data: "menu:addpayee" }],
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      });
    } catch (error: any) {
      logger.error("List payees error:", error);
      handleApiErrorResponse(bot, chatId, error, "menu:listpayees");
    }
  }

  /**
   * Initiate the process of removing a payee
   */
  private initiateRemovePayee(
    bot: TelegramBot,
    chatId: number,
    payeeId: string
  ): void {
    sendConfirmationMessage(
      bot,
      chatId,
      `⚠️ *Remove Payee*\n\nAre you sure you want to remove the payee with ID: \`${payeeId}\`?`,
      `payee:remove:${payeeId}`,
      "payee:removecancel"
    );
  }

  /**
   * Remove a payee by ID
   */
  private async removePayee(
    bot: TelegramBot,
    chatId: number,
    messageId: number,
    token: string,
    payeeId: string
  ): Promise<void> {
    try {
      // Call API to delete payee
      await payeeService.deletePayee(token, payeeId);

      // Show success message
      bot.editMessageText("✅ Payee has been successfully removed.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 View Payees", callback_data: "menu:payees" }],
            [{ text: "« Back to Menu", callback_data: "menu:main" }],
          ],
        },
      });
    } catch (error: any) {
      logger.error("Remove payee error:", error);
      handleApiErrorResponse(bot, chatId, error, "menu:payees");
    }
  }

  /**
   * Handle cancellation of payee operations
   */
  private handleCancelOperation(
    bot: TelegramBot,
    chatId: number,
    messageId: number
  ): void {
    // Clear state
    SessionService.updateSessionState(chatId, {});

    // Show cancellation message
    bot.editMessageText("🚫 Payee operation cancelled.", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "« Back to Menu", callback_data: "menu:main" }],
        ],
      },
    });
  }

  /**
   * Handle confirmation of adding a payee
   */
  private async handleConfirmAddPayee(
    bot: TelegramBot,
    chatId: number,
    messageId: number,
    token: string
  ): Promise<void> {
    const sessionState = SessionService.getSessionState(chatId);

    if (!sessionState || sessionState.currentAction !== "addpayee") {
      bot.editMessageText(
        "⚠️ Error: Operation is no longer active. Please start again.",
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "« Back to Menu", callback_data: "menu:main" }],
            ],
          },
        }
      );
      return;
    }

    const data = sessionState.data as AddPayeeState;
    if (!data.email || !data.nickName) {
      sendErrorMessage(
        bot,
        chatId,
        "Missing required payee information. Please try again.",
        "menu:addpayee"
      );
      return;
    }

    try {
      // Create the payee request
      const payeeData: CreatePayeeRequest = {
        email: data.email,
        nickName: data.nickName,
      };

      // Call the API to create the payee
      await payeeService.createPayee(token, payeeData);

      // Clear state
      SessionService.updateSessionState(chatId, {});

      // Show success message
      bot.editMessageText(
        `✅ Payee added successfully!\n\n` +
          `Email: ${data.email}\n` +
          `Nickname: ${data.nickName}`,
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 View Payees", callback_data: "menu:payees" }],
              [{ text: "« Back to Menu", callback_data: "menu:main" }],
            ],
          },
        }
      );
    } catch (error: any) {
      logger.error("Add payee error:", error);
      SessionService.updateSessionState(chatId, {}); // Clear state
      handleApiErrorResponse(bot, chatId, error, "menu:addpayee");
    }
  }

  /**
   * Handle declining to add a payee
   */
  private handleDeclineAddPayee(
    bot: TelegramBot,
    chatId: number,
    messageId: number
  ): void {
    // Clear state
    SessionService.updateSessionState(chatId, {});

    // Show cancellation message
    bot.editMessageText("🚫 Payee not added.", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "« Back to Menu", callback_data: "menu:main" }],
        ],
      },
    });
  }

  /**
   * Handle cancellation of payee removal
   */
  private handleRemoveCancel(
    bot: TelegramBot,
    chatId: number,
    messageId: number
  ): void {
    bot.editMessageText("🚫 Payee removal cancelled.", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 View Payees", callback_data: "menu:payees" }],
          [{ text: "« Back to Menu", callback_data: "menu:main" }],
        ],
      },
    });
  }
}

/**
 * Register message handlers for payee operations
 * @param bot The Telegram bot instance
 */
export function registerPayeeMessageHandlers(bot: TelegramBot): void {
  bot.on("message", (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const sessionState = SessionService.getSessionState(chatId);

    // Handle add payee flow with session state
    if (sessionState?.currentAction === "addpayee") {
      const payeeCommand = new PayeeCommand();
      payeeCommand.handleUserInput(bot, msg);
    }
  });
}
