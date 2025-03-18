import TelegramBot from "node-telegram-bot-api";
import { getSession } from "../session";
import * as transferService from "../services/transfer.service";
import { formatAmount } from "../utils/format";

// Define the SendEmailState interface for the multi-step process
interface SendEmailState {
  step: "email" | "amount" | "confirm";
  email?: string;
  amount?: string;
}

// Map to track email transfer states
const sendEmailStates = new Map<number, SendEmailState>();

/**
 * Register transfer handlers
 * @param bot The Telegram bot instance
 */
export function registerTransferHandlers(bot: TelegramBot): void {
  // Send to email command handler
  bot.onText(/\/sendemail/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to send funds.\nPlease use /login to authenticate."
      );
      return;
    }

    // Start the send email flow
    bot.sendMessage(
      chatId,
      "📧 *Send Funds to Email*\n\nPlease enter the recipient's email address:",
      { parse_mode: "Markdown" }
    );

    // Initialize state machine at email step
    sendEmailStates.set(chatId, { step: "email" });
  });

  // Transaction history command handler
  bot.onText(/\/history/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to view your transaction history.\nPlease use /login to authenticate."
      );
      return;
    }

    try {
      // Fetch transfer history
      const transferHistory = await transferService.getTransferHistory(
        session.token
      );

      // Log for debugging
      console.log(
        "Transfer history response:",
        JSON.stringify(transferHistory, null, 2)
      );

      // Format and display transfer history
      let historyMessage = "📜 *Recent Transactions*\n\n";

      if (
        !transferHistory ||
        !transferHistory.data ||
        transferHistory.data.length === 0
      ) {
        historyMessage += "No transactions found.";
      } else {
        // Display the most recent transactions
        transferHistory.data
          .slice(0, 5)
          .forEach((transfer: any, index: number) => {
            historyMessage += `*${index + 1}.* ${
              transfer.type || "Transfer"
            }\n`;
            historyMessage += `Amount: ${formatAmount(transfer.fromAmount)} ${
              transfer.fromCurrency || "USDC"
            }\n`;
            historyMessage += `Status: ${transfer.status}\n`;
            historyMessage += `Date: ${new Date(
              transfer.createdAt
            ).toLocaleDateString()}\n\n`;
          });

        historyMessage += "Use the Copperx web app for more details.";
      }

      bot.sendMessage(chatId, historyMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Transfer history fetch error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to fetch your transaction history. Please try again later."
      );
    }
  });

  // Handle the send email flow inputs
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Handle send email flow with state machine
    if (sendEmailStates.has(chatId)) {
      const state = sendEmailStates.get(chatId)!;

      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        sendEmailStates.delete(chatId);
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      // Handle each step in the state machine
      if (state.step === "email") {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          bot.sendMessage(
            chatId,
            "❌ Invalid email format. Please enter a valid email address:"
          );
          return;
        }

        // Move to amount step
        sendEmailStates.set(chatId, { step: "amount", email: text });
        bot.sendMessage(
          chatId,
          `📝 Recipient: ${text}\n\nPlease enter the amount in USDC to send:`
        );
      } else if (state.step === "amount") {
        // Validate amount is a positive number
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Invalid amount. Please enter a positive number:"
          );
          return;
        }

        // Move to confirmation step
        sendEmailStates.set(chatId, {
          step: "confirm",
          email: state.email,
          amount: text,
        });

        // Ask for confirmation
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: ${state.email}\n` +
            `Amount: ${text} USDC\n\n` +
            `Reply with "yes" to confirm or "no" to cancel.`,
          { parse_mode: "Markdown" }
        );
      } else if (state.step === "confirm") {
        // Process confirmation
        const response = text.toLowerCase();

        // Clear state regardless of response
        sendEmailStates.delete(chatId);

        if (response === "yes" || response === "confirm") {
          try {
            // Make API call to send funds
            await transferService.sendToEmail(
              session.token,
              state.email!,
              state.amount!
            );

            // Success message
            bot.sendMessage(
              chatId,
              `✅ *Transfer Initiated Successfully!*\n\n` +
                `${state.amount} USDC has been sent to ${state.email}.\n\n` +
                `Use /balance to check your updated wallet balance.`,
              { parse_mode: "Markdown" }
            );
          } catch (error) {
            console.error("Email transfer error:", error);

            // Provide user-friendly error message
            bot.sendMessage(
              chatId,
              "❌ *Transfer Failed*\n\n" +
                "The transfer could not be completed. Please check your balance " +
                "and ensure the recipient information is correct.\n\n" +
                "Use /balance to check your available funds.",
              { parse_mode: "Markdown" }
            );
          }
        } else {
          // Cancellation message
          bot.sendMessage(
            chatId,
            "🚫 Transfer cancelled. No funds have been sent."
          );
        }
      }
    }
  });
}
