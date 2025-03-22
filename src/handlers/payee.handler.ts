import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../session";
import * as payeeService from "../services/payee.service";
import { CreatePayeeRequest, Payee } from "../types";
import { createYesNoKeyboard } from "../utils/keyboard";

// Define the AddPayeeState interface for the multi-step process
interface AddPayeeState {
  step: "email" | "nickname" | "confirm";
  email?: string;
  nickName?: string;
}

/**
 * Register payee handlers
 * @param bot The Telegram bot instance
 */
export function registerPayeeHandlers(bot: TelegramBot): void {
  // Add payee command handler
  bot.onText(/\/addpayee/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to manage payees.\nPlease use /login to authenticate.",
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

    // Start the add payee flow
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

    // Initialize state machine at email step
    updateSessionState(chatId, {
      currentAction: "addpayee",
      data: { step: "email" },
    });
  });

  // List payees command handler
  bot.onText(/\/listpayees/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view payees.\nPlease use /login to authenticate.",
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

    // Fetch payees
    try {
      bot.sendMessage(chatId, "Loading your payees... Please wait.");
      const payeeResponse = await payeeService.getPayees(session.token);

      if (payeeResponse.data.length === 0) {
        bot.sendMessage(
          chatId,
          "📝 You don't have any saved payees yet. Add a payee to get started.",
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

      let message = "📋 *Your Saved Payees*\n\n";

      payeeResponse.data.forEach((payee: Payee, index: number) => {
        const displayName = payee.displayName || payee.email;
        message += `${index + 1}. ${displayName} - \`${payee.email}\`\n`;
        message += `   ID: \`${payee.id}\`\n\n`;
      });

      message +=
        "\nTo remove a payee, use the /removepayee command followed by the payee ID.";

      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Add Payee", callback_data: "menu:addpayee" }],
            [{ text: "« Back to Menu", callback_data: "return:menu" }],
          ],
        },
      });
    } catch (error) {
      console.error("List payees error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to retrieve payees. Please try again later.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "menu:listpayees" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        }
      );
    }
  });

  // Remove payee command handler
  bot.onText(
    /\/removepayee (.+)/,
    async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
      const chatId = msg.chat.id;
      const payeeId = match?.[1] || "";

      // Check if user is logged in
      const session = getSession(chatId);
      if (!session) {
        bot.sendMessage(
          chatId,
          "⚠️ You need to be logged in to remove payees.\nPlease use /login to authenticate.",
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

      // Ask for confirmation before removing
      bot.sendMessage(
        chatId,
        `⚠️ *Remove Payee*\n\nAre you sure you want to remove the payee with ID: \`${payeeId}\`?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes", callback_data: `payee:remove:${payeeId}` },
                { text: "❌ No", callback_data: "payee:removecancel" },
              ],
            ],
          },
        }
      );
    }
  );

  // Handle payee message input
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle add payee flow with session state
    if (sessionState?.currentAction === "addpayee") {
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

      const data = sessionState.data as AddPayeeState;

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
                  [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
                ],
              },
            }
          );
          return;
        }

        // Update state with email and move to nickname step
        updateSessionState(chatId, {
          currentAction: "addpayee",
          data: { step: "nickname", email: text },
        });

        // Ask for nickname
        bot.sendMessage(
          chatId,
          `📝 Email: ${text}\n\nPlease enter a nickname for this payee:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
              ],
            },
          }
        );
      } else if (data.step === "nickname" && data.email) {
        // Validate nickname is not empty
        if (!text.trim()) {
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
        updateSessionState(chatId, {
          currentAction: "addpayee",
          data: {
            step: "confirm",
            email: data.email,
            nickName: text,
          },
        });

        // Ask for confirmation
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Payee Details*\n\n` +
            `Email: ${data.email}\n` +
            `Nickname: ${text}\n\n` +
            `Do you want to add this payee?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("payee"),
            },
          }
        );
      }
    }
  });

  // Handle payee callbacks
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

    // Handle payee confirmation and cancellation
    if (callbackData.startsWith("payee:")) {
      const parts = callbackData.split(":");
      const action = parts[1];

      // Handle common actions
      if (action === "cancel") {
        bot.answerCallbackQuery(query.id);
        // Clear state
        updateSessionState(chatId, {});

        // Show cancellation message
        bot.editMessageText("🚫 Payee operation cancelled.", {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        });
      }
      // Handle add payee confirmation
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);
        const sessionState = getSessionState(chatId);

        if (!sessionState || sessionState.currentAction !== "addpayee") {
          bot.editMessageText(
            "⚠️ Error: Operation is no longer active. Please start again.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
          return;
        }

        const data = sessionState.data as AddPayeeState;

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText("🚫 Payee not added.", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          });
          return;
        }

        // Process "yes" - add the payee
        try {
          // Create the payee request
          const payeeData: CreatePayeeRequest = {
            email: data.email!,
            nickName: data.nickName,
          };

          // Call the API to create the payee
          await payeeService.createPayee(session.token, payeeData);

          // Clear state and show success message
          updateSessionState(chatId, {});
          bot.editMessageText(
            `✅ Payee added successfully!\n\n` +
              `Email: ${data.email}\n` +
              `Nickname: ${data.nickName}`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "📋 View Payees",
                      callback_data: "menu:payees",
                    },
                  ],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
        } catch (error: any) {
          console.error("Add payee error:", error);
          updateSessionState(chatId, {}); // Clear state

          // Extract error message if available
          let errorMessage = "Unexpected error occurred";
          if (error.response?.data?.message) {
            if (Array.isArray(error.response.data.message)) {
              errorMessage = error.response.data.message
                .map((err: any) => {
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
            } else {
              errorMessage = error.response.data.message;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          bot.editMessageText(`❌ Failed to add payee: ${errorMessage}.`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 Try Again", callback_data: "menu:addpayee" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          });
        }
      }
      // Handle remove payee confirmation
      else if (action === "remove" && parts.length >= 3) {
        bot.answerCallbackQuery(query.id);
        const payeeId = parts[2];

        try {
          // Delete the payee via API
          await payeeService.deletePayee(session.token, payeeId);

          bot.editMessageText("✅ Payee has been successfully removed.", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 View Payees", callback_data: "menu:payees" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          });
        } catch (error) {
          console.error("Remove payee error:", error);

          bot.editMessageText(
            "❌ Failed to remove payee. Please try again later.",
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📋 View Payees", callback_data: "menu:payees" }],
                  [{ text: "« Back to Menu", callback_data: "return:menu" }],
                ],
              },
            }
          );
        }
      }
      // Handle remove payee cancellation
      else if (action === "removecancel") {
        bot.answerCallbackQuery(query.id);

        bot.editMessageText("🚫 Payee removal cancelled.", {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 View Payees", callback_data: "menu:payees" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        });
      }
    }

    // Handle menu:addpayee callback directly to avoid duplicates
    else if (callbackData === "menu:addpayee") {
      bot.answerCallbackQuery(query.id);

      // Start the add payee flow directly in the current message
      bot.editMessageText(
        "➕ *Add a New Payee*\n\nPlease enter the payee's email address:",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel", callback_data: "payee:cancel" }],
            ],
          },
        }
      );

      // Initialize state machine at email step
      updateSessionState(chatId, {
        currentAction: "addpayee",
        data: { step: "email" },
      });
    }
  });
}
