// ========================================
// GAME STATE MANAGEMENT
// ========================================
import logger from '../logger';
import { SERVER_CONFIG } from './config';
import { GAME_CONFIG } from '../shared/config';
import type { Player, Dummy, Shard, TypedServer, Team } from './types';

// Team configuration
const TEAM = SERVER_CONFIG.TEAM;

// Store connected players
export const players = new Map<string, Player>();

// Store temporarily disconnected players (for reconnection grace period)
export interface DisconnectedPlayerEntry {
    playerState: Player;
    disconnectedAt: number;
    cleanupTimer: ReturnType<typeof setTimeout>;
}
export const disconnectedPlayers = new Map<string, DisconnectedPlayerEntry>();

// Shard system
const MAX_SHARDS = SERVER_CONFIG.SHARD.MAX_COUNT;
export const shards = new Map<number, Shard>();
let shardIdCounter = 0;

// Dummy system (server-authoritative)
export const dummies = new Map<number, Dummy>();

// ========================================
// TEAM ASSIGNMENT SYSTEM
// ========================================

/**
 * Get the count of players in each team
 */
export function getTeamCounts(): { red: number; blue: number } {
    let redCount = 0;
    let blueCount = 0;

    players.forEach((player) => {
        if (player.team === TEAM.RED) redCount++;
        else if (player.team === TEAM.BLUE) blueCount++;
    });

    return { red: redCount, blue: blueCount };
}

/**
 * Assign a team to a new player (balances teams)
 */
export function assignTeam(): Team {
    const counts = getTeamCounts();

    // Assign to the team with fewer players
    // If equal, randomly assign
    if (counts.red < counts.blue) {
        return TEAM.RED;
    } else if (counts.blue < counts.red) {
        return TEAM.BLUE;
    } else {
        return Math.random() < 0.5 ? TEAM.RED : TEAM.BLUE;
    }
}

// ========================================
// RATE LIMITING SYSTEM
// ========================================

// Global rate limiter map: "socketId:eventType" -> lastTime
export const rateLimiter = new Map<string, number>();

/**
 * Check if an action should be rate limited
 * @param socketId - Socket ID of the client
 * @param eventType - Type of event (move, attack, chat, etc.)
 * @param limitMs - Minimum time between events in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function rateLimit(socketId: string, eventType: string, limitMs: number): boolean {
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
 */
export function cleanupRateLimiter(socketId: string): void {
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

export function initializeDummies(): void {
    const dummyConfig = SERVER_CONFIG.DUMMY;
    const dummyPositions = dummyConfig.POSITIONS.map((pos) => ({
        x: SERVER_CONFIG.WORLD.WIDTH / 2 + pos.offsetX,
        y: SERVER_CONFIG.WORLD.HEIGHT / 2 + pos.offsetY,
        name: pos.name,
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
            respawnDelay: dummyConfig.RESPAWN_DELAY_MS,
        });
    });

    logger.info(`Initialized ${dummies.size} dummies`);
}

export function initializeShards(): void {
    const shardConfig = SERVER_CONFIG.SHARD;
    const margin = shardConfig.SPAWN_MARGIN;
    for (let i = 0; i < shardConfig.INITIAL_COUNT; i++) {
        const x = margin + Math.random() * (SERVER_CONFIG.WORLD.WIDTH - margin * 2);
        const y = margin + Math.random() * (SERVER_CONFIG.WORLD.HEIGHT - margin * 2);
        const shardId = shardIdCounter++;
        shards.set(shardId, {
            id: shardId,
            x,
            y,
            collected: false,
            collectedTime: 0,
            respawnDelay: 0,
        });
    }
    logger.info(`Initialized ${shards.size} shards`);
}

// ========================================
// RESPAWN FUNCTIONS
// ========================================

export function checkDummyRespawn(io: TypedServer): void {
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
                    maxHP: dummy.maxHP,
                });
            }
        }
    });
}

export function checkPlayerRespawn(io: TypedServer): void {
    const currentTime = Date.now();

    players.forEach((player, playerId) => {
        if (player.isDead && player.deathTime > 0) {
            const elapsedTime = currentTime - player.deathTime;

            if (elapsedTime >= SERVER_CONFIG.PLAYER.RESPAWN_DELAY_MS) {
                // Respawn player
                player.currentHP = player.maxHP;
                player.x = GAME_CONFIG.PLAYER.RESPAWN_X;
                player.y = GAME_CONFIG.PLAYER.RESPAWN_Y;
                player.deathTime = 0;
                player.isDead = false;

                logger.debug(`Player ${playerId} respawned`);

                // Broadcast respawn to all clients
                io.emit('playerRespawned', {
                    playerId: playerId,
                    x: player.x,
                    y: player.y,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                });
            }
        }
    });
}

export function checkShardRespawn(io: TypedServer): void {
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
                io.emit('shardsSpawned', [
                    {
                        id: shard.id,
                        x: shard.x,
                        y: shard.y,
                        collected: false,
                        collectedTime: 0,
                        respawnDelay: 0,
                    },
                ]);
            }
        }
    });

    if (respawnedCount > 0) {
        const activeCount = Array.from(shards.values()).filter((s) => !s.collected).length;
        logger.debug(`Respawned ${respawnedCount} shard(s) (Active: ${activeCount}/${MAX_SHARDS})`);
    }
}

// Start respawn timers
export function startRespawnTimers(io: TypedServer): void {
    setInterval(() => checkShardRespawn(io), 1000); // Check every second
    setInterval(() => checkDummyRespawn(io), 1000); // Check dummy respawn every second
    setInterval(() => checkPlayerRespawn(io), 500); // Check player respawn more frequently
}
