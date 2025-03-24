import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../re-core/command";
import { getSession } from "../session";
import { createMainMenuKeyboard } from "../utils/keyboard";
import { config } from "../config";

/**
 * Start command implementation
 */
export class StartCommand implements BotCommand {
  name = "start";
  description = "Start the bot and get a welcome message";

  /**
   * Execute start command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const username = msg.from?.username || msg.from?.first_name || "there";

    // Check if user is already logged in
    const session = getSession(chatId);
    if (session) {
      // User is logged in, show welcome with menu
      bot.sendMessage(
        chatId,
        `Welcome back ${username} to the Copperx Payout Bot! 🚀\n\n` +
          `What would you like to do today?`,
        {
          reply_markup: {
            inline_keyboard: createMainMenuKeyboard(),
          },
        }
      );
    } else {
      // New user, show welcome message with login button
      bot.sendMessage(
        chatId,
        `Welcome ${username} to the Copperx Payout Bot! 🚀\n\n` +
          `I can help you manage your Copperx payouts directly through Telegram.\n\n` +
          `🔑 Use /login to authenticate\n` +
          `❓ Use /help to see all available commands\n\n` +
          `Need support? Visit ${config.supportLink}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
              [{ text: "❓ Help", callback_data: "menu:help" }],
            ],
          },
        }
      );
    }
  }

  /**
   * Handle callback queries (not needed for start command)
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    // Start command doesn't process callback queries
    bot.answerCallbackQuery(query.id);
  }
}
