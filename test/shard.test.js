/**
 * Shard System Tests
 *
 * Tests for the shard (collectible item) system including:
 * - Particle class
 * - CollectEffect class
 * - Shard class
 * - ShardManager class
 */

// Mock Date.now for consistent timing tests
const mockNow = jest.spyOn(Date, 'now');
let currentTime = 1000000;
mockNow.mockImplementation(() => currentTime);

function advanceTime(ms) {
  currentTime += ms;
}

function resetTime() {
  currentTime = 1000000;
}

// ==================== Particle Class ====================

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;

    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.size = 4 + Math.random() * 4;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= this.decay;
    return this.life > 0;
  }
}

describe('Particle', () => {
  test('should create at given position', () => {
    const particle = new Particle(100, 200, '#00ffff');

    expect(particle.x).toBe(100);
    expect(particle.y).toBe(200);
    expect(particle.color).toBe('#00ffff');
  });

  test('should have random velocity', () => {
    const particle = new Particle(0, 0, '#ffffff');

    // Velocity should exist
    expect(typeof particle.vx).toBe('number');
    expect(typeof particle.vy).toBe('number');

    // Speed should be between 2 and 5
    const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    expect(speed).toBeGreaterThanOrEqual(2);
    expect(speed).toBeLessThanOrEqual(5);
  });

  test('should have size between 4 and 8', () => {
    const particle = new Particle(0, 0, '#ffffff');

    expect(particle.size).toBeGreaterThanOrEqual(4);
    expect(particle.size).toBeLessThanOrEqual(8);
  });

  test('should start with full life', () => {
    const particle = new Particle(0, 0, '#ffffff');
    expect(particle.life).toBe(1.0);
  });

  test('should update position on update', () => {
    const particle = new Particle(100, 100, '#ffffff');
    const initialX = particle.x;
    const initialY = particle.y;

    particle.update();

    expect(particle.x).not.toBe(initialX);
    expect(particle.y).not.toBe(initialY);
  });

  test('should decrease life on update', () => {
    const particle = new Particle(0, 0, '#ffffff');
    particle.update();

    expect(particle.life).toBeLessThan(1.0);
  });

  test('should apply friction to velocity', () => {
    const particle = new Particle(0, 0, '#ffffff');
    const initialVx = particle.vx;
    const initialVy = particle.vy;

    particle.update();

    expect(Math.abs(particle.vx)).toBeLessThan(Math.abs(initialVx));
    expect(Math.abs(particle.vy)).toBeLessThan(Math.abs(initialVy));
  });

  test('should return false when dead', () => {
    const particle = new Particle(0, 0, '#ffffff');
    particle.life = 0.01;
    particle.decay = 0.02;

    const alive = particle.update();

    expect(alive).toBe(false);
  });

  test('should return true while alive', () => {
    const particle = new Particle(0, 0, '#ffffff');
    const alive = particle.update();

    expect(alive).toBe(true);
  });
});

// ==================== CollectEffect Class ====================

