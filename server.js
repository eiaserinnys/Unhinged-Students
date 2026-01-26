// Unhinged Students - Multiplayer Server
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const logger = require('./logger');

const app = express();
const httpServer = createServer(app);

// CORS origin configuration - Security hardening (CRITICAL-3)
function getAllowedOrigins() {
    if (process.env.NODE_ENV === 'production') {
        return [
            'https://eiaserinnys.me',
            'http://eiaserinnys.me'  // HTTP to HTTPS redirect 중 요청 허용
        ];
    }
    // Development/local environment
    return [
        'http://localhost:3000',
        'http://localhost:8000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8000'
    ];
}

const io = new Server(httpServer, {
    cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Serve static files (game client)
app.use(express.static(path.join(__dirname)));

// Store connected players
const players = new Map();

// ========================================
// SERVER CONFIGURATION
// Centralized constants for server-authoritative game logic
// (Anti-cheat: ignore client values, use these)
// ========================================
const SERVER_CONFIG = {
    // World
    WORLD: {
        WIDTH: 1920,
        HEIGHT: 1080,
    },

    // Player
    PLAYER: {
        SPEED: 300,                     // pixels per second
        SPEED_TOLERANCE: 1.5,           // Allow 50% variance for network latency
        MAX_HP: 100,
        RESPAWN_DELAY_MS: 3000,         // 3 seconds
        RESPAWN_X: 960,                 // Center of game world
        RESPAWN_Y: 540,
    },

    // Combat
    COMBAT: {
        ATTACK_POWER: 10,
        ATTACK_RANGE: 150,
        ATTACK_COOLDOWN_MS: 500,
        HIT_RADIUS: 67.5,               // Half of character size for collision
    },

    // Knockback
    KNOCKBACK: {
        MIN_DISTANCE: 30,
        MAX_DISTANCE: 100,
        MULTIPLIER_MIN: 1.25,
        MULTIPLIER_MAX: 2.5,
        BOUNDARY_MARGIN: 50,
        LASER_DISTANCE: 50,             // Fixed knockback for laser
    },

    // Skill - Laser (Q)
    SKILL_LASER: {
        DAMAGE: 44,
        MAX_LENGTH: 2000,
        COOLDOWN_MS: 10000,
    },

    // Skill - Teleport (W)
    SKILL_TELEPORT: {
        MAX_DISTANCE: 400,
        MIN_DISTANCE: 200,
        DAMAGE_RADIUS: 100,
        DAMAGE: 12,
        COOLDOWN_MS: 8000,
    },

    // Skill - Telepathy (E)
    SKILL_TELEPATHY: {
        RADIUS: 180,
        DAMAGE_PER_TICK: 2,
        MAX_HEAL_PER_TICK: 4,
        DURATION_MS: 3000,
        COOLDOWN_MS: 15000,
    },

    // Shard
    SHARD: {
        MAX_COUNT: 40,
        INITIAL_COUNT: 20,
        SPAWN_MARGIN: 100,
        COLLECT_DISTANCE: 100,
        RESPAWN_MIN_MS: 3000,
        RESPAWN_VARIANCE_MS: 2000,
    },

    // Dummy
    DUMMY: {
        MAX_HP: 30,
        RESPAWN_DELAY_MS: 5000,
        POSITIONS: [
            { offsetX: 300, offsetY: 0, name: 'Dummy 1' },
            { offsetX: -300, offsetY: 0, name: 'Dummy 2' },
            { offsetX: 0, offsetY: 300, name: 'Dummy 3' },
        ],
    },

    // Chat
    CHAT: {
        MAX_MESSAGE_LENGTH: 200,
    },

    // Rate limiting (in milliseconds)
    RATE_LIMIT: {
        MOVE_MS: 50,                    // 50ms = 초당 20회
        ATTACK_MS: 500,                 // 기본 공격 쿨다운과 동일
        CHAT_MS: 1000,                  // 초당 1회
    },
};

// Computed values
SERVER_CONFIG.PLAYER.MAX_MOVE_DISTANCE_PER_TICK =
    SERVER_CONFIG.PLAYER.SPEED * SERVER_CONFIG.PLAYER.SPEED_TOLERANCE * 0.1;

// Legacy constants for backward compatibility (used throughout the file)
const GAME_WIDTH = SERVER_CONFIG.WORLD.WIDTH;
const GAME_HEIGHT = SERVER_CONFIG.WORLD.HEIGHT;
const PLAYER_SPEED = SERVER_CONFIG.PLAYER.SPEED;
const PLAYER_SPEED_TOLERANCE = SERVER_CONFIG.PLAYER.SPEED_TOLERANCE;
const ATTACK_POWER = SERVER_CONFIG.COMBAT.ATTACK_POWER;
const ATTACK_RANGE = SERVER_CONFIG.COMBAT.ATTACK_RANGE;
const TELEPORT_MAX_DISTANCE = SERVER_CONFIG.SKILL_TELEPORT.MAX_DISTANCE;
const TELEPORT_DAMAGE_RADIUS = SERVER_CONFIG.SKILL_TELEPORT.DAMAGE_RADIUS;
const TELEPORT_DAMAGE = SERVER_CONFIG.SKILL_TELEPORT.DAMAGE;
const LASER_DAMAGE = SERVER_CONFIG.SKILL_LASER.DAMAGE;
const LASER_MAX_LENGTH = SERVER_CONFIG.SKILL_LASER.MAX_LENGTH;
const TELEPATHY_RADIUS = SERVER_CONFIG.SKILL_TELEPATHY.RADIUS;
const TELEPATHY_DAMAGE_PER_TICK = SERVER_CONFIG.SKILL_TELEPATHY.DAMAGE_PER_TICK;
const TELEPATHY_MAX_HEAL_PER_TICK = SERVER_CONFIG.SKILL_TELEPATHY.MAX_HEAL_PER_TICK;
const SHARD_COLLECT_DISTANCE = SERVER_CONFIG.SHARD.COLLECT_DISTANCE;
const CHAT_MAX_MESSAGE_LENGTH = SERVER_CONFIG.CHAT.MAX_MESSAGE_LENGTH;
const RATE_LIMIT_MOVE = SERVER_CONFIG.RATE_LIMIT.MOVE_MS;
const RATE_LIMIT_ATTACK = SERVER_CONFIG.RATE_LIMIT.ATTACK_MS;
const RATE_LIMIT_CHAT = SERVER_CONFIG.RATE_LIMIT.CHAT_MS;
const KNOCKBACK_MIN = SERVER_CONFIG.KNOCKBACK.MIN_DISTANCE;
const KNOCKBACK_MAX = SERVER_CONFIG.KNOCKBACK.MAX_DISTANCE;
const KNOCKBACK_MULTIPLIER_MIN = SERVER_CONFIG.KNOCKBACK.MULTIPLIER_MIN;
const KNOCKBACK_MULTIPLIER_MAX = SERVER_CONFIG.KNOCKBACK.MULTIPLIER_MAX;
const PLAYER_RESPAWN_DELAY = SERVER_CONFIG.PLAYER.RESPAWN_DELAY_MS;
const DUMMY_RESPAWN_DELAY = SERVER_CONFIG.DUMMY.RESPAWN_DELAY_MS;

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
// INPUT VALIDATION UTILITIES
// ========================================

// Validate that a value is a finite number
function isValidNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

// Validate coordinates are within game bounds
function isValidCoordinate(x, y, margin = 0) {
    return isValidNumber(x) && isValidNumber(y) &&
           x >= margin && x <= GAME_WIDTH - margin &&
           y >= margin && y <= GAME_HEIGHT - margin;
}

// Clamp coordinates to game bounds
function clampCoordinates(x, y, margin = 50) {
    return {
        x: Math.max(margin, Math.min(GAME_WIDTH - margin, x)),
        y: Math.max(margin, Math.min(GAME_HEIGHT - margin, y))
    };
}

// Calculate distance between two points
function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Validate string input (for player names, etc.)
function isValidString(value, maxLength = 50) {
    return typeof value === 'string' && value.length <= maxLength;
}

// Validate positive integer
function isValidPositiveInt(value, max = 1000) {
    return Number.isInteger(value) && value >= 0 && value <= max;
}

// Shard system
const MAX_SHARDS = SERVER_CONFIG.SHARD.MAX_COUNT;
const shards = new Map(); // Map of shardId -> {id, x, y, collected, collectedTime, respawnDelay}
let shardIdCounter = 0;

// Dummy system (server-authoritative)
const dummies = new Map(); // Map of dummyId -> {id, x, y, name, currentHP, maxHP, deathTime, respawnDelay}

// Calculate knockback distance based on distance from attacker (closer = more knockback)
// Applies random multiplier (1.25x ~ 2.5x) for impactful knockback
function calculateKnockbackDistance(attackRange, distance) {
    const ratio = Math.min(1, distance / attackRange);
    const baseKnockback = KNOCKBACK_MAX - ratio * (KNOCKBACK_MAX - KNOCKBACK_MIN);
    const multiplier = KNOCKBACK_MULTIPLIER_MIN + Math.random() * (KNOCKBACK_MULTIPLIER_MAX - KNOCKBACK_MULTIPLIER_MIN);
    return baseKnockback * multiplier;
}

// Line-circle collision detection for laser beam
// Returns true if the line segment intersects the circle
function lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
    // Vector from line start to circle center
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    // Check if intersection is within the line segment
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);

    // Check if either intersection point is within the segment (0 <= t <= 1)
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// Calculate knockback end position
function calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance) {
    let dirX = targetX - attackerX;
    let dirY = targetY - attackerY;
    const distance = Math.sqrt(dirX * dirX + dirY * dirY);

    // If positions are identical, use random direction
    if (distance < 0.001) {
        const randomAngle = Math.random() * Math.PI * 2;
        dirX = Math.cos(randomAngle);
        dirY = Math.sin(randomAngle);
    } else {
        // Normalize direction
        dirX /= distance;
        dirY /= distance;
    }

    // Calculate end position
    let endX = targetX + dirX * knockbackDistance;
    let endY = targetY + dirY * knockbackDistance;

    // Clamp to game bounds (with margin for character size)
    const margin = SERVER_CONFIG.KNOCKBACK.BOUNDARY_MARGIN;
    endX = Math.max(margin, Math.min(GAME_WIDTH - margin, endX));
    endY = Math.max(margin, Math.min(GAME_HEIGHT - margin, endY));

    return { x: endX, y: endY };
}

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

