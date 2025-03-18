import TelegramBot from "node-telegram-bot-api";

/**
 * Register notification handlers
 * @param bot The Telegram bot instance
 */
export function registerNotificationHandlers(bot: TelegramBot): void {
  // No explicit commands needed - notifications are handled automatically on login
  console.log(
    "Notification handlers initialized - deposit notifications are automatic on login"
  );

  // Add an error handler for debugging notification issues
  bot.on("polling_error", (error) => {
    if (error.message.includes("notification")) {
      console.error("Notification-related polling error:", error);
    }
  });
}
