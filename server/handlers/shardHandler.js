// ========================================
// SHARD EVENT HANDLERS
// ========================================
const logger = require('../../logger');
const {
    SERVER_CONFIG,
    SHARD_COLLECT_DISTANCE,
} = require('../config');
const {
    isValidPositiveInt,
    calculateDistance,
} = require('../validation');
const {
    players,
    shards,
} = require('../gameState');

function registerShardHandlers(socket, io) {
    // Handle shard collection
    socket.on('collectShard', (data) => {
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
                logger.cheat(`Remote shard collection attempt from ${socket.id}: distance=${distance.toFixed(1)}px (max: ${SHARD_COLLECT_DISTANCE}px)`);
                return;
            }

            shard.collected = true;
            shard.collectedTime = Date.now();
            // Random respawn delay between 3-5 seconds (3000-5000ms)
            shard.respawnDelay = SERVER_CONFIG.SHARD.RESPAWN_MIN_MS + Math.random() * SERVER_CONFIG.SHARD.RESPAWN_VARIANCE_MS;
            logger.debug(`Player ${socket.id} collected shard ${data.shardId} (will respawn in ${Math.round(shard.respawnDelay/1000)}s)`);

            // Broadcast to all players
            io.emit('shardCollected', {
                shardId: data.shardId,
                playerId: socket.id
            });
        }
    });
}

module.exports = { registerShardHandlers };
