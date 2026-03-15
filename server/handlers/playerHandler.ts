// ========================================
// PLAYER EVENT HANDLERS
// ========================================
import logger from '../../logger';
import { PLAYER_SPEED, PLAYER_SPEED_TOLERANCE, RATE_LIMIT_MOVE, SERVER_CONFIG } from '../config';
import {
    isValidNumber,
    isValidString,
    isValidPositiveInt,
    clampCoordinates,
    calculateDistance,
} from '../validation';
import {
    players,
    shards,
    dummies,
    rateLimit,
    cleanupRateLimiter,
    assignTeam,
    getTeamCounts,
} from '../gameState';
import type { TypedSocket, TypedServer, PlayerMoveData, CharacterId } from '../types';

export function registerPlayerHandlers(socket: TypedSocket, _io: TypedServer): void {
    // Assign team to new player
    const team = assignTeam();
    const teamCounts = getTeamCounts();
    logger.info(
        `Assigned team ${team} to player ${socket.id} (Red: ${teamCounts.red}, Blue: ${teamCounts.blue})`
    );

    // Send player their ID and team
    socket.emit('connected', {
        playerId: socket.id,
        team: team,
    });

    // Send existing players to new player
    const existingPlayers = Array.from(players.values());
    socket.emit('existingPlayers', existingPlayers);

    // Send existing shards to new player
    const activeShards = Array.from(shards.values()).filter((s) => !s.collected);
    socket.emit('existingShards', activeShards);

    // Send existing dummies to new player
    const aliveDummies = Array.from(dummies.values()).filter((d) => d.currentHP > 0);
    socket.emit('existingDummies', aliveDummies);

    // Initialize player data with team
    players.set(socket.id, {
        playerId: socket.id,
        team: team,
        x: 960, // Center of game world
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        deathTime: 0,
        isDead: false,
        characterId: 'alien', // 기본 캐릭터 (playerMove에서 업데이트됨)
    });

    // Notify others about new player (include team)
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        team: team,
        x: 960,
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        isDead: false,
        characterId: 'alien', // 기본 캐릭터
    });

    // Handle player position updates
    socket.on('playerMove', (data: PlayerMoveData) => {
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
            const moveDistance = calculateDistance(
                existingPlayer.x,
                existingPlayer.y,
                data.x,
                data.y
            );
            const currentTime = Date.now();
            const lastMoveTime = existingPlayer.lastMoveTime || currentTime;
            const timeDelta = Math.max(16, currentTime - lastMoveTime); // Minimum 16ms (60fps)
            const maxAllowedDistance = PLAYER_SPEED * PLAYER_SPEED_TOLERANCE * (timeDelta / 1000);

            if (moveDistance > maxAllowedDistance) {
                // Log potential speed hack but allow within reasonable bounds
                // (Network lag can cause position jumps)
                if (moveDistance > maxAllowedDistance * 3) {
                    logger.cheat(
                        `Speed hack detected from ${socket.id}: moved ${moveDistance.toFixed(1)}px in ${timeDelta}ms (max: ${maxAllowedDistance.toFixed(1)}px)`
                    );
                    // Use last valid position instead
                    validX = existingPlayer.x;
                    validY = existingPlayer.y;
                }
            }
        }

        // Validate and sanitize other inputs
        // NOTE: level/experience are server-authoritative (computed from shard collection)
        // Client-sent level/experience are ignored
        const playerName = isValidString(data.playerName, 30) ? data.playerName : 'Player';
        const characterId = (
            isValidString(data.characterId, 20) ? data.characterId : 'alien'
        ) as CharacterId;

        // Calculate maxHP based on character
        const characterMaxHP =
            characterId === 'big-sis-hulk'
                ? SERVER_CONFIG.HULK_STATS.MAX_HP
                : SERVER_CONFIG.PLAYER.MAX_HP;

        // Determine initial HP (use character max HP if new player or character changed)
        let initialMaxHP = characterMaxHP;
        let initialCurrentHP = characterMaxHP;
        if (existingPlayer) {
            // If character changed, reset HP
            if (existingPlayer.characterId !== characterId) {
                initialMaxHP = characterMaxHP;
                initialCurrentHP = characterMaxHP;
            } else {
                initialMaxHP = existingPlayer.maxHP;
                initialCurrentHP = existingPlayer.currentHP;
            }
        }

        // Update player data, preserving HP, death state, team, and curry-bear stored damage
        // level/experience are preserved from server state (shard-based leveling)
        players.set(socket.id, {
            playerId: socket.id,
            socketId: socket.id, // For sending events directly
            team: existingPlayer ? existingPlayer.team : 'red',
            x: validX,
            y: validY,
            playerName: playerName,
            level: existingPlayer ? existingPlayer.level : 1,
            experience: existingPlayer ? existingPlayer.experience : 0,
            characterId: characterId,
            currentHP: initialCurrentHP,
            maxHP: initialMaxHP,
            deathTime: existingPlayer ? existingPlayer.deathTime : 0,
            isDead: existingPlayer ? existingPlayer.isDead : false,
            storedDamage: existingPlayer ? existingPlayer.storedDamage || 0 : 0,
            lastMoveTime: Date.now(),
        });

        // Broadcast to other players (use validated position)
        // level/experience come from server state, not client
        const currentPlayer = players.get(socket.id);
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: validX,
            y: validY,
            playerName: playerName,
            level: currentPlayer ? currentPlayer.level : 1,
            experience: currentPlayer ? currentPlayer.experience : 0,
            characterId: characterId,
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`Player disconnected: ${socket.id}`);

        // Clear rage timer to prevent orphaned setTimeout callbacks
        const disconnectingPlayer = players.get(socket.id);
        if (disconnectingPlayer?.rageTimeout) {
            clearTimeout(disconnectingPlayer.rageTimeout);
        }

        players.delete(socket.id);
        cleanupRateLimiter(socket.id); // Clean up all rate limit entries for this socket

        // Notify others
        socket.broadcast.emit('playerLeft', {
            playerId: socket.id,
        });
    });
}
