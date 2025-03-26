import TelegramBot from "node-telegram-bot-api";
import { commandRegistry } from "../../core/command";
import { SessionService } from "../../core/session.service";
import { EmailTransferCommand } from "./email-transfer-command";
import { WalletTransferCommand } from "./wallet-transfer-command";
import { BankWithdrawalCommand } from "./bank-withdrawal-command";
import { BatchTransferCommand } from "./batch-transfer-command";
import { TransferMenuCommand } from "./transfer-menu-command";
import { DepositCommand } from "./deposit-command";
import { HistoryCommand } from "./history-command";
import { PayeeCommand, registerPayeeMessageHandlers } from "./payee-command";
import { getModuleLogger } from "../../utils/logger";

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
  const payeeCommand = new PayeeCommand();

  // Register commands in registry
  commandRegistry.registerCommand(transferMenuCommand);
  commandRegistry.registerCommand(emailTransferCommand);
  commandRegistry.registerCommand(walletTransferCommand);
  commandRegistry.registerCommand(bankWithdrawalCommand);
  commandRegistry.registerCommand(batchTransferCommand);
  commandRegistry.registerCommand(depositCommand);
  commandRegistry.registerCommand(historyCommand);
  commandRegistry.registerCommand(payeeCommand);

  // Register callback handlers
  commandRegistry.registerCallbackHandler("transfer:menu", transferMenuCommand);
  commandRegistry.registerCallbackHandler(
    "action:transfer",
    transferMenuCommand
  );
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

  // Register callback handlers for email payee selection
  // This handles payee email selection during email transfers
  commandRegistry.registerCallbackHandler("payee:email", emailTransferCommand);

  // Register callback handlers for transfer-related actions
  commandRegistry.registerCallbackHandler("transfer", emailTransferCommand);
  commandRegistry.registerCallbackHandler("amount", emailTransferCommand);
  commandRegistry.registerCallbackHandler("purpose", emailTransferCommand);
  commandRegistry.registerCallbackHandler("network", walletTransferCommand);

  // Add more specific handlers for transfer actions
  commandRegistry.registerCallbackHandler(
    "transfer:amount",
    emailTransferCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:purpose",
    emailTransferCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:cancel",
    emailTransferCommand
  );
  commandRegistry.registerCallbackHandler(
    "transfer:confirm",
    emailTransferCommand
  );

  // Register new command callback handlers
  commandRegistry.registerCallbackHandler("deposit", depositCommand);
  commandRegistry.registerCallbackHandler("menu:deposit", depositCommand);
  commandRegistry.registerCallbackHandler("history", historyCommand);
  commandRegistry.registerCallbackHandler("menu:history", historyCommand);

  // Register payee command callback handlers
  // These handle actions related to managing payees, not selecting them during transfers
  commandRegistry.registerCallbackHandler("payee:cancel", payeeCommand);
  commandRegistry.registerCallbackHandler("payee:yes", payeeCommand);
  commandRegistry.registerCallbackHandler("payee:no", payeeCommand);
  commandRegistry.registerCallbackHandler("payee:remove", payeeCommand);
  commandRegistry.registerCallbackHandler("payee:removecancel", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:addpayee", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:payees", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:listpayees", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:removepayee", payeeCommand);

  logger.info("Transfer commands registered successfully");
}

/**
 * Register message handlers for transfer related user inputs
 * @param bot The Telegram bot instance
 */
export function registerTransferMessageHandlers(bot: TelegramBot): void {
  logger.info("Registering transfer message handlers...");

  // Create shared command instances for use in the main bot message handler
  // These should be the same instances that were registered in registerTransferCommands
  // Don't register additional message handlers - rely on the global handler in bot.ts

  // Register payee-specific message handlers
  registerPayeeMessageHandlers(bot);

  logger.info("Transfer message handlers registered successfully");
}
