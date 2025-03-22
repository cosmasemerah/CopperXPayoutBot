/**
 * Logger utility for structured logging throughout the application
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  service?: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  service: "copperx-bot",
};

// Logger interface
export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any> | Error): void;
}

/**
 * Create a formatted log entry
 */
function formatLogEntry(
  level: string,
  message: string,
  meta?: Record<string, any> | Error,
  service?: string
): string {
  const timestamp = new Date().toISOString();
  const serviceTag = service ? `[${service}]` : "";

  let metaStr = "";
  if (meta) {
    if (meta instanceof Error) {
      metaStr = ` ${meta.message}${meta.stack ? `\n${meta.stack}` : ""}`;
    } else if (Object.keys(meta).length > 0) {
      try {
        metaStr = ` ${JSON.stringify(meta)}`;
      } catch (e) {
        metaStr = ` [Object with circular references]`;
      }
    }
  }

  return `${timestamp} [${level}]${serviceTag} ${message}${metaStr}`;
}

/**
 * Create a new logger instance
 */
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  const mergedConfig: LoggerConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return {
    debug(message: string, meta?: Record<string, any>): void {
      if (mergedConfig.level <= LogLevel.DEBUG && mergedConfig.enableConsole) {
        console.debug(
          formatLogEntry("DEBUG", message, meta, mergedConfig.service)
        );
      }
    },

    info(message: string, meta?: Record<string, any>): void {
      if (mergedConfig.level <= LogLevel.INFO && mergedConfig.enableConsole) {
        console.log(
          formatLogEntry("INFO", message, meta, mergedConfig.service)
        );
      }
    },

    warn(message: string, meta?: Record<string, any>): void {
      if (mergedConfig.level <= LogLevel.WARN && mergedConfig.enableConsole) {
        console.warn(
          formatLogEntry("WARN", message, meta, mergedConfig.service)
        );
      }
    },

    error(message: string, meta?: Record<string, any> | Error): void {
      if (mergedConfig.level <= LogLevel.ERROR && mergedConfig.enableConsole) {
        console.error(
          formatLogEntry("ERROR", message, meta, mergedConfig.service)
        );
      }
    },
  };
}

// Default logger instance
export const logger = createLogger();

// For modules that need a specialized logger
export function getModuleLogger(module: string): Logger {
  return createLogger({ service: module });
}
