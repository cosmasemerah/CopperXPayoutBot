import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import axios from "axios";
import {
  AuthResponse,
  UserSession,
  User,
  KYCResponse,
  KYCStatus,
} from "./types";

// Load environment variables
dotenv.config();

// Validate required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUSHER_KEY = process.env.PUSHER_KEY;
const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER;

if (!BOT_TOKEN || !PUSHER_KEY || !PUSHER_CLUSTER) {
  console.error(
    "Missing required environment variables. Please check your .env file."
  );
  process.exit(1);
}

// Initialize bot with polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Store user sessions with type safety
const sessions = new Map<number, UserSession>();

// Store email OTP request states
interface OTPState {
  email: string;
  sid: string;
}

const awaitingEmail = new Map<number, boolean>();
const awaitingOTP = new Map<number, OTPState>();

// Base API URL
const API_BASE_URL = "https://income-api.copperx.io";

// Function to check if a session is valid
function isSessionValid(session: UserSession): boolean {
  return new Date() < session.expireAt;
}

// Handle /start command with typed message
bot.onText(/\/start/, (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || "there";

  bot.sendMessage(
    chatId,
    `Welcome ${username} to the Copperx Payout Bot! 🚀\n\n` +
      `I can help you manage your Copperx payouts directly through Telegram.\n\n` +
      `🔑 Use /login to authenticate\n` +
      `❓ Use /help to see all available commands\n\n` +
      `Need support? Visit https://t.me/copperxcommunity/2183`
  );
});

// Handle /login command
bot.onText(/\/login/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  // Check if already logged in
  if (sessions.has(chatId)) {
    const session = sessions.get(chatId)!;
    if (isSessionValid(session)) {
      bot.sendMessage(
        chatId,
        "You are already logged in. Use /logout to sign out first."
      );
      return;
    } else {
      // Remove expired session
      sessions.delete(chatId);
    }
  }

  // Start login flow
  bot.sendMessage(chatId, "Please enter your email address to receive an OTP:");
  awaitingEmail.set(chatId, true);
});

// Handle /logout command
bot.onText(/\/logout/, (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  if (sessions.has(chatId)) {
    sessions.delete(chatId);
    bot.sendMessage(chatId, "You have been successfully logged out. 👋");
  } else {
    bot.sendMessage(chatId, "You are not logged in.");
  }
});

