import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../core/command";
import { requireAuth } from "../../core/middleware";

// Create module logger
// const logger = getModuleLogger("transfer-menu-command");

/**
 * Transfer Menu command implementation
 */
export class TransferMenuCommand implements BotCommand {
  name = "transfer";
  description = "Send funds to someone";

  /**
   * Execute transfer command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    requireAuth(bot, chatId, async (_session) => {
      await this.showTransferMenu(bot, chatId);
    });
  }

  /**
   * Handle callback queries
   */
  async handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    // Answer callback query to remove loading indicator
    bot.answerCallbackQuery(query.id);

    if (
      callbackData === "wallet:transfer" ||
      callbackData === "action:transfer" ||
      callbackData === "transfer:menu"
    ) {
      requireAuth(bot, chatId, async (_session) => {
        await this.showTransferMenu(bot, chatId);
      });
    }
  }

  /**
   * Show transfer menu with options
   */
  private async showTransferMenu(
    bot: TelegramBot,
    chatId: number
  ): Promise<void> {
    const message =
      "💸 *Transfer Menu*\n\n" + "Please select a transfer method:";

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "📧 Send to Email", callback_data: "transfer:method:email" }],
      [{ text: "🔑 Send to Wallet", callback_data: "transfer:method:wallet" }],
      [{ text: "🏦 Bank Withdrawal", callback_data: "transfer:method:bank" }],
      [{ text: "📊 Batch Transfer", callback_data: "transfer:method:batch" }],
      [{ text: "📥 Deposit", callback_data: "menu:deposit" }],
      [{ text: "📜 History", callback_data: "menu:history" }],
      [{ text: "❌ Cancel", callback_data: "menu:main" }],
    ];

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }
}