class CollectEffect {
  constructor(x, y, color = '#00ffff') {
    this.particles = [];
    this.active = true;

    for (let i = 0; i < 20; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  update() {
    this.particles = this.particles.filter((p) => p.update());

    if (this.particles.length === 0) {
      this.active = false;
    }
  }
}

describe('CollectEffect', () => {
  test('should create 20 particles', () => {
    const effect = new CollectEffect(100, 100);

    expect(effect.particles.length).toBe(20);
  });

  test('should be active initially', () => {
    const effect = new CollectEffect(100, 100);

    expect(effect.active).toBe(true);
  });

  test('should use default color', () => {
    const effect = new CollectEffect(100, 100);

    expect(effect.particles[0].color).toBe('#00ffff');
  });

  test('should use custom color', () => {
    const effect = new CollectEffect(100, 100, '#ff0000');

    expect(effect.particles[0].color).toBe('#ff0000');
  });

  test('should create particles at given position', () => {
    const effect = new CollectEffect(200, 300);

    effect.particles.forEach((p) => {
      // Particles start at effect position, then move
      // After creation, they should be near the origin
      expect(p.x).toBe(200);
      expect(p.y).toBe(300);
    });
  });

  test('should remove dead particles on update', () => {
    const effect = new CollectEffect(100, 100);

    // Kill some particles
    for (let i = 0; i < 5; i++) {
      effect.particles[i].life = -1;
    }

    effect.update();

    expect(effect.particles.length).toBeLessThan(20);
  });

  test('should deactivate when all particles dead', () => {
    const effect = new CollectEffect(100, 100);

    // Kill all particles
    effect.particles.forEach((p) => {
      p.life = -1;
    });

    effect.update();

    expect(effect.active).toBe(false);
  });
});

// ==================== Shard Class ====================

class Shard {
  constructor(x, y, size = 20, id = null) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.id = id;
    this.collected = false;
    this.color = '#00ffff';
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update() {
    this.pulsePhase += 0.05;
  }

  checkCollision(character) {
    if (this.collected) return false;

    const dx = this.x - character.x;
    const dy = this.y - character.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const collisionDistance = character.width / 2 + this.size;

    return distance < collisionDistance;
  }

  collect() {
    this.collected = true;
  }
}

describe('Shard', () => {
  describe('constructor', () => {
    test('should create at given position', () => {
      const shard = new Shard(100, 200);

      expect(shard.x).toBe(100);
      expect(shard.y).toBe(200);
    });

    test('should have default size of 20', () => {
      const shard = new Shard(0, 0);

      expect(shard.size).toBe(20);
    });

    test('should accept custom size', () => {
      const shard = new Shard(0, 0, 30);

      expect(shard.size).toBe(30);
    });

    test('should accept server ID', () => {
      const shard = new Shard(0, 0, 20, 'shard-123');

      expect(shard.id).toBe('shard-123');
    });

    test('should not be collected initially', () => {
      const shard = new Shard(0, 0);

      expect(shard.collected).toBe(false);
    });

    test('should have cyan color', () => {
      const shard = new Shard(0, 0);

      expect(shard.color).toBe('#00ffff');
    });
  });

  describe('update', () => {
    test('should advance pulse phase', () => {
      const shard = new Shard(0, 0);
      const initialPhase = shard.pulsePhase;

      shard.update();

      expect(shard.pulsePhase).toBe(initialPhase + 0.05);
    });
  });

  describe('checkCollision', () => {
    test('should detect collision with character', () => {
      const shard = new Shard(100, 100);
      const character = { x: 110, y: 100, width: 50 };

      expect(shard.checkCollision(character)).toBe(true);
    });

    test('should not detect collision when far away', () => {
      const shard = new Shard(100, 100);
      const character = { x: 500, y: 500, width: 50 };

      expect(shard.checkCollision(character)).toBe(false);
    });

    test('should not collide when already collected', () => {
      const shard = new Shard(100, 100);
      shard.collected = true;
      const character = { x: 100, y: 100, width: 50 };

      expect(shard.checkCollision(character)).toBe(false);
    });

    test('should use character width and shard size for collision', () => {
      const shard = new Shard(100, 100, 20);
      const character = { x: 100, y: 100, width: 100 }; // 50 radius

      // Distance 0, collision threshold = 50 + 20 = 70
      expect(shard.checkCollision(character)).toBe(true);
    });

    test('should handle diagonal distance correctly', () => {
      const shard = new Shard(0, 0, 20);
      const character = { x: 50, y: 50, width: 50 }; // 25 radius

      // Distance = sqrt(50^2 + 50^2) = ~70.7
      // Collision threshold = 25 + 20 = 45
      // Should NOT collide
      expect(shard.checkCollision(character)).toBe(false);
    });
  });

  describe('collect', () => {
    test('should set collected to true', () => {
      const shard = new Shard(0, 0);
      shard.collect();

      expect(shard.collected).toBe(true);
    });
  });
});

// ==================== ShardManager Class ====================

class ShardManager {
  constructor() {
    this.shards = [];
    this.effects = [];
    this.maxActiveShards = 40;
    this.maxActiveEffects = 10;
    this.respawnInterval = 5000;
    this.lastRespawnTime = Date.now();
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.serverMode = false;
  }

  loadShardsFromServer(shardData) {
    this.shards = [];
    shardData.forEach((data) => {
      this.shards.push(new Shard(data.x, data.y, 20, data.id));
    });
  }

  addShardsFromServer(shardData) {
    shardData.forEach((data) => {
      const existingIndex = this.shards.findIndex((s) => s.id === data.id);
      if (existingIndex !== -1) {
        this.shards[existingIndex].collected = false;
        this.shards[existingIndex].x = data.x;
        this.shards[existingIndex].y = data.y;
      } else {
        this.shards.push(new Shard(data.x, data.y, 20, data.id));
      }
    });
  }

  removeShard(shardId) {
    const shard = this.shards.find((s) => s.id === shardId);
    if (shard && !shard.collected) {
      shard.collected = true;
      if (this.effects.length < this.maxActiveEffects) {
        this.effects.push(new CollectEffect(shard.x, shard.y, shard.color));
      }
    }
  }

  enableServerMode() {
    this.serverMode = true;
  }

  spawnShards(count, canvasWidth, canvasHeight, margin = 100) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    for (let i = 0; i < count; i++) {
      const x = margin + Math.random() * (canvasWidth - margin * 2);
      const y = margin + Math.random() * (canvasHeight - margin * 2);
      this.shards.push(new Shard(x, y));
    }
  }

  spawnSingleShard(margin = 100) {
    if (this.canvasWidth === 0 || this.canvasHeight === 0) return;

    const x = margin + Math.random() * (this.canvasWidth - margin * 2);
    const y = margin + Math.random() * (this.canvasHeight - margin * 2);
    this.shards.push(new Shard(x, y));
  }

  update() {
    this.shards.forEach((shard) => shard.update());
    this.effects.forEach((effect) => effect.update());
    this.effects = this.effects.filter((effect) => effect.active);
  }

  checkCollisions(character) {
    const collectedShards = [];

    this.shards.forEach((shard) => {
      if (shard.checkCollision(character)) {
        shard.collect();
        collectedShards.push(shard);

        if (this.effects.length < this.maxActiveEffects) {
          this.effects.push(new CollectEffect(shard.x, shard.y, shard.color));
        }
      }
    });

    return collectedShards;
  }

  getActiveShardCount() {
    return this.shards.filter((s) => !s.collected).length;
  }

  getTotalShardCount() {
    return this.shards.length;
  }

  clear() {
    this.shards = [];
  }
}

describe('ShardManager', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should start with empty shards', () => {
      const manager = new ShardManager();

      expect(manager.shards.length).toBe(0);
    });

    test('should have default settings', () => {
      const manager = new ShardManager();

      expect(manager.maxActiveShards).toBe(40);
      expect(manager.respawnInterval).toBe(5000);
      expect(manager.serverMode).toBe(false);
    });
  });

  describe('spawnShards', () => {
    test('should spawn specified number of shards', () => {
      const manager = new ShardManager();
      manager.spawnShards(10, 1920, 1080);

      expect(manager.shards.length).toBe(10);
    });

    test('should spawn within bounds', () => {
      const manager = new ShardManager();
      manager.spawnShards(100, 1920, 1080, 100);

      manager.shards.forEach((shard) => {
        expect(shard.x).toBeGreaterThanOrEqual(100);
        expect(shard.x).toBeLessThanOrEqual(1820);
        expect(shard.y).toBeGreaterThanOrEqual(100);
        expect(shard.y).toBeLessThanOrEqual(980);
      });
    });

    test('should store canvas dimensions', () => {
      const manager = new ShardManager();
      manager.spawnShards(1, 1920, 1080);

      expect(manager.canvasWidth).toBe(1920);
      expect(manager.canvasHeight).toBe(1080);
    });
  });

  describe('spawnSingleShard', () => {
    test('should spawn one shard', () => {
      const manager = new ShardManager();
      manager.canvasWidth = 1920;
      manager.canvasHeight = 1080;

      manager.spawnSingleShard();

      expect(manager.shards.length).toBe(1);
    });

    test('should not spawn if canvas dimensions not set', () => {
      const manager = new ShardManager();
      manager.spawnSingleShard();

      expect(manager.shards.length).toBe(0);
    });
  });

  describe('loadShardsFromServer', () => {
    test('should replace all shards', () => {
      const manager = new ShardManager();
      manager.spawnShards(5, 1920, 1080);

      const serverData = [
        { x: 100, y: 100, id: 'server-1' },
        { x: 200, y: 200, id: 'server-2' },
      ];

      manager.loadShardsFromServer(serverData);

      expect(manager.shards.length).toBe(2);
      expect(manager.shards[0].id).toBe('server-1');
    });
  });

  describe('addShardsFromServer', () => {
    test('should add new shards', () => {
      const manager = new ShardManager();

      manager.addShardsFromServer([{ x: 100, y: 100, id: 'new-1' }]);

      expect(manager.shards.length).toBe(1);
    });

    test('should reactivate existing shards', () => {
      const manager = new ShardManager();
      manager.loadShardsFromServer([{ x: 100, y: 100, id: 'shard-1' }]);
      manager.shards[0].collected = true;

      manager.addShardsFromServer([{ x: 200, y: 200, id: 'shard-1' }]);

      expect(manager.shards[0].collected).toBe(false);
      expect(manager.shards[0].x).toBe(200);
    });
  });

  describe('removeShard', () => {
    test('should mark shard as collected', () => {
      const manager = new ShardManager();
      manager.loadShardsFromServer([{ x: 100, y: 100, id: 'remove-me' }]);

      manager.removeShard('remove-me');

      expect(manager.shards[0].collected).toBe(true);
    });

    test('should create collection effect', () => {
      const manager = new ShardManager();
      manager.loadShardsFromServer([{ x: 100, y: 100, id: 'remove-me' }]);

      manager.removeShard('remove-me');

      expect(manager.effects.length).toBe(1);
    });

    test('should cap effects at maxActiveEffects', () => {
      const manager = new ShardManager();
      manager.maxActiveEffects = 2;

      for (let i = 0; i < 5; i++) {
        manager.loadShardsFromServer([{ x: 100, y: 100, id: `shard-${i}` }]);
        manager.removeShard(`shard-${i}`);
      }

      expect(manager.effects.length).toBeLessThanOrEqual(2);
    });
  });

  describe('enableServerMode', () => {
    test('should set serverMode to true', () => {
      const manager = new ShardManager();
      manager.enableServerMode();

      expect(manager.serverMode).toBe(true);
    });
  });

  describe('checkCollisions', () => {
    test('should return collected shards', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(100, 100));

      const character = { x: 100, y: 100, width: 50 };
      const collected = manager.checkCollisions(character);

      expect(collected.length).toBe(1);
    });

    test('should mark shards as collected', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(100, 100));

      const character = { x: 100, y: 100, width: 50 };
      manager.checkCollisions(character);

      expect(manager.shards[0].collected).toBe(true);
    });

    test('should create effects on collection', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(100, 100));

      const character = { x: 100, y: 100, width: 50 };
      manager.checkCollisions(character);

      expect(manager.effects.length).toBe(1);
    });

    test('should return empty array if no collisions', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(100, 100));

      const character = { x: 500, y: 500, width: 50 };
      const collected = manager.checkCollisions(character);

      expect(collected.length).toBe(0);
    });
  });

  describe('getActiveShardCount', () => {
    test('should count only uncollected shards', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(0, 0));
      manager.shards.push(new Shard(100, 100));
      manager.shards[0].collected = true;

      expect(manager.getActiveShardCount()).toBe(1);
    });
  });

  describe('getTotalShardCount', () => {
    test('should count all shards', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(0, 0));
      manager.shards.push(new Shard(100, 100));
      manager.shards[0].collected = true;

      expect(manager.getTotalShardCount()).toBe(2);
    });
  });

  describe('clear', () => {
    test('should remove all shards', () => {
      const manager = new ShardManager();
      manager.spawnShards(10, 1920, 1080);
      manager.clear();

      expect(manager.shards.length).toBe(0);
    });
  });

  describe('update', () => {
    test('should update all shards', () => {
      const manager = new ShardManager();
      manager.shards.push(new Shard(0, 0));
      const initialPhase = manager.shards[0].pulsePhase;

      manager.update();

      expect(manager.shards[0].pulsePhase).not.toBe(initialPhase);
    });

    test('should remove inactive effects', () => {
      const manager = new ShardManager();
      const effect = new CollectEffect(0, 0);
      effect.active = false;
      manager.effects.push(effect);

      manager.update();

      expect(manager.effects.length).toBe(0);
    });
  });
});
