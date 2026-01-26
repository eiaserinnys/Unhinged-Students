// Unhinged Students - Server Logger Utility
// Centralized logging system with environment-based log levels

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Get log level from environment (default: 'info' in production, 'debug' otherwise)
const DEFAULT_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const currentLevel = process.env.LOG_LEVEL || DEFAULT_LEVEL;
const currentLevelValue = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

/**
 * Format log message with timestamp and level prefix
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Log message
 * @param {any[]} args - Additional arguments
 * @returns {string} Formatted message
 */
function formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

const logger = {
    /**
     * Debug level - detailed information for debugging
     * Only shown when LOG_LEVEL=debug
     */
    debug: (message, ...args) => {
        if (currentLevelValue <= LOG_LEVELS.debug) {
            console.log(formatMessage('debug', message), ...args);
        }
    },

    /**
     * Info level - important events and state changes
     * Shown when LOG_LEVEL=debug or LOG_LEVEL=info
     */
    info: (message, ...args) => {
        if (currentLevelValue <= LOG_LEVELS.info) {
            console.log(formatMessage('info', message), ...args);
        }
    },

    /**
     * Warn level - warnings that don't stop execution
     * Shown when LOG_LEVEL=debug, info, or warn
     */
    warn: (message, ...args) => {
        if (currentLevelValue <= LOG_LEVELS.warn) {
            console.warn(formatMessage('warn', message), ...args);
        }
    },

    /**
     * Error level - errors and critical issues
     * Always shown regardless of LOG_LEVEL
     */
    error: (message, ...args) => {
        console.error(formatMessage('error', message), ...args);
    },

    /**
     * Security/Cheat detection logs - always shown as warnings
     * Use for anti-cheat related logging
     */
    cheat: (message, ...args) => {
        console.warn(formatMessage('cheat', message), ...args);
    },

    /**
     * Get current log level
     */
    getLevel: () => currentLevel,

    /**
     * Check if a specific level would be logged
     */
    isLevelEnabled: (level) => {
        const levelValue = LOG_LEVELS[level] ?? LOG_LEVELS.info;
        return currentLevelValue <= levelValue;
    }
};

module.exports = logger;
