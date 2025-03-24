import TelegramBot from "node-telegram-bot-api";
import { registerAuthCommands } from "./auth";
import { registerWalletCommands } from "./wallet";
import {
  registerTransferCommands,
  registerTransferMessageHandlers,
} from "./transfer";
import { StartCommand } from "./start-command";
import { MenuCommand } from "./menu-command";
import { HelpCommand } from "./help-command";
import { NotificationCommand } from "./notification-command";
import { PayeeCommand, registerPayeeMessageHandlers } from "./payee-command";
import { commandRegistry } from "../re-core/command";
import { getModuleLogger } from "../re-utils/logger";

// Create module logger
const logger = getModuleLogger("commands-index");

/**
 * Register all commands from all domains
 */
export function registerAllCommands(bot: TelegramBot): void {
  logger.info("Registering all commands...");

  // Register core commands
  const startCommand = new StartCommand();
  const menuCommand = new MenuCommand();
  const helpCommand = new HelpCommand();
  const notificationCommand = new NotificationCommand();
  const payeeCommand = new PayeeCommand();

  commandRegistry.registerCommand(startCommand);
  commandRegistry.registerCommand(menuCommand);
  commandRegistry.registerCommand(helpCommand);
  commandRegistry.registerCommand(notificationCommand);
  commandRegistry.registerCommand(payeeCommand);

  // Register core command callbacks
  commandRegistry.registerCallbackHandler("menu", menuCommand);
  commandRegistry.registerCallbackHandler("menu:help", helpCommand);
  commandRegistry.registerCallbackHandler("action", notificationCommand);
  commandRegistry.registerCallbackHandler("payee", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:addpayee", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:payees", payeeCommand);
  commandRegistry.registerCallbackHandler("menu:listpayees", payeeCommand);

  // Register domain commands
  registerAuthCommands(bot);
  registerWalletCommands(bot);
  registerTransferCommands(bot);

  // Register message handlers for transfer-related user inputs
  registerTransferMessageHandlers(bot);

  // Register message handlers for payee-related user inputs
  registerPayeeMessageHandlers(bot);

  // Set up bot command list
  const commands = commandRegistry.getCommands().map((cmd) => ({
    command: cmd.name,
    description: cmd.description,
  }));

  bot
    .setMyCommands(commands)
    .then(() =>
      logger.info(
        "Bot command list updated with " + commands.length + " commands"
      )
    )
    .catch((err) => logger.error("Failed to update bot command list", err));

  logger.info("All commands registered successfully");
}
