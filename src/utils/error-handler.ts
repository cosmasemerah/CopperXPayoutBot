import TelegramBot from "node-telegram-bot-api";
import { config } from "../config";
import { ApiError } from "../types/common";
import { getModuleLogger } from "./logger";

// Create module logger
const logger = getModuleLogger("error-handler");

/**
 * Error types to categorize different errors
 */
export enum ErrorType {
  AUTH = "auth",
  VALIDATION = "validation",
  SERVER = "server",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: string;
  originalError?: any;
}

/**
 * Process API errors into standard format
 * @param error The error object
 * @returns Standardized error response
 */
export function processApiError(error: any): ErrorResponse {
  // Check if the error is a standard API error
  if (error.response && error.response.data) {
    const apiErrorData = error.response.data as ApiError;
    const status = error.response.status;

    if (status === 401 || status === 403) {
      return {
        type: ErrorType.AUTH,
        message: "Your session has expired or you are not authorized",
        details: apiErrorData.message || "Please login again to continue",
        originalError: error,
      };
    } else if (status === 400 || status === 422) {
      return {
        type: ErrorType.VALIDATION,
        message: "The information you provided is not valid",
        details: formatValidationErrors(apiErrorData),
        originalError: error,
      };
    } else if (status >= 500) {
      return {
        type: ErrorType.SERVER,
        message: "Our server encountered an issue",
        details:
          apiErrorData.message || "Please try again later or contact support",
        originalError: error,
      };
    }
  } else if (error.request) {
    return {
      type: ErrorType.NETWORK,
      message: "Connection issue detected",
      details:
        "Could not connect to the server. Please check your internet connection and try again.",
      originalError: error,
    };
  }

  // For general errors not related to API calls
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN,
      message: "An unexpected error occurred",
      details: error.message || "Please try again or contact support",
      originalError: error,
    };
  }

  return {
    type: ErrorType.UNKNOWN,
    message: "An unexpected error occurred",
    details: "We couldn't process your request. Please try again later.",
    originalError: error,
  };
}

/**
 * Format validation errors into a readable string
 * @param data The error response data
 * @returns Formatted error message
 */
function formatValidationErrors(data: ApiError): string {
  if (Array.isArray(data?.message)) {
    return data.message.map((msg: string) => `• ${msg}`).join("\n");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return "The provided information is invalid. Please check your inputs and try again.";
}

/**
 * Handle API errors and send appropriate response to user
 * @param bot The Telegram bot instance
 * @param chatId The chat ID of the user
 * @param error The error object
 * @param commandReference Optional callback data for retry button
 */
export function handleApiErrorResponse(
  bot: TelegramBot,
  chatId: number,
  error: Error | Record<string, any> | undefined,
  commandReference?: string
): void {
  const processedError = processApiError(error);

  let message = `❌ *${processedError.message}*`;
  if (processedError.details) {
    message += `\n\n${processedError.details}`;
  }

  if (processedError.type === ErrorType.AUTH) {
    message += "\n\n*Please login again* using /login to continue";
  }

  // Log the original error for debugging
  if (processedError.originalError) {
    logger.error("Original error:", processedError.originalError);
  }

  message += `\n\nNeed help? Contact support at ${config.supportLink}`;

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

  if (commandReference) {
    keyboard.push([{ text: "🔄 Try Again", callback_data: commandReference }]);
  }

  if (processedError.type === ErrorType.AUTH) {
    keyboard.push([{ text: "🔑 Login", callback_data: "action:login" }]);
  }

  keyboard.push([{ text: "« Back to Menu", callback_data: "menu:main" }]);

  bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
