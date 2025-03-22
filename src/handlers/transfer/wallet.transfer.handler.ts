import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as transferService from "../../services/transfer.service";
import * as walletService from "../../services/wallet.service";
import {
  createAmountKeyboard,
  createYesNoKeyboard,
  createPurposeCodeKeyboard,
} from "../../utils/keyboard";
import { getPurposeCodeLabel } from "../../utils/helpers";
import { config } from "../../config";
import { getNetworkName } from "../../utils/networkConstants";

// Define the SendWalletState interface for the multi-step process
interface SendWalletState {
  step: "address" | "amount" | "purpose" | "confirm";
  address?: string;
  amount?: string;
  network?: string;
  purposeCode?: string;
}

/**
 * Register wallet transfer handlers
 * @param bot The Telegram bot instance
 */
export function registerWalletTransferHandlers(bot: TelegramBot): void {
  // Send to wallet address command handler
  bot.onText(/\/sendwallet/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to send funds.\nPlease use /login to authenticate."
      );
      return;
    }

    // Start the send wallet flow
    bot.sendMessage(
      chatId,
      "🔑 *Send Funds to Wallet Address*\n\nPlease enter the recipient's wallet address:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "sendwallet:cancel" }],
          ],
        },
      }
    );

    // Initialize state machine at address step
    updateSessionState(chatId, {
      currentAction: "sendwallet",
      data: { step: "address" },
    });
  });

  // Handle wallet transfer message input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle send wallet flow with session state
    if (sessionState?.currentAction === "sendwallet") {
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

      const data = sessionState.data as SendWalletState;

      // Handle each step in the state machine
      if (data.step === "address") {
        // Basic wallet address validation (check for length and format)
        const addressRegex = /^0x[a-fA-F0-9]{40}$/; // Basic Ethereum address format
        if (!addressRegex.test(text)) {
          bot.sendMessage(
            chatId,
            "❌ Invalid wallet address format. Please enter a valid wallet address (0x followed by 40 hexadecimal characters):",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "❌ Cancel", callback_data: "sendwallet:cancel" }],
                ],
              },
            }
          );
          return;
        }

        try {
          // Get default wallet to determine network
          const defaultWallet = await walletService.getDefaultWallet(
            session.token
          );
          const network = defaultWallet?.network || "137"; // Default to Polygon if not found

          // Update state with address and network, then move to amount step
          updateSessionState(chatId, {
            currentAction: "sendwallet",
            data: {
              step: "amount",
              address: text,
              network: network,
            },
          });

          // Show amount options with inline keyboard
          bot.sendMessage(
            chatId,
            `📝 Recipient: \`${text}\`\n\nPlease select or enter an amount in USDC to send:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createAmountKeyboard("sendwallet"),
              },
            }
          );
        } catch (error) {
          console.error("Default wallet fetch error:", error);
          bot.sendMessage(
            chatId,
            "❌ Failed to retrieve your default wallet information. Please try again later.",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 Try Again", callback_data: "menu:send" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          updateSessionState(chatId, {});
        }
      } else if (data.step === "amount" && data.address) {
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
                  [{ text: "❌ Cancel", callback_data: "sendwallet:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Move to purpose selection step
        updateSessionState(chatId, {
          currentAction: "sendwallet",
          data: {
            step: "purpose",
            address: data.address,
            amount: text,
            network: data.network,
          },
        });

        // Format network name
        const networkDisplayName = getNetworkName(data.network || "");

        // Ask for purpose code selection
        bot.sendMessage(
          chatId,
          `📝 *Transfer Details*\n\n` +
            `Recipient: \`${data.address}\`\n` +
            `Amount: ${text} USDC\n` +
            `Network: ${networkDisplayName}\n\n` +
            `Please select the purpose of this transfer:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendwallet"),
            },
          }
        );
      }
    }
  });

  // Handle wallet transfer callbacks
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

    // Handle send wallet flow callbacks
    if (callbackData.startsWith("sendwallet:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "sendwallet") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as SendWalletState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `📝 Recipient: \`${data.address}\`\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        // Format network name
        const networkDisplayName = getNetworkName(data.network || "");

        // Move to purpose selection step with selected amount
        updateSessionState(chatId, {
          currentAction: "sendwallet",
          data: {
            step: "purpose",
            address: data.address,
            amount: amount,
            network: data.network,
          },
        });

        // Ask for purpose code selection
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `📝 *Transfer Details*\n\n` +
            `Recipient: \`${data.address}\`\n` +
            `Amount: ${amount} USDC\n` +
            `Network: ${networkDisplayName}\n\n` +
            `Please select the purpose of this transfer:`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createPurposeCodeKeyboard("sendwallet"),
            },
          }
        );
      }
      // Handle purpose code selection
      else if (action === "purpose" && parts.length >= 3) {
        const purposeCode = parts[2];

        // Format network name
        const networkDisplayName = getNetworkName(data.network || "");

        // Move to confirmation step with selected purpose code
        updateSessionState(chatId, {
          currentAction: "sendwallet",
          data: {
            step: "confirm",
            address: data.address,
            amount: data.amount,
            network: data.network,
            purposeCode: purposeCode,
          },
        });

        // Get user-friendly purpose label using the helper
        const purposeLabel = getPurposeCodeLabel(purposeCode);

        // Ask for confirmation with purpose code included
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: \`${data.address}\`\n` +
            `Amount: ${data.amount} USDC\n` +
            `Network: ${networkDisplayName}\n` +
            `Purpose: ${purposeLabel}\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendwallet"),
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

          // Make API call to send funds to wallet
          await transferService.sendToWallet(
            session.token,
            data.address!,
            data.amount!,
            "USDC",
            data.network!,
            data.purposeCode || "self"
          );

          // Clear state and show success message
          updateSessionState(chatId, {});

          // Get user-friendly purpose label
          const purposeLabel = getPurposeCodeLabel(data.purposeCode || "self");

          bot.editMessageText(
            `✅ *Transfer Initiated Successfully!*\n\n` +
              `${data.amount} USDC has been sent to \`${data.address}\`.\n` +
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
          console.error("Send to wallet error:", error);
          updateSessionState(chatId, {}); // Clear state
          bot.editMessageText(
            `❌ Transfer failed: ${
              error.response?.data?.message || "Unexpected error occurred"
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
