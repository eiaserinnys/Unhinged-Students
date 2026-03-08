// Unhinged Students - Server Logger Utility
// Centralized logging system with environment-based log levels

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel | 'cheat', number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    cheat: 2, // Same level as warn
};

// Get log level from environment (default: 'info' in production, 'debug' otherwise)
const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || DEFAULT_LEVEL;
const currentLevelValue = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

/**
 * Format log message with timestamp and level prefix
 * @param level - Log level (debug, info, warn, error, cheat)
 * @param message - Log message
 * @returns Formatted message
 */
function formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

interface Logger {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    cheat: (message: string, ...args: unknown[]) => void;
    getLevel: () => string;
    isLevelEnabled: (level: LogLevel) => boolean;
}

const logger: Logger = {
    /**
     * Debug level - detailed information for debugging
     * Only shown when LOG_LEVEL=debug
     */
    debug: (message: string, ...args: unknown[]): void => {
        if (currentLevelValue <= LOG_LEVELS.debug) {
            console.log(formatMessage('debug', message), ...args);
        }
    },

    /**
     * Info level - important events and state changes
     * Shown when LOG_LEVEL=debug or LOG_LEVEL=info
     */
    info: (message: string, ...args: unknown[]): void => {
        if (currentLevelValue <= LOG_LEVELS.info) {
            console.log(formatMessage('info', message), ...args);
        }
    },

    /**
     * Warn level - warnings that don't stop execution
     * Shown when LOG_LEVEL=debug, info, or warn
     */
    warn: (message: string, ...args: unknown[]): void => {
        if (currentLevelValue <= LOG_LEVELS.warn) {
            console.warn(formatMessage('warn', message), ...args);
        }
    },

    /**
     * Error level - errors and critical issues
     * Always shown regardless of LOG_LEVEL
     */
    error: (message: string, ...args: unknown[]): void => {
        console.error(formatMessage('error', message), ...args);
    },

    /**
     * Security/Cheat detection logs - always shown as warnings
     * Use for anti-cheat related logging
     */
    cheat: (message: string, ...args: unknown[]): void => {
        console.warn(formatMessage('cheat', message), ...args);
    },

    /**
     * Get current log level
     */
    getLevel: (): string => currentLevel,

    /**
     * Check if a specific level would be logged
     */
    isLevelEnabled: (level: LogLevel): boolean => {
        const levelValue = LOG_LEVELS[level] ?? LOG_LEVELS.info;
        return currentLevelValue <= levelValue;
    },
};

export = logger;
