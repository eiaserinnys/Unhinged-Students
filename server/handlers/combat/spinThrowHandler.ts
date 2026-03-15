/**
 * @fileoverview Spin throw handler (Hulk Sister Q skill)
 */
import logger from '../../../logger';
import { SERVER_CONFIG, RATE_LIMIT_SPIN_THROW, PLAYER_RESPAWN_DELAY } from '../../config';
import { clampCoordinates } from '../../validation';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import { checkAndHandleDeath } from '../../../shared/combat';
import type {
    TypedSocket,
    TypedServer,
    Player,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

export function registerSpinThrowHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('spinThrow', (data) => {
        if (!rateLimit(socket.id, 'spinThrow', RATE_LIMIT_SPIN_THROW)) {
            return;
        }

        logger.info(`SpinThrow request: targetId=${data.targetId}, targetType=${data.targetType}`);

        const attacker = players.get(socket.id);
        if (!attacker) {
            logger.warn(`SpinThrow: attacker not found for ${socket.id}`);
            return;
        }
        if (attacker.isDead) {
            logger.warn(`SpinThrow: attacker ${socket.id} is dead`);
            return;
        }

        // Only hulk sister can use this skill
        if (attacker.characterId !== 'big-sis-hulk') {
            logger.cheat(`Non hulk-sister ${socket.id} tried to use spin throw`);
            return;
        }

        const targetType = data.targetType || 'player';
        const targetId = data.targetId;
        let target: { x: number; y: number; currentHP: number; maxHP: number; isDead?: boolean };
        let targetX: number;
        let targetY: number;

        // Get target based on type (use SERVER-SIDE position only for anti-cheat)
        if (targetType === 'dummy') {
            const dummyIndex = targetId as number;
            const dummy = dummies.get(dummyIndex);
            if (!dummy || dummy.currentHP <= 0) {
                logger.warn(
                    `SpinThrow: dummy ${dummyIndex} not found or dead (HP=${dummy?.currentHP})`
                );
                return;
            }
            target = dummy;
            targetX = dummy.x;
            targetY = dummy.y;
        } else {
            const player = players.get(targetId as string);
            if (!player || player.isDead) {
                logger.warn(`SpinThrow: player target ${targetId} not found or dead`);
                return;
            }
            target = player;
            targetX = player.x;
            targetY = player.y;
        }

        // Validate target is in range using SERVER-SIDE positions only
        const dx = targetX - attacker.x;
        const dy = targetY - attacker.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const grabRangeTolerance = SERVER_CONFIG.SKILL_SPIN_THROW.GRAB_RANGE * 2.0;
        if (distance > grabRangeTolerance) {
            logger.cheat(
                `Spin throw target too far: dist=${distance.toFixed(0)}px (max: ${grabRangeTolerance.toFixed(0)}px), ` +
                    `attacker=(${attacker.x.toFixed(0)},${attacker.y.toFixed(0)}), ` +
                    `target=(${targetX.toFixed(0)},${targetY.toFixed(0)})`
            );
            return;
        }

        // Calculate throw direction (from attacker to target)
        const dirLength = Math.sqrt(dx * dx + dy * dy);
        const dirX = dirLength > 0 ? dx / dirLength : 1;
        const dirY = dirLength > 0 ? dy / dirLength : 0;

        // Calculate throw damage (with rage multiplier if active)
        let throwDamage = SERVER_CONFIG.SKILL_SPIN_THROW.DAMAGE;
        let throwDistance = SERVER_CONFIG.SKILL_SPIN_THROW.THROW_DISTANCE;

        if (attacker.rageActive) {
            throwDamage *= SERVER_CONFIG.SKILL_RAGE.DAMAGE_MULTIPLIER;
            throwDistance *= SERVER_CONFIG.SKILL_RAGE.THROW_MULTIPLIER;
        }

        // Apply rage stacks bonus
        const rageStacks = attacker.rageStacks || 0;
        throwDamage *= 1 + rageStacks * SERVER_CONFIG.HULK_PASSIVE.DAMAGE_PER_STACK;
        throwDistance *= 1 + rageStacks * SERVER_CONFIG.HULK_PASSIVE.THROW_PER_STACK;

        const finalDamage = Math.floor(throwDamage);

        // Apply damage to target
        if (targetType === 'dummy') {
            target.currentHP = Math.max(0, target.currentHP - finalDamage);
        } else {
            applyDamageWithPassives(target as Player, finalDamage, io);
        }

        // Calculate throw end position
        let endX = targetX + dirX * throwDistance;
        let endY = targetY + dirY * throwDistance;

        // Clamp to bounds
        const clamped = clampCoordinates(endX, endY);
        endX = clamped.x;
        endY = clamped.y;

        // Move target to throw position
        target.x = endX;
        target.y = endY;

        logger.info(
            `SpinThrow SUCCESS: ${socket.id} threw ${targetType}:${targetId} for ${finalDamage} damage, ` +
                `from=(${targetX.toFixed(0)},${targetY.toFixed(0)}) to=(${endX.toFixed(0)},${endY.toFixed(0)})`
        );

        // === COLLISION DAMAGE ===
        const collisionRadius = 80;
        const collisionDamage = SERVER_CONFIG.SKILL_SPIN_THROW.COLLISION_DAMAGE;
        const collisionHitPlayers: HitPlayerInfo[] = [];
        const collisionKilledPlayers: KilledPlayerInfo[] = [];
        const collisionHitDummies: HitDummyInfo[] = [];
        let thrownTargetTookCollisionDamage = false;

        // Check collision with other players
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (targetType === 'player' && playerId === targetId) return;
            if (player.isDead) return;

            const cdx = player.x - endX;
            const cdy = player.y - endY;
            const collisionDist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (collisionDist <= collisionRadius) {
                applyDamageWithPassives(player, collisionDamage, io);

                collisionHitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x,
                    knockbackEndY: player.y,
                    attackerX: endX,
                    attackerY: endY,
                });

                logger.debug(
                    `Spin throw collision: ${playerId} hit by thrown target for ${collisionDamage} damage`
                );

                if (!thrownTargetTookCollisionDamage) {
                    thrownTargetTookCollisionDamage = true;
                    if (targetType === 'dummy') {
                        target.currentHP = Math.max(0, target.currentHP - collisionDamage);
                    } else {
                        applyDamageWithPassives(target as Player, collisionDamage, io);
                    }
                    logger.debug(
                        `Spin throw collision: thrown target took ${collisionDamage} collision damage`
                    );
                }

                if (checkAndHandleDeath(player, playerId, socket.id, collisionKilledPlayers, PLAYER_RESPAWN_DELAY)) {
                    logger.info(`${playerId} has been killed by spin throw collision!`);
                }
            }
        });

        // Check collision with dummies
        dummies.forEach((dummy) => {
            if (targetType === 'dummy' && dummy.id === targetId) return;
            if (dummy.currentHP <= 0) return;

            const cdx = dummy.x - endX;
            const cdy = dummy.y - endY;
            const collisionDist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (collisionDist <= collisionRadius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - collisionDamage);

                collisionHitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: dummy.x,
                    knockbackEndY: dummy.y,
                    attackerX: endX,
                    attackerY: endY,
                });

                logger.debug(
                    `Spin throw collision: ${dummy.name} hit by thrown target for ${collisionDamage} damage`
                );

                if (!thrownTargetTookCollisionDamage) {
                    thrownTargetTookCollisionDamage = true;
                    if (targetType === 'dummy') {
                        target.currentHP = Math.max(0, target.currentHP - collisionDamage);
                    } else {
                        applyDamageWithPassives(target as Player, collisionDamage, io);
                    }
                    logger.debug(
                        `Spin throw collision: thrown target took ${collisionDamage} collision damage`
                    );
                }

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        // Broadcast collision damage FIRST (before playerSpinThrow)
        if (collisionHitPlayers.length > 0) {
            io.emit('spinThrowCollision', {
                attackerId: socket.id,
                hitPlayers: collisionHitPlayers,
                thrownTargetId: targetId,
                thrownTargetType: targetType,
            });
        }

        if (collisionKilledPlayers.length > 0) {
            collisionKilledPlayers.forEach((killed) => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay,
                });
            });
        }

        if (collisionHitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: collisionHitDummies,
            });
        }

        // Broadcast spin throw effect with server-authoritative HP values
        io.emit('playerSpinThrow', {
            attackerId: socket.id,
            targetId: targetId,
            targetType: targetType,
            startX: attacker.x,
            startY: attacker.y,
            endX: endX,
            endY: endY,
            damage: finalDamage,
            collisionDamage: thrownTargetTookCollisionDamage ? collisionDamage : 0,
            targetCurrentHP: target.currentHP,
            targetMaxHP: target.maxHP,
        });

        // Check if target died (including from collision damage)
        if (target.currentHP <= 0) {
            if (targetType === 'dummy') {
                logger.debug(`Dummy ${targetId} died from spin throw`);
            } else {
                const targetKilledPlayers: KilledPlayerInfo[] = [];
                checkAndHandleDeath(target as Player, targetId as string, socket.id, targetKilledPlayers, PLAYER_RESPAWN_DELAY);
                for (const killed of targetKilledPlayers) {
                    io.emit('playerDied', {
                        playerId: killed.playerId,
                        killedBy: killed.killedBy,
                        respawnDelay: killed.respawnDelay,
                    });
                    logger.info(`${killed.playerId} has been killed by spin throw from ${socket.id}!`);
                }
            }
        }
    });
}
