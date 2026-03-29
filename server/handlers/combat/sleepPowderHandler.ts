/**
 * @fileoverview Sleep Powder skill handler (Squeak-Squeak W skill)
 * 수면 가루: 범위 내 적을 잠들게 함 (이동 불가, 공격 불가)
 */
import logger from '../../../logger';
import { GAME_CONFIG } from '../../../shared/config';
import { players } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

export function registerSleepPowderHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('sleepPowder', () => {
        const caster = players.get(socket.id);
        if (!caster || caster.isDead) return;

        logger.info(`Sleep powder cast by ${socket.id} at (${caster.x.toFixed(0)}, ${caster.y.toFixed(0)})`);

        const affectedPlayers: Array<{ playerId: string; duration: number }> = [];

        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;
            if (caster.team && player.team && caster.team === player.team) return;

            const dx = player.x - caster.x;
            const dy = player.y - caster.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= GAME_CONFIG.SKILL_SLEEP_POWDER.RADIUS) {
                player.sleepUntil = Date.now() + GAME_CONFIG.SKILL_SLEEP_POWDER.SLEEP_DURATION_MS;
                affectedPlayers.push({ playerId, duration: GAME_CONFIG.SKILL_SLEEP_POWDER.SLEEP_DURATION_MS });
                logger.debug(`${playerId} put to sleep for ${GAME_CONFIG.SKILL_SLEEP_POWDER.SLEEP_DURATION_MS}ms`);
            }
        });

        io.emit('sleepPowderEffect', {
            casterId: socket.id,
            casterX: caster.x,
            casterY: caster.y,
            radius: GAME_CONFIG.SKILL_SLEEP_POWDER.RADIUS,
            affectedPlayers,
        });
    });
}
