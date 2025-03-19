import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { registerAuthHandlers } from "./handlers/auth.handler";
import { registerWalletHandlers } from "./handlers/wallet.handler";
import { registerTransferHandlers } from "./handlers/transfer.handler";
import { registerNotificationHandlers } from "./handlers/notification.handler";
import { getSession } from "./session";
import {
  createMainMenuKeyboard,
  createSendOptionsKeyboard,
} from "./utils/keyboard";

// Initialize bot with polling
const bot = new TelegramBot(config.botToken, { polling: true });

// Register all handlers
registerAuthHandlers(bot);
registerWalletHandlers(bot);
registerTransferHandlers(bot);
registerNotificationHandlers(bot);

// Add general callback query routing for main menu
bot.on("callback_query", (query) => {
  if (!query.message || !query.data) return;

  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const callbackData = query.data;

  console.log(`Received callback in main handler: ${callbackData}`);

  // Handle main menu actions
  if (callbackData.startsWith("menu:")) {
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      return;
    }

    const action = callbackData.split(":")[1];

    switch (action) {
      case "balance":
        // Trigger balance command programmatically
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/balance",
          },
        });
        break;

      case "history":
        // Trigger history command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/history",
          },
        });
        break;

      case "profile":
        // Trigger profile command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/profile",
          },
        });
        break;

      case "send":
        // Show send options
        bot.answerCallbackQuery(query.id);
        bot.editMessageText("💸 *Send Funds*\n\nPlease select an option:", {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createSendOptionsKeyboard(),
          },
        });
        break;

      case "withdraw":
        // Trigger withdrawbank command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/withdrawbank",
          },
        });
        break;

      case "setdefaultwallet":
        // Trigger setdefaultwallet command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/setdefaultwallet",
          },
        });
        break;

      case "kyc":
        // Trigger kyc command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/kyc",
          },
        });
        break;

      case "help":
        // Trigger help command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/help",
          },
        });
        break;

      case "deposit":
        // Trigger deposit command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/deposit",
          },
        });
        break;
    }
  }
  // Handle send menu options
  else if (callbackData.startsWith("send:")) {
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      return;
    }

    const action = callbackData.split(":")[1];

    switch (action) {
      case "email":
        // Trigger sendemail command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/sendemail",
          },
        });
        break;

      case "wallet":
        // Trigger sendwallet command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/sendwallet",
          },
        });
        break;

      case "bank":
        // Trigger withdrawbank command
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, messageId);
        bot.processUpdate({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: query.from,
            chat: { id: chatId, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "/withdrawbank",
          },
        });
        break;

      case "back":
        // Go back to main menu
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          "🤖 *CopperX Payout Bot*\n\nWhat would you like to do?",
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createMainMenuKeyboard(),
            },
          }
        );
        break;
    }
  }
  // Handle direct return to menu callbacks
  else if (callbackData === "return:menu") {
    // Show main menu
    bot.answerCallbackQuery(query.id);
    bot.editMessageText(
      "🤖 *CopperX Payout Bot*\n\nWhat would you like to do?",
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createMainMenuKeyboard(),
        },
      }
    );
  }
});

// Add main menu command
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  // Check if user is logged in
  const session = getSession(chatId);
  if (!session) {
    bot.sendMessage(
      chatId,
      "⚠️ You need to be logged in to access the menu.\nPlease use /login to authenticate."
    );
    return;
  }

  // Show main menu with inline keyboard
  bot.sendMessage(
    chatId,
    "🤖 *CopperX Payout Bot*\n\nWhat would you like to do?",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: createMainMenuKeyboard(),
      },
    }
  );
});

// Error handling for bot API errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
});

bot.on("error", (error) => {
  console.error("Bot error:", error);
});

// Log successful bot startup
console.log("Copperx Payout Bot is running...");

// Get and log bot information
bot.getMe().then((botInfo) => {
  console.log(`Bot username: @${botInfo.username}`);
});
