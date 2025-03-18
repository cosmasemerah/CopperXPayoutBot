import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { registerAuthHandlers } from "./handlers/auth.handler";
import { registerWalletHandlers } from "./handlers/wallet.handler";
import { registerTransferHandlers } from "./handlers/transfer.handler";
import { registerNotificationHandlers } from "./handlers/notification.handler";

// Initialize bot with polling
const bot = new TelegramBot(config.botToken, { polling: true });

// Register all handlers
registerAuthHandlers(bot);
registerWalletHandlers(bot);
registerTransferHandlers(bot);
registerNotificationHandlers(bot);

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
