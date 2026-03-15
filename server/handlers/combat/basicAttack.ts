/**
 * @fileoverview Basic attack handler (spacebar attack)
 */
import logger from '../../../logger';
import {
    ATTACK_POWER,
    ATTACK_RANGE,
    RATE_LIMIT_ATTACK,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import {
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
} from '../../validation';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type { TypedSocket, TypedServer, HitPlayerInfo, HitDummyInfo, KilledPlayerInfo } from '../../types';

export function registerBasicAttackHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('playerAttack', (data) => {
        if (!rateLimit(socket.id, 'attack', RATE_LIMIT_ATTACK)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        const attackX = attacker.x;
        const attackY = attacker.y;
        const attackRange = ATTACK_RANGE;
        const attackPower = ATTACK_POWER;

        if (data.range && data.range > ATTACK_RANGE * 1.1) {
            logger.cheat(
                `Suspicious attack range from ${socket.id}: ${data.range} (server: ${ATTACK_RANGE})`
            );
        }
        if (data.power && data.power > ATTACK_POWER * 1.1) {
            logger.cheat(
                `Suspicious attack power from ${socket.id}: ${data.power} (server: ${ATTACK_POWER})`
            );
        }

        socket.broadcast.emit('playerAttacked', {
            playerId: socket.id,
            x: attackX,
            y: attackY,
            range: attackRange,
        });

        const hitPlayers: HitPlayerInfo[] = [];
        const killedPlayers: KilledPlayerInfo[] = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - attackX;
            const dy = player.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= attackRange) {
                applyDamageWithPassives(player, attackPower, io);

                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(
                    attackX,
                    attackY,
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
                    attackerX: attackX,
                    attackerY: attackY,
                });

                logger.debug(
                    `${socket.id} hit ${playerId} for ${attackPower} damage (HP: ${player.currentHP}/${player.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`
                );

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY,
                    });
                    logger.info(`${playerId} has been killed by ${socket.id}!`);
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
            });
        }

        const hitDummies: HitDummyInfo[] = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - attackX;
            const dy = dummy.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= attackRange + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - attackPower);

                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(
                    attackX,
                    attackY,
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
                    attackerX: attackX,
                    attackerY: attackY,
                });

                logger.debug(
                    `${socket.id} hit ${dummy.name} for ${attackPower} damage (HP: ${dummy.currentHP}/${dummy.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`
                );

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated!`);
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
