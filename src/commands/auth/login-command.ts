import TelegramBot from "node-telegram-bot-api";
import {
  SessionService,
  ExtendedSession,
  SessionState,
} from "../../core/session.service";
import * as authService from "../../services/auth.service";
import { sendSuccessMessage } from "../../utils/message-templates";
import { handleApiErrorResponse } from "../../utils/error-handler";
import { getModuleLogger } from "../../utils/logger";
import { NotificationCommand } from "../notification-command";
import { AuthResponse, OTPState, OTPRequestResponse } from "../../types/auth";
import { BaseAuthCommand } from "./base-auth-command";
import { commandRegistry } from "../../core/command";

// Create module logger
const logger = getModuleLogger("login-command");

/**
 * Interface for login session state
 */
interface LoginSessionState extends SessionState {
  currentAction: "login";
  loginStep: "email" | "otp";
  email?: string;
  sid?: string;
}

/**
 * Login command implementation
 */
export class LoginCommand extends BaseAuthCommand {
  name = "login";
  description = "Authenticate with your Copperx account";

  // Map to track email input states
  private awaitingEmail = new Map<number, boolean>();
  // Map to track OTP input states
  private awaitingOTP = new Map<number, OTPState>();

  /**
   * Get the callback prefix for this command
   */
  protected getCallbackPrefix(): string {
    return "action:login";
  }

  /**
   * Start the auth flow for Login
   */
  protected async startAuthFlow(
    bot: TelegramBot,
    chatId: number,
    _msg: TelegramBot.Message
  ): Promise<void> {
    // Check if already logged in
    const session = SessionService.getSession(chatId);
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

    logger.debug(`[startAuthFlow] Setting login state for chat ${chatId}`);

    // For non-logged in users, initialize a session state
    if (!SessionService.getSessionState(chatId)) {
      logger.debug(
        `[startAuthFlow] Creating initial session state for ${chatId}`
      );
      SessionService.updateSessionState(chatId, {
        currentAction: "login",
        data: {},
      });
    }

    // Now update the state with login details
    SessionService.updateSessionState(chatId, {
      currentAction: "login",
      data: {
        currentAction: "login",
        loginStep: "email",
      },
    });

    const stateAfter = SessionService.getSessionState(chatId);
    logger.debug(`[startAuthFlow] State after update:`, stateAfter);

    // Start login flow
    bot.sendMessage(
      chatId,
      "Please enter your email address to receive an OTP:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel Login", callback_data: "login:cancel" }],
          ],
        },
      }
    );

    this.awaitingEmail.set(chatId, true);
  }

  /**
   * Process callback data for login
   */
  protected async processCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void> {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const callbackData = query.data;

    logger.debug(
      `[processCallback] Processing callback ${callbackData} for chat ${chatId}`
    );

    if (callbackData === "action:login") {
      this.execute(bot, query.message as TelegramBot.Message);
    } else if (callbackData === "login:cancel") {
      logger.debug(
        `[processCallback] Cancelling login flow for chat ${chatId}`
      );

      // Cancel login flow
      this.awaitingEmail.delete(chatId);
      this.awaitingOTP.delete(chatId);

      // Clear session data
      this.clearSessionData(chatId);

      // Send confirmation
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
   * Handle user text input for login
   */
  async handleUserInput(
    bot: TelegramBot,
    msg: TelegramBot.Message
  ): Promise<void> {
    if (!msg.text) return;

    const chatId = msg.chat.id;

    // Get the raw session state first for debugging
    const rawState = SessionService.getSessionState(chatId);
    logger.debug(
      `[handleUserInput] Raw session state for ${chatId}:`,
      rawState
    );

    // Get the state using our helper
    const state = this.getSessionData<LoginSessionState>(chatId);
    logger.debug(
      `[handleUserInput] Processed session data for ${chatId}:`,
      state
    );

    // First check our session state
    if (state && state.currentAction === "login") {
      switch (state.loginStep) {
        case "email":
          logger.debug(
            `[handleUserInput] Processing email input for ${chatId} from session state`
          );
          await this.handleEmailInput(bot, msg);
          return;
        case "otp":
          logger.debug(
            `[handleUserInput] Processing OTP input for ${chatId} from session state`
          );
          await this.handleOTPInput(bot, msg);
          return;
        default:
          logger.warn(
            `[handleUserInput] Unknown login step: ${state.loginStep}`
          );
      }
    }

    // Fallback to the old tracking mechanism
    if (this.awaitingEmail.has(chatId)) {
      logger.debug(
        `[handleUserInput] Processing email input for ${chatId} from awaitingEmail map`
      );
      await this.handleEmailInput(bot, msg);
      return;
    }

    if (this.awaitingOTP.has(chatId)) {
      logger.debug(
        `[handleUserInput] Processing OTP input for ${chatId} from awaitingOTP map`
      );
      await this.handleOTPInput(bot, msg);
      return;
    }

    logger.debug(
      `[handleUserInput] Ignoring input: Not in login flow. Current action: ${state?.currentAction}`
    );
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

      // Store email and sid in session state
      this.updateSessionData<LoginSessionState>(chatId, {
        currentAction: "login",
        loginStep: "otp",
        email: response.email,
        sid: response.sid,
      });

      // Clean up email tracking
      this.awaitingEmail.delete(chatId);

      // Store OTP state in local map
      this.awaitingOTP.set(chatId, {
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
      this.awaitingEmail.delete(chatId);
      this.clearSessionData(chatId);
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

    const otpState = this.awaitingOTP.get(chatId);
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
      SessionService.setSession(chatId, session);

      // Clean up tracking state
      this.awaitingOTP.delete(chatId);
      this.clearSessionData(chatId);

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
      this.awaitingOTP.delete(chatId);
      this.clearSessionData(chatId);
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
 * Register message handlers for login flow
 * @param bot The Telegram bot instance
 */
export function registerLoginMessageHandlers(bot: TelegramBot): void {
  const loginCommand = new LoginCommand();

  // Register the login command for handling messages
  commandRegistry.registerCommand(loginCommand);

  // Register callback handlers
  commandRegistry.registerCallbackHandler("action:login", loginCommand);
  commandRegistry.registerCallbackHandler("login", loginCommand);

  logger.info("Login message handlers registered successfully");
}