function checkDummyRespawn() {
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

function checkPlayerRespawn() {
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

// Initialize shards
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

// Respawn shards (individual shard respawn)
function checkShardRespawn() {
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

// Start shard, dummy, and player respawn systems
initializeShards();
initializeDummies();
setInterval(checkShardRespawn, 1000); // Check every second
setInterval(checkDummyRespawn, 1000); // Check dummy respawn every second
setInterval(checkPlayerRespawn, 500); // Check player respawn more frequently

io.on('connection', (socket) => {
    logger.info(`Player connected: ${socket.id}`);

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

    // Handle shard collection
    socket.on('collectShard', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Dead players cannot collect shards
        if (player.isDead) return;

        // === INPUT VALIDATION ===
        // Validate shardId type
        if (!isValidPositiveInt(data.shardId, 10000)) {
            logger.cheat(`Invalid shardId from ${socket.id}: ${data.shardId}`);
            return;
        }

        const shard = shards.get(data.shardId);

        if (shard && !shard.collected) {
            // Verify player is close enough to collect (anti-cheat: prevent remote collection)
            const distance = calculateDistance(player.x, player.y, shard.x, shard.y);
            if (distance > SHARD_COLLECT_DISTANCE) {
                logger.cheat(`Remote shard collection attempt from ${socket.id}: distance=${distance.toFixed(1)}px (max: ${SHARD_COLLECT_DISTANCE}px)`);
                return;
            }

            shard.collected = true;
            shard.collectedTime = Date.now();
            // Random respawn delay between 3-5 seconds (3000-5000ms)
            shard.respawnDelay = SERVER_CONFIG.SHARD.RESPAWN_MIN_MS + Math.random() * SERVER_CONFIG.SHARD.RESPAWN_VARIANCE_MS;
            logger.debug(`Player ${socket.id} collected shard ${data.shardId} (will respawn in ${Math.round(shard.respawnDelay/1000)}s)`);

            // Broadcast to all players
            io.emit('shardCollected', {
                shardId: data.shardId,
                playerId: socket.id
            });
        }
    });

    // Handle player attack
    socket.on('playerAttack', (data) => {
        // === RATE LIMITING ===
        if (!rateLimit(socket.id, 'attack', RATE_LIMIT_ATTACK)) {
            return; // Attack on cooldown, silently ignore
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot attack
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y to prevent remote attack hacks)
        const attackX = attacker.x;
        const attackY = attacker.y;

        // IGNORE client range/power values - use server constants (anti-cheat)
        const attackRange = ATTACK_RANGE;
        const attackPower = ATTACK_POWER;

        // Log if client sent suspicious values
        if (data.range && data.range > ATTACK_RANGE * 1.1) {
            logger.cheat(`Suspicious attack range from ${socket.id}: ${data.range} (server: ${ATTACK_RANGE})`);
        }
        if (data.power && data.power > ATTACK_POWER * 1.1) {
            logger.cheat(`Suspicious attack power from ${socket.id}: ${data.power} (server: ${ATTACK_POWER})`);
        }

        // Broadcast attack to all other players (for visual effect)
        socket.broadcast.emit('playerAttacked', {
            playerId: socket.id,
            x: attackX,
            y: attackY,
            range: attackRange
        });

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself
            if (player.isDead) return; // Skip dead players

            // Calculate distance from attacker position
            const dx = player.x - attackX;
            const dy = player.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range (server-authoritative range)
            if (distance <= attackRange) {
                // Apply damage (server-authoritative power)
                player.currentHP = Math.max(0, player.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, player.x, player.y, knockbackDist);

                // Update player position to knockback end (server-authoritative)
                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                logger.debug(`${socket.id} hit ${playerId} for ${attackPower} damage (HP: ${player.currentHP}/${player.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Check if player died
                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    logger.info(`${playerId} has been killed by ${socket.id}!`);
                }
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        // Broadcast deaths to all players
        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check all dummies in range
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return; // Skip dead dummies

            // Calculate distance
            const dx = dummy.x - attackX;
            const dy = dummy.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range (consider dummy size ~135px, half = 67.5)
            if (distance <= attackRange + 67.5) {
                // Apply damage
                dummy.currentHP = Math.max(0, dummy.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, dummy.x, dummy.y, knockbackDist);

                // Update dummy position to knockback end (server-authoritative)
                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                logger.debug(`${socket.id} hit ${dummy.name} for ${attackPower} damage (HP: ${dummy.currentHP}/${dummy.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Mark death time if killed
                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated!`);
                }
            }
        });

        // Broadcast dummy damage to all players
        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle teleport (sync with other players)
    socket.on('teleport', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Dead players cannot teleport
        if (player.isDead) return;

        // === INPUT VALIDATION ===
        // Validate coordinate types
        if (!isValidNumber(data.startX) || !isValidNumber(data.startY) ||
            !isValidNumber(data.endX) || !isValidNumber(data.endY)) {
            logger.cheat(`Invalid teleport coordinates from ${socket.id}`);
            return;
        }

        // Use server-side start position (prevent start position spoofing)
        const startX = player.x;
        const startY = player.y;

        // Validate end position
        let endX = data.endX;
        let endY = data.endY;

        // Check teleport distance (anti-cheat: limit max teleport distance)
        const teleportDistance = calculateDistance(startX, startY, endX, endY);
        if (teleportDistance > TELEPORT_MAX_DISTANCE * 1.2) { // Allow 20% tolerance
            logger.cheat(`Teleport distance exceeded from ${socket.id}: ${teleportDistance.toFixed(1)}px (max: ${TELEPORT_MAX_DISTANCE}px)`);
            // Clamp to max distance
            const angle = Math.atan2(endY - startY, endX - startX);
            endX = startX + Math.cos(angle) * TELEPORT_MAX_DISTANCE;
            endY = startY + Math.sin(angle) * TELEPORT_MAX_DISTANCE;
        }

        // Clamp to game bounds
        const clamped = clampCoordinates(endX, endY);
        endX = clamped.x;
        endY = clamped.y;

        // Broadcast teleport to all other players
        socket.broadcast.emit('playerTeleport', {
            playerId: socket.id,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        });

        // Update player position on server
        player.x = endX;
        player.y = endY;
    });

    // Handle teleport damage
    socket.on('teleportDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot deal damage
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y)
        const x = attacker.x;
        const y = attacker.y;

        // IGNORE client radius/damage values - use server constants (anti-cheat)
        const radius = TELEPORT_DAMAGE_RADIUS;
        const damage = TELEPORT_DAMAGE;

        // Log if client sent suspicious values
        if (data.radius && data.radius > TELEPORT_DAMAGE_RADIUS * 1.1) {
            logger.cheat(`Suspicious teleport damage radius from ${socket.id}: ${data.radius} (server: ${TELEPORT_DAMAGE_RADIUS})`);
        }
        if (data.damage && data.damage > TELEPORT_DAMAGE * 1.1) {
            logger.cheat(`Suspicious teleport damage from ${socket.id}: ${data.damage} (server: ${TELEPORT_DAMAGE})`);
        }

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                player.currentHP = Math.max(0, player.currentHP - damage);

                const knockbackDist = calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(x, y, player.x, player.y, knockbackDist);

                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x,
                    attackerY: y
                });

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                }
            }
        });

        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check dummies
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                const knockbackDist = calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(x, y, dummy.x, dummy.y, knockbackDist);

                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x,
                    attackerY: y
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle laser aiming (sync with other players)
    socket.on('laserAiming', (data) => {
        // Broadcast laser aiming to all other players
        socket.broadcast.emit('laserAiming', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            dirX: data.dirX,
            dirY: data.dirY
        });
    });

    // Handle laser attack (Q skill)
    socket.on('laserAttack', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot attack
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Validate coordinate types
        if (!isValidNumber(data.x1) || !isValidNumber(data.y1) ||
            !isValidNumber(data.x2) || !isValidNumber(data.y2)) {
            logger.cheat(`Invalid laser coordinates from ${socket.id}`);
            return;
        }

        // Use attacker's server-side position as laser start (prevent remote laser hacks)
        const x1 = attacker.x;
        const y1 = attacker.y;

        // Validate laser direction and clamp length
        let x2 = data.x2;
        let y2 = data.y2;
        const laserLength = calculateDistance(x1, y1, x2, y2);

        if (laserLength > LASER_MAX_LENGTH) {
            // Clamp to max length
            const angle = Math.atan2(y2 - y1, x2 - x1);
            x2 = x1 + Math.cos(angle) * LASER_MAX_LENGTH;
            y2 = y1 + Math.sin(angle) * LASER_MAX_LENGTH;
        }

        // IGNORE client damage value - use server constant (anti-cheat)
        const damage = LASER_DAMAGE;
        const hitRadius = 67.5; // Half of character size for collision

        // Log if client sent suspicious values
        if (data.damage && data.damage > LASER_DAMAGE * 1.1) {
            logger.cheat(`Suspicious laser damage from ${socket.id}: ${data.damage} (server: ${LASER_DAMAGE})`);
        }

        logger.debug(`Laser attack from ${socket.id}: (${x1.toFixed(0)}, ${y1.toFixed(0)}) -> (${x2.toFixed(0)}, ${y2.toFixed(0)})`);

        // Broadcast laser effect to all other players (use validated coordinates)
        socket.broadcast.emit('laserFired', {
            playerId: socket.id,
            x1, y1, x2, y2
        });

        // Check all players in laser path
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself
            if (player.isDead) return; // Skip dead players

            // Check line-circle collision
            if (lineCircleIntersect(x1, y1, x2, y2, player.x, player.y, hitRadius)) {
                // Apply damage (server-authoritative)
                player.currentHP = Math.max(0, player.currentHP - damage);

                // Calculate knockback direction from laser origin
                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(x1, y1, player.x, player.y, knockbackDist);

                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x1,
                    attackerY: y1
                });

                logger.debug(`Laser hit ${playerId} for ${damage} damage (HP: ${player.currentHP}/${player.maxHP})`);

                // Check if player died
                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    logger.info(`${playerId} has been killed by laser from ${socket.id}!`);
                }
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        // Broadcast deaths
        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check all dummies in laser path
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return; // Skip dead dummies

            // Check line-circle collision
            if (lineCircleIntersect(x1, y1, x2, y2, dummy.x, dummy.y, hitRadius)) {
                // Apply damage
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                // Calculate knockback
                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(x1, y1, dummy.x, dummy.y, knockbackDist);

                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x1,
                    attackerY: y1
                });

                logger.debug(`Laser hit ${dummy.name} for ${damage} damage (HP: ${dummy.currentHP}/${dummy.maxHP})`);

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated by laser!`);
                }
            }
        });

        // Broadcast dummy damage
        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle telepathy (sync with other players)
    socket.on('telepathy', (data) => {
        // Broadcast telepathy effect to all other players
        socket.broadcast.emit('playerTelepathy', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            radius: data.radius
        });
    });

    // Handle telepathy damage
    socket.on('telepathyDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot deal damage
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y)
        const x = attacker.x;
        const y = attacker.y;

        // IGNORE client values - use server constants (anti-cheat)
        const radius = TELEPATHY_RADIUS;
        const damagePerTarget = TELEPATHY_DAMAGE_PER_TICK;
        const maxHeal = TELEPATHY_MAX_HEAL_PER_TICK;

        // Log if client sent suspicious values
        if (data.radius && data.radius > TELEPATHY_RADIUS * 1.1) {
            logger.cheat(`Suspicious telepathy radius from ${socket.id}: ${data.radius} (server: ${TELEPATHY_RADIUS})`);
        }
        if (data.damagePerTarget && data.damagePerTarget > TELEPATHY_DAMAGE_PER_TICK * 1.1) {
            logger.cheat(`Suspicious telepathy damage from ${socket.id}: ${data.damagePerTarget} (server: ${TELEPATHY_DAMAGE_PER_TICK})`);
        }

        let totalDamageDealt = 0;

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                player.currentHP = Math.max(0, player.currentHP - damagePerTarget);
                totalDamageDealt += damagePerTarget;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x, // No knockback for telepathy
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y
                });

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                }
            }
        });

        // Check dummies
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damagePerTarget);
                totalDamageDealt += damagePerTarget;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: dummy.x,
                    knockbackEndY: dummy.y,
                    attackerX: x,
                    attackerY: y
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        // Broadcast telepathy tick damage (no knockback, no vignette)
        if (hitPlayers.length > 0) {
            io.emit('telepathyTick', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        if (hitDummies.length > 0) {
            io.emit('telepathyTickDummy', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }

        // Calculate heal amount and send to attacker
        const healAmount = Math.min(totalDamageDealt, maxHeal);
        if (healAmount > 0) {
            // Update attacker HP on server
            attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healAmount);

            // Send heal event to attacker
            io.to(socket.id).emit('telepathyHeal', {
                playerId: socket.id,
                healAmount: healAmount,
                newHP: attacker.currentHP
            });
        }
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
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Game client available at http://localhost:${PORT}/index.html`);
    logger.info(`Log level: ${logger.getLevel()}`);
});
