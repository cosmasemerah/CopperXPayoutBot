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
 * Interface for login session data stored in SessionState.data
 *
 * This represents the structure of data we store in the "data" property
 * of the session state for the login flow. When checking the current step,
 * we can do:
 *
 * if (sessionState?.currentAction === "login") {
 *   const loginData = sessionState.data as LoginData;
 *   if (loginData.loginStep === "email") { ... }
 * }
 */
interface LoginSessionState {
  /** Current step in the login flow */
  loginStep: "email" | "otp";
  /** User's email address (stored after email step) */
  email?: string;
  /** Session ID for OTP verification */
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

    // Set login state with correct structure
    const updateResult = SessionService.updateSessionState(chatId, {
      currentAction: "login",
      data: {
        loginStep: "email",
      },
    });

    logger.debug(`[startAuthFlow] Session update result: ${updateResult}`);

    // Let's check if the session state was actually set
    const stateAfter = SessionService.getSessionState(chatId);
    logger.debug(`[startAuthFlow] State after update:`, stateAfter);

    if (!stateAfter || stateAfter.currentAction !== "login") {
      logger.error(`[startAuthFlow] Failed to set session state for ${chatId}`);
      // Create a new session if it doesn't exist
      SessionService.setSession(chatId, {
        token: "", // Empty token for temporary session
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        organizationId: "",
        state: {
          currentAction: "login",
          data: {
            loginStep: "email",
          },
        },
      });

      // Check again
      const stateAfterFix = SessionService.getSessionState(chatId);
      logger.debug(
        `[startAuthFlow] State after creating session:`,
        stateAfterFix
      );
    }

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

      // Clear session data directly
      SessionService.updateSessionState(chatId, {});

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

    // Add detailed debugging
    logger.debug(
      `[handleUserInput] Called for chat ${chatId} with text: "${msg.text.substring(
        0,
        10
      )}..."`
    );

    // Check if we're awaiting input from this chat
    const isAwaitingEmail = this.awaitingEmail.has(chatId);
    const isAwaitingOTP = this.awaitingOTP.has(chatId);
    logger.debug(
      `[handleUserInput] Tracking state - awaitingEmail: ${isAwaitingEmail}, awaitingOTP: ${isAwaitingOTP}`
    );

    // Get session state directly
    const sessionState = SessionService.getSessionState(chatId);
    logger.debug(
      `[handleUserInput] Session state for ${chatId}:`,
      sessionState
    );

    // First check if this is a login flow from session state
    if (sessionState?.currentAction === "login") {
      logger.debug(`[handleUserInput] Found login action in session state`);

      // Make sure data exists with default empty object
      const loginData = sessionState.data as LoginSessionState;

      // Determine which step we're in
      if (loginData.loginStep === "email") {
        logger.debug(
          `[handleUserInput] Processing email input from session state`
        );
        await this.handleEmailInput(bot, msg);
        return;
      } else if (loginData.loginStep === "otp") {
        logger.debug(
          `[handleUserInput] Processing OTP input from session state`
        );
        await this.handleOTPInput(bot, msg);
        return;
      } else {
        logger.warn(
          `[handleUserInput] Unknown login step in session: ${loginData.loginStep}`
        );
      }
    }

    // Fallback to the old tracking mechanism if session state doesn't have what we need
    if (this.awaitingEmail.has(chatId)) {
      logger.debug(
        `[handleUserInput] Processing email input from awaitingEmail map`
      );

      // Make sure session state is set properly
      SessionService.updateSessionState(chatId, {
        currentAction: "login",
        data: {
          loginStep: "email",
        },
      });

      await this.handleEmailInput(bot, msg);
      return;
    }

    if (this.awaitingOTP.has(chatId)) {
      logger.debug(
        `[handleUserInput] Processing OTP input from awaitingOTP map`
      );

      // Make sure session state is set properly
      const otpState = this.awaitingOTP.get(chatId);
      if (otpState) {
        SessionService.updateSessionState(chatId, {
          currentAction: "login",
          data: {
            loginStep: "otp",
            email: otpState.email,
            sid: otpState.sid,
          },
        });
      }

      await this.handleOTPInput(bot, msg);
      return;
    }

    logger.debug(
      `[handleUserInput] Ignoring input: Not in login flow. Current action: ${sessionState?.currentAction}`
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

      // Store email and sid directly in session state with proper structure
      const updateResult = SessionService.updateSessionState(chatId, {
        currentAction: "login",
        data: {
          loginStep: "otp",
          email: response.email,
          sid: response.sid,
        },
      });

      // Log the update result and session state
      logger.debug(`[handleEmailInput] Session update result: ${updateResult}`);
      const updatedState = SessionService.getSessionState(chatId);
      logger.debug(`[handleEmailInput] Updated session state:`, updatedState);

      // Clean up email tracking
      this.awaitingEmail.delete(chatId);

      // Store OTP state in local map for backward compatibility
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
      // Clear session state directly
      SessionService.updateSessionState(chatId, {});
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

    // Get both from session state and local map for comprehensive check
    const sessionState = SessionService.getSessionState(chatId);
    const otpState = this.awaitingOTP.get(chatId);

    // First try to get credentials from session state
    let email: string | undefined;
    let sid: string | undefined;

    // Safely extract data from session if it exists
    if (sessionState?.data) {
      email = sessionState.data.email;
      sid = sessionState.data.sid;
    }

    // Fallback to map if not in session
    if (!email || !sid) {
      if (!otpState) {
        logger.error(`[handleOTPInput] No OTP state found for chat ${chatId}`);
        bot.sendMessage(
          chatId,
          "⚠️ Your OTP session has expired. Please start the login process again.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Login Again", callback_data: "action:login" }],
                [{ text: "« Back to Menu", callback_data: "menu:main" }],
              ],
            },
          }
        );
        return;
      }

      email = otpState.email;
      sid = otpState.sid;
    }

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
        email,
        otp,
        sid
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
      SessionService.updateSessionState(chatId, {}); // Clear session state

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
      SessionService.updateSessionState(chatId, {}); // Clear session state
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

  // Register callback handlers
  commandRegistry.registerCallbackHandler("action:login", loginCommand);
  commandRegistry.registerCallbackHandler("login", loginCommand);

  logger.info("Login message handlers registered successfully");
}
