/**
 * @fileoverview Basic attack handler (spacebar attack)
 */
import logger from '../../../logger';
import { SERVER_CONFIG } from '../../config';
import { players, rateLimit } from '../../gameState';
import { processAreaDamageToPlayers, processAreaDamageToDummies, broadcastDamageEvents } from './damageProcessor';
import type {
    TypedSocket,
    TypedServer,
} from '../../types';

export function registerBasicAttackHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('playerAttack', (data) => {
        if (!rateLimit(socket.id, 'attack', SERVER_CONFIG.RATE_LIMIT.ATTACK_MS)) {
            return;
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        const attackX = attacker.x;
        const attackY = attacker.y;
        const attackRange = SERVER_CONFIG.COMBAT.ATTACK_RANGE;
        const attackPower = SERVER_CONFIG.COMBAT.ATTACK_POWER;

        if (data.range && data.range > SERVER_CONFIG.COMBAT.ATTACK_RANGE * 1.1) {
            logger.cheat(
                `Suspicious attack range from ${socket.id}: ${data.range} (server: ${SERVER_CONFIG.COMBAT.ATTACK_RANGE})`
            );
        }
        if (data.power && data.power > SERVER_CONFIG.COMBAT.ATTACK_POWER * 1.1) {
            logger.cheat(
                `Suspicious attack power from ${socket.id}: ${data.power} (server: ${SERVER_CONFIG.COMBAT.ATTACK_POWER})`
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
            respawnDelay: SERVER_CONFIG.PLAYER.RESPAWN_DELAY_MS,
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
