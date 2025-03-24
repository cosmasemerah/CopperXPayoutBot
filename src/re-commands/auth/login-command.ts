import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../re-core/command";
import { getSession, setSession, ExtendedSession } from "../../session";
import * as authService from "../../services/auth.service";
import { sendSuccessMessage } from "../../re-utils/message-templates";
import { handleApiErrorResponse } from "../../re-utils/error-handler";
import { getModuleLogger } from "../../re-utils/logger";
import { NotificationCommand } from "../notification-command";
import {
  AuthResponse,
  OTPState,
  OTPRequestResponse,
} from "../../re-types/auth";

// Create module logger
const logger = getModuleLogger("login-command");

// Map to track email input states
const awaitingEmail = new Map<number, boolean>();
// Map to track OTP input states
const awaitingOTP = new Map<number, OTPState>();

/**
 * Login command implementation
 */
export class LoginCommand implements BotCommand {
  name = "login";
  description = "Authenticate with your Copperx account";

  /**
   * Execute login command
   */
  async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Check if already logged in
    const session = getSession(chatId);
    if (session) {
      bot.sendMessage(
        chatId,
        "You are already logged in. Use /logout to sign out first.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 Profile", callback_data: "menu:profile" }],
              [{ text: "💰 Balance", callback_data: "menu:balance" }],
            ],
          },
        }
      );
      return;
    }

    // Start login flow
    bot.sendMessage(
      chatId,
      "Please enter your email address to receive an OTP:"
    );
    awaitingEmail.set(chatId, true);
  }

  /**
   * Handle callback queries related to login
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

    if (callbackData === "action:login") {
      this.execute(bot, query.message as TelegramBot.Message);
    } else if (callbackData === "login:cancel") {
      // Cancel login flow
      awaitingEmail.delete(chatId);
      awaitingOTP.delete(chatId);

      bot.sendMessage(chatId, "Login process canceled.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Login Again", callback_data: "action:login" }],
            [{ text: "📋 Main Menu", callback_data: "menu:main" }],
          ],
        },
      });
    }
  }

  /**
   * Handle email input from user
   */
  async handleEmailInput(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    const chatId = msg.chat.id;
    const email = msg.text?.trim();

    if (!email || !this.isValidEmail(email)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid email address.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel Login", callback_data: "login:cancel" }],
          ],
        },
      });
      return;
    }

    try {
      // Request OTP
      const response: OTPRequestResponse = await authService.requestEmailOTP(
        email
      );

      // Store OTP state
      awaitingEmail.delete(chatId);
      awaitingOTP.set(chatId, {
        email: response.email,
        sid: response.sid,
      });

      bot.sendMessage(
        chatId,
        `📱 We've sent a one-time password to *${email}*.\n\nPlease enter the OTP:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Cancel Login", callback_data: "login:cancel" }],
            ],
          },
        }
      );
    } catch (error: any) {
      logger.error(`OTP request error:`, error);
      handleApiErrorResponse(bot, chatId, error, "action:login");
      awaitingEmail.delete(chatId);
    }
  }

  /**
   * Handle OTP input from user
   */
  async handleOTPInput(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    const chatId = msg.chat.id;
    const otp = msg.text?.trim();

    const otpState = awaitingOTP.get(chatId);
    if (!otpState) return;

    if (!otp || !this.isValidOTP(otp)) {
      bot.sendMessage(chatId, "⚠️ Please enter a valid OTP code.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel Login", callback_data: "login:cancel" }],
          ],
        },
      });
      return;
    }

    try {
      // Authenticate with OTP
      const authResponse: AuthResponse = await authService.authenticateWithOTP(
        otpState.email,
        otp,
        otpState.sid
      );

      // Create user session
      const session: ExtendedSession = {
        token: authResponse.accessToken,
        expireAt: new Date(authResponse.expireAt),
        organizationId: authResponse.user.organizationId,
        lastActivity: new Date(),
      };
      setSession(chatId, session);

      // Clean up state
      awaitingOTP.delete(chatId);

      // Setup notification subscriptions using the NotificationCommand
      try {
        await NotificationCommand.initNotificationsOnLogin(
          bot,
          chatId,
          session
        );
        logger.info(`Notifications set up for user ${chatId}`);
      } catch (notifError: any) {
        logger.error(`Notification setup error:`, notifError);
        // Don't block login flow if subscription fails
      }

      // Send success message
      sendSuccessMessage(
        bot,
        chatId,
        `🎉 Login successful!\n\nWelcome to Copperx Payout Bot. What would you like to do?`,
        ["profile", "balance"]
      );
    } catch (error: any) {
      logger.error(`Authentication error:`, error);
      handleApiErrorResponse(bot, chatId, error, "action:login");
      awaitingOTP.delete(chatId);
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate OTP format
   */
  private isValidOTP(otp: string): boolean {
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
  }
}

/**
 * Create and register message handlers for login flow
 * @param bot The Telegram bot instance
 */
export function registerLoginMessageHandlers(bot: TelegramBot): void {
  bot.on("message", (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;

    // Handle email input
    if (awaitingEmail.has(chatId)) {
      const loginCommand = new LoginCommand();
      loginCommand.handleEmailInput(bot, msg);
      return;
    }

    // Handle OTP input
    if (awaitingOTP.has(chatId)) {
      const loginCommand = new LoginCommand();
      loginCommand.handleOTPInput(bot, msg);
      return;
    }
  });
}
