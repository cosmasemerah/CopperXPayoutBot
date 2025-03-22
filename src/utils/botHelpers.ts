import TelegramBot from "node-telegram-bot-api";

export function triggerCommand(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  command: string
) {
  if (!query.message) return;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  bot.answerCallbackQuery(query.id);
  bot.deleteMessage(chatId, messageId);
  bot.processUpdate({
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: query.from,
      chat: { id: chatId, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: command,
    },
  });
}

export function editMenuMessage(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  text: string,
  keyboard: any
) {
  bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
