import TelegramBot from "node-telegram-bot-api";

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
      command.pattern = new RegExp(`^\/${command.name}(?:\\s+(.+))?$`);
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
    // First try exact match
    for (const [prefix, command] of this.callbackHandlers.entries()) {
      if (callbackData === prefix) {
        return command;
      }
    }

    // Then try prefix match
    const prefix = callbackData.split(":")[0];
    return this.callbackHandlers.get(prefix);
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
