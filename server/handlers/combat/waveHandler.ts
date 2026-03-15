/**
 * @fileoverview Wave attack handler (Crazy-Eyes basic attack)
 */
import logger from '../../../logger';
import {
    WAVE_RADIUS,
    WAVE_DAMAGE,
    WAVE_CONFUSION_DURATION,
    RATE_LIMIT_WAVE,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type {
    TypedSocket,
    TypedServer,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

export function registerWaveHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('waveAttack', (_data) => {
        if (!rateLimit(socket.id, 'wave', RATE_LIMIT_WAVE)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        const x = attacker.x;
        const y = attacker.y;

        const radius = WAVE_RADIUS;
        const damage = WAVE_DAMAGE;
        const confusionDuration = WAVE_CONFUSION_DURATION;

        logger.debug(`Wave attack from ${socket.id} at (${x.toFixed(0)}, ${y.toFixed(0)})`);

        socket.broadcast.emit('playerWave', {
            playerId: socket.id,
            x: x,
            y: y,
            radius: radius,
        });

        const hitPlayers: HitPlayerInfo[] = [];
        const killedPlayers: KilledPlayerInfo[] = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                applyDamageWithPassives(player, damage, io);

                player.confusedUntil = Date.now() + confusionDuration;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x,
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y,
                    confused: true,
                    confusionDuration: confusionDuration,
                });

                logger.debug(
                    `Wave hit ${playerId} for ${damage} damage, confused for ${confusionDuration}ms`
                );

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY,
                    });
                    logger.info(`${playerId} has been killed by wave from ${socket.id}!`);
                }
            }
        });

        if (hitPlayers.length > 0) {
            io.emit('waveDamage', {
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

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: dummy.x,
                    knockbackEndY: dummy.y,
                    attackerX: x,
                    attackerY: y,
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
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
