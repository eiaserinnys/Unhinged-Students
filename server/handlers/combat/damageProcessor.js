/**
 * @fileoverview Common damage processing utilities for combat handlers
 * Reduces code duplication across different attack types
 */
const logger = require('../../../logger');
const {
    calculateDistance,
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
} = require('../../validation');
const { checkAndHandleDeath } = require('../../../shared/combat');
const { players, dummies } = require('../../gameState');

/**
 * Process area damage to all players within range
 * @param {Object} options - Damage options
 * @param {string} options.attackerId - The attacking player's socket ID
 * @param {number} options.x - Center X coordinate of the damage area
 * @param {number} options.y - Center Y coordinate of the damage area
 * @param {number} options.radius - Damage radius
 * @param {number} options.damage - Damage amount
 * @param {number} options.respawnDelay - Respawn delay in milliseconds
 * @param {boolean} [options.applyKnockback=true] - Whether to apply knockback
 * @param {number} [options.knockbackDistance] - Override knockback distance
 * @returns {Object} { hitPlayers: Array, killedPlayers: Array }
 */
function processAreaDamageToPlayers({
    attackerId,
    x,
    y,
    radius,
    damage,
    respawnDelay,
    applyKnockback = true,
    knockbackDistance,
}) {
    const hitPlayers = [];
    const killedPlayers = [];

    players.forEach((player, playerId) => {
        if (playerId === attackerId) return;
        if (player.isDead) return;

        const distance = calculateDistance(x, y, player.x, player.y);

        if (distance <= radius) {
            player.currentHP = Math.max(0, player.currentHP - damage);

            let knockbackEndX = player.x;
            let knockbackEndY = player.y;

            if (applyKnockback) {
                const knockbackDist =
                    knockbackDistance ?? calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(
                    x,
                    y,
                    player.x,
                    player.y,
                    knockbackDist
                );
                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;
                knockbackEndX = knockbackEnd.x;
                knockbackEndY = knockbackEnd.y;
            }

            hitPlayers.push({
                playerId,
                currentHP: player.currentHP,
                maxHP: player.maxHP,
                knockbackEndX,
                knockbackEndY,
                attackerX: x,
                attackerY: y,
            });

            checkAndHandleDeath(player, playerId, attackerId, killedPlayers, respawnDelay);
        }
    });

    return { hitPlayers, killedPlayers };
}

/**
 * Process area damage to all dummies within range
 * @param {Object} options - Damage options
 * @param {string} options.attackerId - The attacking player's socket ID (for logging)
 * @param {number} options.x - Center X coordinate of the damage area
 * @param {number} options.y - Center Y coordinate of the damage area
 * @param {number} options.radius - Damage radius
 * @param {number} options.damage - Damage amount
 * @param {boolean} [options.applyKnockback=true] - Whether to apply knockback
 * @param {number} [options.knockbackDistance] - Override knockback distance
 * @param {number} [options.dummyRadiusBonus=67.5] - Additional radius for dummy hitbox
 * @returns {Object} { hitDummies: Array }
 */
function processAreaDamageToDummies({
    attackerId,
    x,
    y,
    radius,
    damage,
    applyKnockback = true,
    knockbackDistance,
    dummyRadiusBonus = 67.5,
}) {
    const hitDummies = [];

    dummies.forEach((dummy) => {
        if (dummy.currentHP <= 0) return;

        const distance = calculateDistance(x, y, dummy.x, dummy.y);

        if (distance <= radius + dummyRadiusBonus) {
            dummy.currentHP = Math.max(0, dummy.currentHP - damage);

            let knockbackEndX = dummy.x;
            let knockbackEndY = dummy.y;

            if (applyKnockback) {
                const knockbackDist =
                    knockbackDistance ?? calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(
                    x,
                    y,
                    dummy.x,
                    dummy.y,
                    knockbackDist
                );
                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;
                knockbackEndX = knockbackEnd.x;
                knockbackEndY = knockbackEnd.y;
            }

            hitDummies.push({
                dummyId: dummy.id,
                currentHP: dummy.currentHP,
                maxHP: dummy.maxHP,
                knockbackEndX,
                knockbackEndY,
                attackerX: x,
                attackerY: y,
            });

            if (dummy.currentHP <= 0) {
                dummy.deathTime = Date.now();
            }
        }
    });

    return { hitDummies };
}

/**
 * Broadcast damage and death events to all clients
 * @param {Object} io - Socket.io server instance
 * @param {string} attackerId - The attacking player's socket ID
 * @param {Array} hitPlayers - Array of hit player info
 * @param {Array} killedPlayers - Array of killed player info
 * @param {Array} hitDummies - Array of hit dummy info
 * @param {Object} options - Optional broadcast settings
 * @param {string} [options.playerDamageEvent='playerDamaged'] - Event name for player damage
 * @param {string} [options.dummyDamageEvent='dummyDamaged'] - Event name for dummy damage
 */
function broadcastDamageEvents(
    io,
    attackerId,
    hitPlayers,
    killedPlayers,
    hitDummies,
    options = {}
) {
    const { playerDamageEvent = 'playerDamaged', dummyDamageEvent = 'dummyDamaged' } = options;

    if (hitPlayers.length > 0) {
        io.emit(playerDamageEvent, {
            attackerId,
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
        io.emit(dummyDamageEvent, {
            attackerId,
            hitDummies,
        });
    }
}

module.exports = {
    processAreaDamageToPlayers,
    processAreaDamageToDummies,
    broadcastDamageEvents,
};
