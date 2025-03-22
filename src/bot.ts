import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { registerAuthHandlers } from "./handlers/auth.handler";
import { registerWalletHandlers } from "./handlers/wallet.handler";
import { registerTransferHandlers } from "./handlers/transfer";
import { registerNotificationHandlers } from "./handlers/notification.handler";
import { registerPayeeHandlers } from "./handlers/payee.handler";
import { getSession, scanAndRefreshSessions } from "./session";
import { createMainMenuKeyboard } from "./utils/keyboard";
import { handleCallbackQuery } from "./handlers/callback.router";
import { SESSION_REFRESH_INTERVAL } from "./constants";

export function startBot() {
  // Initialize bot with polling
  const bot = new TelegramBot(config.botToken, { polling: true });

  // Set up scheduled session refresh
  setInterval(() => {
    scanAndRefreshSessions();
  }, SESSION_REFRESH_INTERVAL);

  // Register all handlers
  registerAuthHandlers(bot);
  registerWalletHandlers(bot);
  registerTransferHandlers(bot);
  registerNotificationHandlers(bot);
  registerPayeeHandlers(bot);

  // Add callback query handler
  bot.on("callback_query", (query) => handleCallbackQuery(bot, query));

  // Add main menu command
  bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to access the menu.\nPlease use /login to authenticate.",
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

  return bot;
}
