/**
 * @fileoverview Doll Hug Shield handler (Squeak-Squeak R skill)
 * 인형 안고 자기: 쥐 모양 방어막 생성. SHIELD_HP만큼 피해를 흡수.
 * 방어막이 깨지거나 시간이 지나면 해제.
 */
import logger from '../../../logger';
import { GAME_CONFIG } from '../../../shared/config';
import { players } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

// 활성화된 방어막 추적
interface ActiveShield {
    casterId: string;
    shieldHP: number;
    maxShieldHP: number;
    expiresAt: number;
    expiryTimer: ReturnType<typeof setTimeout>;
}

const activeShields = new Map<string, ActiveShield>();

/**
 * 방어막 해제
 */
function endShield(playerId: string, io: TypedServer, reason: string): void {
    const shield = activeShields.get(playerId);
    if (!shield) return;

    clearTimeout(shield.expiryTimer);
    activeShields.delete(playerId);

    io.emit('dollHugShieldEnd', { playerId, reason });
    logger.debug(`Doll hug shield ended for ${playerId}: ${reason}`);
}

/**
 * 방어막이 피해를 흡수. 흡수한 만큼 반환.
 * 실제 받아야 할 피해 = damage - absorbed
 */
export function absorbShieldDamage(playerId: string, damage: number, io: TypedServer): number {
    const shield = activeShields.get(playerId);
    if (!shield) return damage;

    const absorbed = Math.min(shield.shieldHP, damage);
    shield.shieldHP -= absorbed;

    logger.debug(`Shield absorbed ${absorbed} for ${playerId}, ${shield.shieldHP}/${shield.maxShieldHP} remaining`);

    io.emit('dollHugShieldHit', {
        playerId,
        absorbed,
        shieldHP: shield.shieldHP,
        maxShieldHP: shield.maxShieldHP,
    });

    if (shield.shieldHP <= 0) {
        endShield(playerId, io, 'broken');
    }

    return damage - absorbed;
}

export function hasActiveShield(playerId: string): boolean {
    return activeShields.has(playerId);
}

export function registerDollHugHandlers(socket: TypedSocket, io: TypedServer): void {
    socket.on('dollHug', () => {
        const caster = players.get(socket.id);
        if (!caster || caster.isDead) return;

        // 이미 방어막 있으면 갱신
        if (activeShields.has(socket.id)) {
            endShield(socket.id, io, 'refreshed');
        }

        const expiryTimer = setTimeout(() => {
            endShield(socket.id, io, 'expired');
        }, GAME_CONFIG.SKILL_DOLL_HUG.DURATION_MS);

        const shield: ActiveShield = {
            casterId: socket.id,
            shieldHP: GAME_CONFIG.SKILL_DOLL_HUG.SHIELD_HP,
            maxShieldHP: GAME_CONFIG.SKILL_DOLL_HUG.SHIELD_HP,
            expiresAt: Date.now() + GAME_CONFIG.SKILL_DOLL_HUG.DURATION_MS,
            expiryTimer,
        };

        activeShields.set(socket.id, shield);

        logger.info(`Doll hug shield activated for ${socket.id} (HP: ${shield.shieldHP})`);

        io.emit('dollHugShieldStart', {
            playerId: socket.id,
            shieldHP: shield.shieldHP,
            maxShieldHP: shield.maxShieldHP,
            duration: GAME_CONFIG.SKILL_DOLL_HUG.DURATION_MS,
        });
    });

    socket.on('disconnect', () => {
        if (activeShields.has(socket.id)) {
            endShield(socket.id, io, 'disconnect');
        }
    });
}
