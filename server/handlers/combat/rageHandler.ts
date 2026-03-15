/**
 * @fileoverview Rage handlers (Hulk Sister E skill)
 */
import logger from '../../../logger';
import { SERVER_CONFIG, RATE_LIMIT_RAGE } from '../../config';
import { players, rateLimit } from '../../gameState';
import type { TypedSocket, TypedServer } from '../../types';

export function registerRageHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle rage start
    socket.on('rageStart', () => {
        if (!rateLimit(socket.id, 'rage', RATE_LIMIT_RAGE)) {
            return;
        }

        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        // Only hulk sister can use this skill
        if (player.characterId !== 'big-sis-hulk') {
            logger.cheat(`Non hulk-sister ${socket.id} tried to use rage`);
            return;
        }

        player.rageActive = true;
        player.rageStartTime = Date.now();

        // Clear any existing rage timeout
        if (player.rageTimeout) {
            clearTimeout(player.rageTimeout);
        }

        // Server-authoritative rage duration: auto-end after DURATION_MS
        const rageDuration = SERVER_CONFIG.SKILL_RAGE.DURATION_MS;
        player.rageTimeout = setTimeout(() => {
            const p = players.get(socket.id);
            if (p && p.rageActive) {
                p.rageActive = false;
                p.rageTimeout = undefined;
                logger.debug(`Rage auto-ended by server for ${socket.id}`);

                // Broadcast rage end to all players
                io.emit('playerRageEnd', {
                    playerId: socket.id,
                });
            }
        }, rageDuration);

        logger.debug(`Rage started by ${socket.id} (auto-end in ${rageDuration}ms)`);

        // Broadcast rage start
        socket.broadcast.emit('playerRageStart', {
            playerId: socket.id,
            duration: rageDuration,
        });
    });

    // Handle rage end (client-initiated early end)
    socket.on('rageEnd', () => {
        const player = players.get(socket.id);
        if (!player) return;

        player.rageActive = false;

        // Clear the server-side auto-end timer
        if (player.rageTimeout) {
            clearTimeout(player.rageTimeout);
            player.rageTimeout = undefined;
        }

        logger.debug(`Rage ended by ${socket.id}`);

        // Broadcast rage end
        socket.broadcast.emit('playerRageEnd', {
            playerId: socket.id,
        });
    });
}
