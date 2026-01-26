// ========================================
// GAME STATE MANAGEMENT
// ========================================
const logger = require('../logger');
const {
    SERVER_CONFIG,
    GAME_WIDTH,
    GAME_HEIGHT,
    PLAYER_RESPAWN_DELAY,
    DUMMY_RESPAWN_DELAY,
} = require('./config');

// Store connected players
const players = new Map();

// Shard system
const MAX_SHARDS = SERVER_CONFIG.SHARD.MAX_COUNT;
const shards = new Map(); // Map of shardId -> {id, x, y, collected, collectedTime, respawnDelay}
let shardIdCounter = 0;

// Dummy system (server-authoritative)
const dummies = new Map(); // Map of dummyId -> {id, x, y, name, currentHP, maxHP, deathTime, respawnDelay}

// ========================================
// RATE LIMITING SYSTEM
// ========================================

// Global rate limiter map: "socketId:eventType" -> lastTime
const rateLimiter = new Map();

/**
 * Check if an action should be rate limited
 * @param {string} socketId - Socket ID of the client
 * @param {string} eventType - Type of event (move, attack, chat, etc.)
 * @param {number} limitMs - Minimum time between events in milliseconds
 * @returns {boolean} - true if allowed, false if rate limited
 */
function rateLimit(socketId, eventType, limitMs) {
    const key = `${socketId}:${eventType}`;
    const now = Date.now();
    const lastTime = rateLimiter.get(key) || 0;

    if (now - lastTime < limitMs) {
        return false; // Rate limited
    }

    rateLimiter.set(key, now);
    return true;
}

/**
 * Clean up rate limiter entries for a disconnected socket
 * @param {string} socketId - Socket ID to clean up
 */
function cleanupRateLimiter(socketId) {
    const prefix = `${socketId}:`;
    for (const key of rateLimiter.keys()) {
        if (key.startsWith(prefix)) {
            rateLimiter.delete(key);
        }
    }
}

// ========================================
// INITIALIZATION FUNCTIONS
// ========================================

function initializeDummies() {
    const dummyConfig = SERVER_CONFIG.DUMMY;
    const dummyPositions = dummyConfig.POSITIONS.map(pos => ({
        x: GAME_WIDTH / 2 + pos.offsetX,
        y: GAME_HEIGHT / 2 + pos.offsetY,
        name: pos.name
    }));

    dummyPositions.forEach((pos, index) => {
        dummies.set(index, {
            id: index,
            x: pos.x,
            y: pos.y,
            initialX: pos.x,
            initialY: pos.y,
            name: pos.name,
            currentHP: dummyConfig.MAX_HP,
            maxHP: dummyConfig.MAX_HP,
            deathTime: 0,
            respawnDelay: dummyConfig.RESPAWN_DELAY_MS
        });
    });

    logger.info(`Initialized ${dummies.size} dummies`);
}

function initializeShards() {
    const shardConfig = SERVER_CONFIG.SHARD;
    const margin = shardConfig.SPAWN_MARGIN;
    for (let i = 0; i < shardConfig.INITIAL_COUNT; i++) {
        const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
        const y = margin + Math.random() * (GAME_HEIGHT - margin * 2);
        const shardId = shardIdCounter++;
        shards.set(shardId, {
            id: shardId,
            x,
            y,
            collected: false,
            collectedTime: 0,
            respawnDelay: 0
        });
    }
    logger.info(`Initialized ${shards.size} shards`);
}

// ========================================
// RESPAWN FUNCTIONS
// ========================================

function checkDummyRespawn(io) {
    const currentTime = Date.now();

    dummies.forEach((dummy) => {
        if (dummy.currentHP <= 0 && dummy.deathTime > 0) {
            const elapsedTime = currentTime - dummy.deathTime;

            if (elapsedTime >= dummy.respawnDelay) {
                // Respawn dummy
                dummy.currentHP = dummy.maxHP;
                dummy.x = dummy.initialX;
                dummy.y = dummy.initialY;
                dummy.deathTime = 0;

                logger.debug(`${dummy.name} respawned`);

                // Broadcast respawn to all clients
                io.emit('dummyRespawned', {
                    dummyId: dummy.id,
                    x: dummy.x,
                    y: dummy.y,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP
                });
            }
        }
    });
}

function checkPlayerRespawn(io) {
    const currentTime = Date.now();

    players.forEach((player, playerId) => {
        if (player.isDead && player.deathTime > 0) {
            const elapsedTime = currentTime - player.deathTime;

            if (elapsedTime >= PLAYER_RESPAWN_DELAY) {
                // Respawn player
                player.currentHP = player.maxHP;
                player.x = 960; // Center of game world
                player.y = 540;
                player.deathTime = 0;
                player.isDead = false;

                logger.debug(`Player ${playerId} respawned`);

                // Broadcast respawn to all clients
                io.emit('playerRespawned', {
                    playerId: playerId,
                    x: player.x,
                    y: player.y,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP
                });
            }
        }
    });
}

function checkShardRespawn(io) {
    const currentTime = Date.now();
    let respawnedCount = 0;

    // Check each collected shard for individual respawn
    shards.forEach((shard) => {
        if (shard.collected && shard.collectedTime > 0) {
            const elapsedTime = currentTime - shard.collectedTime;

            // Check if it's time to respawn this shard
            if (elapsedTime >= shard.respawnDelay) {
                // Respawn at same location
                shard.collected = false;
                shard.collectedTime = 0;
                shard.respawnDelay = 0;
                respawnedCount++;

                // Broadcast respawned shard to all clients
                io.emit('shardsSpawned', [{ id: shard.id, x: shard.x, y: shard.y }]);
            }
        }
    });

    if (respawnedCount > 0) {
        const activeCount = Array.from(shards.values()).filter(s => !s.collected).length;
        logger.debug(`Respawned ${respawnedCount} shard(s) (Active: ${activeCount}/${MAX_SHARDS})`);
    }
}

// Start respawn timers
function startRespawnTimers(io) {
    setInterval(() => checkShardRespawn(io), 1000); // Check every second
    setInterval(() => checkDummyRespawn(io), 1000); // Check dummy respawn every second
    setInterval(() => checkPlayerRespawn(io), 500); // Check player respawn more frequently
}

module.exports = {
    players,
    shards,
    dummies,
    rateLimiter,
    rateLimit,
    cleanupRateLimiter,
    initializeDummies,
    initializeShards,
    checkDummyRespawn,
    checkPlayerRespawn,
    checkShardRespawn,
    startRespawnTimers,
};
