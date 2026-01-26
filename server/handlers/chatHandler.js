// ========================================
// CHAT EVENT HANDLERS
// ========================================
const logger = require('../../logger');
const {
    CHAT_MAX_MESSAGE_LENGTH,
    RATE_LIMIT_CHAT,
} = require('../config');
const {
    players,
    rateLimit,
} = require('../gameState');

function registerChatHandlers(socket, io) {
    // Handle chat messages (CRITICAL-2 fix: Server-side validation)
    socket.on('chatMessage', (data) => {
        // 1. Rate limiting (1 message per second) - check first to avoid unnecessary processing
        if (!rateLimit(socket.id, 'chat', RATE_LIMIT_CHAT)) {
            logger.debug(`Chat rate limit exceeded by ${socket.id}`);
            return;
        }

        // 2. Type validation
        if (!data || typeof data.message !== 'string') {
            logger.debug(`Chat invalid message type from ${socket.id}`);
            return;
        }

        // 3. Empty message filter (trim and check)
        const trimmedMessage = data.message.trim();
        if (trimmedMessage.length === 0) {
            return; // Silently ignore empty messages
        }

        // 4. Length limit (max 200 characters)
        if (trimmedMessage.length > CHAT_MAX_MESSAGE_LENGTH) {
            logger.debug(`Chat message too long from ${socket.id}: ${trimmedMessage.length} chars`);
            return;
        }

        const playerData = players.get(socket.id);
        const message = {
            playerId: socket.id,
            playerName: playerData ? playerData.playerName : 'Unknown',
            message: trimmedMessage,
            timestamp: Date.now()
        };

        logger.debug(`Chat from ${message.playerName}: ${message.message}`);

        // Broadcast to all players (including sender)
        io.emit('chatMessage', message);
    });
}

module.exports = { registerChatHandlers };
