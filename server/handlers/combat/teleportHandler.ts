/**
 * @fileoverview Teleport and teleport damage handlers
 */
import logger from '../../../logger';
import {
    TELEPORT_MAX_DISTANCE,
    TELEPORT_DAMAGE_RADIUS,
    TELEPORT_DAMAGE,
    RATE_LIMIT_TELEPORT,
    RATE_LIMIT_TELEPORT_DAMAGE,
    PLAYER_RESPAWN_DELAY,
} from '../../config';
import {
    isValidNumber,
    clampCoordinates,
    calculateDistance,
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
} from '../../validation';
import { players, dummies, rateLimit } from '../../gameState';
import { applyDamageWithPassives } from './damageProcessor';
import type { TypedSocket, TypedServer, HitPlayerInfo, HitDummyInfo, KilledPlayerInfo } from '../../types';

export function registerTeleportHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle teleport (sync with other players)
    socket.on('teleport', (data) => {
        if (!rateLimit(socket.id, 'teleport', RATE_LIMIT_TELEPORT)) {
            return;
        }

        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        if (
            !isValidNumber(data.startX) ||
            !isValidNumber(data.startY) ||
            !isValidNumber(data.endX) ||
            !isValidNumber(data.endY)
        ) {
            logger.cheat(`Invalid teleport coordinates from ${socket.id}`);
            return;
        }

        const startX = player.x;
        const startY = player.y;

        let endX = data.endX;
        let endY = data.endY;

        const teleportDistance = calculateDistance(startX, startY, endX, endY);
        if (teleportDistance > TELEPORT_MAX_DISTANCE * 1.2) {
            logger.cheat(
                `Teleport distance exceeded from ${socket.id}: ${teleportDistance.toFixed(1)}px (max: ${TELEPORT_MAX_DISTANCE}px)`
            );
            const angle = Math.atan2(endY - startY, endX - startX);
            endX = startX + Math.cos(angle) * TELEPORT_MAX_DISTANCE;
            endY = startY + Math.sin(angle) * TELEPORT_MAX_DISTANCE;
        }

        const clamped = clampCoordinates(endX, endY);
        endX = clamped.x;
        endY = clamped.y;

        socket.broadcast.emit('playerTeleport', {
            playerId: socket.id,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
        });

        player.x = endX;
        player.y = endY;
    });

    // Handle teleport damage
    socket.on('teleportDamage', (data) => {
        if (!rateLimit(socket.id, 'teleportDamage', RATE_LIMIT_TELEPORT_DAMAGE)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        const x = attacker.x;
        const y = attacker.y;

        const radius = TELEPORT_DAMAGE_RADIUS;
        const damage = TELEPORT_DAMAGE;

        if (data.radius && data.radius > TELEPORT_DAMAGE_RADIUS * 1.1) {
            logger.cheat(
                `Suspicious teleport damage radius from ${socket.id}: ${data.radius} (server: ${TELEPORT_DAMAGE_RADIUS})`
            );
        }
        if (data.damage && data.damage > TELEPORT_DAMAGE * 1.1) {
            logger.cheat(
                `Suspicious teleport damage from ${socket.id}: ${data.damage} (server: ${TELEPORT_DAMAGE})`
            );
        }

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

                const knockbackDist = calculateKnockbackDistance(radius, distance);
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

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                const knockbackDist = calculateKnockbackDistance(radius, distance);
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
