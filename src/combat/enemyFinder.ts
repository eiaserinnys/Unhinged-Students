/**
 * Enemy Finder Module
 *
 * Utility functions for finding enemies:
 * - findNearestEnemy: Finds closest enemy to player
 * - findRandomEnemy: Selects random enemy from available
 */

import { gameState } from '../core/gameState.js';

type EnemyType = 'dummy' | 'player' | 'none';

interface EnemyInfo {
    x: number;
    y: number;
    type: EnemyType;
    playerId?: string;
    dummyIndex?: number;
}

/**
 * Find the nearest enemy to the player
 * @param playersOnly - If true, only target other players (not dummies)
 * @returns Enemy object with x, y, type properties or default position
 */
export function findNearestEnemy(playersOnly: boolean = false): EnemyInfo | null {
    const player = gameState.player;
    if (!player) return null;

    const playerPos = player.getPosition();
    let nearestEnemy: EnemyInfo | null = null;
    let nearestDistance = Infinity;

    // Check dummies (skip if playersOnly)
    if (!playersOnly) {
        gameState.dummies.forEach((dummy, index) => {
            if (dummy.isAlive()) {
                const dx = dummy.x - playerPos.x;
                const dy = dummy.y - playerPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = { x: dummy.x, y: dummy.y, type: 'dummy', dummyIndex: index };
                }
            }
        });
    }

    // Check remote players
    if (gameState.networkManager) {
        gameState.networkManager.remotePlayers.forEach((remotePlayer, playerId) => {
            if (!remotePlayer.isDead) {
                const dx = remotePlayer.x - playerPos.x;
                const dy = remotePlayer.y - playerPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = { x: remotePlayer.x, y: remotePlayer.y, type: 'player', playerId: playerId };
                }
            }
        });
    }

    // If no enemy found, return a point in front of the player (based on facing direction)
    if (!nearestEnemy) {
        // Default to right direction
        return { x: playerPos.x + 500, y: playerPos.y, type: 'none' };
    }

    return nearestEnemy;
}

/**
 * Find a random enemy (dummy or remote player) for teleport targeting
 * @returns Enemy object with x, y, type properties or null
 */
export function findRandomEnemy(): EnemyInfo | null {
    const enemies: EnemyInfo[] = [];

    // Collect all alive dummies
    gameState.dummies.forEach((dummy) => {
        if (dummy.isAlive()) {
            enemies.push({ x: dummy.x, y: dummy.y, type: 'dummy' });
        }
    });

    // Collect all alive remote players
    if (gameState.networkManager) {
        gameState.networkManager.remotePlayers.forEach((remotePlayer) => {
            if (!remotePlayer.isDead) {
                enemies.push({ x: remotePlayer.x, y: remotePlayer.y, type: 'player' });
            }
        });
    }

    // Return random enemy or null if none
    if (enemies.length === 0) {
        return null;
    }

    return enemies[Math.floor(Math.random() * enemies.length)];
}

// Expose to global scope
declare global {
    interface Window {
        findNearestEnemy: typeof findNearestEnemy;
        findRandomEnemy: typeof findRandomEnemy;
    }
}

window.findNearestEnemy = findNearestEnemy;
window.findRandomEnemy = findRandomEnemy;
