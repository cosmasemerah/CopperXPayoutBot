import TelegramBot from "node-telegram-bot-api";
import { getSession } from "../session";
import {
  createMainMenuKeyboard,
  createSendOptionsKeyboard,
  createBackToMenuKeyboard,
} from "../utils/keyboard";
import { triggerCommand, editMenuMessage } from "../utils/botHelpers";
import { config } from "../config";
import * as payeeService from "../services/payee.service";

export function handleActionCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
) {
  if (!query.message || !query.data) return;
  const chatId = query.message.chat.id;
  const action = query.data.split(":")[1];

  switch (action) {
    case "login":
      triggerCommand(bot, query, "/login");
      break;

    case "retry":
      const session = getSession(chatId);
      const currentState = session?.state?.currentAction;
      if (currentState) {
        triggerCommand(bot, query, `/${currentState}`);
      } else {
        bot.answerCallbackQuery(query.id, {
          text: "Unable to retry. Please try again manually.",
          show_alert: true,
        });
      }
      break;

    case "support":
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        `For support, please visit: ${config.supportLink}\n\nOr contact our team directly.`,
        {
          reply_markup: {
            inline_keyboard: createBackToMenuKeyboard(),
          },
        }
      );
      break;

    case "refreshbalance":
      // Trigger the balance command to refresh wallet balances
      triggerCommand(bot, query, "/balance");
      break;

    case "unsubscribe":
      triggerCommand(bot, query, "/unsubscribe");
      break;
  }
}

export async function handleMenuCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
) {
  if (!query.message || !query.data) return;
  const chatId = query.message.chat.id;
  const session = getSession(chatId);

  if (!session) {
    bot.answerCallbackQuery(query.id, {
      text: "Your session has expired. Please login again.",
      show_alert: true,
    });
    return;
  }

  const action = query.data.split(":")[1];
  const menuActions = {
    balance: "/balance",
    history: "/history",
    profile: "/profile",
    withdraw: "/withdrawbank",
    setdefaultwallet: "/setdefaultwallet",
    kyc: "/kyc",
    help: "/help",
    deposit: "/deposit",
    addpayee: "/addpayee",
    listpayees: "/listpayees",
    sendbatch: "/sendbatch",
  };

  if (action === "send") {
    bot.answerCallbackQuery(query.id);
    editMenuMessage(
      bot,
      chatId,
      query.message.message_id,
      "💸 *Send Funds*\n\nPlease select an option:",
      createSendOptionsKeyboard()
    );
  } else if (action === "payees") {
    bot.answerCallbackQuery(query.id);
    try {
      // Show loading message
      bot.editMessageText("Loading your payees... Please wait.", {
        chat_id: chatId,
        message_id: query.message.message_id,
      });

      // Fetch payees directly
      const payeeResponse = await payeeService.getPayees(session.token);

      if (payeeResponse.data.length === 0) {
        bot.editMessageText(
          "📝 You don't have any saved payees yet. Add a payee to get started.",
          {
            chat_id: chatId,
            message_id: query.message.message_id,
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

      // Format message with payee list
      let message = "👥 *Your Payees*\n\n";

      payeeResponse.data.forEach((payee, index) => {
        const displayName = payee.displayName || payee.email;
        message += `${index + 1}. ${displayName} - \`${payee.email}\`\n`;
        message += `   ID: \`${payee.id}\`\n\n`;
      });

      message +=
        "\nTo remove a payee, use the /removepayee command followed by the payee ID.";

      // Show payee list with action buttons
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "➕ Add Payee", callback_data: "menu:addpayee" },
              { text: "📤 Send Batch", callback_data: "menu:sendbatch" },
            ],
            [{ text: "« Back to Menu", callback_data: "return:menu" }],
          ],
        },
      });
    } catch (error) {
      console.error("List payees error:", error);
      bot.editMessageText(
        "❌ Failed to retrieve payees. Please try again later.",
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "menu:payees" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        }
      );
    }
  } else if (action in menuActions) {
    triggerCommand(bot, query, menuActions[action as keyof typeof menuActions]);
  }
}

export function handleSendCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
) {
  if (!query.message || !query.data) return;
  const chatId = query.message.chat.id;
  const session = getSession(chatId);

  if (!session) {
    bot.answerCallbackQuery(query.id, {
      text: "Your session has expired. Please login again.",
      show_alert: true,
    });
    return;
  }

  const action = query.data.split(":")[1];
  const sendActions = {
    email: "/sendemail",
    wallet: "/sendwallet",
    bank: "/withdrawbank",
  };

  if (action === "back") {
    bot.answerCallbackQuery(query.id);
    editMenuMessage(
      bot,
      chatId,
      query.message.message_id,
      "🤖 *CopperX Payout Bot*\n\nWhat would you like to do?",
      createMainMenuKeyboard()
    );
  } else if (action in sendActions) {
    triggerCommand(bot, query, sendActions[action as keyof typeof sendActions]);
  }
}

export function handleCallbackQuery(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
) {
  if (!query.message || !query.data) return;
  const callbackData = query.data;
  const chatId = query.message.chat.id;

  // Centralized logging (log only once per callback)
  console.log(`Received callback: ${callbackData} from chat ${chatId}`);

  if (callbackData.startsWith("action:")) {
    handleActionCallback(bot, query);
  } else if (callbackData.startsWith("menu:")) {
    handleMenuCallback(bot, query);
  } else if (callbackData.startsWith("send:")) {
    handleSendCallback(bot, query);
  } else if (callbackData === "return:menu") {
    if (!query.message) return;
    bot.answerCallbackQuery(query.id);
    editMenuMessage(
      bot,
      query.message.chat.id,
      query.message.message_id,
      "🤖 *CopperX Payout Bot*\n\nWhat would you like to do?",
      createMainMenuKeyboard()
    );
  }
}
