/**
 * Combat State Module
 *
 * Functions for combat-related state management that are exposed to
 * the network layer via window.* registrations:
 * - updateStoredDamage (curry-bear passive)
 * - triggerCurryRecoveryEffect (curry-bear E skill visual)
 * - startRatIllusionOnMe / endRatIllusionOnMe (squeak-squeak Q on target)
 */

import { logger } from '../utils/logger.js';
import { gameState } from '../core/gameState.js';
import type { RatState, RatIllusionOnMeData } from './types.js';
import { getRatIllusionEffect, setRatIllusionEffect } from './skillExecutor.js';

/**
 * Update stored damage for curry-bear (called from network.js)
 */
export function updateStoredDamage(storedDamage: number, maxStored: number): void {
    gameState.storedDamage = storedDamage;
    gameState.maxStoredDamage = maxStored;
}

/**
 * Trigger curry recovery visual effect (called from network.js)
 */
export function triggerCurryRecoveryEffect(_healAmount: number): void {
    gameState.curryRecoveryActive = true;
    gameState.curryRecoveryStartTime = Date.now();
    gameState.storedDamage = 0;
}

/**
 * Start rat illusion effect on the local player (when targeted by squeak-squeak)
 */
export function startRatIllusionOnMe(data: RatIllusionOnMeData): void {
    logger.info(`Rat illusion started on me! Caster: ${data.casterId}`);

    if (!gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const rats: RatState[] = [];

    for (let i = 0; i < data.ratCount; i++) {
        const angle = (i / data.ratCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = data.radius * (0.5 + Math.random() * 0.5);
        const x = playerPos.x + Math.cos(angle) * distance;
        const y = playerPos.y + Math.sin(angle) * distance;

        const targetAngle = Math.random() * Math.PI * 2;
        const targetDistance = data.radius * (0.3 + Math.random() * 0.7);

        rats.push({
            x,
            y,
            targetX: playerPos.x + Math.cos(targetAngle) * targetDistance,
            targetY: playerPos.y + Math.sin(targetAngle) * targetDistance,
            isReal: false,
            angle: Math.random() * Math.PI * 2,
            wigglePhase: Math.random() * Math.PI * 2,
        });
    }

    setRatIllusionEffect({
        active: true,
        x: playerPos.x,
        y: playerPos.y,
        startTime: Date.now(),
        duration: data.duration,
        radius: data.radius,
        rats,
    });
}

/**
 * End rat illusion effect on the local player
 */
export function endRatIllusionOnMe(reason: string): void {
    logger.info(`Rat illusion ended: ${reason}`);
    const effect = getRatIllusionEffect();
    if (effect) {
        effect.active = false;
        effect.rats = [];
    }
}
