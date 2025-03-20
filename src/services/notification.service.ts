import Pusher from "pusher-js";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
import { config } from "../config";
import { createActionKeyboard } from "../utils/keyboard";

interface PusherAuthorizer {
  authorize: (
    socketId: string,
    callback: (error: Error | null, authData: any) => void
  ) => void;
}

interface PusherChannel {
  bind: (event: string, callback: (data?: any) => void) => void;
}

/**
 * Initialize Pusher and subscribe to deposit notifications
 * @param chatId The Telegram chat ID
 * @param token The authentication token
 * @param organizationId The organization ID
 * @param bot The Telegram bot instance
 * @returns The Pusher channel
 */
export function subscribeToDepositNotifications(
  chatId: number,
  token: string,
  organizationId: string,
  bot: TelegramBot
): PusherChannel | null {
  try {
    const pusherClient = new Pusher(config.pusher.key, {
      cluster: config.pusher.cluster,
      authorizer: (channel: { name: string }): PusherAuthorizer => ({
        authorize: async (
          socketId: string,
          callback: (error: Error | null, authData: any) => void
        ): Promise<void> => {
          try {
            const response = await axios.post(
              `${config.apiBaseUrl}/api/notifications/auth`,
              {
                socket_id: socketId,
                channel_name: channel.name,
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (response.data) {
              callback(null, response.data);
            } else {
              callback(new Error("Pusher authentication failed"), null);
            }
          } catch (error) {
            console.error("Pusher authorization error:", error);
            callback(error as Error, null);
          }
        },
      }),
    });

    // Subscribe to organization's private channel
    const channel = pusherClient.subscribe(`private-org-${organizationId}`);

    channel.bind("pusher:subscription_succeeded", () => {
      console.log(
        `Successfully subscribed to organization channel for chat ID ${chatId}`
      );

      // Send confirmation message to user
      bot.sendMessage(
        chatId,
        "✅ Successfully subscribed to deposit notifications! You will be notified when you receive deposits.",
        {
          reply_markup: {
            inline_keyboard: createActionKeyboard([]),
          },
        }
      );
    });

    channel.bind("pusher:subscription_error", (error: any) => {
      console.error("Subscription error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to subscribe to notifications. Please try again later.",
        {
          reply_markup: {
            inline_keyboard: createActionKeyboard(["support"]),
          },
        }
      );
    });

    // Bind to the deposit event
    channel.bind("deposit", (data: any) => {
      bot.sendMessage(
        chatId,
        `💰 *New Deposit Received*\n\n` +
          `${data.amount} ${data.currency || "USDC"} deposited on ${
            data.network || "your wallet"
          }\n\n` +
          `Use /balance to view your updated wallet balances.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createActionKeyboard(["balance", "history"]),
          },
        }
      );
    });

    return channel;
  } catch (error) {
    console.error("Error setting up Pusher:", error);
    bot.sendMessage(
      chatId,
      "❌ Failed to set up notifications. Please try again later.",
      {
        reply_markup: {
          inline_keyboard: createActionKeyboard(["support"]),
        },
      }
    );
    return null;
  }
}
