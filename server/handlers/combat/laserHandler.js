/**
 * @fileoverview Laser skill handler (Q skill)
 */
const logger = require('../../../logger');
const {
    SERVER_CONFIG,
    LASER_DAMAGE,
    LASER_MAX_LENGTH,
    PLAYER_RESPAWN_DELAY,
} = require('../../config');
const {
    isValidNumber,
    calculateDistance,
    calculateKnockbackEndPosition,
    lineCircleIntersect,
} = require('../../validation');
const { checkAndHandleDeath } = require('../../../shared/combat');
const { players, dummies } = require('../../gameState');

/**
 * Process laser damage using line-circle collision
 * @param {Object} options - Laser damage options
 * @returns {Object} { hitPlayers, killedPlayers, hitDummies }
 */
function processLaserDamage({ attackerId, x1, y1, x2, y2, damage, respawnDelay }) {
    const hitRadius = 67.5; // Half of character size for collision
    const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;

    const hitPlayers = [];
    const killedPlayers = [];

    players.forEach((player, playerId) => {
        if (playerId === attackerId) return;
        if (player.isDead) return;

        if (lineCircleIntersect(x1, y1, x2, y2, player.x, player.y, hitRadius)) {
            player.currentHP = Math.max(0, player.currentHP - damage);

            const knockbackEnd = calculateKnockbackEndPosition(
                x1,
                y1,
                player.x,
                player.y,
                knockbackDist
            );
            player.x = knockbackEnd.x;
            player.y = knockbackEnd.y;

            hitPlayers.push({
                playerId,
                currentHP: player.currentHP,
                maxHP: player.maxHP,
                knockbackEndX: knockbackEnd.x,
                knockbackEndY: knockbackEnd.y,
                attackerX: x1,
                attackerY: y1,
            });

            logger.debug(
                `Laser hit ${playerId} for ${damage} damage (HP: ${player.currentHP}/${player.maxHP})`
            );

            if (checkAndHandleDeath(player, playerId, attackerId, killedPlayers, respawnDelay)) {
                logger.info(`${playerId} has been killed by laser from ${attackerId}!`);
            }
        }
    });

    const hitDummies = [];

    dummies.forEach((dummy) => {
        if (dummy.currentHP <= 0) return;

        if (lineCircleIntersect(x1, y1, x2, y2, dummy.x, dummy.y, hitRadius)) {
            dummy.currentHP = Math.max(0, dummy.currentHP - damage);

            const knockbackEnd = calculateKnockbackEndPosition(
                x1,
                y1,
                dummy.x,
                dummy.y,
                knockbackDist
            );
            dummy.x = knockbackEnd.x;
            dummy.y = knockbackEnd.y;

            hitDummies.push({
                dummyId: dummy.id,
                currentHP: dummy.currentHP,
                maxHP: dummy.maxHP,
                knockbackEndX: knockbackEnd.x,
                knockbackEndY: knockbackEnd.y,
                attackerX: x1,
                attackerY: y1,
            });

            logger.debug(
                `Laser hit ${dummy.name} for ${damage} damage (HP: ${dummy.currentHP}/${dummy.maxHP})`
            );

            if (dummy.currentHP <= 0) {
                dummy.deathTime = Date.now();
                logger.debug(`${dummy.name} has been defeated by laser!`);
            }
        }
    });

    return { hitPlayers, killedPlayers, hitDummies };
}

/**
 * Register laser event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function registerLaserHandlers(socket, io) {
    // Handle laser aiming (sync with other players)
    socket.on('laserAiming', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Validate direction vector is provided and is numeric
        if (!isValidNumber(data.dirX) || !isValidNumber(data.dirY)) {
            logger.cheat(`Invalid laser direction from ${socket.id}: non-numeric values`);
            return;
        }

        // Validate direction vector is normalized (length should be ~1)
        const length = Math.sqrt(data.dirX * data.dirX + data.dirY * data.dirY);
        if (length < 0.9 || length > 1.1) {
            logger.cheat(
                `Invalid laser direction from ${socket.id}: length=${length.toFixed(3)} (expected ~1.0)`
            );
            return;
        }

        // Use server-side player position (anti-cheat)
        socket.broadcast.emit('laserAiming', {
            playerId: socket.id,
            x: player.x,
            y: player.y,
            dirX: data.dirX,
            dirY: data.dirY,
        });
    });

    // Handle laser attack
    socket.on('laserAttack', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Validate coordinate types
        if (
            !isValidNumber(data.x1) ||
            !isValidNumber(data.y1) ||
            !isValidNumber(data.x2) ||
            !isValidNumber(data.y2)
        ) {
            logger.cheat(`Invalid laser coordinates from ${socket.id}`);
            return;
        }

        // Use attacker's server-side position as laser start
        const x1 = attacker.x;
        const y1 = attacker.y;

        // Validate laser direction and clamp length
        let x2 = data.x2;
        let y2 = data.y2;
        const laserLength = calculateDistance(x1, y1, x2, y2);

        if (laserLength > LASER_MAX_LENGTH) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            x2 = x1 + Math.cos(angle) * LASER_MAX_LENGTH;
            y2 = y1 + Math.sin(angle) * LASER_MAX_LENGTH;
        }

        // Log suspicious damage values
        if (data.damage && data.damage > LASER_DAMAGE * 1.1) {
            logger.cheat(
                `Suspicious laser damage from ${socket.id}: ${data.damage} (server: ${LASER_DAMAGE})`
            );
        }

        logger.debug(
            `Laser attack from ${socket.id}: (${x1.toFixed(0)}, ${y1.toFixed(0)}) -> (${x2.toFixed(0)}, ${y2.toFixed(0)})`
        );

        // Broadcast laser effect
        socket.broadcast.emit('laserFired', {
            playerId: socket.id,
            x1,
            y1,
            x2,
            y2,
        });

        // Process laser damage
        const { hitPlayers, killedPlayers, hitDummies } = processLaserDamage({
            attackerId: socket.id,
            x1,
            y1,
            x2,
            y2,
            damage: LASER_DAMAGE,
            respawnDelay: PLAYER_RESPAWN_DELAY,
        });

        // Broadcast damage
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers,
            });
        }

        if (killedPlayers.length > 0) {
            killedPlayers.forEach((killed) => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay,
                });
            });
        }

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies,
            });
        }
    });
}

module.exports = { registerLaserHandlers };
