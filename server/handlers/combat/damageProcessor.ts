/**
 * @fileoverview Common damage processing utilities for combat handlers
 * Reduces code duplication across different attack types
 */
import {
    calculateDistance,
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
} from '../../validation';
import { checkAndHandleDeath } from '../../../shared/combat';
import { players, dummies } from '../../gameState';
import type {
    TypedServer,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
    AreaDamageOptions,
    AreaDamageResult,
    DummyDamageResult,
    BroadcastOptions,
} from '../../types';

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
    } = options;

    const hitPlayers: HitPlayerInfo[] = [];
    const killedPlayers: KilledPlayerInfo[] = [];

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
        dummyRadiusBonus = 67.5,
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
