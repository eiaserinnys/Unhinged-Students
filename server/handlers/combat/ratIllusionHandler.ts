/**
 * @fileoverview Rat Illusion skill handler (Squeak-Squeak Q skill)
 * 쥐 환상: 적 화면에 쥐 5마리 표시, 진짜 쥐를 찾아 클릭해야 함
 * 못 찾으면 초당 체력 10 감소
 */
import logger from '../../../logger';
import { GAME_CONFIG } from '../../../shared/config';
import { players, dummies } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

// 활성화된 쥐 환상 효과 추적
interface ActiveRatIllusion {
    casterId: string; // 스킬 시전자
    targetId: string; // 효과 대상
    realRatIndex: number; // 진짜 쥐 인덱스
    startTime: number;
    drainInterval: NodeJS.Timeout | null;
}

const activeIllusions = new Map<string, ActiveRatIllusion>();

/**
 * 쥐 환상 효과 종료
 */
function endRatIllusion(targetId: string, io: TypedServer, reason: string): void {
    const illusion = activeIllusions.get(targetId);
    if (!illusion) return;

    // 체력 감소 타이머 정리
    if (illusion.drainInterval) {
        clearInterval(illusion.drainInterval);
    }

    // 무적 상태 해제
    const target = players.get(targetId);
    if (target) {
        target.ratIllusionUntil = undefined;
    }

    activeIllusions.delete(targetId);

    // 효과 종료 브로드캐스트
    io.emit('ratIllusionEnd', {
        targetId,
        reason,
    });

    logger.debug(`Rat illusion ended for ${targetId}: ${reason}`);
}

/**
 * Register rat illusion event handlers
 */
