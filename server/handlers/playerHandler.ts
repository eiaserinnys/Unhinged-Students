// ========================================
// PLAYER EVENT HANDLERS
// ========================================
import logger from '../../logger';
import { SERVER_CONFIG } from '../config';
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
    disconnectedPlayers,
    rateLimit,
    cleanupRateLimiter,
    assignTeam,
    getTeamCounts,
} from '../gameState';
import type { TypedSocket, TypedServer, PlayerMoveData, CharacterId, IdentifyData } from '../types';
import { GAME_CONFIG } from '../../shared/config';

export function registerPlayerHandlers(socket: TypedSocket, io: TypedServer): void {
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
        x: GAME_CONFIG.PLAYER.RESPAWN_X,
        y: GAME_CONFIG.PLAYER.RESPAWN_Y,
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
        x: GAME_CONFIG.PLAYER.RESPAWN_X,
        y: GAME_CONFIG.PLAYER.RESPAWN_Y,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        isDead: false,
        characterId: 'alien', // 기본 캐릭터
    });

    // Guard: identify is processed at most once per socket
    let identified = false;

    // Handle identify event (for reconnection support)
    socket.on('identify', (data: IdentifyData) => {
        if (identified) return;

        if (!isValidString(data.playerId, 50) || data.playerId.length === 0) {
            logger.cheat(`Invalid persistentId from ${socket.id}`);
            return;
        }

        identified = true;

        const savedState = disconnectedPlayers.get(data.playerId);
        if (savedState) {
            // Reconnecting player — restore state
            clearTimeout(savedState.cleanupTimer);
            disconnectedPlayers.delete(data.playerId);

            const elapsed = Date.now() - savedState.disconnectedAt;
            const restored = savedState.playerState;

            // Time-based state cleanup: expire effects that would have ended during disconnect
            if (restored.rageActive && elapsed > GAME_CONFIG.SKILL_RAGE.DURATION_MS) {
                restored.rageActive = false;
                restored.rageStartTime = undefined;
            }
            if (restored.madnessStartTime && elapsed > GAME_CONFIG.SKILL_MADNESS.DURATION_MS) {
                restored.madnessStartTime = undefined;
            }
            restored.confusedUntil = undefined;
            restored.ratIllusionUntil = undefined;
            restored.telepathyLastTickTime = undefined;
            restored.madnessLastTickTime = undefined;
            // Clear rage timeout (was already cleared on disconnect)
            restored.rageTimeout = undefined;

            // Update to new socket ID
            const restoredPlayer = {
                ...restored,
                playerId: socket.id,
                socketId: socket.id,
                persistentId: data.playerId,
            };

            // Remove the placeholder player that was created on connection
            players.delete(socket.id);
            players.set(socket.id, restoredPlayer);

            logger.info(`Player ${socket.id} reconnected (persistentId: ${data.playerId}, elapsed: ${elapsed}ms)`);

            // Notify the reconnecting client with their restored state
            socket.emit('reconnected', {
                playerId: socket.id,
                team: restoredPlayer.team,
                x: restoredPlayer.x,
                y: restoredPlayer.y,
                currentHP: restoredPlayer.currentHP,
                maxHP: restoredPlayer.maxHP,
                level: restoredPlayer.level,
                experience: restoredPlayer.experience,
                characterId: restoredPlayer.characterId,
                playerName: restoredPlayer.playerName,
                shardCollectCount: restoredPlayer.shardCollectCount || 0,
                storedDamage: restoredPlayer.storedDamage || 0,
                rageStacks: restoredPlayer.rageStacks || 0,
            });

            // Notify others that this player reconnected
            socket.broadcast.emit('playerReconnected', {
                playerId: socket.id,
                team: restoredPlayer.team,
                x: restoredPlayer.x,
                y: restoredPlayer.y,
                playerName: restoredPlayer.playerName,
                level: restoredPlayer.level,
                experience: restoredPlayer.experience,
                currentHP: restoredPlayer.currentHP,
                maxHP: restoredPlayer.maxHP,
                isDead: restoredPlayer.isDead,
                characterId: restoredPlayer.characterId,
            });
            return;
        }

        // New player — just record persistentId on existing player entry
        const player = players.get(socket.id);
        if (player) {
            player.persistentId = data.playerId;
            // Update name/character if provided
            if (isValidString(data.playerName, 30)) {
                player.playerName = data.playerName;
            }
            if (isValidString(data.characterId, 20)) {
                player.characterId = data.characterId as CharacterId;
            }
        }
    });

    // Handle player position updates
    socket.on('playerMove', (data: PlayerMoveData) => {
        // === RATE LIMITING ===
        if (!rateLimit(socket.id, 'move', SERVER_CONFIG.RATE_LIMIT.MOVE_MS)) {
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
            const maxAllowedDistance = SERVER_CONFIG.PLAYER.SPEED * SERVER_CONFIG.PLAYER.SPEED_TOLERANCE * (timeDelta / 1000);

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

        // Update player data, preserving HP, death state, team, and all character-specific state
        // level/experience are preserved from server state (shard-based leveling)
        players.set(socket.id, {
            playerId: socket.id,
            persistentId: existingPlayer?.persistentId,
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
            // Preserve character-specific state across playerMove updates
            shardCollectCount: existingPlayer?.shardCollectCount,
            rageActive: existingPlayer?.rageActive,
            rageStartTime: existingPlayer?.rageStartTime,
            rageStacks: existingPlayer?.rageStacks,
            rageTimeout: existingPlayer?.rageTimeout,
            confusedUntil: existingPlayer?.confusedUntil,
            ratIllusionUntil: existingPlayer?.ratIllusionUntil,
            telepathyLastTickTime: existingPlayer?.telepathyLastTickTime,
            madnessLastTickTime: existingPlayer?.madnessLastTickTime,
            madnessStartTime: existingPlayer?.madnessStartTime,
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

        const player = players.get(socket.id);

        // Clear rage timer to prevent orphaned setTimeout callbacks
        if (player?.rageTimeout) {
            clearTimeout(player.rageTimeout);
            player.rageTimeout = undefined;
        }

        // If player has a persistentId, save state for reconnection grace period
        if (player?.persistentId) {
            cleanupRateLimiter(socket.id);

            // Capture the socket.id at disconnect time for the grace period callback
            const disconnectedSocketId = socket.id;

            const cleanupTimer = setTimeout(() => {
                disconnectedPlayers.delete(player.persistentId!);
                logger.info(`Grace period expired for persistentId: ${player.persistentId}`);
                // Notify others that the player is permanently gone
                io.emit('playerLeft', { playerId: disconnectedSocketId });
            }, SERVER_CONFIG.RECONNECT_GRACE_PERIOD_MS);

            disconnectedPlayers.set(player.persistentId, {
                playerState: { ...player, rageTimeout: undefined },
                disconnectedAt: Date.now(),
                cleanupTimer,
            });

            players.delete(socket.id);

            // Notify others that this player is temporarily disconnected
            socket.broadcast.emit('playerTemporarilyDisconnected', {
                playerId: socket.id,
            });
            return;
        }

        // No persistentId — immediate cleanup (legacy behavior)
        players.delete(socket.id);
        cleanupRateLimiter(socket.id);

        // Notify others
        socket.broadcast.emit('playerLeft', {
            playerId: socket.id,
        });
    });
}
