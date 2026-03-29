/**
 * @fileoverview Rat Revive skill handler (Squeak-Squeak T skill)
 * 쥐 살리기: 죽은 아군 전체를 부활 (쥐 환상으로 죽은 캐릭터 제외)
 */
import logger from '../../../logger';
import { GAME_CONFIG } from '../../../shared/config';
import { players } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

export function registerRatReviveHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('ratRevive', () => {
        const caster = players.get(socket.id);
        if (!caster || caster.isDead) return;

        logger.info(`Rat revive cast by ${socket.id}`);

        const revivedPlayers: Array<{ playerId: string; x: number; y: number; currentHP: number; maxHP: number }> = [];

        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (!player.isDead) return;
            // 같은 팀만 부활
            if (caster.team && player.team && caster.team !== player.team) return;
            // 쥐 환상으로 죽은 경우 부활 불가 (ratIllusionKilled 플래그 체크)
            if (player.ratIllusionKilled) {
                logger.debug(`${playerId} cannot be revived (killed by rat illusion)`);
                return;
            }

            const reviveHP = Math.floor(player.maxHP * GAME_CONFIG.SKILL_RAT_REVIVE.REVIVE_HP_RATIO);
            player.currentHP = reviveHP;
            player.isDead = false;
            player.deathTime = 0;

            revivedPlayers.push({
                playerId,
                x: player.x,
                y: player.y,
                currentHP: reviveHP,
                maxHP: player.maxHP,
            });

            logger.info(`${playerId} revived with ${reviveHP}/${player.maxHP} HP`);
        });

        if (revivedPlayers.length === 0) {
            logger.debug(`Rat revive: no valid targets for ${socket.id}`);
        }

        io.emit('ratReviveEffect', {
            casterId: socket.id,
            revivedPlayers,
        });
    });
}
