import TelegramBot from "node-telegram-bot-api";
import { BotCommand, commandRegistry } from "../core/command";
import { config } from "../config";

/**
 * Help command implementation
 */
export class HelpCommand implements BotCommand {
  name = "help";
  description = "Display all available commands";

  /**
   * Execute help command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Get all commands from registry
    const commands = commandRegistry.getCommands();
    const helpText = this.buildHelpMessage(commands);

    bot.sendMessage(chatId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "« Back to Menu", callback_data: "menu:main" }],
          [{ text: "💬 Support Channel", url: config.supportLink }],
        ],
      },
    });
  }

  /**
   * Build help message from available commands
   */
  private buildHelpMessage(commands: BotCommand[]): string {
    let message = "*Copperx Payout Bot - Help*\n\n";
    message += "Here are all available commands:\n\n";

    commands.forEach((cmd) => {
      message += `*/${cmd.name}* - ${cmd.description}\n`;
    });

    message += "\n*Need more help?*\n";
    message += `Visit our support channel at ${config.supportLink}`;

    return message;
  }

  /**
   * Handle callback queries
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) {
      bot.answerCallbackQuery(query.id);
      return;
    }

    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (callbackData === "menu:help") {
      this.execute(bot, query.message as TelegramBot.Message);
    }
  }
}
