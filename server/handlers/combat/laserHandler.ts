/**
 * @fileoverview Laser aiming and attack handlers (Alien Q skill)
 */
import logger from '../../../logger';
import { SERVER_CONFIG } from '../../config';
import { GAME_CONFIG } from '../../../shared/config';
import {
    isValidNumber,
    calculateDistance,
    calculateKnockbackEndPosition,
    lineCircleIntersect,
} from '../../validation';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import { recordKill } from '../../matchManager';
import type {
    TypedSocket,
    TypedServer,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

export function registerLaserHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle laser aiming (sync with other players)
    socket.on('laserAiming', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        if (!isValidNumber(data.dirX) || !isValidNumber(data.dirY)) {
            logger.cheat(`Invalid laser direction types from ${socket.id}`);
            return;
        }

        const dirLength = Math.sqrt(data.dirX * data.dirX + data.dirY * data.dirY);
        if (dirLength < 0.9 || dirLength > 1.1) {
            logger.cheat(`Invalid laser direction length from ${socket.id}: ${dirLength}`);
            return;
        }

        socket.broadcast.emit('laserAiming', {
            playerId: socket.id,
            x: player.x,
            y: player.y,
            dirX: data.dirX,
            dirY: data.dirY,
        });
    });

    // Handle laser attack (Q skill)
    socket.on('laserAttack', (data) => {
        if (!rateLimit(socket.id, 'laser', SERVER_CONFIG.RATE_LIMIT.LASER_MS)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        if (
            !isValidNumber(data.x1) ||
            !isValidNumber(data.y1) ||
            !isValidNumber(data.x2) ||
            !isValidNumber(data.y2)
        ) {
            logger.cheat(`Invalid laser coordinates from ${socket.id}`);
            return;
        }

        const x1 = attacker.x;
        const y1 = attacker.y;

        let x2 = data.x2;
        let y2 = data.y2;
        const laserLength = calculateDistance(x1, y1, x2, y2);

        if (laserLength > SERVER_CONFIG.SKILL_LASER.MAX_LENGTH) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            x2 = x1 + Math.cos(angle) * SERVER_CONFIG.SKILL_LASER.MAX_LENGTH;
            y2 = y1 + Math.sin(angle) * SERVER_CONFIG.SKILL_LASER.MAX_LENGTH;
        }

        const damage = SERVER_CONFIG.SKILL_LASER.DAMAGE;
        const hitRadius = GAME_CONFIG.COMBAT.DUMMY_RADIUS_BONUS;

        if (data.damage && data.damage > SERVER_CONFIG.SKILL_LASER.DAMAGE * 1.1) {
            logger.cheat(
                `Suspicious laser damage from ${socket.id}: ${data.damage} (server: ${SERVER_CONFIG.SKILL_LASER.DAMAGE})`
            );
        }

        logger.debug(
            `Laser attack from ${socket.id}: (${x1.toFixed(0)}, ${y1.toFixed(0)}) -> (${x2.toFixed(0)}, ${y2.toFixed(0)})`
        );

        socket.broadcast.emit('laserFired', {
            playerId: socket.id,
            x1,
            y1,
            x2,
            y2,
        });

        const hitPlayers: HitPlayerInfo[] = [];
        const killedPlayers: KilledPlayerInfo[] = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            if (lineCircleIntersect(x1, y1, x2, y2, player.x, player.y, hitRadius)) {
                applyDamageWithPassives(player, damage, io);

                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(
                    x1,
                    y1,
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
                    attackerX: x1,
                    attackerY: y1,
                });

                logger.debug(
                    `Laser hit ${playerId} for ${damage} damage (HP: ${player.currentHP}/${player.maxHP})`
                );

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: SERVER_CONFIG.PLAYER.RESPAWN_DELAY_MS,
                    });
                    logger.info(`${playerId} has been killed by laser from ${socket.id}!`);
                }
            }
        });

        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
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

                const killer = players.get(killed.killedBy);
                if (killer) {
                    recordKill(killer.team, io);
                }
            });
        }

        const hitDummies: HitDummyInfo[] = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            if (lineCircleIntersect(x1, y1, x2, y2, dummy.x, dummy.y, hitRadius)) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(
                    x1,
                    y1,
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
                    attackerX: x1,
                    attackerY: y1,
                });

                logger.debug(
                    `Laser hit ${dummy.name} for ${damage} damage (HP: ${dummy.currentHP}/${dummy.maxHP})`
                );

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated by laser!`);
                }
            }
        });

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies,
            });
        }
    });
}
