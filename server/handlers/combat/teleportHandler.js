/**
 * @fileoverview Teleport skill handler (E skill)
 */
const logger = require('../../../logger');
const {
    TELEPORT_MAX_DISTANCE,
    TELEPORT_DAMAGE_RADIUS,
    TELEPORT_DAMAGE,
    PLAYER_RESPAWN_DELAY,
} = require('../../config');
const {
    isValidNumber,
    clampCoordinates,
    calculateDistance,
} = require('../../validation');
const { players } = require('../../gameState');
const {
    processAreaDamageToPlayers,
    processAreaDamageToDummies,
    broadcastDamageEvents,
} = require('./damageProcessor');

/**
 * Register teleport event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function registerTeleportHandlers(socket, io) {
    // Handle teleport movement (sync with other players)
    socket.on('teleport', (data) => {
        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        // Validate coordinate types
        if (!isValidNumber(data.startX) || !isValidNumber(data.startY) ||
            !isValidNumber(data.endX) || !isValidNumber(data.endY)) {
            logger.cheat(`Invalid teleport coordinates from ${socket.id}`);
            return;
        }

        // Use server-side start position (prevent start position spoofing)
        const startX = player.x;
        const startY = player.y;

        let endX = data.endX;
        let endY = data.endY;

        // Check teleport distance (anti-cheat)
        const teleportDistance = calculateDistance(startX, startY, endX, endY);
        if (teleportDistance > TELEPORT_MAX_DISTANCE * 1.2) {
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
            startX,
            startY,
            endX,
            endY,
        });

        // Update player position on server
        player.x = endX;
        player.y = endY;
    });

    // Handle teleport damage
    socket.on('teleportDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Use server-side position
        const x = attacker.x;
        const y = attacker.y;

        // Log suspicious values
        if (data.radius && data.radius > TELEPORT_DAMAGE_RADIUS * 1.1) {
            logger.cheat(`Suspicious teleport damage radius from ${socket.id}: ${data.radius} (server: ${TELEPORT_DAMAGE_RADIUS})`);
        }
        if (data.damage && data.damage > TELEPORT_DAMAGE * 1.1) {
            logger.cheat(`Suspicious teleport damage from ${socket.id}: ${data.damage} (server: ${TELEPORT_DAMAGE})`);
        }

        // Process damage using shared processor
        const { hitPlayers, killedPlayers } = processAreaDamageToPlayers({
            attackerId: socket.id,
            x,
            y,
            radius: TELEPORT_DAMAGE_RADIUS,
            damage: TELEPORT_DAMAGE,
            respawnDelay: PLAYER_RESPAWN_DELAY,
        });

        const { hitDummies } = processAreaDamageToDummies({
            attackerId: socket.id,
            x,
            y,
            radius: TELEPORT_DAMAGE_RADIUS,
            damage: TELEPORT_DAMAGE,
        });

        // Broadcast damage events
        broadcastDamageEvents(io, socket.id, hitPlayers, killedPlayers, hitDummies);
    });
}

module.exports = { registerTeleportHandlers };
