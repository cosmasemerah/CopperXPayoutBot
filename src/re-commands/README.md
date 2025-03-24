# Refactored Commands for Copperx Telegram Bot

This directory contains the refactored command implementations for the Copperx Telegram Bot. Each command follows a consistent pattern and leverages the modular type system defined in `src/re-types/`.

## Directory Structure

- `/re-commands/auth/`: Authentication related commands
- `/re-commands/wallet/`: Wallet related commands
- `/re-commands/transfer/`: Transfer related commands
- `/re-commands/notification/`: Notification related commands

## Type Safety Guidelines

When implementing or modifying commands, please follow these type safety guidelines:

1. **Import Types from re-types Directory**:

   ```typescript
   // Import from the domain-specific type modules
   import { User, AuthResponse } from "../../re-types/auth";
   import { ApiError } from "../../re-types/common";
   ```

2. **Explicitly Type API Responses**:

   ```typescript
   // Add type annotation to API responses
   const profile: User = await authService.getUserProfile(session.token);
   ```

3. **Use Explicit Error Typing**:

   ```typescript
   try {
     // API call
   } catch (error: any) {
     // Eventually replace 'any' with a more specific type
     logger.error(`Error details:`, error);
   }
   ```

4. **Type Command Parameters and Return Values**:
   ```typescript
   async execute(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
     // Implementation
   }
   ```

## Incremental Migration

As we transition to the new type system, follow these steps when updating commands:

1. Create appropriate types in the `re-types` directory if they don't exist
2. Update import statements to use the new types
3. Add explicit type annotations to variables and function parameters
4. Remove any usage of the `any` type where possible

For session management, we're temporarily continuing to use the original `UserSession` from `types.ts` to avoid conflicts. This will be addressed in a future update.
