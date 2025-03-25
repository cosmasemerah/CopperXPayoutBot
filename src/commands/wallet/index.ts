import TelegramBot from "node-telegram-bot-api";
import { commandRegistry } from "../../core/command";
import { BalanceCommand } from "./balance-command";
import { SetDefaultWalletCommand } from "./set-default-wallet-command";

/**
 * Register all wallet-related commands
 * @param bot The Telegram bot instance
 */
export function registerWalletCommands(_bot: TelegramBot): void {
  // Create command instances
  const balanceCommand = new BalanceCommand();
  const setDefaultWalletCommand = new SetDefaultWalletCommand();

  // Register commands in registry
  commandRegistry.registerCommand(balanceCommand);
  commandRegistry.registerCommand(setDefaultWalletCommand);

  // Register callback handlers
  commandRegistry.registerCallbackHandler("menu:balance", balanceCommand);
  commandRegistry.registerCallbackHandler("action:balance", balanceCommand);
  commandRegistry.registerCallbackHandler(
    "action:settings",
    setDefaultWalletCommand
  );
  commandRegistry.registerCallbackHandler("wallet", setDefaultWalletCommand);
  commandRegistry.registerCallbackHandler(
    "setdefault",
    setDefaultWalletCommand
  ); // For setdefault:* callbacks
}
