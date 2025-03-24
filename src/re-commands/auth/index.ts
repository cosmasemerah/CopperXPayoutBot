import TelegramBot from "node-telegram-bot-api";
import { commandRegistry } from "../../re-core/command";
import { LoginCommand, registerLoginMessageHandlers } from "./login-command";
import { LogoutCommand } from "./logout-command";
import { ProfileCommand } from "./profile-command";
import { KYCCommand } from "./kyc-command";

/**
 * Register all authentication-related commands
 * @param bot The Telegram bot instance
 */
export function registerAuthCommands(bot: TelegramBot): void {
  // Create command instances
  const loginCommand = new LoginCommand();
  const logoutCommand = new LogoutCommand();
  const profileCommand = new ProfileCommand();
  const kycCommand = new KYCCommand();

  // Register commands in registry
  commandRegistry.registerCommand(loginCommand);
  commandRegistry.registerCommand(logoutCommand);
  commandRegistry.registerCommand(profileCommand);
  commandRegistry.registerCommand(kycCommand);

  // Register callback handlers
  commandRegistry.registerCallbackHandler("action", loginCommand);
  commandRegistry.registerCallbackHandler("login", loginCommand);
  commandRegistry.registerCallbackHandler("menu", profileCommand);
  commandRegistry.registerCallbackHandler("menu", kycCommand);

  // Register message handlers for multi-step flows
  registerLoginMessageHandlers(bot);
}
