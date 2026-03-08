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
import { players, rateLimit } from '../../gameState';
import {
    processAreaDamageToPlayers,
    processAreaDamageToDummies,
    broadcastDamageEvents,
} from './damageProcessor';
import type { TypedSocket, TypedServer, AttackData } from '../../types';

/**
 * Register basic attack event handlers
 */
export function registerBasicAttackHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('playerAttack', (data: AttackData) => {
        // Rate limiting
        if (!rateLimit(socket.id, 'attack', RATE_LIMIT_ATTACK)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Use server-side position (anti-cheat)
        const attackX = attacker.x;
        const attackY = attacker.y;

        // Log suspicious values
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

        // Broadcast attack to all other players (for visual effect)
        socket.broadcast.emit('playerAttacked', {
            playerId: socket.id,
            x: attackX,
            y: attackY,
            range: ATTACK_RANGE,
        });

        // Process damage using shared processor
        const { hitPlayers, killedPlayers } = processAreaDamageToPlayers({
            attackerId: socket.id,
            x: attackX,
            y: attackY,
            radius: ATTACK_RANGE,
            damage: ATTACK_POWER,
            respawnDelay: PLAYER_RESPAWN_DELAY,
        });

        // Log player hits
        hitPlayers.forEach((hit) => {
            logger.debug(
                `${socket.id} hit ${hit.playerId} for ${ATTACK_POWER} damage ` +
                    `(HP: ${hit.currentHP}/${hit.maxHP}), knockback to (${hit.knockbackEndX.toFixed(1)}, ${hit.knockbackEndY.toFixed(1)})`
            );
        });

        killedPlayers.forEach((killed) => {
            logger.info(`${killed.playerId} has been killed by ${socket.id}!`);
        });

        const { hitDummies } = processAreaDamageToDummies({
            attackerId: socket.id,
            x: attackX,
            y: attackY,
            radius: ATTACK_RANGE,
            damage: ATTACK_POWER,
        });

        // Log dummy hits
        hitDummies.forEach((hit) => {
            logger.debug(
                `${socket.id} hit dummy ${hit.dummyId} for ${ATTACK_POWER} damage ` +
                    `(HP: ${hit.currentHP}/${hit.maxHP})`
            );
            if (hit.currentHP <= 0) {
                logger.debug(`Dummy ${hit.dummyId} has been defeated!`);
            }
        });

        // Broadcast damage events
        broadcastDamageEvents(io, socket.id, hitPlayers, killedPlayers, hitDummies);
    });
}
