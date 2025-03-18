import TelegramBot from "node-telegram-bot-api";
import { getSession, updateSessionState, getSessionState } from "../session";
import * as transferService from "../services/transfer.service";
import * as walletService from "../services/wallet.service";
import { formatAmount, formatAddress } from "../utils/format";
import { createYesNoKeyboard, createAmountKeyboard } from "../utils/keyboard";

// Define the SendEmailState interface for the multi-step process
interface SendEmailState {
  step: "email" | "amount" | "confirm";
  email?: string;
  amount?: string;
}

// Define the SendWalletState interface for the multi-step process
interface SendWalletState {
  step: "address" | "amount" | "confirm";
  address?: string;
  amount?: string;
  network?: string;
}

// Define the DepositState interface for the deposit process
interface DepositState {
  step: "amount" | "complete";
  amount?: string;
  walletId?: string;
  network?: string;
  depositAddress?: string;
}

// Define the WithdrawBankState interface for the bank withdrawal process
interface WithdrawBankState {
  step: "amount" | "confirm";
  amount?: string;
}

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
    updateSessionState(chatId, {
      currentAction: "sendemail",
      data: { step: "email" },
    });
  });

  // Send to wallet address command handler
  bot.onText(/\/sendwallet/, async (msg: TelegramBot.Message) => {
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

    // Start the send wallet flow
    bot.sendMessage(
      chatId,
      "🔑 *Send Funds to Wallet Address*\n\nPlease enter the recipient's wallet address:",
      { parse_mode: "Markdown" }
    );

    // Initialize state machine at address step
    updateSessionState(chatId, {
      currentAction: "sendwallet",
      data: { step: "address" },
    });
  });

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
      // Fetch default wallet
      const defaultWallet = await walletService.getDefaultWallet(session.token);

      if (!defaultWallet) {
        bot.sendMessage(
          chatId,
          "⚠️ You don't have a default wallet set up.\nPlease use /setdefaultwallet to set a default wallet first."
        );
        return;
      }

      // Set session state for deposit flow
      updateSessionState(chatId, {
        currentAction: "deposit",
        data: {
          step: "amount",
          walletId: defaultWallet.walletId,
          network: defaultWallet.network,
        },
      });

      // Get network name for display
      const networkNames: Record<string, string> = {
        "1": "Ethereum",
        "10": "Optimism",
        "56": "Binance Smart Chain",
        "137": "Polygon",
        "8453": "Base",
        "42161": "Arbitrum One",
        "23434": "Starknet",
      };
      const networkName =
        networkNames[defaultWallet.network] ||
        `Network ${defaultWallet.network}`;

      // Show amount options with inline keyboard
      bot.sendMessage(
        chatId,
        `💰 *Deposit to Your Wallet*\n\n` +
          `Network: ${networkName}\n` +
          `Default Wallet ID: \`${defaultWallet.walletId}\`\n\n` +
          `Please select or enter an amount in USDC to deposit:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: createAmountKeyboard("deposit"),
          },
        }
      );
    } catch (error) {
      console.error("Default wallet fetch error:", error);
      bot.sendMessage(
        chatId,
        "❌ Failed to retrieve your wallet information. Please try again later or visit the Copperx web app at https://copperx.io."
      );
    }
  });

  // Bank withdrawal command handler
  bot.onText(/\/withdrawbank/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    // Check if user is logged in
    const session = getSession(chatId);
    if (!session) {
      bot.sendMessage(
        chatId,
        "⚠️ You need to be logged in to withdraw funds.\nPlease use /login to authenticate."
      );
      return;
    }

    // Set session state for withdrawal flow
    updateSessionState(chatId, {
      currentAction: "withdrawbank",
      data: { step: "amount" },
    });

    // Show amount options with inline keyboard
    bot.sendMessage(
      chatId,
      `🏦 *Withdraw to Bank Account*\n\n` +
        `Please select or enter an amount in USDC to withdraw:\n\n` +
        `_Note: Your bank account details must be configured on the Copperx platform. ` +
        `If you haven't set up your bank account yet, please visit https://copperx.io._`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: createAmountKeyboard("withdrawbank"),
        },
      }
    );
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

  // Handle the input flows (email, wallet, deposit)
  bot.on("message", async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands and empty messages
    if (!text || text.startsWith("/")) return;

    // Get session state
    const sessionState = getSessionState(chatId);

    // Handle send email flow with session state
    if (sessionState?.currentAction === "sendemail") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      const data = sessionState.data as SendEmailState;

      // Handle each step in the state machine
      if (data.step === "email") {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          bot.sendMessage(
            chatId,
            "❌ Invalid email format. Please enter a valid email address:"
          );
          return;
        }

        // Update state with email and move to amount step
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: { step: "amount", email: text },
        });

        // Show amount options with inline keyboard
        bot.sendMessage(
          chatId,
          `📝 Recipient: ${text}\n\nPlease select or enter an amount in USDC to send:`,
          {
            reply_markup: {
              inline_keyboard: createAmountKeyboard("sendemail"),
            },
          }
        );
      } else if (data.step === "amount" && data.email) {
        // This handles custom amount input (when user types amount instead of using buttons)

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
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: {
            step: "confirm",
            email: data.email,
            amount: text,
          },
        });

        // Ask for confirmation with inline keyboard
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: ${data.email}\n` +
            `Amount: ${text} USDC\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendemail"),
            },
          }
        );
      }
    }
    // Handle send wallet flow with session state
    else if (sessionState?.currentAction === "sendwallet") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      const data = sessionState.data as SendWalletState;

      // Handle each step in the state machine
      if (data.step === "address") {
        // Basic wallet address validation (check for length and format)
        const addressRegex = /^0x[a-fA-F0-9]{40}$/; // Basic Ethereum address format
        if (!addressRegex.test(text)) {
          bot.sendMessage(
            chatId,
            "❌ Invalid wallet address format. Please enter a valid wallet address (0x followed by 40 hexadecimal characters):"
          );
          return;
        }

        try {
          // Get default wallet to determine network
          const defaultWallet = await walletService.getDefaultWallet(
            session.token
          );
          const network = defaultWallet?.network || "137"; // Default to Polygon if not found

          // Update state with address and network, then move to amount step
          updateSessionState(chatId, {
            currentAction: "sendwallet",
            data: {
              step: "amount",
              address: text,
              network: network,
            },
          });

          // Show amount options with inline keyboard
          bot.sendMessage(
            chatId,
            `📝 Recipient: \`${text}\`\n\nPlease select or enter an amount in USDC to send:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: createAmountKeyboard("sendwallet"),
              },
            }
          );
        } catch (error) {
          console.error("Default wallet fetch error:", error);
          bot.sendMessage(
            chatId,
            "❌ Failed to retrieve your default wallet information. Please try again later."
          );
          updateSessionState(chatId, {});
        }
      } else if (data.step === "amount" && data.address) {
        // This handles custom amount input (when user types amount instead of using buttons)

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
        updateSessionState(chatId, {
          currentAction: "sendwallet",
          data: {
            step: "confirm",
            address: data.address,
            amount: text,
            network: data.network,
          },
        });

        // Format network name (from available networks in wallet handler)
        const networkNames: Record<string, string> = {
          "1": "Ethereum",
          "10": "Optimism",
          "56": "Binance Smart Chain",
          "137": "Polygon",
          "8453": "Base",
          "42161": "Arbitrum One",
          "23434": "Starknet",
        };
        const networkName =
          networkNames[data.network || ""] || `Network ${data.network}`;

        // Ask for confirmation with inline keyboard
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: \`${data.address}\`\n` +
            `Amount: ${text} USDC\n` +
            `Network: ${networkName}\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendwallet"),
            },
          }
        );
      }
    }
    // Handle deposit flow with session state - for custom amount input
    else if (sessionState?.currentAction === "deposit") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      const data = sessionState.data as DepositState;

      // Only step where we expect text input is for custom amount
      if (data.step === "amount") {
        // Validate amount is a positive number
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Invalid amount. Please enter a positive number:"
          );
          return;
        }

        try {
          // Initiate deposit
          const depositResponse = await transferService.initiateDeposit(
            session.token,
            text,
            data.network!
          );

          // Update state
          updateSessionState(chatId, {
            currentAction: "deposit",
            data: {
              step: "complete",
              amount: text,
              walletId: data.walletId,
              network: data.network,
              depositAddress:
                depositResponse.walletAddress || depositResponse.depositAddress,
            },
          });

          // Format network for display
          const networkNames: Record<string, string> = {
            "1": "Ethereum",
            "10": "Optimism",
            "56": "Binance Smart Chain",
            "137": "Polygon",
            "8453": "Base",
            "42161": "Arbitrum One",
            "23434": "Starknet",
          };
          const networkName =
            networkNames[data.network!] || `Network ${data.network}`;

          // Show deposit instructions
          const depositAddress =
            depositResponse.walletAddress || depositResponse.depositAddress;

          if (depositAddress) {
            bot.sendMessage(
              chatId,
              `✅ *Deposit Setup Complete*\n\n` +
                `Amount: ${text} USDC\n` +
                `Network: ${networkName}\n` +
                `Deposit Address: \`${depositAddress}\`\n\n` +
                `Please send exactly ${text} USDC to the address above.\n` +
                `Your account will be credited once the transaction is confirmed on the blockchain.\n\n` +
                `You will receive a notification when your deposit is received.`,
              { parse_mode: "Markdown" }
            );
          } else if (depositResponse.paymentUrl) {
            bot.sendMessage(
              chatId,
              `✅ *Deposit Setup Complete*\n\n` +
                `Amount: ${text} USDC\n` +
                `Network: ${networkName}\n\n` +
                `Please use the following payment link to complete your deposit:\n` +
                `${depositResponse.paymentUrl}\n\n` +
                `Your account will be credited once the payment is complete.\n\n` +
                `You will receive a notification when your deposit is received.`,
              { parse_mode: "Markdown" }
            );
          } else {
            // Generic success if we don't have specific deposit instructions
            bot.sendMessage(
              chatId,
              `✅ *Deposit Initiated*\n\n` +
                `Amount: ${text} USDC\n` +
                `Network: ${networkName}\n\n` +
                `Please check the Copperx web app for complete deposit instructions.\n\n` +
                `You will receive a notification when your deposit is received.`,
              { parse_mode: "Markdown" }
            );
          }
        } catch (error) {
          console.error("Deposit initiation error:", error);
          updateSessionState(chatId, {}); // Clear session state
          bot.sendMessage(
            chatId,
            "❌ *Deposit Setup Failed*\n\n" +
              "We couldn't initiate your deposit at this time. Please try again later " +
              "or visit the Copperx web app to complete your deposit.\n\n" +
              "https://copperx.io",
            { parse_mode: "Markdown" }
          );
        }
      }
    }
    // Handle bank withdrawal flow with session state - for custom amount input
    else if (sessionState?.currentAction === "withdrawbank") {
      // Make sure user is still logged in
      const session = getSession(chatId);
      if (!session) {
        updateSessionState(chatId, {});
        bot.sendMessage(
          chatId,
          "⚠️ Your session has expired. Please use /login to authenticate."
        );
        return;
      }

      const data = sessionState.data as WithdrawBankState;

      // Only step where we expect text input is for custom amount
      if (data.step === "amount") {
        // Validate amount is a positive number
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(
            chatId,
            "❌ Invalid amount. Please enter a positive number:"
          );
          return;
        }

        // Update state and move to confirmation step
        updateSessionState(chatId, {
          currentAction: "withdrawbank",
          data: {
            step: "confirm",
            amount: text,
          },
        });

        // Ask for confirmation with inline keyboard
        bot.sendMessage(
          chatId,
          `⚠️ *Please Confirm Bank Withdrawal*\n\n` +
            `Amount: ${text} USDC\n\n` +
            `Funds will be sent to your pre-configured bank account on the Copperx platform.\n` +
            `Do you want to proceed with this withdrawal?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("withdrawbank"),
            },
          }
        );
      }
    }
  });

  // Handle callback queries from inline keyboards
  bot.on("callback_query", async (query) => {
    if (!query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const callbackData = query.data;

    // For debugging
    console.log(`Received callback: ${callbackData} from chat ${chatId}`);

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

    // Handle send email flow callbacks
    if (callbackData.startsWith("sendemail:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "sendemail") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as SendEmailState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `📝 Recipient: ${data.email}\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          return;
        }

        // Move to confirmation step with selected amount
        updateSessionState(chatId, {
          currentAction: "sendemail",
          data: {
            step: "confirm",
            email: data.email,
            amount: amount,
          },
        });

        // Ask for confirmation
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: ${data.email}\n` +
            `Amount: ${amount} USDC\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendemail"),
            },
          }
        );
      }
      // Handle confirmation response
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "🚫 Transfer cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          return;
        }

        // Process the transfer
        try {
          // Make API call to send funds
          await transferService.sendToEmail(
            session.token,
            data.email!,
            data.amount!
          );

          // Clear state and show success message
          updateSessionState(chatId, {});
          bot.editMessageText(
            `✅ *Transfer Initiated Successfully!*\n\n` +
              `${data.amount} USDC has been sent to ${data.email}.\n\n` +
              `Use /balance to check your updated wallet balance.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        } catch (error) {
          console.error("Email transfer error:", error);

          // Clear state and show error message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "❌ *Transfer Failed*\n\n" +
              "The transfer could not be completed. Please check your balance " +
              "and ensure the recipient information is correct.\n\n" +
              "Use /balance to check your available funds.",
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id, { text: "Operation cancelled" });
        updateSessionState(chatId, {});
        bot.deleteMessage(chatId, messageId);
      }
    }
    // Handle send wallet flow callbacks
    else if (callbackData.startsWith("sendwallet:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "sendwallet") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as SendWalletState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `📝 Recipient: \`${data.address}\`\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        // Format network name
        const networkNames: Record<string, string> = {
          "1": "Ethereum",
          "10": "Optimism",
          "56": "Binance Smart Chain",
          "137": "Polygon",
          "8453": "Base",
          "42161": "Arbitrum One",
          "23434": "Starknet",
        };
        const networkName =
          networkNames[data.network || ""] || `Network ${data.network}`;

        // Move to confirmation step with selected amount
        updateSessionState(chatId, {
          currentAction: "sendwallet",
          data: {
            step: "confirm",
            address: data.address,
            amount: amount,
            network: data.network,
          },
        });

        // Ask for confirmation
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `⚠️ *Please Confirm Transfer*\n\n` +
            `Recipient: \`${data.address}\`\n` +
            `Amount: ${amount} USDC\n` +
            `Network: ${networkName}\n\n` +
            `Do you want to proceed with this transfer?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("sendwallet"),
            },
          }
        );
      }
      // Handle confirmation response
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "🚫 Transfer cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          return;
        }

        // Process the transfer
        try {
          // Make API call to send funds to wallet
          await transferService.sendToWallet(
            session.token,
            data.address!,
            data.amount!,
            "USD",
            data.network!
          );

          // Clear state and show success message
          updateSessionState(chatId, {});
          bot.editMessageText(
            `✅ *Transfer Initiated Successfully!*\n\n` +
              `${data.amount} USDC has been sent to \`${data.address}\`.\n\n` +
              `Use /balance to check your updated wallet balance.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        } catch (error) {
          console.error("Wallet transfer error:", error);

          // Clear state and show error message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "❌ *Transfer Failed*\n\n" +
              "The transfer could not be completed. Please check your balance " +
              "and ensure the recipient address and network are correct.\n\n" +
              "Use /balance to check your available funds.",
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id, { text: "Operation cancelled" });
        updateSessionState(chatId, {});
        bot.deleteMessage(chatId, messageId);
      }
    }
    // Handle deposit flow callbacks
    else if (callbackData.startsWith("deposit:")) {
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

      const data = sessionState.data as DepositState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `💰 *Deposit to Your Wallet*\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        try {
          // Initiate deposit with selected amount
          const depositResponse = await transferService.initiateDeposit(
            session.token,
            amount,
            data.network!
          );

          // Update state
          updateSessionState(chatId, {
            currentAction: "deposit",
            data: {
              step: "complete",
              amount: amount,
              walletId: data.walletId,
              network: data.network,
              depositAddress:
                depositResponse.walletAddress || depositResponse.depositAddress,
            },
          });

          // Format network for display
          const networkNames: Record<string, string> = {
            "1": "Ethereum",
            "10": "Optimism",
            "56": "Binance Smart Chain",
            "137": "Polygon",
            "8453": "Base",
            "42161": "Arbitrum One",
            "23434": "Starknet",
          };
          const networkName =
            networkNames[data.network!] || `Network ${data.network}`;

          // Acknowledge callback
          bot.answerCallbackQuery(query.id);

          // Show deposit instructions
          const depositAddress =
            depositResponse.walletAddress || depositResponse.depositAddress;

          if (depositAddress) {
            bot.editMessageText(
              `✅ *Deposit Setup Complete*\n\n` +
                `Amount: ${amount} USDC\n` +
                `Network: ${networkName}\n` +
                `Deposit Address: \`${depositAddress}\`\n\n` +
                `Please send exactly ${amount} USDC to the address above.\n` +
                `Your account will be credited once the transaction is confirmed on the blockchain.\n\n` +
                `You will receive a notification when your deposit is received.`,
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
              }
            );
          } else if (depositResponse.paymentUrl) {
            bot.editMessageText(
              `✅ *Deposit Setup Complete*\n\n` +
                `Amount: ${amount} USDC\n` +
                `Network: ${networkName}\n\n` +
                `Please use the following payment link to complete your deposit:\n` +
                `${depositResponse.paymentUrl}\n\n` +
                `Your account will be credited once the payment is complete.\n\n` +
                `You will receive a notification when your deposit is received.`,
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
              }
            );
          } else {
            // Generic success if we don't have specific deposit instructions
            bot.editMessageText(
              `✅ *Deposit Initiated*\n\n` +
                `Amount: ${amount} USDC\n` +
                `Network: ${networkName}\n\n` +
                `Please check the Copperx web app for complete deposit instructions.\n\n` +
                `You will receive a notification when your deposit is received.`,
              {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
              }
            );
          }
        } catch (error) {
          console.error("Deposit initiation error:", error);
          updateSessionState(chatId, {}); // Clear session state
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            "❌ *Deposit Setup Failed*\n\n" +
              "We couldn't initiate your deposit at this time. Please try again later " +
              "or visit the Copperx web app to complete your deposit.\n\n" +
              "https://copperx.io",
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id, { text: "Operation cancelled" });
        updateSessionState(chatId, {});
        bot.deleteMessage(chatId, messageId);
      }
    }
    // Handle bank withdrawal flow callbacks
    else if (callbackData.startsWith("withdrawbank:")) {
      const parts = callbackData.split(":");
      const action = parts[1];
      const sessionState = getSessionState(chatId);

      if (!sessionState || sessionState.currentAction !== "withdrawbank") {
        bot.answerCallbackQuery(query.id, {
          text: "This operation is no longer active.",
          show_alert: true,
        });
        return;
      }

      const data = sessionState.data as WithdrawBankState;

      // Handle amount selection
      if (action === "amount") {
        const amount = parts[2];

        if (amount === "custom") {
          // Ask for custom amount
          bot.answerCallbackQuery(query.id);
          bot.editMessageText(
            `🏦 *Withdraw to Bank Account*\n\nPlease enter a custom amount in USDC:`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
          return;
        }

        // Update state and move to confirmation step
        updateSessionState(chatId, {
          currentAction: "withdrawbank",
          data: {
            step: "confirm",
            amount: amount,
          },
        });

        // Ask for confirmation
        bot.answerCallbackQuery(query.id);
        bot.editMessageText(
          `⚠️ *Please Confirm Bank Withdrawal*\n\n` +
            `Amount: ${amount} USDC\n\n` +
            `Funds will be sent to your pre-configured bank account on the Copperx platform.\n` +
            `Do you want to proceed with this withdrawal?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: createYesNoKeyboard("withdrawbank"),
            },
          }
        );
      }
      // Handle confirmation response
      else if (action === "yes" || action === "no") {
        bot.answerCallbackQuery(query.id);

        if (action === "no") {
          // Clear state and show cancellation message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "🚫 Withdrawal cancelled. No funds have been sent.",
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          return;
        }

        // Process the withdrawal
        try {
          // Make API call to withdraw funds to bank
          await transferService.withdrawToBank(session.token, data.amount!);

          // Clear state and show success message
          updateSessionState(chatId, {});
          bot.editMessageText(
            `✅ *Bank Withdrawal Initiated Successfully!*\n\n` +
              `${data.amount} USDC is being processed for withdrawal to your bank account.\n\n` +
              `This may take 1-3 business days to complete depending on your bank.\n` +
              `Use /history to check the status of your withdrawal.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        } catch (error) {
          console.error("Bank withdrawal error:", error);

          // Extract error message if available
          const errorResponse = (error as any)?.response?.data;
          let errorMessage = "The withdrawal could not be completed.";

          // Check for specific error types
          if (errorResponse?.message?.includes("KYC")) {
            errorMessage =
              "You need to complete KYC verification before withdrawing funds. Please visit https://copperx.io/kyc to complete your verification.";
          } else if (errorResponse?.message?.includes("minimum")) {
            errorMessage =
              "The withdrawal amount is below the minimum requirement. Please try a larger amount.";
          } else if (errorResponse?.message?.includes("bank")) {
            errorMessage =
              "You need to set up your bank account details first. Please visit https://copperx.io to configure your bank account.";
          }

          // Clear state and show error message
          updateSessionState(chatId, {});
          bot.editMessageText(
            "❌ *Withdrawal Failed*\n\n" +
              errorMessage +
              "\n\n" +
              "Use /balance to check your available funds.",
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: "Markdown",
            }
          );
        }
      }
      // Handle cancellation
      else if (action === "cancel") {
        bot.answerCallbackQuery(query.id, { text: "Operation cancelled" });
        updateSessionState(chatId, {});
        bot.deleteMessage(chatId, messageId);
      }
    }
  });
}
