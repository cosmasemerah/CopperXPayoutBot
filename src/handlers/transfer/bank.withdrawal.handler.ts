import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as transferService from "../../services/transfer.service";
import {
  createAmountKeyboard,
  createYesNoKeyboard,
} from "../../utils/keyboard";
import { config } from "../../config";

// Define the WithdrawBankState interface for the multi-step process
interface WithdrawBankState {
  step: "amount" | "confirm";
  amount?: string;
}

/**
 * Register bank withdrawal handlers
 * @param bot The Telegram bot instance
 */
export function registerBankWithdrawalHandlers(bot: TelegramBot): void {
  // Bank withdrawal command handler
  bot.onText(/\/withdrawbank/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to withdraw funds.\nPlease use /login to authenticate."
      );
      return;
    }

    // Set session state for withdrawal flow
    updateSessionState(chatId, {
      currentAction: "withdrawbank",
      data: { step: "amount" },
    });

    // Show amount options with inline keyboard
    bot.sendMessage(
      chatId,
      `🏦 *Withdraw to Bank Account*\n\n` +
        `Please select or enter an amount in USDC to withdraw:\n\n` +
        `_Note: Your bank account details must be configured on the Copperx platform. ` +
        `If you haven't set up your bank account yet, please visit https://copperx.io._`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createAmountKeyboard("withdrawbank"),
        },
      }
    );
  });

  // Handle bank withdrawal message input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle bank withdrawal flow with session state
    if (sessionState?.currentAction === "withdrawbank") {
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

      const data = sessionState.data as WithdrawBankState;

      // Only step where we expect text input is for custom amount
      if (data.step === "amount") {
        // Validate amount is a positive number
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Invalid amount. Please enter a positive number:",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "withdrawbank:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Update state and move to confirmation step
        updateSessionState(chatId, {
          currentAction: "withdrawbank",
          data: {
            step: "confirm",
            amount: text,
          },
        });

        // Ask for confirmation with inline keyboard
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Bank Withdrawal*\n\n` +
            `Amount: ${text} USDC\n\n` +
            `Funds will be sent to your pre-configured bank account on the Copperx platform.\n` +
            `Do you want to proceed with this withdrawal?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("withdrawbank"),
            },
          }
        );
      }
    }
  });

  // Handle bank withdrawal callbacks
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

    // Handle bank withdrawal flow callbacks
    if (callbackData.startsWith("withdrawbank:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "withdrawbank") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as WithdrawBankState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `🏦 *Withdraw to Bank Account*\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        // Update state and move to confirmation step
        updateSessionState(chatId, {
          currentAction: "withdrawbank",
          data: {
            step: "confirm",
            amount: amount,
          },
        });

        // Ask for confirmation
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `⚠️ *Please Confirm Bank Withdrawal*\n\n` +
            `Amount: ${amount} USDC\n\n` +
            `Funds will be sent to your pre-configured bank account on the Copperx platform.\n` +
            `Do you want to proceed with this withdrawal?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("withdrawbank"),
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
            "🚫 Withdrawal cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🏧 Try Again", callback_data: "menu:withdraw" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          return;
        }

        // Process the withdrawal
        try {
          // Make API call to withdraw funds to bank
          await transferService.withdrawToBank(session.token, data.amount!);

          // Clear state and show success message
          updateSessionState(chatId, {});
          bot.editMessageText(
            `✅ *Bank Withdrawal Initiated Successfully!*\n\n` +
              `${data.amount} USDC is being processed for withdrawal to your bank account.\n\n` +
              `This may take 1-3 business days to complete depending on your bank.\n` +
              `Use /history to check the status of your withdrawal.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📜 View History", callback_data: "menu:history" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
        } catch (error: any) {
          console.error("Bank withdrawal error:", error);

          // Get error message based on the type of error
          let withdrawalErrorMessage = "Unexpected error occurred";

          if (error.response?.data?.message?.includes("KYC")) {
            withdrawalErrorMessage =
              "Your KYC verification is incomplete or pending approval";
          } else if (error.response?.data?.message?.includes("minimum")) {
            withdrawalErrorMessage =
              "The amount is below the minimum withdrawal limit";
          } else if (error.response?.data?.message?.includes("bank")) {
            withdrawalErrorMessage =
              "No bank account configured. Please set up your bank details on Copperx platform";
          } else if (error.response?.data?.message) {
            withdrawalErrorMessage = error.response.data.message;
          }

          await bot.sendMessage(
            chatId,
            `❌ Bank withdrawal failed: ${withdrawalErrorMessage}. Try again or visit ${config.supportLink}`
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id);
        // Clear state
        updateSessionState(chatId, {});

        // Show cancellation message with menu instead of deleting the message
        bot.editMessageText(
          "🚫 Withdrawal cancelled. No funds have been withdrawn.",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏧 Try Again", callback_data: "menu:withdraw" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          }
        );
      }
    }
  });
}
