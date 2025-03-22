import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../../session";
import * as walletService from "../../services/wallet.service";
import {
  createDepositWalletSelectionKeyboard,
  createDepositActionsKeyboard,
} from "../../utils/keyboard";
import { getNetworkName } from "../../utils/networkConstants";
import { logger } from "../../utils/logger";
import { sendWalletQRCode } from "../../utils/message";

// Define the DepositState interface for tracking the deposit flow
interface DepositState {
  step: "wallet_selection" | "show_address";
  walletId?: string;
  network?: string;
  walletAddress?: string;
}

/**
 * Register deposit handlers
 * @param bot The Telegram bot instance
 */
export function registerDepositHandlers(bot: TelegramBot): void {
  // Deposit command handler
  bot.onText(/\/deposit/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to initiate a deposit.\nPlease use /login to authenticate."
      );
      return;
    }

    try {
      // Fetch all user wallets
      const wallets = await walletService.getWallets(session.token);

      logger.info(`Fetched ${wallets.length} wallets for user`, { chatId });

      if (!wallets || wallets.length === 0) {
        bot.sendMessage(
          chatId,
          "⚠️ You don't have any wallets set up.\nPlease visit https://copperx.io to set up your wallets first."
        );
        return;
      }

      // Set session state for deposit flow
      updateSessionState(chatId, {
        currentAction: "deposit",
        data: {
          step: "wallet_selection",
        } as DepositState,
      });

      // Show wallet selection options
      bot.sendMessage(
        chatId,
        "💰 *Deposit to Your Wallet*\n\nPlease select which wallet you would like to deposit to:",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createDepositWalletSelectionKeyboard(wallets),
          },
        }
      );
    } catch (error) {
      logger.error("Wallet fetch error:", { error });
      bot.sendMessage(
        chatId,
        "❌ Failed to retrieve your wallet information. Please try again later or visit the Copperx web app at https://copperx.io."
      );
    }
  });

  // Handle deposit callbacks
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.answerCallbackQuery(query.id, {
        text: "Your session has expired. Please login again.",
        show_alert: true,
      });
      bot.deleteMessage(chatId, messageId);
      return;
    }

    // Handle deposit flow callbacks
    if (callbackData.startsWith("deposit:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "deposit") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      // Get current deposit state
      const data = sessionState.data as DepositState;

      // Handle wallet selection
      if (action === "wallet" && parts.length >= 4) {
        const walletId = parts[2];
        const network = parts[3];

        try {
          // Fetch the wallet to get the address
          const wallets = await walletService.getWallets(session.token);
          const selectedWallet = wallets.find((w) => w.id === walletId);

          if (!selectedWallet) {
            bot.answerCallbackQuery(query.id, {
              text: "Wallet not found. Please try again.",
              show_alert: true,
            });
            return;
          }

          // Update state with selected wallet
          updateSessionState(chatId, {
            currentAction: "deposit",
            data: {
              step: "show_address",
              walletId: walletId,
              network: network,
              walletAddress: selectedWallet.walletAddress,
            } as DepositState,
          });

          // Get network name for display
          const networkName = getNetworkName(network);

          // Format wallet address for display
          const walletAddress = selectedWallet.walletAddress;

          // Acknowledge callback
          bot.answerCallbackQuery(query.id);

          // Show wallet address with warning and QR code option
          bot.editMessageText(
            `📥 *Deposit to ${networkName} Wallet*\n\n` +
              `Please send *USDC only* to the following wallet address:\n\n` +
              `\`${walletAddress}\`\n\n` +
              `⚠️ *IMPORTANT:*\n` +
              `• Only deposit USDC tokens\n` +
              `• Make sure you are using the ${networkName} network\n` +
              `• Deposits from other networks may result in loss of funds\n\n` +
              `You will receive a notification when your deposit is confirmed.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createDepositActionsKeyboard(walletId),
              },
            }
          );
        } catch (error) {
          logger.error("Error processing wallet selection:", { error });
          bot.answerCallbackQuery(query.id, {
            text: "Failed to retrieve wallet information. Please try again.",
            show_alert: true,
          });
        }
      }
      // Handle QR code generation
      else if (action === "qrcode" && parts.length >= 3) {
        // Retrieve wallet address from state
        if (data.walletAddress) {
          try {
            // Acknowledge callback
            bot.answerCallbackQuery(query.id);

            // Use the utility function to send QR code
            await sendWalletQRCode(
              bot,
              chatId,
              data.walletAddress,
              data.network
            );
          } catch (error) {
            logger.error("Error generating QR code:", { error });
            bot.sendMessage(
              chatId,
              "❌ Failed to generate QR code. Please try again later."
            );
          }
        } else {
          bot.answerCallbackQuery(query.id, {
            text: "Could not generate QR code. Wallet address not found.",
            show_alert: true,
          });
        }
      }

      // Handle cancellation
      else if (action === "cancel") {
        // Clear state
        updateSessionState(chatId, {
          currentAction: undefined,
        });

        // Acknowledge callback
        bot.answerCallbackQuery(query.id);

        // Show cancellation message
        bot.editMessageText("🚫 Deposit operation cancelled.", {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "📥 Try Again", callback_data: "menu:deposit" }],
              [{ text: "« Back to Menu", callback_data: "return:menu" }],
            ],
          },
        });
      }
    }
  });
}
