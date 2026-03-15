/**
 * @fileoverview Pot smash handler (Curry-Bear basic attack)
 */
import logger from '../../../logger';
import {
    POT_SMASH_DAMAGE,
    POT_SMASH_SPLASH_DAMAGE,
    POT_SMASH_RANGE,
    POT_SMASH_ANGLE,
    POT_SMASH_SPLASH_RADIUS,
    RATE_LIMIT_POT_SMASH,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import { isValidNumber, calculateKnockbackEndPosition } from '../../validation';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type {
    TypedSocket,
    TypedServer,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

export function registerPotSmashHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('potSmash', (data) => {
        if (!rateLimit(socket.id, 'potSmash', RATE_LIMIT_POT_SMASH)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        if (!isValidNumber(data.dirX) || !isValidNumber(data.dirY)) {
            logger.cheat(`Invalid pot smash direction from ${socket.id}`);
            return;
        }

        const x = attacker.x;
        const y = attacker.y;
        const dirX = data.dirX;
        const dirY = data.dirY;

        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        const normDirX = dirLength > 0 ? dirX / dirLength : 1;
        const normDirY = dirLength > 0 ? dirY / dirLength : 0;

        const range = POT_SMASH_RANGE;
        const angle = POT_SMASH_ANGLE;
        const damage = POT_SMASH_DAMAGE;
        const splashDamage = POT_SMASH_SPLASH_DAMAGE;
        const splashRadius = POT_SMASH_SPLASH_RADIUS;
        const halfAngleRad = ((angle / 2) * Math.PI) / 180;

        logger.debug(
            `Pot smash from ${socket.id} at (${x.toFixed(0)}, ${y.toFixed(0)}) dir (${normDirX.toFixed(2)}, ${normDirY.toFixed(2)})`
        );

        socket.broadcast.emit('playerPotSmash', {
            playerId: socket.id,
            x: x,
            y: y,
            dirX: normDirX,
            dirY: normDirY,
        });

        // Helper to check if target is in cone
        function isInCone(targetX: number, targetY: number): boolean {
            const dx = targetX - x;
            const dy = targetY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > range) return false;
            if (distance === 0) return true;

            const targetAngle = Math.atan2(dy, dx);
            const attackAngle = Math.atan2(normDirY, normDirX);
            let angleDiff = Math.abs(targetAngle - attackAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            return angleDiff <= halfAngleRad;
        }

        const mainHitPositions: { x: number; y: number }[] = [];

        const hitPlayers: HitPlayerInfo[] = [];
        const killedPlayers: KilledPlayerInfo[] = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            if (isInCone(player.x, player.y)) {
                applyDamageWithPassives(player, damage, io);
                mainHitPositions.push({ x: player.x, y: player.y });

                const knockbackDist = 60;
                const knockbackEnd = calculateKnockbackEndPosition(
                    x,
                    y,
                    player.x,
                    player.y,
                    knockbackDist
                );
                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x,
                    attackerY: y,
                    isMainHit: true,
                });

                logger.debug(`Pot smash hit ${playerId} for ${damage} damage`);

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY,
                    });
                }
            }
        });

        const hitDummies: HitDummyInfo[] = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            if (isInCone(dummy.x, dummy.y)) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);
                mainHitPositions.push({ x: dummy.x, y: dummy.y });

                const knockbackDist = 60;
                const knockbackEnd = calculateKnockbackEndPosition(
                    x,
                    y,
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
                    attackerX: x,
                    attackerY: y,
                    isMainHit: true,
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        // Apply splash damage around main hit positions
        mainHitPositions.forEach((hitPos) => {
            players.forEach((player, playerId) => {
                if (playerId === socket.id) return;
                if (player.isDead) return;
                if (hitPlayers.some((h) => h.playerId === playerId && h.isMainHit)) return;

                const dx = player.x - hitPos.x;
                const dy = player.y - hitPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= splashRadius) {
                    applyDamageWithPassives(player, splashDamage, io);

                    hitPlayers.push({
                        playerId: playerId,
                        currentHP: player.currentHP,
                        maxHP: player.maxHP,
                        knockbackEndX: player.x,
                        knockbackEndY: player.y,
                        attackerX: hitPos.x,
                        attackerY: hitPos.y,
                        isMainHit: false,
                    });

                    logger.debug(`Pot smash splash hit ${playerId} for ${splashDamage} damage`);

                    if (player.currentHP <= 0 && !player.isDead) {
                        player.isDead = true;
                        player.deathTime = Date.now();
                        killedPlayers.push({
                            playerId: playerId,
                            killedBy: socket.id,
                            respawnDelay: PLAYER_RESPAWN_DELAY,
                        });
                    }
                }
            });

            dummies.forEach((dummy) => {
                if (dummy.currentHP <= 0) return;
                if (hitDummies.some((h) => h.dummyId === dummy.id && h.isMainHit)) return;

                const dx = dummy.x - hitPos.x;
                const dy = dummy.y - hitPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= splashRadius + 67.5) {
                    dummy.currentHP = Math.max(0, dummy.currentHP - splashDamage);

                    hitDummies.push({
                        dummyId: dummy.id,
                        currentHP: dummy.currentHP,
                        maxHP: dummy.maxHP,
                        knockbackEndX: dummy.x,
                        knockbackEndY: dummy.y,
                        attackerX: hitPos.x,
                        attackerY: hitPos.y,
                        isMainHit: false,
                    });

                    if (dummy.currentHP <= 0) {
                        dummy.deathTime = Date.now();
                    }
                }
            });
        });

        if (hitPlayers.length > 0) {
            io.emit('potSmashDamage', {
                attackerId: socket.id,
                hitPlayers: hitPlayers,
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
                hitDummies: hitDummies,
            });
        }
    });
}
