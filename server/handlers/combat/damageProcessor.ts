/**
 * @fileoverview Common damage processing utilities for combat handlers
 * Reduces code duplication across different attack types
 */
import logger from '../../../logger';
import { SERVER_CONFIG } from '../../config';
import { GAME_CONFIG } from '../../../shared/config';
import {
    calculateDistance,
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
} from '../../validation';
import { checkAndHandleDeath } from '../../../shared/combat';
import { players, dummies } from '../../gameState';
import { recordKill } from '../../matchManager';
import type {
    TypedServer,
    Player,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
    AreaDamageOptions,
    AreaDamageResult,
    DummyDamageResult,
    BroadcastOptions,
} from '../../types';

/**
 * Helper function to apply damage with character-specific passive effects
 * - Curry-bear: stores portion of damage taken for recovery skill
 * - Hulk-sister: gains rage stacks when taking damage
 */
export function applyDamageWithPassives(
    player: Player,
    damage: number,
    io: TypedServer
): { currentHP: number; storedDamageChanged: boolean } {
    const actualDamage = Math.min(damage, player.currentHP);
    player.currentHP = Math.max(0, player.currentHP - damage);

    let storedDamageChanged = false;

    // Curry-bear passive: store half the damage taken
    if (player.characterId === 'curry-bear' && actualDamage > 0) {
        const storageAmount = Math.floor(actualDamage * SERVER_CONFIG.SKILL_CURRY_RECOVERY.STORE_RATIO);
        player.storedDamage = player.storedDamage || 0;
        player.storedDamage = Math.min(
            player.storedDamage + storageAmount,
            SERVER_CONFIG.SKILL_CURRY_RECOVERY.MAX_STORED_DAMAGE
        );
        storedDamageChanged = true;
        logger.debug(
            `Curry-bear stored ${storageAmount} damage (total: ${player.storedDamage}/${SERVER_CONFIG.SKILL_CURRY_RECOVERY.MAX_STORED_DAMAGE})`
        );

        // Notify the curry-bear player of their stored damage
        if (player.socketId) {
            io.to(player.socketId).emit('storedDamageUpdate', {
                storedDamage: player.storedDamage,
                maxStored: SERVER_CONFIG.SKILL_CURRY_RECOVERY.MAX_STORED_DAMAGE,
            });
        }
    }

    // Hulk-sister passive: gain rage stacks when taking damage
    if (player.characterId === 'big-sis-hulk' && actualDamage > 0) {
        player.rageStacks = player.rageStacks || 0;
        const maxStacks = SERVER_CONFIG.HULK_PASSIVE.MAX_STACKS;
        if (player.rageStacks < maxStacks) {
            player.rageStacks = Math.min(player.rageStacks + 1, maxStacks);
            logger.debug(`Hulk-sister rage stack +1 (total: ${player.rageStacks}/${maxStacks})`);

            // Notify the hulk-sister player of their rage stacks
            if (player.socketId) {
                io.to(player.socketId).emit('rageStacksUpdate', {
                    playerId: player.playerId,
                    stacks: player.rageStacks,
                });
            }
        }
    }

    return { currentHP: player.currentHP, storedDamageChanged };
}

/**
 * Process area damage to all players within range
 */
export function processAreaDamageToPlayers(options: AreaDamageOptions): AreaDamageResult {
    const {
        attackerId,
        x,
        y,
        radius,
        damage,
        respawnDelay,
        applyKnockback = true,
        knockbackDistance,
        applyPassives = false,
        io,
    } = options;

    const hitPlayers: HitPlayerInfo[] = [];
    const killedPlayers: KilledPlayerInfo[] = [];

    players.forEach((player, playerId) => {
        if (playerId === attackerId) return;
        if (player.isDead) return;

        // 쥐 환상 무적 상태 체크
        if (player.ratIllusionUntil && player.ratIllusionUntil > Date.now()) {
            return; // 무적 상태면 데미지 스킵
        }

        const distance = calculateDistance(x, y, player.x, player.y);

        if (distance <= radius) {
            if (applyPassives && io) {
                applyDamageWithPassives(player, damage, io);
            } else {
                player.currentHP = Math.max(0, player.currentHP - damage);
            }

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
 */
export function processAreaDamageToDummies(
    options: Omit<AreaDamageOptions, 'respawnDelay'>
): DummyDamageResult {
    const {
        x,
        y,
        radius,
        damage,
        applyKnockback = true,
        knockbackDistance,
        dummyRadiusBonus = GAME_CONFIG.COMBAT.DUMMY_RADIUS_BONUS,
    } = options;

    const hitDummies: HitDummyInfo[] = [];

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
 */
export function broadcastDamageEvents(
    io: TypedServer,
    attackerId: string,
    hitPlayers: HitPlayerInfo[],
    killedPlayers: KilledPlayerInfo[],
    hitDummies: HitDummyInfo[],
    options: BroadcastOptions = {}
): void {
    const { playerDamageEvent = 'playerDamaged', dummyDamageEvent = 'dummyDamaged' } = options;

    if (hitPlayers.length > 0) {
        // Type assertion needed due to dynamic event name
        (io.emit as (event: string, data: unknown) => void)(playerDamageEvent, {
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

            // Track kill for match scoring
            const killer = players.get(killed.killedBy);
            if (killer) {
                recordKill(killer.team, io);
            }
        });
    }

    if (hitDummies.length > 0) {
        // Type assertion needed due to dynamic event name
        (io.emit as (event: string, data: unknown) => void)(dummyDamageEvent, {
            attackerId,
            hitDummies,
        });
    }
}
