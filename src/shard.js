// Shard system - Collectible items for leveling up

class Shard {
    constructor(x, y, size = 20) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.collected = false;
        this.color = '#00ffff'; // Cyan color for shards
        this.pulsePhase = Math.random() * Math.PI * 2; // Random starting phase for animation
    }

    update() {
        // Pulse animation
        this.pulsePhase += 0.05;
    }

    render(ctx) {
        if (this.collected) return;

        // Pulse effect
        const pulseFactor = Math.sin(this.pulsePhase) * 0.2 + 1;
        const renderSize = this.size * pulseFactor;

        // Draw diamond shape
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4); // Rotate 45 degrees

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Fill
        ctx.fillStyle = this.color;
        ctx.fillRect(-renderSize / 2, -renderSize / 2, renderSize, renderSize);

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-renderSize / 2, -renderSize / 2, renderSize, renderSize);

        ctx.restore();
    }

    checkCollision(character) {
        if (this.collected) return false;

        const dx = this.x - character.x;
        const dy = this.y - character.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Collision radius (character bounds + shard size)
        const collisionDistance = (character.width / 2) + this.size;

        return distance < collisionDistance;
    }

    collect() {
        this.collected = true;
    }
}

// Shard manager
class ShardManager {
    constructor() {
        this.shards = [];
        this.maxActiveShards = 40; // Maximum shards on map at once
        this.respawnInterval = 5000; // 5 seconds in milliseconds
        this.lastRespawnTime = Date.now();
        this.canvasWidth = 0;
        this.canvasHeight = 0;
    }

    spawnShards(count, canvasWidth, canvasHeight, margin = 100) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (canvasWidth - margin * 2);
            const y = margin + Math.random() * (canvasHeight - margin * 2);
            this.shards.push(new Shard(x, y));
        }
        console.log(`Spawned ${count} shards`);
    }

    // Spawn a single shard at random location
    spawnSingleShard(margin = 100) {
        if (this.canvasWidth === 0 || this.canvasHeight === 0) return;

        const x = margin + Math.random() * (this.canvasWidth - margin * 2);
        const y = margin + Math.random() * (this.canvasHeight - margin * 2);
        this.shards.push(new Shard(x, y));
    }

    update() {
        this.shards.forEach(shard => shard.update());

        // Check for respawn
        const currentTime = Date.now();
        if (currentTime - this.lastRespawnTime >= this.respawnInterval) {
            this.checkRespawn();
            this.lastRespawnTime = currentTime;
        }
    }

    // Check and respawn shards if needed
    checkRespawn() {
        const activeCount = this.getActiveShardCount();

        if (activeCount < this.maxActiveShards) {
            // Spawn 5-10 shards randomly
            const spawnCount = Math.floor(Math.random() * 6) + 5; // 5-10
            const actualSpawnCount = Math.min(spawnCount, this.maxActiveShards - activeCount);

            for (let i = 0; i < actualSpawnCount; i++) {
                this.spawnSingleShard();
            }

            if (actualSpawnCount > 0) {
                console.log(`Respawned ${actualSpawnCount} shards (Active: ${activeCount + actualSpawnCount}/${this.maxActiveShards})`);
            }
        }
    }

    render(ctx) {
        this.shards.forEach(shard => shard.render(ctx));
    }

    checkCollisions(character) {
        const collectedShards = [];

        this.shards.forEach(shard => {
            if (shard.checkCollision(character)) {
                shard.collect();
                collectedShards.push(shard);
            }
        });

        return collectedShards;
    }

    getActiveShardCount() {
        return this.shards.filter(s => !s.collected).length;
    }

    getTotalShardCount() {
        return this.shards.length;
    }

    clear() {
        this.shards = [];
    }
}
