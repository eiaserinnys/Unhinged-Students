// Unhinged Students - Client Logger Utility
// Centralized logging system with environment-based log levels

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

/**
 * Get log level from URL parameter or localStorage
 * Priority: URL param > localStorage > default
 * Default: 'warn' (only warn/error in production)
 */
function getLogLevel() {
    // Check URL parameter first (?logLevel=debug)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLevel = urlParams.get('logLevel');
    if (urlLevel && LOG_LEVELS[urlLevel] !== undefined) {
        return urlLevel;
    }

    // Check localStorage
    const storedLevel = localStorage.getItem('LOG_LEVEL');
    if (storedLevel && LOG_LEVELS[storedLevel] !== undefined) {
        return storedLevel;
    }

    // Default: 'warn' for production (suppress debug/info logs)
    return 'warn';
}

const _logLevel = getLogLevel();
const _logLevelValue = LOG_LEVELS[_logLevel] ?? LOG_LEVELS.warn;

/**
 * Format log message with timestamp and level prefix
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Log message
 * @returns {string} Formatted message
 */
function _formatLogMessage(level, message) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

// Global logger object
const logger = {
    /**
     * Debug level - detailed information for debugging
     * Only shown when LOG_LEVEL=debug
     */
    debug: (message, ...args) => {
        if (_logLevelValue <= LOG_LEVELS.debug) {
            console.log(_formatLogMessage('debug', message), ...args);
        }
    },

    /**
     * Info level - important events and state changes
     * Shown when LOG_LEVEL=debug or LOG_LEVEL=info
     */
    info: (message, ...args) => {
        if (_logLevelValue <= LOG_LEVELS.info) {
            console.log(_formatLogMessage('info', message), ...args);
        }
    },

    /**
     * Warn level - warnings that don't stop execution
     * Shown when LOG_LEVEL=debug, info, or warn
     */
    warn: (message, ...args) => {
        if (_logLevelValue <= LOG_LEVELS.warn) {
            console.warn(_formatLogMessage('warn', message), ...args);
        }
    },

    /**
     * Error level - errors and critical issues
     * Always shown regardless of LOG_LEVEL
     */
    error: (message, ...args) => {
        console.error(_formatLogMessage('error', message), ...args);
    },

    /**
     * Get current log level
     */
    getLevel: () => _logLevel,

    /**
     * Set log level (persists to localStorage)
     * @param {string} level - Log level to set
     */
    setLevel: (level) => {
        if (LOG_LEVELS[level] !== undefined) {
            localStorage.setItem('LOG_LEVEL', level);
            console.log(`Log level set to: ${level}. Reload page to apply.`);
        }
    },

    /**
     * Check if a specific level would be logged
     */
    isLevelEnabled: (level) => {
        const levelValue = LOG_LEVELS[level] ?? LOG_LEVELS.warn;
        return _logLevelValue <= levelValue;
    }
};
