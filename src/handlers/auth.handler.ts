import TelegramBot from "node-telegram-bot-api";
import { getSession, setSession, deleteSession } from "../session";
import * as authService from "../services/auth.service";
import * as notificationService from "../services/notification.service";
import { ExtendedSession } from "../session";
import { KYCStatus } from "../types";
import { config } from "../config";
import {
  createMainMenuKeyboard,
  createActionKeyboard,
  createBackToMenuKeyboard,
} from "../utils/keyboard";
import { sendSuccessMessage, sendErrorMessage } from "../utils/message";

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

    // Check if user is already logged in
    const session = getSession(chatId);
    if (session) {
      // User is logged in, show welcome with menu
      bot.sendMessage(
        chatId,
        `Welcome back ${username} to the Copperx Payout Bot! 🚀\n\n` +
          `What would you like to do today?`,
        {
          reply_markup: {
            inline_keyboard: createMainMenuKeyboard(),
          },
        }
      );
    } else {
      // New user, show welcome message with login button
      bot.sendMessage(
        chatId,
        `Welcome ${username} to the Copperx Payout Bot! 🚀\n\n` +
          `I can help you manage your Copperx payouts directly through Telegram.\n\n` +
          `🔑 Use /login to authenticate\n` +
          `❓ Use /help to see all available commands\n\n` +
          `Need support? Visit ${config.supportLink}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
              [{ text: "❓ Help", callback_data: "menu:help" }],
            ],
          },
        }
      );
    }
  });

  // Login command handler
  bot.onText(/\/login/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if already logged in
    const session = getSession(chatId);
    if (session) {
      bot.sendMessage(
        chatId,
        "You are already logged in. Use /logout to sign out first.",
        {
          reply_markup: {
            inline_keyboard: createActionKeyboard(["profile", "balance"]),
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
      bot.sendMessage(chatId, "You have been successfully logged out. 👋", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Login Again", callback_data: "action:login" }],
          ],
        },
      });
    } else {
      bot.sendMessage(chatId, "You are not logged in.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Login", callback_data: "action:login" }],
          ],
        },
      });
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
        "⚠️ You need to be logged in to view your profile.\nPlease use /login to authenticate.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
            ],
          },
        }
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

      // Send with navigation options
      sendSuccessMessage(bot, chatId, profileMessage, ["balance", "kyc"]);
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      sendErrorMessage(
        bot,
        chatId,
        `❌ Profile fetch failed: ${
          error.response?.data?.message || "Could not retrieve your profile"
        }. Try again or visit ${config.supportLink}`,
        "menu:profile"
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
        "⚠️ You need to be logged in to check your KYC status.\nPlease use /login to authenticate.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
            ],
          },
        }
      );
      return;
    }

    try {
      // Fetch KYC status
      const kycResponse = await authService.getKYCStatus(session.token);

      if (kycResponse.data.length === 0) {
        sendSuccessMessage(
          bot,
          chatId,
          "📋 *KYC Status*\n\n" +
            "You haven't started the KYC process yet.\n" +
            "Please complete your KYC at https://copperx.io/kyc",
          ["profile"]
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

      sendSuccessMessage(bot, chatId, `📋 *KYC Status*\n\n${statusMessage}`, [
        "profile",
      ]);
    } catch (error: any) {
      console.error("KYC status fetch error:", error);
      sendErrorMessage(
        bot,
        chatId,
        `❌ KYC check failed: ${
          error.response?.data?.message || "Could not retrieve your KYC status"
        }. Try again or visit ${config.supportLink}`,
        "menu:kyc"
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
        sendSuccessMessage(
          bot,
          chatId,
          "✅ Successfully unsubscribed from deposit notifications.",
          []
        );
      } catch (error) {
        console.error("Unsubscribe error:", error);
        sendErrorMessage(
          bot,
          chatId,
          "❌ Error while unsubscribing. Please try again.",
          "action:unsubscribe"
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        "You are not currently subscribed to deposit notifications.",
        {
          reply_markup: {
            inline_keyboard: createBackToMenuKeyboard(),
          },
        }
      );
    }
  });

  // Help command handler
  bot.onText(/\/help/, (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    const isLoggedIn = !!session;

    bot.sendMessage(
      chatId,
      "📚 *Command Reference*\n\n" +
        "🔑 /login - Sign in with Copperx\n" +
        "👋 /logout - Sign out\n" +
        "👤 /profile - View your account details\n" +
        "📋 /kyc - Check KYC status\n" +
        "💰 /balance - See wallet balances\n" +
        "🏦 /setdefaultwallet - Set default wallet\n" +
        "📥 /deposit - Deposit USDC\n" +
        "📧 /sendemail - Send to email\n" +
        "📤 /sendwallet - Send to wallet\n" +
        "🏧 /withdrawbank - Withdraw to bank\n" +
        "📜 /history - View recent transactions\n" +
        "📋 /menu - Interactive command menu\n" +
        "🚫 /unsubscribe - Stop notifications\n" +
        "❓ /help - Show this guide\n\n" +
        `*Tip*: Use /menu anytime to access the interactive dashboard menu!\n\n` +
        `Support: ${config.supportLink}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 Open Menu", callback_data: "return:menu" }],
            // Show logout if logged in, otherwise show login
            [
              {
                text: isLoggedIn ? "👋 Logout" : "🔑 Login",
                callback_data: isLoggedIn ? "action:logout" : "action:login",
              },
            ],
          ],
        },
      }
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
          "Invalid email format. Please use /login to try again.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 Try Again", callback_data: "action:login" }],
              ],
            },
          }
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
      } catch (error: any) {
        console.error("OTP request error:", error);
        bot.sendMessage(
          chatId,
          `❌ Login failed: ${
            error.response?.data?.message || "Could not send OTP"
          }. Try again or visit ${config.supportLink}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔄 Try Again", callback_data: "action:login" }],
                [{ text: "📞 Support", callback_data: "action:support" }],
              ],
            },
          }
        );
      }
      return;
    }

    // Handle OTP input
    if (awaitingOTP.has(chatId)) {
      const otpState = awaitingOTP.get(chatId)!;

      try {
        // Verify OTP
        const authResponse = await authService.authenticateWithOTP(
          otpState.email,
          text,
          otpState.sid
        );

        // Clear OTP state on success
        awaitingOTP.delete(chatId);

        // Create session
        const session: ExtendedSession = {
          token: authResponse.accessToken,
          expireAt: new Date(authResponse.expireAt),
          organizationId: authResponse.user.organizationId,
          lastActivity: new Date(),
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
          `✅ Login successful!\n\nWelcome ${authResponse.user.firstName}!\n\nYou will automatically receive notifications for deposits. Use /help to see available commands.`,
          {
            reply_markup: {
              inline_keyboard: createMainMenuKeyboard(),
            },
          }
        );
      } catch (error: any) {
        console.error("Authentication error:", error);
        // Don't delete the OTP state, keep it for retry
        bot.sendMessage(
          chatId,
          `❌ Login failed: ${
            error.response?.data?.message ||
            "Invalid OTP or authentication failed"
          }. Please try entering the correct OTP again.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Request New OTP",
                    callback_data: "action:request_new_otp",
                  },
                ],
                [
                  {
                    text: "❌ Cancel Login",
                    callback_data: "action:cancel_login",
                  },
                ],
              ],
            },
          }
        );
      }
      return;
    }
  });

  // Handle callbacks
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Handle only auth-related callbacks
    if (callbackData === "action:login") {
      try {
        bot.answerCallbackQuery(query.id);

        // Instead of deleting and sending a new message, edit the current one
        bot.editMessageText(
          "Please enter your email address to receive an OTP:",
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );

        // Set the awaiting email flag
        awaitingEmail.set(chatId, true);
      } catch (error) {
        console.error("Error in login callback:", error);
        // Don't throw, just log the error
      }
      return;
    }

    // Handle logout callback
    if (callbackData === "action:logout") {
      try {
        bot.answerCallbackQuery(query.id);

        // Clean up any active subscriptions
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

        // Delete the session if exists
        if (getSession(chatId)) {
          deleteSession(chatId);
          bot.editMessageText("You have been successfully logged out. 👋", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Login Again", callback_data: "action:login" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          });
        } else {
          bot.editMessageText("You are not currently logged in.", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Login", callback_data: "action:login" }],
                [{ text: "« Back to Menu", callback_data: "return:menu" }],
              ],
            },
          });
        }
      } catch (error) {
        console.error("Error in logout callback:", error);
      }
      return;
    }

    // Handle cancel login callback
    if (callbackData === "action:cancel_login") {
      // Clear any login states
      awaitingEmail.delete(chatId);
      awaitingOTP.delete(chatId);

      bot.answerCallbackQuery(query.id, {
        text: "Login cancelled.",
      });

      bot.editMessageText(
        "Login process cancelled. You can start again anytime with /login.",
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔑 Login", callback_data: "action:login" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        }
      );
      return;
    }

    // Handle request new OTP callback
    if (callbackData === "action:request_new_otp") {
      bot.answerCallbackQuery(query.id);

      if (awaitingOTP.has(chatId)) {
        const otpState = awaitingOTP.get(chatId)!;

        try {
          // Request a new OTP for the same email
          const { email, sid } = await authService.requestEmailOTP(
            otpState.email
          );

          // Update with new session ID
          awaitingOTP.set(chatId, { email, sid });

          bot.editMessageText(
            `New OTP has been sent to ${otpState.email}. Please enter it here:`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "❌ Cancel Login",
                      callback_data: "action:cancel_login",
                    },
                  ],
                ],
              },
            }
          );
        } catch (error: any) {
          console.error("OTP re-request error:", error);
          bot.editMessageText(
            `❌ Failed to send a new OTP: ${
              error.response?.data?.message || "Could not send OTP"
            }. Try again or visit ${config.supportLink}`,
            {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 Try Again", callback_data: "action:login" }],
                  [{ text: "📞 Support", callback_data: "action:support" }],
                ],
              },
            }
          );
          // Clear the OTP state as it failed
          awaitingOTP.delete(chatId);
        }
      } else {
        // If somehow the OTP state was lost, restart login
        bot.editMessageText(
          "Session expired. Please start the login process again.",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔑 Login", callback_data: "action:login" }],
              ],
            },
          }
        );
      }
      return;
    }
  });
}
