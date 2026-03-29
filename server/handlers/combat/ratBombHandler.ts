/**
 * @fileoverview Rat Bomb skill handler (Squeak-Squeak E skill)
 * 쥐 폭탄: 범위 폭발 데미지 + 쥐 4마리가 흩어져 추가 데미지
 */
import logger from '../../../logger';
import { GAME_CONFIG } from '../../../shared/config';
import { players } from '../../gameState';
import { processAreaDamageToPlayers } from './damageProcessor';
import type { TypedSocket, TypedServer } from '../../types';

export function registerRatBombHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('ratBomb', () => {
        const caster = players.get(socket.id);
        if (!caster || caster.isDead) return;

        logger.info(`Rat bomb cast by ${socket.id} at (${caster.x.toFixed(0)}, ${caster.y.toFixed(0)})`);

        // 1. 즉발 폭발 데미지
        const { hitPlayers, killedPlayers } = processAreaDamageToPlayers({
            attackerId: socket.id,
            x: caster.x,
            y: caster.y,
            radius: GAME_CONFIG.SKILL_RAT_BOMB.EXPLOSION_RADIUS,
            damage: GAME_CONFIG.SKILL_RAT_BOMB.EXPLOSION_DAMAGE,
            respawnDelay: GAME_CONFIG.PLAYER.RESPAWN_DELAY_MS,
            applyKnockback: true,
            applyPassives: true,
            io,
        });

        // 2. 쥐 4마리 위치 계산 (폭발 중심에서 방사형)
        const rats: Array<{ x: number; y: number; damage: number }> = [];
        for (let i = 0; i < GAME_CONFIG.SKILL_RAT_BOMB.RAT_COUNT; i++) {
            const angle = (i / GAME_CONFIG.SKILL_RAT_BOMB.RAT_COUNT) * Math.PI * 2;
            const dist = GAME_CONFIG.SKILL_RAT_BOMB.EXPLOSION_RADIUS * 0.6;
            rats.push({
                x: caster.x + Math.cos(angle) * dist,
                y: caster.y + Math.sin(angle) * dist,
                damage: GAME_CONFIG.SKILL_RAT_BOMB.RAT_DAMAGE,
            });
        }

        // 3. 쥐 데미지: 근처 적에게 즉시 추가 데미지 (폭발 외에 추가)
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;
            if (caster.team && player.team && caster.team === player.team) return;

            for (const rat of rats) {
                const dx = player.x - rat.x;
                const dy = player.y - rat.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= GAME_CONFIG.SKILL_RAT_BOMB.EXPLOSION_RADIUS * 0.5) {
                    player.currentHP = Math.max(0, player.currentHP - rat.damage);

                    if (player.currentHP <= 0 && !player.isDead) {
                        player.isDead = true;
                        player.deathTime = Date.now();
                        io.emit('playerDied', {
                            playerId,
                            killedBy: socket.id,
                            respawnDelay: GAME_CONFIG.PLAYER.RESPAWN_DELAY_MS,
                        });
                    }
                    break; // 쥐 한 마리만 맞음
                }
            }
        });

        // 클라이언트에 결과 전달 (폭발에 맞은 플레이어 HP 포함)
        const allHitPlayers = hitPlayers.map(p => {
            const playerState = players.get(p.playerId);
            return {
                playerId: p.playerId,
                currentHP: playerState?.currentHP ?? p.currentHP,
                maxHP: playerState?.maxHP ?? p.maxHP,
            };
        });

        io.emit('ratBombEffect', {
            casterId: socket.id,
            casterX: caster.x,
            casterY: caster.y,
            explosionDamage: GAME_CONFIG.SKILL_RAT_BOMB.EXPLOSION_DAMAGE,
            rats,
            hitPlayers: allHitPlayers,
        });

        logger.debug(`Rat bomb hit ${hitPlayers.length} players`);

        if (killedPlayers.length > 0) {
            logger.info(`Rat bomb killed: ${killedPlayers.map(p => p.playerId).join(', ')}`);
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay,
                });
            });
        }
    });
}
