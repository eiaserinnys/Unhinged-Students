// Shard system - Collectible items for leveling up

// Particle for collection effect
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;

        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = GAME_CONFIG.PARTICLE.MIN_SPEED + Math.random() * GAME_CONFIG.PARTICLE.SPEED_VARIANCE;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Size and lifetime
        this.size = GAME_CONFIG.PARTICLE.MIN_SIZE + Math.random() * GAME_CONFIG.PARTICLE.SIZE_VARIANCE;
        this.life = 1.0; // 0.0 to 1.0
        this.decay = GAME_CONFIG.PARTICLE.MIN_DECAY + Math.random() * GAME_CONFIG.PARTICLE.DECAY_VARIANCE;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= GAME_CONFIG.PARTICLE.FRICTION;
        this.vy *= GAME_CONFIG.PARTICLE.FRICTION;
        this.life -= this.decay;
        return this.life > 0;
    }

    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Collection effect
class CollectEffect {
    constructor(x, y, color = GAME_CONFIG.SHARD.COLOR) {
        this.particles = [];
        this.active = true;

        // Create particles
        for (let i = 0; i < GAME_CONFIG.PARTICLE.COLLECT_COUNT; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    update() {
        // Update all particles and remove dead ones
        this.particles = this.particles.filter(p => p.update());

        // Deactivate when all particles are gone
        if (this.particles.length === 0) {
            this.active = false;
        }
    }

    render(ctx) {
        this.particles.forEach(p => p.render(ctx));
    }
}

class Shard {
    constructor(x, y, size = GAME_CONFIG.SHARD.SIZE, id = null) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.id = id; // Server-assigned ID
        this.collected = false;
        this.color = GAME_CONFIG.SHARD.COLOR;
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
        this.effects = []; // Collection effects
        this.maxActiveShards = GAME_CONFIG.SHARD.MAX_COUNT;
        this.maxActiveEffects = GAME_CONFIG.SHARD.MAX_EFFECTS;
        this.respawnInterval = GAME_CONFIG.SHARD.RESPAWN_INTERVAL_MS;
        this.lastRespawnTime = Date.now();
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.serverMode = false; // Whether to use server-synced shards
    }

    // Load shards from server
    loadShardsFromServer(shardData) {
        this.shards = [];
        shardData.forEach(data => {
            this.shards.push(new Shard(data.x, data.y, GAME_CONFIG.SHARD.SIZE, data.id));
        });
        logger.debug(`Loaded ${this.shards.length} shards from server`);
    }

    // Add shards from server spawn event (respawn)
    addShardsFromServer(shardData) {
        shardData.forEach(data => {
            // Check if shard already exists
            const existingIndex = this.shards.findIndex(s => s.id === data.id);
            if (existingIndex !== -1) {
                // Shard exists - reactivate it (respawn)
                this.shards[existingIndex].collected = false;
                this.shards[existingIndex].x = data.x;
                this.shards[existingIndex].y = data.y;
            } else {
                // New shard
                this.shards.push(new Shard(data.x, data.y, GAME_CONFIG.SHARD.SIZE, data.id));
            }
        });
    }

    // Remove shard by ID (server-synced)
    removeShard(shardId) {
        const shard = this.shards.find(s => s.id === shardId);
        if (shard && !shard.collected) {
            shard.collected = true;
            // Create effect (with cap to prevent performance issues)
            if (this.effects.length < this.maxActiveEffects) {
                this.effects.push(new CollectEffect(shard.x, shard.y, shard.color));
            }
        }
    }

    // Enable server mode
    enableServerMode() {
        this.serverMode = true;
        logger.debug('ShardManager: Server mode enabled');
    }

    spawnShards(count, canvasWidth, canvasHeight, margin = GAME_CONFIG.SHARD.SPAWN_MARGIN) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (canvasWidth - margin * 2);
            const y = margin + Math.random() * (canvasHeight - margin * 2);
            this.shards.push(new Shard(x, y));
        }
        logger.debug(`Spawned ${count} shards`);
    }

    // Spawn a single shard at random location
    spawnSingleShard(margin = GAME_CONFIG.SHARD.SPAWN_MARGIN) {
        if (this.canvasWidth === 0 || this.canvasHeight === 0) return;

        const x = margin + Math.random() * (this.canvasWidth - margin * 2);
        const y = margin + Math.random() * (this.canvasHeight - margin * 2);
        this.shards.push(new Shard(x, y));
    }

    update() {
        this.shards.forEach(shard => shard.update());

        // Update effects and remove inactive ones
        this.effects.forEach(effect => effect.update());
        this.effects = this.effects.filter(effect => effect.active);

        // Check for respawn (only in local mode)
        if (!this.serverMode) {
            const currentTime = Date.now();
            if (currentTime - this.lastRespawnTime >= this.respawnInterval) {
                this.checkRespawn();
                this.lastRespawnTime = currentTime;
            }
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
                logger.debug(`Respawned ${actualSpawnCount} shards (Active: ${activeCount + actualSpawnCount}/${this.maxActiveShards})`);
            }
        }
    }

    render(ctx) {
        // Render shards first
        this.shards.forEach(shard => shard.render(ctx));

        // Render effects on top
        this.effects.forEach(effect => effect.render(ctx));
    }

    checkCollisions(character) {
        const collectedShards = [];

        this.shards.forEach(shard => {
            if (shard.checkCollision(character)) {
                shard.collect();
                collectedShards.push(shard);

                // Create collection effect at shard position (with cap to prevent performance issues)
                if (this.effects.length < this.maxActiveEffects) {
                    this.effects.push(new CollectEffect(shard.x, shard.y, shard.color));
                }
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
