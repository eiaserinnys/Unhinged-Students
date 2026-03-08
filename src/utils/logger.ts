// Unhinged Students - Client Logger Utility
// Centralized logging system with environment-based log levels

import type { LogLevel, Logger } from '../types/index.js';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Get log level from URL parameter or localStorage
 * Priority: URL param > localStorage > default
 * Default: 'warn' (only warn/error in production)
 */
function getLogLevel(): LogLevel {
    // Check URL parameter first (?logLevel=debug)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLevel = urlParams.get('logLevel');
    if (urlLevel && isValidLogLevel(urlLevel)) {
        return urlLevel;
    }

    // Check localStorage
    const storedLevel = localStorage.getItem('LOG_LEVEL');
    if (storedLevel && isValidLogLevel(storedLevel)) {
        return storedLevel;
    }

    // Default: 'warn' for production (suppress debug/info logs)
    return 'warn';
}

function isValidLogLevel(level: string): level is LogLevel {
    return level in LOG_LEVELS;
}

const _logLevel: LogLevel = getLogLevel();
const _logLevelValue: number = LOG_LEVELS[_logLevel] ?? LOG_LEVELS.warn;

/**
 * Format log message with timestamp and level prefix
 * @param level - Log level (debug, info, warn, error)
 * @param message - Log message
 * @returns Formatted message
 */
function _formatLogMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

// Global logger object
export const logger: Logger = {
    /**
     * Debug level - detailed information for debugging
     * Only shown when LOG_LEVEL=debug
     */
    debug: (message: string, ...args: unknown[]): void => {
        if (_logLevelValue <= LOG_LEVELS.debug) {
            console.log(_formatLogMessage('debug', message), ...args);
        }
    },

    /**
     * Info level - important events and state changes
     * Shown when LOG_LEVEL=debug or LOG_LEVEL=info
     */
    info: (message: string, ...args: unknown[]): void => {
        if (_logLevelValue <= LOG_LEVELS.info) {
            console.log(_formatLogMessage('info', message), ...args);
        }
    },

    /**
     * Warn level - warnings that don't stop execution
     * Shown when LOG_LEVEL=debug, info, or warn
     */
    warn: (message: string, ...args: unknown[]): void => {
        if (_logLevelValue <= LOG_LEVELS.warn) {
            console.warn(_formatLogMessage('warn', message), ...args);
        }
    },

    /**
     * Error level - errors and critical issues
     * Always shown regardless of LOG_LEVEL
     */
    error: (message: string, ...args: unknown[]): void => {
        console.error(_formatLogMessage('error', message), ...args);
    },

    /**
     * Get current log level
     */
    getLevel: (): LogLevel => _logLevel,

    /**
     * Set log level (persists to localStorage)
     * @param level - Log level to set
     */
    setLevel: (level: LogLevel): void => {
        if (isValidLogLevel(level)) {
            localStorage.setItem('LOG_LEVEL', level);
            console.log(`Log level set to: ${level}. Reload page to apply.`);
        }
    },

    /**
     * Check if a specific level would be logged
     */
    isLevelEnabled: (level: LogLevel): boolean => {
        const levelValue = LOG_LEVELS[level] ?? LOG_LEVELS.warn;
        return _logLevelValue <= levelValue;
    },
};

// Default export for convenience
export default logger;

// Backward compatibility: expose to window for legacy code
window.logger = logger;
