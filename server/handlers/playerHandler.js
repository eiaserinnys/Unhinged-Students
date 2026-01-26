// ========================================
// PLAYER EVENT HANDLERS
// ========================================
const logger = require('../../logger');
const {
    PLAYER_SPEED,
    PLAYER_SPEED_TOLERANCE,
    RATE_LIMIT_MOVE,
} = require('../config');
const {
    isValidNumber,
    isValidString,
    isValidPositiveInt,
    clampCoordinates,
    calculateDistance,
} = require('../validation');
const {
    players,
    shards,
    dummies,
    rateLimit,
    cleanupRateLimiter,
} = require('../gameState');

function registerPlayerHandlers(socket, io) {
    // Send player their ID
    socket.emit('connected', {
        playerId: socket.id
    });

    // Send existing players to new player
    const existingPlayers = Array.from(players.values());
    socket.emit('existingPlayers', existingPlayers);

    // Send existing shards to new player
    const activeShards = Array.from(shards.values()).filter(s => !s.collected);
    socket.emit('existingShards', activeShards);

    // Send existing dummies to new player
    const aliveDummies = Array.from(dummies.values()).filter(d => d.currentHP > 0);
    socket.emit('existingDummies', aliveDummies);

    // Initialize player data
    players.set(socket.id, {
        playerId: socket.id,
        x: 960, // Center of game world
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        deathTime: 0,
        isDead: false
    });

    // Notify others about new player
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        x: 960,
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        isDead: false
    });

    // Handle player position updates
    socket.on('playerMove', (data) => {
        // === RATE LIMITING ===
        if (!rateLimit(socket.id, 'move', RATE_LIMIT_MOVE)) {
            return; // Too many move events, silently ignore
        }

        // === INPUT VALIDATION ===
        // Validate coordinate types
        if (!isValidNumber(data.x) || !isValidNumber(data.y)) {
            logger.cheat(`Invalid move coordinates from ${socket.id}: x=${data.x}, y=${data.y}`);
            return;
        }

        const existingPlayer = players.get(socket.id);

        // Clamp coordinates to game bounds (anti-cheat: prevent out-of-bounds positions)
        const clamped = clampCoordinates(data.x, data.y);
        let validX = clamped.x;
        let validY = clamped.y;

        // Speed hack detection (only if player exists with previous position)
        if (existingPlayer && !existingPlayer.isDead) {
            const moveDistance = calculateDistance(existingPlayer.x, existingPlayer.y, data.x, data.y);
            const currentTime = Date.now();
            const lastMoveTime = existingPlayer.lastMoveTime || currentTime;
            const timeDelta = Math.max(16, currentTime - lastMoveTime); // Minimum 16ms (60fps)
            const maxAllowedDistance = PLAYER_SPEED * PLAYER_SPEED_TOLERANCE * (timeDelta / 1000);

            if (moveDistance > maxAllowedDistance) {
                // Log potential speed hack but allow within reasonable bounds
                // (Network lag can cause position jumps)
                if (moveDistance > maxAllowedDistance * 3) {
                    logger.cheat(`Speed hack detected from ${socket.id}: moved ${moveDistance.toFixed(1)}px in ${timeDelta}ms (max: ${maxAllowedDistance.toFixed(1)}px)`);
                    // Use last valid position instead
                    validX = existingPlayer.x;
                    validY = existingPlayer.y;
                }
            }
        }

        // Validate and sanitize other inputs
        const playerName = isValidString(data.playerName, 30) ? data.playerName : 'Player';
        const level = isValidPositiveInt(data.level, 30) ? data.level : 1;
        const experience = isValidPositiveInt(data.experience, 10000) ? data.experience : 0;

        // Update player data, preserving HP and death state
        players.set(socket.id, {
            playerId: socket.id,
            x: validX,
            y: validY,
            playerName: playerName,
            level: level,
            experience: experience,
            currentHP: existingPlayer ? existingPlayer.currentHP : 100,
            maxHP: existingPlayer ? existingPlayer.maxHP : 100,
            deathTime: existingPlayer ? existingPlayer.deathTime : 0,
            isDead: existingPlayer ? existingPlayer.isDead : false,
            lastMoveTime: Date.now()
        });

        // Broadcast to other players (use validated position)
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: validX,
            y: validY,
            playerName: playerName,
            level: level,
            experience: experience
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`Player disconnected: ${socket.id}`);
        players.delete(socket.id);
        cleanupRateLimiter(socket.id); // Clean up all rate limit entries for this socket

        // Notify others
        socket.broadcast.emit('playerLeft', {
            playerId: socket.id
        });
    });
}

module.exports = { registerPlayerHandlers };
