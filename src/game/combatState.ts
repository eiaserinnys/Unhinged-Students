/**
 * Combat State Module
 *
 * Functions for combat-related state management that are exposed to
 * the network layer via window.* registrations:
 * - updateStoredDamage (curry-bear passive)
 * - triggerCurryRecoveryEffect (curry-bear E skill visual)
 * - startRatIllusionOnMe / endRatIllusionOnMe (squeak-squeak Q on target)
 * - onRatIllusionCastSuccess (squeak-squeak Q caster feedback)
 * - onSleepPowderEffect / onSleepStart (squeak-squeak W)
 * - onRatBombEffect (squeak-squeak E)
 * - onDollHugShieldStart / Hit / End (squeak-squeak R)
 * - onRatReviveEffect (squeak-squeak T)
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

/**
 * Caster feedback: rat illusion successfully applied to a target (Q skill)
 */
export function onRatIllusionCastSuccess(targetId: string): void {
    logger.info(`Rat illusion successfully cast on ${targetId}!`);
    gameState.ratIllusionCastSuccessTime = Date.now();
}

/**
 * Sleep powder visual effect (W skill) — show sleeping particles around affected players
 */
export function onSleepPowderEffect(data: {
    casterId: string;
    casterX: number;
    casterY: number;
    affectedPlayers: Array<{ playerId: string; duration: number }>;
}): void {
    logger.debug(`Sleep powder effect: ${data.affectedPlayers.length} targets`);
    gameState.sleepPowderEffect = {
        active: true,
        casterId: data.casterId,
        casterX: data.casterX,
        casterY: data.casterY,
        affectedPlayers: data.affectedPlayers,
        startTime: Date.now(),
    };
}

/**
 * Local player fell asleep (W skill)
 */
export function onSleepStart(duration: number): void {
    logger.info(`Fell asleep for ${duration}ms`);
    gameState.sleepUntil = Date.now() + duration;
}

/**
 * Rat bomb visual effect (E skill) — explosion + rat scatter
 */
export function onRatBombEffect(data: {
    casterId: string;
    casterX: number;
    casterY: number;
    explosionDamage: number;
    rats: Array<{ x: number; y: number; damage: number }>;
    hitPlayers: Array<{ playerId: string; currentHP: number; maxHP: number }>;
}): void {
    logger.debug(`Rat bomb effect: ${data.rats.length} rats, ${data.hitPlayers.length} hit`);
    gameState.ratBombEffect = {
        active: true,
        casterId: data.casterId,
        casterX: data.casterX,
        casterY: data.casterY,
        rats: data.rats,
        startTime: Date.now(),
    };
    // Update local HP if we were hit
    const myHit = data.hitPlayers.find(p => p.playerId === gameState.playerId);
    if (myHit && gameState.player) {
        gameState.player.currentHP = myHit.currentHP;
    }
}

/**
 * Doll hug shield activated (R skill)
 */
export function onDollHugShieldStart(data: {
    playerId: string;
    shieldHP: number;
    maxShieldHP: number;
    duration: number;
}): void {
    logger.debug(`Doll hug shield start: ${data.playerId}`);
    gameState.dollHugShields = gameState.dollHugShields ?? new Map();
    gameState.dollHugShields.set(data.playerId, {
        shieldHP: data.shieldHP,
        maxShieldHP: data.maxShieldHP,
        startTime: Date.now(),
        duration: data.duration,
    });
}

/**
 * Doll hug shield absorbed damage (R skill)
 */
export function onDollHugShieldHit(data: {
    playerId: string;
    absorbed: number;
    shieldHP: number;
    maxShieldHP: number;
}): void {
    const shield = gameState.dollHugShields?.get(data.playerId);
    if (shield) {
        shield.shieldHP = data.shieldHP;
    }
    logger.debug(`Shield hit: ${data.playerId} absorbed ${data.absorbed}`);
}

/**
 * Doll hug shield ended (R skill)
 */
export function onDollHugShieldEnd(data: { playerId: string; reason: string }): void {
    gameState.dollHugShields?.delete(data.playerId);
    logger.debug(`Shield ended: ${data.playerId} (${data.reason})`);
}

/**
 * Rat revive effect (T skill)
 */
export function onRatReviveEffect(data: {
    casterId: string;
    revivedPlayers: Array<{ playerId: string; x: number; y: number; currentHP: number; maxHP: number }>;
}): void {
    logger.info(`Rat revive: ${data.revivedPlayers.length} players revived by ${data.casterId}`);
    gameState.ratReviveEffect = {
        active: true,
        casterId: data.casterId,
        revivedPlayers: data.revivedPlayers,
        startTime: Date.now(),
    };
}
