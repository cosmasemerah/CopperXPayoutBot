import TelegramBot from "node-telegram-bot-api";
import { commandRegistry } from "../../re-core/command";
import { getSession } from "../../session";
import { EmailTransferCommand } from "./email-transfer-command";
import { WalletTransferCommand } from "./wallet-transfer-command";
import { BankWithdrawalCommand } from "./bank-withdrawal-command";
import { BatchTransferCommand } from "./batch-transfer-command";
import { TransferMenuCommand } from "./transfer-menu-command";
import { DepositCommand } from "./deposit-command";
import { HistoryCommand } from "./history-command";
import { getModuleLogger } from "../../re-utils/logger";

// Create module logger
const logger = getModuleLogger("transfer-commands");

/**
 * Register all transfer-related commands
 * @param bot The Telegram bot instance
 */
export function registerTransferCommands(_bot: TelegramBot): void {
  logger.info("Registering transfer commands...");

  // Create command instances
  const transferMenuCommand = new TransferMenuCommand();
  const emailTransferCommand = new EmailTransferCommand();
  const walletTransferCommand = new WalletTransferCommand();
  const bankWithdrawalCommand = new BankWithdrawalCommand();
  const batchTransferCommand = new BatchTransferCommand();
  const depositCommand = new DepositCommand();
  const historyCommand = new HistoryCommand();

  // Register commands in registry
  commandRegistry.registerCommand(transferMenuCommand);
  commandRegistry.registerCommand(depositCommand);
  commandRegistry.registerCommand(historyCommand);

  // Register callback handlers
  commandRegistry.registerCallbackHandler("wallet", transferMenuCommand);
  commandRegistry.registerCallbackHandler(
    "transfer:method:email",
    emailTransferCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:method:wallet",
    walletTransferCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:method:bank",
    bankWithdrawalCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:method:batch",
    batchTransferCommand
  );

  // Register new command callback handlers
  commandRegistry.registerCallbackHandler("deposit", depositCommand);
  commandRegistry.registerCallbackHandler("menu:deposit", depositCommand);
  commandRegistry.registerCallbackHandler("history", historyCommand);
  commandRegistry.registerCallbackHandler("menu:history", historyCommand);

  logger.info("Transfer commands registered successfully");
}

/**
 * Register message handlers for transfer related user inputs
 * @param bot The Telegram bot instance
 */
export function registerTransferMessageHandlers(bot: TelegramBot): void {
  logger.info("Registering transfer message handlers...");

  // Create command instances
  const emailTransferCommand = new EmailTransferCommand();
  const walletTransferCommand = new WalletTransferCommand();
  const bankWithdrawalCommand = new BankWithdrawalCommand();
  const batchTransferCommand = new BatchTransferCommand();
  const depositCommand = new DepositCommand();

  // Register message handler
  bot.on("message", async (msg) => {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const session = getSession(chatId);

    if (!session || !session.state || !session.state.currentAction) return;

    // Route message based on current action
    switch (session.state.currentAction) {
      case "sendemail":
        await emailTransferCommand.handleUserInput(bot, msg);
        break;

      case "sendwallet":
        await walletTransferCommand.handleUserInput(bot, msg);
        break;

      case "withdrawbank":
        await bankWithdrawalCommand.handleUserInput(bot, msg);
        break;

      case "sendbatch":
        await batchTransferCommand.handleUserInput(bot, msg);
        break;

      case "deposit":
        // Handle only if deposit command has user input handling
        if ("handleUserInput" in depositCommand) {
          await depositCommand.handleUserInput(bot, msg);
        }
        break;
    }
  });

  logger.info("Transfer message handlers registered successfully");
}
