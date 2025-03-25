import TelegramBot from "node-telegram-bot-api";
import { getModuleLogger } from "../utils/logger";

// Create module logger
const logger = getModuleLogger("command-registry");

/**
 * Bot command interface
 * Defines the structure for all bot commands
 */
export interface BotCommand {
  /**
   * Command name without the leading slash
   */
  name: string;

  /**
   * Command description for help menu
   */
  description: string;

  /**
   * Regular expression pattern to match command text
   * Will be automatically generated if not provided
   */
  pattern?: RegExp;

  /**
   * Execute the command
   * @param bot TelegramBot instance
   * @param msg Message that triggered the command
   */
  execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void>;

  /**
   * Handle callback queries related to this command
   * @param bot TelegramBot instance
   * @param query Callback query to handle
   */
  handleCallback(
    bot: TelegramBot,
    query: TelegramBot.CallbackQuery
  ): Promise<void>;
}

/**
 * Command registry to manage all bot commands
 */
export class CommandRegistry {
  private commands: Map<string, BotCommand> = new Map();
  private callbackHandlers: Map<string, BotCommand> = new Map();

  /**
   * Register a command in the registry
   * @param command The command to register
   */
  registerCommand(command: BotCommand): void {
    this.commands.set(command.name, command);

    // If no pattern is provided, create default pattern
    if (!command.pattern) {
      // Create a pattern that matches both the command name and with the bot name
      command.pattern = new RegExp(
        `^\/${command.name}(?:@\\w+)?(?:\\s+(.+))?$`,
        "i"
      );
      logger.debug(
        `Created pattern for command /${command.name}: ${command.pattern}`
      );
    }
  }

  /**
   * Register a callback prefix with a command
   * @param prefix The callback data prefix
   * @param command The command to handle callbacks
   */
  registerCallbackHandler(prefix: string, command: BotCommand): void {
    this.callbackHandlers.set(prefix, command);
  }

  /**
   * Get all registered commands
   * @returns List of registered commands
   */
  getCommands(): BotCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get a specific command by name
   * @param name Command name
   * @returns Command or undefined if not found
   */
  getCommand(name: string): BotCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Find a command handler for a callback query
   * @param callbackData The callback data
   * @returns The command that handles this callback or undefined
   */
  findCallbackHandler(callbackData: string): BotCommand | undefined {
    logger.debug(`Finding handler for callback data: ${callbackData}`);

    // First try exact match for entire callback data
    for (const [prefix, command] of this.callbackHandlers.entries()) {
      if (callbackData === prefix) {
        logger.debug(
          `Found exact match handler: ${command.name} for prefix: ${prefix}`
        );
        return command;
      }
    }

    // Then try prefix match
    // Get prefix (everything before the first colon)
    const prefix = callbackData.split(":")[0];
    if (prefix && this.callbackHandlers.has(prefix)) {
      logger.debug(
        `Found prefix match handler: ${
          this.callbackHandlers.get(prefix)?.name
        } for prefix: ${prefix}`
      );
      return this.callbackHandlers.get(prefix);
    }

    // Try matching domain:action format if there are at least 2 parts
    const parts = callbackData.split(":");
    if (parts.length >= 2) {
      const domainAction = `${parts[0]}:${parts[1]}`;
      if (this.callbackHandlers.has(domainAction)) {
        logger.debug(
          `Found domain:action match handler: ${
            this.callbackHandlers.get(domainAction)?.name
          } for: ${domainAction}`
        );
        return this.callbackHandlers.get(domainAction);
      }
    }

    // No handler found
    logger.warn(`No handler found for callback data: ${callbackData}`);
    return undefined;
  }

  /**
   * Log all registered callback handlers for debugging purposes
   */
  logRegisteredHandlers(): void {
    logger.info(
      `Registered callback handlers (${this.callbackHandlers.size}):`
    );
    for (const [prefix, command] of this.callbackHandlers.entries()) {
      logger.info(`- ${prefix} -> ${command.name}`);
    }
  }
}

/**
 * Create and configure the command registry
 * @returns Configured command registry
 */
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry();
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
