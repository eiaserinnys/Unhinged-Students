/**
 * @fileoverview Curry recovery handler (Curry-Bear E skill)
 */
import logger from '../../../logger';
import { RATE_LIMIT_CURRY_RECOVERY, CURRY_RECOVERY_MAX_STORED } from '../../config';
import { players, rateLimit } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

export function registerCurryHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle curry recovery
    socket.on('curryRecovery', () => {
        if (!rateLimit(socket.id, 'curryRecovery', RATE_LIMIT_CURRY_RECOVERY)) {
            return;
        }

        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        logger.info(
            `Curry recovery attempt by ${socket.id}, characterId: ${player.characterId}, storedDamage: ${player.storedDamage}`
        );

        // Only curry-bear can use this skill
        if (player.characterId !== 'curry-bear') {
            logger.info(
                `Non curry-bear ${socket.id} (${player.characterId}) tried to use curry recovery`
            );
            return;
        }

        const storedDamage = player.storedDamage || 0;
        if (storedDamage <= 0) {
            logger.debug(`${socket.id} tried to use curry recovery with no stored damage`);
            return;
        }

        // Heal by stored damage amount
        const healAmount = storedDamage;
        const oldHP = player.currentHP;
        player.currentHP = Math.min(player.maxHP, player.currentHP + healAmount);
        const actualHeal = player.currentHP - oldHP;

        // Reset stored damage
        player.storedDamage = 0;

        logger.debug(`Curry recovery: ${socket.id} healed ${actualHeal} (stored: ${storedDamage})`);

        // Broadcast recovery effect to all players
        io.emit('playerCurryRecovery', {
            playerId: socket.id,
            healAmount: actualHeal,
            currentHP: player.currentHP,
            maxHP: player.maxHP,
        });
    });

    // Handle stored damage sync request (for UI display)
    socket.on('requestStoredDamage', () => {
        const player = players.get(socket.id);
        if (!player) return;

        socket.emit('storedDamageUpdate', {
            storedDamage: player.storedDamage || 0,
            maxStored: CURRY_RECOVERY_MAX_STORED,
        });
    });
}
