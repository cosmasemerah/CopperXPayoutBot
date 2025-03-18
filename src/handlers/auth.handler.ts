import TelegramBot from "node-telegram-bot-api";
import { getSession, setSession, deleteSession } from "../session";
import * as authService from "../services/auth.service";
import * as notificationService from "../services/notification.service";
import { ExtendedSession } from "../session";
import { KYCStatus } from "../types";

// Map to track active notification subscriptions for deposit events
const activeSubscriptions = new Map<number, any>();

// State for tracking authentication steps
interface OTPState {
  email: string;
  sid: string;
}

// Map to track email input states
const awaitingEmail = new Map<number, boolean>();
// Map to track OTP input states
const awaitingOTP = new Map<number, OTPState>();

/**
 * Register authentication handlers
 * @param bot The Telegram bot instance
 */
export function registerAuthHandlers(bot: TelegramBot): void {
  // Start command handler
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

  // Login command handler
  bot.onText(/\/login/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if already logged in
    const session = getSession(chatId);
    if (session) {
      bot.sendMessage(
        chatId,
        "You are already logged in. Use /logout to sign out first."
      );
      return;
    }

    // Start login flow
    bot.sendMessage(
      chatId,
      "Please enter your email address to receive an OTP:"
    );
    awaitingEmail.set(chatId, true);
  });

  // Logout command handler
  bot.onText(/\/logout/, (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Clean up any active subscriptions for this chat
    if (activeSubscriptions.has(chatId)) {
      const channel = activeSubscriptions.get(chatId);
      try {
        if (channel) {
          channel.unbind_all();
          channel.unsubscribe();
        }
        activeSubscriptions.delete(chatId);
      } catch (error) {
        console.error("Error cleaning up subscriptions on logout:", error);
      }
    }

    if (getSession(chatId)) {
      deleteSession(chatId);
      bot.sendMessage(chatId, "You have been successfully logged out. 👋");
    } else {
      bot.sendMessage(chatId, "You are not logged in.");
    }
  });

  // Profile command handler
  bot.onText(/\/profile/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view your profile.\nPlease use /login to authenticate."
      );
      return;
    }

    try {
      // Fetch user profile
      const user = await authService.getUserProfile(session.token);

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

  // KYC command handler
  bot.onText(/\/kyc/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to check your KYC status.\nPlease use /login to authenticate."
      );
      return;
    }

    try {
      // Fetch KYC status
      const kycResponse = await authService.getKYCStatus(session.token);

      if (kycResponse.data.length === 0) {
        bot.sendMessage(
          chatId,
          "📋 *KYC Status*\n\n" +
            "You haven't started the KYC process yet.\n" +
            "Please complete your KYC at https://copperx.io/kyc",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const kycData = kycResponse.data[0];
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

  // Unsubscribe from notifications command handler
  bot.onText(/\/unsubscribe/, (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    if (activeSubscriptions.has(chatId)) {
      const channel = activeSubscriptions.get(chatId);

      // Attempt to unbind and unsubscribe
      try {
        if (channel) {
          channel.unbind_all();
          channel.unsubscribe();
        }

        activeSubscriptions.delete(chatId);
        bot.sendMessage(
          chatId,
          "✅ Successfully unsubscribed from deposit notifications."
        );
      } catch (error) {
        console.error("Unsubscribe error:", error);
        bot.sendMessage(
          chatId,
          "❌ Error while unsubscribing. Please try again."
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        "You are not currently subscribed to deposit notifications."
      );
    }
  });

  // Help command handler
  bot.onText(/\/help/, (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
      chatId,
      `Available Commands:\n\n` +
        `🔑 /login - Authenticate with your Copperx account\n` +
        `👤 /profile - View your profile details\n` +
        `📋 /kyc - Check your KYC status\n` +
        `💰 /balance - View your wallet balances\n` +
        `🏦 /setdefaultwallet - Set your default wallet\n` +
        `📤 /sendemail - Send funds to an email address\n` +
        `📜 /history - View your transaction history\n` +
        `📋 /menu - Show interactive menu with all options\n` +
        `🚫 /unsubscribe - Disable deposit notifications\n` +
        `❓ /help - Show this help message\n\n` +
        `Need assistance? Visit https://t.me/copperxcommunity/2183`
    );
  });

  // Handle email and OTP inputs
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
        const { email, sid } = await authService.requestEmailOTP(text);
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
        const authResponse = await authService.authenticateWithOTP(
          otpState.email,
          text,
          otpState.sid
        );

        // Create session
        const session: ExtendedSession = {
          token: authResponse.accessToken,
          expireAt: new Date(authResponse.expireAt),
          organizationId: authResponse.user.organizationId,
        };

        setSession(chatId, session);

        // Auto-subscribe to deposit notifications
        try {
          // Check if already subscribed
          if (!activeSubscriptions.has(chatId)) {
            const channel = notificationService.subscribeToDepositNotifications(
              chatId,
              session.token,
              session.organizationId,
              bot
            );

            if (channel) {
              activeSubscriptions.set(chatId, channel);
              console.log(
                `User ${authResponse.user.email} subscribed to deposit notifications automatically`
              );
            }
          }
        } catch (error) {
          console.error("Auto-subscription error:", error);
          // Don't block login flow if subscription fails
        }

        bot.sendMessage(
          chatId,
          `✅ Login successful!\n\nWelcome ${authResponse.user.firstName}!\n\nYou will automatically receive notifications for deposits. Use /help to see available commands.`
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
}
