import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as transferService from "../../services/transfer.service";
import {
  createAmountKeyboard,
  createYesNoKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getPurposeCodeLabel } from "../../utils/helpers";
import { config } from "../../config";

// Define the SendEmailState interface for the multi-step process
interface SendEmailState {
  step: "email" | "amount" | "purpose" | "confirm";
  email?: string;
  amount?: string;
  purposeCode?: string;
}

/**
 * Register email transfer handlers
 * @param bot The Telegram bot instance
 */
export function registerEmailTransferHandlers(bot: TelegramBot): void {
  // Send to email command handler
  bot.onText(/\/sendemail/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to send funds.\nPlease use /login to authenticate.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
            ],
          },
        }
      );
      return;
    }

    // Start the send email flow
    bot.sendMessage(
      chatId,
      "📧 *Send Funds to Email*\n\nPlease enter the recipient's email address:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "sendemail:cancel" }],
          ],
        },
      }
    );

    // Initialize state machine at email step
    updateSessionState(chatId, {
      currentAction: "sendemail",
      data: { step: "email" },
    });
  });

  // Handle email transfer message input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle send email flow with session state
    if (sessionState?.currentAction === "sendemail") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Login", callback_data: "action:login" }],
              ],
            },
          }
        );
        return;
      }

      const data = sessionState.data as SendEmailState;

      // Handle each step in the state machine
      if (data.step === "email") {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          bot.sendMessage(
            chatId,
            "❌ Invalid email format. Please enter a valid email address:",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "sendemail:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Update state with email and move to amount step
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: { step: "amount", email: text },
        });

        // Show amount options with inline keyboard
        bot.sendMessage(
          chatId,
          `📝 Recipient: ${text}\n\nPlease select or enter an amount in USDC to send:`,
          {
            reply_markup: {
              inline_keyboard: createAmountKeyboard("sendemail"),
            },
          }
        );
      } else if (data.step === "amount" && data.email) {
        // This handles custom amount input (when user types amount instead of using buttons)

        // Validate amount is a positive number
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Invalid amount. Please enter a positive number:",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "sendemail:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Move to purpose selection step
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: {
            step: "purpose",
            email: data.email,
            amount: text,
          },
        });

        // Ask for purpose code selection
        bot.sendMessage(
          chatId,
          `📝 *Transfer Details*\n\n` +
            `Recipient: ${data.email}\n` +
            `Amount: ${text} USDC\n\n` +
            `Please select the purpose of this transfer:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendemail"),
            },
          }
        );
      }
    }
  });

  // Handle email transfer callbacks
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      bot.deleteMessage(chatId, messageId);
      return;
    }

    // Handle send email flow callbacks
    if (callbackData.startsWith("sendemail:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "sendemail") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as SendEmailState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `📝 Recipient: ${data.email}\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          return;
        }

        // Move to purpose code selection step with selected amount
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: {
            step: "purpose",
            email: data.email,
            amount: amount,
          },
        });

        // Ask for purpose code selection
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `📝 *Transfer Details*\n\n` +
            `Recipient: ${data.email}\n` +
            `Amount: ${amount} USDC\n\n` +
            `Please select the purpose of this transfer:`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendemail"),
            },
          }
        );
      }
      // Handle purpose code selection
      else if (action === "purpose" && parts.length >= 3) {
        const purposeCode = parts[2];

        // Move to confirmation step with selected purpose code
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: {
            step: "confirm",
            email: data.email,
            amount: data.amount,
            purposeCode: purposeCode,
          },
        });

        // Ask for confirmation with purpose code included
        bot.answerCallbackQuery(query.id);

        // Get user-friendly purpose label using the helper
        const purposeLabel = getPurposeCodeLabel(purposeCode);

        bot.editMessageText(
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: ${data.email}\n` +
            `Amount: ${data.amount} USDC\n` +
            `Purpose: ${purposeLabel}\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendemail"),
            },
          }
        );
      }
      // Handle confirmation response
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "🚫 Transfer cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📤 Try Again", callback_data: "menu:send" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          return;
        }

        // Check if there's sufficient balance in the default wallet before proceeding
        try {
          const amount = data.amount!;

          // Check balance first
          const balanceCheck = await transferService.checkSufficientBalance(
            session.token,
            amount
          );

          if (!balanceCheck.hasSufficientBalance) {
            updateSessionState(chatId, {}); // Clear state
            bot.editMessageText(
              `❌ Insufficient balance. You have ${balanceCheck.balance} USDC but trying to send ${amount} USDC.\n\nPlease check your balance or try a smaller amount.`,
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "💰 Check Balance",
                        callback_data: "menu:balance",
                      },
                    ],
                    [{ text: "📤 Try Again", callback_data: "menu:send" }],
                    [{ text: "« Back to Menu", callback_data: "return:menu" }],
                  ],
                },
              }
            );
            return;
          }

          // Process the transfer
          await transferService.sendToEmail(
            session.token,
            data.email!,
            data.amount!,
            "USDC", // Use USDC as the currency
            data.purposeCode || "self" // Use selected purpose code or default to "self"
          );

          // Clear state and show success message with purpose information
          updateSessionState(chatId, {});

          // Get user-friendly purpose label using the helper
          const purposeLabel = getPurposeCodeLabel(data.purposeCode || "self");

          bot.editMessageText(
            `✅ *Transfer Initiated Successfully!*\n\n` +
              `${data.amount} USDC has been sent to ${data.email}.\n` +
              `Purpose: ${purposeLabel}\n\n` +
              `Use /balance to check your updated wallet balance.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔍 View Balance", callback_data: "menu:balance" }],
                  [{ text: "📤 Send More", callback_data: "menu:send" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
        } catch (error: any) {
          console.error("Send to email error:", error);

          // Add detailed error logging to see the full validation message
          if (error.response?.data?.message) {
            console.log(
              "API Error Details:",
              JSON.stringify(error.response.data.message, null, 2)
            );

            // Extract error messages in a user-friendly format
            let errorMessage = "Validation failed";

            if (Array.isArray(error.response.data.message)) {
              errorMessage = error.response.data.message
                .map((err: any) => {
                  // Handle different error formats
                  if (typeof err === "string") return err;
                  if (err.message) return err.message;
                  if (err.property && err.constraints) {
                    return `${err.property}: ${Object.values(
                      err.constraints
                    ).join(", ")}`;
                  }
                  return JSON.stringify(err);
                })
                .join("; ");
            }

            // Show the extracted error message to the user
            updateSessionState(chatId, {}); // Clear state
            bot.editMessageText(
              `❌ Transfer failed: ${errorMessage}. Try again or visit ${config.supportLink}`,
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📤 Try Again", callback_data: "menu:send" }],
                    [{ text: "« Back to Menu", callback_data: "return:menu" }],
                  ],
                },
              }
            );
            return;
          }

          updateSessionState(chatId, {}); // Clear state
          bot.editMessageText(
            `❌ Transfer failed: ${
              error.message || "Unexpected error occurred"
            }. Try again or visit ${config.supportLink}`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📤 Try Again", callback_data: "menu:send" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id);
        // Clear state
        updateSessionState(chatId, {});

        // Show cancellation message with menu instead of deleting the message
        bot.editMessageText("🚫 Transfer cancelled. No funds have been sent.", {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "📤 Try Again", callback_data: "menu:send" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        });
      }
    }
  });
}
