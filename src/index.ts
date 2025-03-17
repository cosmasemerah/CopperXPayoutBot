import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import Pusher from "pusher";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration constants
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const PUSHER_KEY = process.env.PUSHER_KEY || "";
const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER || "";

// Validate environment variables
if (!BOT_TOKEN || !PUSHER_KEY || !PUSHER_CLUSTER) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

// Initialize Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Basic command handler
bot.onText(/\/start/, (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome to the Copperx Payout Bot! Use /login to authenticate."
  );
});

console.log("Bot is running...");
