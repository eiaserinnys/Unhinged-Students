/**
 * @fileoverview Basic attack handler (spacebar attack)
 */
import logger from '../../../logger';
import { ATTACK_POWER, ATTACK_RANGE, RATE_LIMIT_ATTACK, PLAYER_RESPAWN_DELAY } from '../../config';
import { players, rateLimit } from '../../gameState';
import { processAreaDamageToPlayers, processAreaDamageToDummies, broadcastDamageEvents } from './damageProcessor';
import type {
    TypedSocket,
    TypedServer,
} from '../../types';

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

        // Player damage (with passives)
        const { hitPlayers, killedPlayers } = processAreaDamageToPlayers({
            attackerId: socket.id,
            x: attackX,
            y: attackY,
            radius: attackRange,
            damage: attackPower,
            respawnDelay: PLAYER_RESPAWN_DELAY,
            applyKnockback: true,
            applyPassives: true,
            io,
        });

        // Dummy damage
        const { hitDummies } = processAreaDamageToDummies({
            attackerId: socket.id,
            x: attackX,
            y: attackY,
            radius: attackRange,
            damage: attackPower,
            applyKnockback: true,
        });

        // Broadcast
        broadcastDamageEvents(io, socket.id, hitPlayers, killedPlayers, hitDummies);
    });
}
