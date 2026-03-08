/**
 * @fileoverview Telepathy skill handler (R skill)
 */
import logger from '../../../logger';
import {
    SERVER_CONFIG,
    TELEPATHY_RADIUS,
    TELEPATHY_DAMAGE_PER_TICK,
    TELEPATHY_MAX_HEAL_PER_TICK,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import { calculateDistance } from '../../validation';
import { checkAndHandleDeath } from '../../../shared/combat';
import { players, dummies } from '../../gameState';
import type {
    TypedSocket,
    TypedServer,
    TelepathyData,
    TelepathyDamageData,
    HitPlayerInfo,
    HitDummyInfo,
    KilledPlayerInfo,
} from '../../types';

/**
 * Register telepathy event handlers
 */
export function registerTelepathyHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle telepathy visual effect (sync with other players)
    socket.on('telepathy', (_data: TelepathyData) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Use server-side position and constant radius
        socket.broadcast.emit('playerTelepathy', {
            playerId: socket.id,
            x: player.x,
            y: player.y,
            radius: TELEPATHY_RADIUS,
        });
    });

    // Handle telepathy damage tick
    socket.on('telepathyDamage', (data: TelepathyDamageData) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Tick rate validation (anti-cheat)
        const now = Date.now();
        const lastTick = attacker.telepathyLastTickTime || 0;
        const tickInterval = SERVER_CONFIG.SKILL_TELEPATHY.TICK_INTERVAL_MS;

        // Reject if tick is too fast (90% tolerance for network latency)
        if (lastTick > 0 && now - lastTick < tickInterval * 0.9) {
            logger.cheat(
                `Telepathy tick too fast from ${socket.id}: ${now - lastTick}ms (min: ${tickInterval * 0.9}ms)`
            );
            return;
        }

        attacker.telepathyLastTickTime = now;

        // Use server-side position
        const x = attacker.x;
        const y = attacker.y;

        // Log suspicious values
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

        // Process player damage
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const distance = calculateDistance(x, y, player.x, player.y);

            if (distance <= TELEPATHY_RADIUS) {
                player.currentHP = Math.max(0, player.currentHP - TELEPATHY_DAMAGE_PER_TICK);
                totalDamageDealt += TELEPATHY_DAMAGE_PER_TICK;

                hitPlayers.push({
                    playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x, // No knockback for telepathy
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y,
                });

                checkAndHandleDeath(
                    player,
                    playerId,
                    socket.id,
                    killedPlayers,
                    PLAYER_RESPAWN_DELAY
                );
            }
        });

        // Process dummy damage
        const hitDummies: HitDummyInfo[] = [];
        const dummyRadiusBonus = 67.5;

        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const distance = calculateDistance(x, y, dummy.x, dummy.y);

            if (distance <= TELEPATHY_RADIUS + dummyRadiusBonus) {
                dummy.currentHP = Math.max(0, dummy.currentHP - TELEPATHY_DAMAGE_PER_TICK);
                totalDamageDealt += TELEPATHY_DAMAGE_PER_TICK;

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

        // Broadcast telepathy tick damage (no knockback, no vignette)
        if (hitPlayers.length > 0) {
            io.emit('telepathyTick', {
                attackerId: socket.id,
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
            io.emit('telepathyTickDummy', {
                attackerId: socket.id,
                hitDummies,
            });
        }

        // Calculate and send heal to attacker
        const healAmount = Math.min(totalDamageDealt, TELEPATHY_MAX_HEAL_PER_TICK);
        if (healAmount > 0) {
            attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healAmount);

            io.to(socket.id).emit('telepathyHeal', {
                playerId: socket.id,
                healAmount,
                newHP: attacker.currentHP,
            });
        }
    });
}
