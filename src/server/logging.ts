/**
 * Structured JSON Logging
 *
 * Provides configurable log levels and JSON-formatted output for production use.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[currentLevel];
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function formatEntry(level: LogLevel, message: string, extra?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      process.stdout.write(formatEntry('debug', message, extra) + '\n');
    }
  },

  info(message: string, extra?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      process.stdout.write(formatEntry('info', message, extra) + '\n');
    }
  },

  warn(message: string, extra?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      process.stderr.write(formatEntry('warn', message, extra) + '\n');
    }
  },

  error(message: string, extra?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      process.stderr.write(formatEntry('error', message, extra) + '\n');
    }
  },
};

/** Initialize log level from environment. */
export function initLogging(): void {
  const envLevel = process.env['WHEATLEY_LOG_LEVEL']?.toLowerCase();
  if (envLevel && envLevel in LEVEL_VALUES) {
    setLogLevel(envLevel as LogLevel);
  }
}