export function registerRatIllusionHandlers(socket: TypedSocket, io: TypedServer): void {
    // 쥐 환상 시전
    socket.on('ratIllusion', (data: { targetId?: string }) => {
        const caster = players.get(socket.id);
        if (!caster) return;
        if (caster.isDead) return;

        // 타겟이 지정되지 않으면 가장 가까운 적(플레이어 또는 더미)을 찾음
        let targetId = data.targetId;
        let targetType: 'player' | 'dummy' = 'player';

        if (!targetId) {
            let minDistance = Infinity;

            // 가장 가까운 적 플레이어 찾기
            players.forEach((player, playerId) => {
                if (playerId === socket.id) return;
                if (player.isDead) return;
                // 다른 팀 플레이어만 타겟 (팀이 없으면 모두 타겟)
                if (caster.team && player.team && caster.team === player.team) return;

                const dx = player.x - caster.x;
                const dy = player.y - caster.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    targetId = playerId;
                    targetType = 'player';
                }
            });

            // 더미도 타겟 후보에 포함
            dummies.forEach((dummy) => {
                if (dummy.currentHP <= 0) return;

                const dx = dummy.x - caster.x;
                const dy = dummy.y - caster.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    targetId = `dummy_${dummy.id}`;
                    targetType = 'dummy';
                }
            });
        } else if (targetId.startsWith('dummy_')) {
            targetType = 'dummy';
        }

        if (!targetId) {
            logger.debug(`Rat illusion: no valid target for ${socket.id}`);
            return;
        }

        // 더미 타겟인 경우 바로 데미지
        if (targetType === 'dummy') {
            const dummyId = parseInt(targetId.replace('dummy_', ''));
            const dummy = dummies.get(dummyId);
            if (!dummy || dummy.currentHP <= 0) return;

            const damage = GAME_CONFIG.SKILL_RAT_ILLUSION.HP_DRAIN_PER_SECOND * GAME_CONFIG.SKILL_RAT_ILLUSION.DUMMY_DAMAGE_MULTIPLIER; // 더미에게는 N초치 데미지를 한번에
            dummy.currentHP = Math.max(0, dummy.currentHP - damage);

            logger.info(
                `Rat illusion hit dummy ${dummyId} for ${damage} damage (${dummy.currentHP}/${dummy.maxHP})`
            );

            // 더미 데미지 브로드캐스트
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                dummyIndex: dummyId,
                damage,
                currentHP: dummy.currentHP,
            });

            // 더미 사망 체크
            if (dummy.currentHP <= 0) {
                dummy.deathTime = Date.now();
                logger.info(`Dummy ${dummyId} killed by rat illusion from ${socket.id}`);
            }

            return; // 더미는 여기서 끝
        }

        // 플레이어 타겟인 경우 (기존 로직)
        const target = players.get(targetId);
        if (!target || target.isDead) return;

        // 무적 상태 설정 (쥐 환상 지속 시간 동안)
        target.ratIllusionUntil = Date.now() + GAME_CONFIG.SKILL_RAT_ILLUSION.DURATION_MS;

        // 이미 쥐 환상 효과가 있으면 종료
        if (activeIllusions.has(targetId)) {
            endRatIllusion(targetId, io, 'replaced');
        }

        // 진짜 쥐 인덱스 결정 (서버에서만 알고 있음!)
        const realRatIndex = Math.floor(Math.random() * GAME_CONFIG.SKILL_RAT_ILLUSION.RAT_COUNT);

        logger.info(`Rat illusion cast by ${socket.id} on ${targetId} (real rat: ${realRatIndex})`);

        // 쥐 환상 효과 시작
        const illusion: ActiveRatIllusion = {
            casterId: socket.id,
            targetId,
            realRatIndex,
            startTime: Date.now(),
            drainInterval: null,
        };

        // 체력 감소 타이머 설정 (1초마다)
        illusion.drainInterval = setInterval(() => {
            const targetPlayer = players.get(targetId!);
            if (!targetPlayer || targetPlayer.isDead) {
                endRatIllusion(targetId!, io, 'target_dead');
                return;
            }

            // 체력 감소
            const damage = GAME_CONFIG.SKILL_RAT_ILLUSION.HP_DRAIN_PER_SECOND;
            targetPlayer.currentHP = Math.max(0, targetPlayer.currentHP - damage);

            logger.debug(
                `Rat illusion draining ${targetId}: -${damage} HP (${targetPlayer.currentHP}/${targetPlayer.maxHP})`
            );

            // 체력 감소 브로드캐스트
            io.emit('ratIllusionDrain', {
                targetId: targetId!,
                damage,
                currentHP: targetPlayer.currentHP,
                maxHP: targetPlayer.maxHP,
            });

            // 사망 체크
            if (targetPlayer.currentHP <= 0) {
                targetPlayer.isDead = true;
                targetPlayer.deathTime = Date.now();

                io.emit('playerDied', {
                    playerId: targetId!,
                    killedBy: illusion.casterId,
                    respawnDelay: GAME_CONFIG.PLAYER.RESPAWN_DELAY_MS,
                });

                endRatIllusion(targetId!, io, 'killed');
            }
        }, 1000); // 1초마다 체력 감소 체크

        activeIllusions.set(targetId, illusion);

        // 자동 종료 타이머 (지속 시간 후)
        setTimeout(() => {
            if (activeIllusions.has(targetId!)) {
                endRatIllusion(targetId!, io, 'timeout');
            }
        }, GAME_CONFIG.SKILL_RAT_ILLUSION.DURATION_MS);

        // 타겟에게 쥐 환상 효과 전송 (진짜 쥐 인덱스는 보내지 않음!)
        io.to(targetId).emit('ratIllusionStart', {
            casterId: socket.id,
            casterX: caster.x,
            casterY: caster.y,
            ratCount: GAME_CONFIG.SKILL_RAT_ILLUSION.RAT_COUNT,
            duration: GAME_CONFIG.SKILL_RAT_ILLUSION.DURATION_MS,
            radius: GAME_CONFIG.SKILL_RAT_ILLUSION.EFFECT_RADIUS,
        });

        // 시전자에게 확인 메시지
        socket.emit('ratIllusionCast', {
            targetId,
            duration: GAME_CONFIG.SKILL_RAT_ILLUSION.DURATION_MS,
        });

        // 다른 플레이어에게도 시각 효과 (구경꾼용)
        socket.broadcast.emit('ratIllusionEffect', {
            casterId: socket.id,
            targetId,
            casterX: caster.x,
            casterY: caster.y,
        });
    });

    // 쥐 클릭 (진짜 쥐를 찾았는지 체크)
    socket.on('ratClick', (data: { ratIndex: number }) => {
        const illusion = activeIllusions.get(socket.id);
        if (!illusion) {
            logger.debug(`Rat click from ${socket.id} but no active illusion`);
            return;
        }

        const { ratIndex } = data;

        if (ratIndex === illusion.realRatIndex) {
            // 진짜 쥐를 찾음! 효과 종료
            logger.info(`${socket.id} found the real rat! (index: ${ratIndex})`);
            endRatIllusion(socket.id, io, 'found');

            // 찾았다는 피드백
            io.to(socket.id).emit('ratIllusionSuccess', {
                message: '진짜 쥐를 찾았다!',
            });
        } else {
            // 가짜 쥐 클릭
            logger.debug(
                `${socket.id} clicked fake rat (index: ${ratIndex}, real: ${illusion.realRatIndex})`
            );

            io.to(socket.id).emit('ratIllusionFail', {
                clickedIndex: ratIndex,
                message: '가짜 쥐야!',
            });
        }
    });

    // 연결 종료 시 정리
    socket.on('disconnect', () => {
        // 이 플레이어에게 걸린 쥐 환상 정리
        if (activeIllusions.has(socket.id)) {
            endRatIllusion(socket.id, io, 'disconnect');
        }

        // 이 플레이어가 시전한 쥐 환상 정리
        activeIllusions.forEach((illusion, targetId) => {
            if (illusion.casterId === socket.id) {
                endRatIllusion(targetId, io, 'caster_disconnect');
            }
        });
    });
}
