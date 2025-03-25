import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../core/command";
import { SessionService } from "../core/session.service";
import { createMainMenuKeyboard } from "../utils/keyboard";

/**
 * Menu command implementation
 */
export class MenuCommand implements BotCommand {
  name = "menu";
  description = "Show main menu options";

  /**
   * Execute menu command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = SessionService.getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to login first before accessing the menu.\n\nUse /login to authenticate.",
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

    // User is logged in, show the main menu
    await this.sendMainMenu(bot, chatId);
  }

  /**
   * Send main menu
   */
  private async sendMainMenu(bot: TelegramBot, chatId: number): Promise<void> {
    bot.sendMessage(
      chatId,
      "🏠 *Main Menu*\n\nWelcome to the Copperx Payout Bot! Please choose one of the following options to proceed:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createMainMenuKeyboard(),
        },
      }
    );
  }

  /**
   * Handle callback queries related to menu
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) {
      bot.answerCallbackQuery(query.id);
      return;
    }

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    // Handle main menu callback - handle all formats for backwards compatibility
    if (
      callbackData === "menu:main" ||
      callbackData === "menu" ||
      callbackData === "return:menu"
    ) {
      await this.sendMainMenu(bot, chatId);
    }
  }
}