// Handle /profile command
bot.onText(/\/profile/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  // Check if user is logged in
  if (!sessions.has(chatId)) {
    bot.sendMessage(
      chatId,
      "⚠️ You need to be logged in to view your profile.\nPlease use /login to authenticate."
    );
    return;
  }

  const session = sessions.get(chatId)!;

  // Check if session is valid
  if (!isSessionValid(session)) {
    sessions.delete(chatId);
    bot.sendMessage(
      chatId,
      "⚠️ Your session has expired.\nPlease use /login to authenticate again."
    );
    return;
  }

  try {
    // Fetch user profile with type safety
    const response = await axios.get<User>(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    const user = response.data;

    // Format profile information
    const profileMessage =
      `👤 *User Profile*\n\n` +
      `*Name*: ${user.firstName} ${user.lastName}\n` +
      `*Email*: ${user.email}\n` +
      `*Account Type*: ${user.type}\n` +
      `*Status*: ${user.status}\n` +
      `*Role*: ${user.role}`;

    bot.sendMessage(chatId, profileMessage, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Profile fetch error:", error);
    bot.sendMessage(
      chatId,
      "❌ Failed to fetch your profile information. Please try again later."
    );
  }
});

// Handle /kyc command
bot.onText(/\/kyc/, async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  // Check if user is logged in
  if (!sessions.has(chatId)) {
    bot.sendMessage(
      chatId,
      "⚠️ You need to be logged in to check your KYC status.\nPlease use /login to authenticate."
    );
    return;
  }

  const session = sessions.get(chatId)!;

  // Check if session is valid
  if (!isSessionValid(session)) {
    sessions.delete(chatId);
    bot.sendMessage(
      chatId,
      "⚠️ Your session has expired.\nPlease use /login to authenticate again."
    );
    return;
  }

  try {
    // Fetch KYC status with type safety
    const response = await axios.get<KYCResponse>(`${API_BASE_URL}/api/kycs`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (response.data.data.length === 0) {
      bot.sendMessage(
        chatId,
        "📋 *KYC Status*\n\n" +
          "You haven't started the KYC process yet.\n" +
          "Please complete your KYC at https://copperx.io/kyc",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const kycData = response.data.data[0];
    let statusMessage = "";

    // Create user-friendly status message based on KYC status
    if (kycData.status === KYCStatus.APPROVED) {
      statusMessage =
        "✅ Your KYC is *approved*. You have full access to all features.";
    } else if (kycData.status === KYCStatus.REJECTED) {
      statusMessage =
        "❌ Your KYC has been *rejected*. Please visit https://copperx.io/kyc to resubmit.";
    } else if (
      kycData.status === KYCStatus.PENDING ||
      kycData.status === KYCStatus.INITIATED
    ) {
      statusMessage =
        "⏳ Your KYC is *pending review*. We'll notify you once it's approved.";
    } else {
      statusMessage = `🔍 Your KYC status is: *${kycData.status}*\nVisit https://copperx.io/kyc for more details.`;
    }

    bot.sendMessage(chatId, `📋 *KYC Status*\n\n${statusMessage}`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("KYC status fetch error:", error);
    bot.sendMessage(
      chatId,
      "❌ Failed to fetch your KYC status. Please try again later."
    );
  }
});

// Handle messages for email and OTP
bot.on("message", async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands
  if (!text || text.startsWith("/")) return;

  // Handle email input
  if (awaitingEmail.get(chatId)) {
    awaitingEmail.delete(chatId);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      bot.sendMessage(
        chatId,
        "Invalid email format. Please use /login to try again."
      );
      return;
    }

    try {
      // Request OTP
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/email-otp/request`,
        {
          email: text,
        }
      );

      const { email, sid } = response.data;
      awaitingOTP.set(chatId, { email, sid });

      bot.sendMessage(
        chatId,
        "OTP has been sent to your email. Please enter it here:"
      );
    } catch (error) {
      console.error("OTP request error:", error);
      bot.sendMessage(
        chatId,
        "Failed to send OTP. Please try again with /login"
      );
    }
    return;
  }

  // Handle OTP input
  if (awaitingOTP.has(chatId)) {
    const otpState = awaitingOTP.get(chatId)!;
    awaitingOTP.delete(chatId);

    try {
      // Verify OTP
      const response = await axios.post<AuthResponse>(
        `${API_BASE_URL}/api/auth/email-otp/authenticate`,
        {
          email: otpState.email,
          otp: text,
          sid: otpState.sid,
        }
      );

      // Create session
      const session: UserSession = {
        token: response.data.accessToken,
        expireAt: new Date(response.data.expireAt),
        organizationId: response.data.user.organizationId,
      };

      sessions.set(chatId, session);

      bot.sendMessage(
        chatId,
        `✅ Login successful!\n\nWelcome ${response.data.user.firstName}!\n\nUse /help to see available commands.`
      );
    } catch (error) {
      console.error("Authentication error:", error);
      bot.sendMessage(
        chatId,
        "❌ Invalid OTP or authentication failed. Please try again with /login"
      );
    }
    return;
  }
});

// Handle /help command with typed message
bot.onText(/\/help/, (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `Available Commands:\n\n` +
      `🔑 /login - Authenticate with your Copperx account\n` +
      `👤 /profile - View your profile details\n` +
      `📋 /kyc - Check your KYC status\n` +
      `💰 /balance - View your wallet balances\n` +
      `📤 /sendemail - Send funds to an email address\n` +
      `🔔 /subscribe - Enable deposit notifications\n` +
      `❓ /help - Show this help message\n\n` +
      `Need assistance? Visit https://t.me/copperxcommunity/2183`
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
