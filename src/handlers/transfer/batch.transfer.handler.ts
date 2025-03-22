import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as transferService from "../../services/transfer.service";
import * as payeeService from "../../services/payee.service";
import {
  createAmountKeyboard,
  createYesNoKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getPurposeCodeLabel } from "../../utils/helpers";
import { config } from "../../config";
import { Payee } from "../../types";

// Define the BatchTransferState interface for the multi-step process
interface BatchTransferState {
  step: "select_payees" | "enter_amounts" | "purpose" | "confirm";
  selectedPayees?: Payee[];
  amounts?: Record<string, string>; // Map of payee ID to amount
  currentPayeeIndex?: number; // Track which payee we're collecting amount for
  purposeCode?: string;
}

/**
 * Register batch transfer handlers
 * @param bot The Telegram bot instance
 */
export function registerBatchTransferHandlers(bot: TelegramBot): void {
  // Send batch command handler
  bot.onText(/\/sendbatch/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to send batch payments.\nPlease use /login to authenticate."
      );
      return;
    }

    try {
      // Fetch payees from the API
      const payeeResponse = await payeeService.getPayees(session.token);

      if (!payeeResponse.data || payeeResponse.data.length === 0) {
        bot.sendMessage(
          chatId,
          "📝 You don't have any saved payees yet.\n\nUse /addpayee to add payees before using batch transfer.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ Add Payee", callback_data: "menu:addpayee" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          }
        );
        return;
      }

      // Format the payees for selection
      let message = "👥 *Select Payees for Batch Transfer*\n\n";
      message +=
        "Select payees by sending their numbers, separated by commas.\n";
      message +=
        "For example: `1,3,4` will select the 1st, 3rd, and 4th payees.\n\n";

      payeeResponse.data.forEach((payee, index) => {
        const displayName = payee.displayName || payee.email;
        message += `${index + 1}. ${displayName} - \`${payee.email}\`\n`;
      });

      // Initialize state machine at select_payees step with available payees
      updateSessionState(chatId, {
        currentAction: "sendbatch",
        data: {
          step: "select_payees",
          selectedPayees: [],
          amounts: {},
        },
      });

      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "sendbatch:cancel" }],
          ],
        },
      });
    } catch (error) {
      console.error("Error fetching payees for batch transfer:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to retrieve your payees. Please try again later.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "menu:sendbatch" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        }
      );
    }
  });

  // Handle batch transfer message input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle send batch flow with session state
    if (sessionState?.currentAction === "sendbatch") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      const data = sessionState.data as BatchTransferState;

      // Handle each step in the state machine
      if (data.step === "select_payees") {
        try {
          // Fetch all payees to select from
          const payeeResponse = await payeeService.getPayees(session.token);

          if (!payeeResponse.data || payeeResponse.data.length === 0) {
            bot.sendMessage(
              chatId,
              "❌ No payees found. Please add payees first."
            );
            return;
          }

          // Parse the indices from user input (e.g., "1,3,5")
          const indices = text
            .split(",")
            .map((index) => parseInt(index.trim(), 10) - 1);

          // Validate indices
          if (
            indices.some(
              (index) =>
                isNaN(index) || index < 0 || index >= payeeResponse.data.length
            )
          ) {
            bot.sendMessage(
              chatId,
              `❌ Invalid selection. Please enter numbers between 1 and ${payeeResponse.data.length}, separated by commas.`
            );
            return;
          }

          // Get selected payees
          const selectedPayees = indices.map(
            (index) => payeeResponse.data[index]
          );

          // Initialize empty amounts object
          const amounts: Record<string, string> = {};

          // Update state with selected payees and move to amount entry step
          updateSessionState(chatId, {
            currentAction: "sendbatch",
            data: {
              step: "enter_amounts",
              selectedPayees: selectedPayees,
              amounts: amounts,
              currentPayeeIndex: 0, // Start with the first payee
            },
          });

          // Ask for the amount for the first payee
          promptForPayeeAmount(bot, chatId, selectedPayees[0]);
        } catch (error) {
          console.error("Error handling payee selection:", error);
          bot.sendMessage(
            chatId,
            "❌ An error occurred when processing your selection. Please try again."
          );
        }
      } else if (
        data.step === "enter_amounts" &&
        data.selectedPayees &&
        data.currentPayeeIndex !== undefined
      ) {
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
                  [{ text: "❌ Cancel", callback_data: "sendbatch:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Get the current payee we're processing
        const currentPayee = data.selectedPayees[data.currentPayeeIndex];

        // Store the amount for this payee
        const updatedAmounts = data.amounts || {};
        updatedAmounts[currentPayee.id] = text;

        // Check if we've collected amounts for all payees
        if (data.currentPayeeIndex >= data.selectedPayees.length - 1) {
          // We've collected all amounts, move to purpose selection
          updateSessionState(chatId, {
            currentAction: "sendbatch",
            data: {
              step: "purpose",
              selectedPayees: data.selectedPayees,
              amounts: updatedAmounts,
            },
          });

          // Show summary of selected payees and amounts
          let summaryMessage = "✅ *Selected Payees and Amounts:*\n\n";
          let totalAmount = 0;

          data.selectedPayees.forEach((payee, index) => {
            const displayName = payee.displayName || payee.email;
            const payeeAmount = parseFloat(updatedAmounts[payee.id]);
            totalAmount += payeeAmount;
            summaryMessage += `${index + 1}. ${displayName} - \`${
              payee.email
            }\`\n   Amount: ${payeeAmount.toFixed(2)} USDC\n\n`;
          });

          summaryMessage += `📝 *Transfer Details*\n\n`;
          summaryMessage += `Total: ${totalAmount.toFixed(2)} USDC\n\n`;
          summaryMessage += `Please select the purpose of this transfer:`;

          bot.sendMessage(chatId, summaryMessage, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendbatch"),
            },
          });
        } else {
          // Move to the next payee
          updateSessionState(chatId, {
            currentAction: "sendbatch",
            data: {
              step: "enter_amounts",
              selectedPayees: data.selectedPayees,
              amounts: updatedAmounts,
              currentPayeeIndex: data.currentPayeeIndex + 1,
            },
          });

          // Prompt for the next payee's amount
          promptForPayeeAmount(
            bot,
            chatId,
            data.selectedPayees[data.currentPayeeIndex + 1]
          );
        }
      }
    }
  });

  // Helper function to prompt for payee amount
  function promptForPayeeAmount(
    bot: TelegramBot,
    chatId: number,
    payee: Payee
  ) {
    const displayName = payee.displayName || payee.email;
    bot.sendMessage(
      chatId,
      `Please enter an amount in USDC to send to: *${displayName}* (\`${payee.email}\`):`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createAmountKeyboard("sendbatch"),
        },
      }
    );
  }

  // Handle batch transfer callbacks
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

    // Handle send batch flow callbacks
    if (callbackData.startsWith("sendbatch:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "sendbatch") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as BatchTransferState;

      // Handle amount selection from the keyboard
      if (action === "amount" && parts.length >= 3) {
        const amount = parts[2];

        if (!data.selectedPayees || data.currentPayeeIndex === undefined) {
          bot.answerCallbackQuery(query.id, {
            text: "Error: Unable to process amount. Please try again.",
            show_alert: true,
          });
          return;
        }

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);

          const currentPayee = data.selectedPayees[data.currentPayeeIndex];
          const displayName = currentPayee.displayName || currentPayee.email;

          bot.editMessageText(
            `Please enter a custom amount in USDC to send to: *${displayName}* (\`${currentPayee.email}\`):`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        // Handle predefined amount
        const currentPayee = data.selectedPayees[data.currentPayeeIndex];

        // Store the amount for this payee
        const updatedAmounts = data.amounts || {};
        updatedAmounts[currentPayee.id] = amount;

        // Check if we've collected amounts for all payees
        if (data.currentPayeeIndex >= data.selectedPayees.length - 1) {
          // We've collected all amounts, move to purpose selection
          updateSessionState(chatId, {
            currentAction: "sendbatch",
            data: {
              step: "purpose",
              selectedPayees: data.selectedPayees,
              amounts: updatedAmounts,
            },
          });

          // Show summary of selected payees and amounts
          let summaryMessage = "✅ *Selected Payees and Amounts:*\n\n";
          let totalAmount = 0;

          data.selectedPayees.forEach((payee, index) => {
            const displayName = payee.displayName || payee.email;
            const payeeAmount = parseFloat(updatedAmounts[payee.id]);
            totalAmount += payeeAmount;
            summaryMessage += `${index + 1}. ${displayName} - \`${
              payee.email
            }\`\n   Amount: ${payeeAmount.toFixed(2)} USDC\n\n`;
          });

          summaryMessage += `📝 *Transfer Details*\n\n`;
          summaryMessage += `Total: ${totalAmount.toFixed(2)} USDC\n\n`;
          summaryMessage += `Please select the purpose of this transfer:`;

          bot.answerCallbackQuery(query.id);
          bot.editMessageText(summaryMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendbatch"),
            },
          });
        } else {
          // Move to the next payee
          const nextPayeeIndex = data.currentPayeeIndex + 1;
          updateSessionState(chatId, {
            currentAction: "sendbatch",
            data: {
              step: "enter_amounts",
              selectedPayees: data.selectedPayees,
              amounts: updatedAmounts,
              currentPayeeIndex: nextPayeeIndex,
            },
          });

          // Prompt for the next payee's amount
          const nextPayee = data.selectedPayees[nextPayeeIndex];
          const displayName = nextPayee.displayName || nextPayee.email;

          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `Please enter an amount in USDC to send to: *${displayName}* (\`${nextPayee.email}\`):`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createAmountKeyboard("sendbatch"),
              },
            }
          );
        }
      }
      // Handle purpose code selection
      else if (action === "purpose" && parts.length >= 3) {
        const purposeCode = parts[2];

        if (!data.selectedPayees || !data.amounts) {
          bot.answerCallbackQuery(query.id, {
            text: "Error: Missing payee or amount data.",
            show_alert: true,
          });
          return;
        }

        // Move to confirmation step with selected purpose code
        updateSessionState(chatId, {
          currentAction: "sendbatch",
          data: {
            step: "confirm",
            selectedPayees: data.selectedPayees,
            amounts: data.amounts,
            purposeCode: purposeCode,
          },
        });

        // Get user-friendly purpose label
        const purposeLabel = getPurposeCodeLabel(purposeCode);

        // Calculate total amount
        let totalAmount = 0;
        data.selectedPayees.forEach((payee) => {
          totalAmount += parseFloat(data.amounts![payee.id]);
        });

        // Format confirmation message with payee details and amounts
        let confirmationMessage = "⚠️ *Please Confirm Batch Transfer*\n\n";
        confirmationMessage += "📋 *Payees and Amounts:*\n\n";

        data.selectedPayees.forEach((payee, index) => {
          const displayName = payee.displayName || payee.email;
          confirmationMessage += `${index + 1}. ${displayName} - \`${
            payee.email
          }\`\n   Amount: ${parseFloat(data.amounts![payee.id]).toFixed(
            2
          )} USDC\n\n`;
        });

        confirmationMessage += `Total amount: ${totalAmount.toFixed(2)} USDC\n`;
        confirmationMessage += `Number of payees: ${data.selectedPayees.length}\n`;
        confirmationMessage += `Purpose: ${purposeLabel}\n\n`;
        confirmationMessage += `Do you want to proceed with this batch transfer?`;

        // Ask for confirmation with purpose code included
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(confirmationMessage, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createYesNoKeyboard("sendbatch"),
          },
        });
      }
      // Handle confirmation response
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "🚫 Batch transfer cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📤 Try Again", callback_data: "menu:sendbatch" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          return;
        }

        // Process "yes" - check balance and send transfers
        if (!data.selectedPayees || !data.amounts) {
          bot.editMessageText(
            "❌ Error: Missing payee or amount data. Please try again.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📤 Try Again", callback_data: "menu:sendbatch" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          return;
        }

        try {
          // Calculate total amount needed
          let totalAmount = 0;
          data.selectedPayees.forEach((payee) => {
            totalAmount += parseFloat(data.amounts![payee.id]);
          });

          // Check balance first
          const balanceCheck = await transferService.checkSufficientBalance(
            session.token,
            totalAmount.toString()
          );

          if (!balanceCheck.hasSufficientBalance) {
            updateSessionState(chatId, {}); // Clear state
            bot.editMessageText(
              `❌ Insufficient balance. You have ${
                balanceCheck.balance
              } USDC but trying to send ${totalAmount.toFixed(
                2
              )} USDC total.\n\nPlease check your balance or try a smaller amount.`,
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
                    [{ text: "📤 Try Again", callback_data: "menu:sendbatch" }],
                    [{ text: "« Back to Menu", callback_data: "return:menu" }],
                  ],
                },
              }
            );
            return;
          }

          // Prepare batch transfer request
          const requests = data.selectedPayees.map((payee, index) => {
            return {
              requestId: `batch-${index}-${Date.now()}`,
              request: {
                email: payee.email,
                payeeId: payee.id,
                amount: (
                  parseFloat(data.amounts![payee.id]) * 100000000
                ).toFixed(0), // Convert to API expected format
                purposeCode: data.purposeCode || "self",
                currency: "USDC",
              },
            };
          });

          // Update message to show processing
          bot.editMessageText("⏳ Processing batch transfer... Please wait.", {
            chat_id: chatId,
            message_id: messageId,
          });

          // Send batch transfer
          await transferService.sendBatchTransfers(session.token, requests);

          // Clear state and show success message
          updateSessionState(chatId, {});

          const purposeLabel = getPurposeCodeLabel(data.purposeCode || "self");

          // Format summary message with individual amounts
          let summaryMessage =
            "✅ *Batch Transfer Initiated Successfully!*\n\n";
          summaryMessage += "📋 *Payees and Amounts:*\n\n";

          data.selectedPayees.forEach((payee, index) => {
            const displayName = payee.displayName || payee.email;
            summaryMessage += `${index + 1}. ${displayName} - \`${
              payee.email
            }\`\n   Amount: ${parseFloat(data.amounts![payee.id]).toFixed(
              2
            )} USDC\n\n`;
          });

          summaryMessage += `Total sent: ${totalAmount.toFixed(2)} USDC\n`;
          summaryMessage += `Number of payees: ${data.selectedPayees.length}\n`;
          summaryMessage += `Purpose: ${purposeLabel}\n\n`;
          summaryMessage += `Use /balance to check your updated wallet balance.`;

          bot.editMessageText(summaryMessage, {
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
          });
        } catch (error: any) {
          console.error("Batch transfer error:", error);
          updateSessionState(chatId, {}); // Clear state

          let errorMessage = "Unexpected error occurred";
          if (error.response?.data?.message) {
            if (Array.isArray(error.response.data.message)) {
              errorMessage = error.response.data.message.join("; ");
            } else {
              errorMessage = error.response.data.message;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          bot.editMessageText(
            `❌ Batch transfer failed: ${errorMessage}. Try again or visit ${config.supportLink}`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📤 Try Again", callback_data: "menu:sendbatch" }],
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

        // Show cancellation message with menu
        bot.editMessageText(
          "🚫 Batch transfer cancelled. No funds have been sent.",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "📤 Try Again", callback_data: "menu:sendbatch" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          }
        );
      }
    }
  });
}
