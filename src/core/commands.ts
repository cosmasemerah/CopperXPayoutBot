import TelegramBot from "node-telegram-bot-api";
import { commandRegistry } from "./command";
import { getModuleLogger } from "../utils/logger";

// Import core commands
import { StartCommand } from "../commands/start-command";
import { MenuCommand } from "../commands/menu-command";
import { HelpCommand } from "../commands/help-command";
import { NotificationCommand } from "../commands/notification-command";

// Import domain commands
import { registerAuthCommands } from "../commands/auth";
import { registerWalletCommands } from "../commands/wallet";
import { registerTransferCommands } from "../commands/transfer";

// Create module logger
const logger = getModuleLogger("commands");

/**
 * Register all bot commands
 */
export function registerAllCommands(bot: TelegramBot): void {
  logger.info("Registering all bot commands...");

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
  commandRegistry.registerCallbackHandler(
    "action:notifications",
    notificationCommand
  );

  // Register domain-specific commands
  registerAuthCommands(bot);
  registerWalletCommands(bot);
  registerTransferCommands(bot);

  // Set up Telegram bot commands list
  const commands = commandRegistry.getCommands().map((cmd) => ({
    command: cmd.name,
    description: cmd.description,
  }));

  bot
    .setMyCommands(commands)
    .then(() => logger.info("Bot commands list updated"))
    .catch((err) => logger.error("Failed to update bot commands list", err));

  // Set up global command handler
  bot.onText(/^\/([a-zA-Z0-9_]+)(@\w+)?(\s+(.*))?$/, (msg, match) => {
    if (!match) return;

    const commandName = match[1].toLowerCase();
    const command = commandRegistry.getCommand(commandName);

    if (command) {
      logger.info(
        `Executing command: /${commandName} from user ${msg.from?.id}`
      );
      command.execute(bot, msg).catch((err) => {
        logger.error(`Error executing command /${commandName}:`, err);
      });
    }
  });

  logger.info("Command registration complete from src/core/commands.ts");
}
