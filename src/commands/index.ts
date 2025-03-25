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
import { commandRegistry } from "../core/command";
import { getModuleLogger } from "../utils/logger";

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

  commandRegistry.registerCommand(startCommand);
  commandRegistry.registerCommand(menuCommand);
  commandRegistry.registerCommand(helpCommand);
  commandRegistry.registerCommand(notificationCommand);

  // Register core command callbacks
  commandRegistry.registerCallbackHandler("menu", menuCommand);
  commandRegistry.registerCallbackHandler("menu:main", menuCommand);
  commandRegistry.registerCallbackHandler("menu:help", helpCommand);
  commandRegistry.registerCallbackHandler(
    "action:notifications",
    notificationCommand
  );

  // Register domain commands
  registerAuthCommands(bot);
  registerWalletCommands(bot);
  registerTransferCommands(bot);

  // Register message handlers for transfer-related user inputs
  registerTransferMessageHandlers(bot);

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

  // Log all registered commands and callbacks for verification
  const registeredCommands = commandRegistry.getCommands();
  logger.info(`Registered ${registeredCommands.length} commands:`);
  registeredCommands.forEach((cmd) => {
    logger.info(`- /${cmd.name}: ${cmd.description}`);
  });

  // Log all registered callback handlers
  commandRegistry.logRegisteredHandlers();

  // Debug message to help trace execution
  logger.info(
    "All commands registered successfully. When executing from src/commands/index.ts"
  );
}
