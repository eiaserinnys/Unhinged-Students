// ========================================
// SHARD EVENT HANDLERS
// ========================================
import logger from '../../logger';
import { SERVER_CONFIG, SHARD_COLLECT_DISTANCE } from '../config';
import { isValidPositiveInt, calculateDistance } from '../validation';
import { players, shards } from '../gameState';
import type { TypedSocket, TypedServer, CollectShardData } from '../types';

export function registerShardHandlers(socket: TypedSocket, io: TypedServer): void {
    // Handle shard collection
    socket.on('collectShard', (data: CollectShardData) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Dead players cannot collect shards
        if (player.isDead) return;

        // === INPUT VALIDATION ===
        // Validate shardId type
        if (!isValidPositiveInt(data.shardId, 10000)) {
            logger.cheat(`Invalid shardId from ${socket.id}: ${data.shardId}`);
            return;
        }

        const shard = shards.get(data.shardId);

        if (shard && !shard.collected) {
            // Verify player is close enough to collect (anti-cheat: prevent remote collection)
            const distance = calculateDistance(player.x, player.y, shard.x, shard.y);
            if (distance > SHARD_COLLECT_DISTANCE) {
                logger.cheat(
                    `Remote shard collection attempt from ${socket.id}: distance=${distance.toFixed(1)}px (max: ${SHARD_COLLECT_DISTANCE}px)`
                );
                return;
            }

            shard.collected = true;
            shard.collectedTime = Date.now();
            // Random respawn delay between 3-5 seconds (3000-5000ms)
            shard.respawnDelay =
                SERVER_CONFIG.SHARD.RESPAWN_MIN_MS +
                Math.random() * SERVER_CONFIG.SHARD.RESPAWN_VARIANCE_MS;
            logger.debug(
                `Player ${socket.id} collected shard ${data.shardId} (will respawn in ${Math.round(shard.respawnDelay / 1000)}s)`
            );

            // Broadcast to all players
            io.emit('shardCollected', {
                shardId: data.shardId,
                playerId: socket.id,
            });
        }
    });
}
