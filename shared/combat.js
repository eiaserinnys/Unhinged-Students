/**
 * @fileoverview Shared combat utility functions
 * Used by server for damage calculation and death handling
 */

/**
 * Check if a player/entity should die and handle the death
 * @param {Object} target - The target entity (player or dummy)
 * @param {string} targetId - The ID of the target
 * @param {string} attackerId - The ID of the attacker
 * @param {Array} killedList - Array to push death info to
 * @param {number} respawnDelay - Respawn delay in milliseconds
 * @returns {boolean} True if death occurred, false otherwise
 */
function checkAndHandleDeath(target, targetId, attackerId, killedList, respawnDelay) {
    // Already dead - no action needed
    if (target.isDead) {
        return false;
    }

    // Still alive - no death
    if (target.currentHP > 0) {
        return false;
    }

    // Death occurred
    target.isDead = true;
    target.deathTime = Date.now();

    killedList.push({
        playerId: targetId,
        killedBy: attackerId,
        respawnDelay: respawnDelay,
    });

    return true;
}

module.exports = {
    checkAndHandleDeath,
};
