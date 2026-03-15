/**
 * @fileoverview Telepathy handlers (Alien E skill)
 */
import logger from '../../../logger';
import {
    SERVER_CONFIG,
    TELEPATHY_RADIUS,
    TELEPATHY_DAMAGE_PER_TICK,
    TELEPATHY_MAX_HEAL_PER_TICK,
    RATE_LIMIT_TELEPATHY,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type { TypedSocket, TypedServer, HitPlayerInfo, HitDummyInfo, KilledPlayerInfo } from '../../types';

export function registerTelepathyHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle telepathy (sync with other players)
    socket.on('telepathy', (data) => {
        if (!rateLimit(socket.id, 'telepathy', RATE_LIMIT_TELEPATHY)) {
            return;
        }

        socket.broadcast.emit('playerTelepathy', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            radius: data.radius,
        });
    });

    // Handle telepathy damage
    socket.on('telepathyDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // === TICK RATE VALIDATION ===
        const now = Date.now();
        const tickInterval = SERVER_CONFIG.SKILL_TELEPATHY.TICK_INTERVAL_MS;
        const minTickInterval = tickInterval * 0.9;

        if (
            attacker.telepathyLastTickTime &&
            now - attacker.telepathyLastTickTime < minTickInterval
        ) {
            logger.cheat(
                `Telepathy tick too fast from ${socket.id}: ${now - attacker.telepathyLastTickTime}ms (min: ${minTickInterval}ms)`
            );
            return;
        }
        attacker.telepathyLastTickTime = now;

        const x = attacker.x;
        const y = attacker.y;

        const radius = TELEPATHY_RADIUS;
        const damagePerTarget = TELEPATHY_DAMAGE_PER_TICK;
        const maxHeal = TELEPATHY_MAX_HEAL_PER_TICK;

        if (data.radius && data.radius > TELEPATHY_RADIUS * 1.1) {
            logger.cheat(
                `Suspicious telepathy radius from ${socket.id}: ${data.radius} (server: ${TELEPATHY_RADIUS})`
            );
        }
        if (data.damagePerTarget && data.damagePerTarget > TELEPATHY_DAMAGE_PER_TICK * 1.1) {
            logger.cheat(
                `Suspicious telepathy damage from ${socket.id}: ${data.damagePerTarget} (server: ${TELEPATHY_DAMAGE_PER_TICK})`
            );
        }

        let totalDamageDealt = 0;

        const hitPlayers: HitPlayerInfo[] = [];
        const killedPlayers: KilledPlayerInfo[] = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                applyDamageWithPassives(player, damagePerTarget, io);
                totalDamageDealt += damagePerTarget;

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
                        respawnDelay: PLAYER_RESPAWN_DELAY,
                    });
                }
            }
        });

        const hitDummies: HitDummyInfo[] = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damagePerTarget);
                totalDamageDealt += damagePerTarget;

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

        if (hitPlayers.length > 0) {
            io.emit('telepathyTick', {
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
            io.emit('telepathyTickDummy', {
                attackerId: socket.id,
                hitDummies: hitDummies,
            });
        }

        const healAmount = Math.min(totalDamageDealt, maxHeal);
        if (healAmount > 0) {
            attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healAmount);

            io.to(socket.id).emit('telepathyHeal', {
                playerId: socket.id,
                healAmount: healAmount,
                newHP: attacker.currentHP,
            });
        }
    });
}
