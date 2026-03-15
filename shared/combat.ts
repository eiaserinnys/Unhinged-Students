/**
 * @fileoverview Shared combat utility functions
 * Used by server for damage calculation and death handling
 */

import type { KilledPlayerInfo } from './types';

interface DeathTarget {
    currentHP: number;
    isDead: boolean;
    deathTime: number;
}

/**
 * Check if a player/entity should die and handle the death
 * @param target - The target entity (player or dummy)
 * @param targetId - The ID of the target
 * @param attackerId - The ID of the attacker
 * @param killedList - Array to push death info to
 * @param respawnDelay - Respawn delay in milliseconds
 * @returns True if death occurred, false otherwise
 */
export function checkAndHandleDeath(
    target: DeathTarget,
    targetId: string,
    attackerId: string,
    killedList: KilledPlayerInfo[],
    respawnDelay: number
): boolean {
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
