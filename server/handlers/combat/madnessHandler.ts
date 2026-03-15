/**
 * @fileoverview Madness walk handlers (Crazy-Eyes E skill)
 */
import logger from '../../../logger';
import { SERVER_CONFIG } from '../../config';
import { GAME_CONFIG } from '../../../shared/config';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type {
    TypedSocket,
    TypedServer,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

export function registerMadnessHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle madness walk start
    socket.on('madnessStart', () => {
        if (!rateLimit(socket.id, 'madness', SERVER_CONFIG.RATE_LIMIT.MADNESS_MS)) {
            return;
        }

        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        player.madnessStartTime = Date.now();
        player.madnessLastTickTime = undefined;

        logger.debug(`Madness walk started by ${socket.id}`);

        socket.broadcast.emit('playerMadnessStart', {
            playerId: socket.id,
        });
    });

    // Handle madness walk end
    socket.on('madnessEnd', () => {
        const player = players.get(socket.id);
        if (!player) return;

        player.madnessStartTime = undefined;
        player.madnessLastTickTime = undefined;

        logger.debug(`Madness walk ended by ${socket.id}`);

        socket.broadcast.emit('playerMadnessEnd', {
            playerId: socket.id,
        });
    });

    // Handle madness tick damage
    socket.on('madnessDamage', () => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // === DURATION VALIDATION ===
        const now = Date.now();
        if (!attacker.madnessStartTime) {
            logger.cheat(`Madness damage without madnessStart from ${socket.id}`);
            return;
        }
        if (attacker.madnessStartTime) {
            const elapsed = now - attacker.madnessStartTime;
            const maxDuration = SERVER_CONFIG.SKILL_MADNESS.DURATION_MS;
            if (elapsed > maxDuration * 1.1) {
                logger.cheat(
                    `Madness duration exceeded from ${socket.id}: ${elapsed}ms (max: ${maxDuration}ms)`
                );
                attacker.madnessStartTime = undefined;
                attacker.madnessLastTickTime = undefined;
                socket.broadcast.emit('playerMadnessEnd', { playerId: socket.id });
                return;
            }
        }

        // === TICK RATE VALIDATION ===
        const tickInterval = SERVER_CONFIG.SKILL_MADNESS.TICK_INTERVAL_MS;
        const minTickInterval = tickInterval * 0.9;
        if (attacker.madnessLastTickTime && now - attacker.madnessLastTickTime < minTickInterval) {
            logger.cheat(
                `Madness tick too fast from ${socket.id}: ${now - attacker.madnessLastTickTime}ms (min: ${minTickInterval}ms)`
            );
            return;
        }
        attacker.madnessLastTickTime = now;

        const x = attacker.x;
        const y = attacker.y;
        const radius = SERVER_CONFIG.SKILL_MADNESS.RADIUS;
        const damage = SERVER_CONFIG.SKILL_MADNESS.DAMAGE_PER_TICK;

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

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x,
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y,
                });

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: SERVER_CONFIG.PLAYER.RESPAWN_DELAY_MS,
                    });
                    logger.info(`${playerId} has been killed by madness walk from ${socket.id}!`);
                }
            }
        });

        if (hitPlayers.length > 0) {
            io.emit('madnessTick', {
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

            if (distance <= radius + GAME_CONFIG.COMBAT.DUMMY_RADIUS_BONUS) {
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
