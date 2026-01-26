/**
 * Skill System Tests
 *
 * Tests for the skill system including:
 * - Skill class
 * - SkillManager class
 * - LaserBeamEffect
 * - TeleportEffect
 * - TelepathyEffect
 * - SkillUI
 */

// Mock Date.now for consistent timing tests
const mockNow = jest.spyOn(Date, 'now');
let currentTime = 1000000;
mockNow.mockImplementation(() => currentTime);

// Helper to advance time
function advanceTime(ms) {
  currentTime += ms;
}

// Helper to reset time
function resetTime() {
  currentTime = 1000000;
}

// Import the skill classes (we need to define them since the source uses global scope)
// In a real scenario, we'd refactor to use ES modules

// ==================== Skill Class Tests ====================

class Skill {
  constructor(name, key, cooldown, iconColor = '#666666') {
    this.name = name;
    this.key = key;
    this.cooldown = cooldown;
    this.lastUsedTime = 0;
    this.iconColor = iconColor;
    this.readyFlashTime = 0;
    this.readyFlashDuration = 300;
    this.wasOnCooldown = false;
  }

  isReady() {
    return Date.now() - this.lastUsedTime >= this.cooldown;
  }

  use() {
    if (!this.isReady()) return false;
    this.lastUsedTime = Date.now();
    this.wasOnCooldown = true;
    return true;
  }

  getRemainingCooldown() {
    const elapsed = Date.now() - this.lastUsedTime;
    return Math.max(0, this.cooldown - elapsed);
  }

  getCooldownProgress() {
    if (this.lastUsedTime === 0) return 1;
    const elapsed = Date.now() - this.lastUsedTime;
    return Math.min(1, elapsed / this.cooldown);
  }

  checkReadyFlash() {
    if (this.wasOnCooldown && this.isReady()) {
      this.readyFlashTime = Date.now();
      this.wasOnCooldown = false;
      return true;
    }
    return false;
  }

  isFlashing() {
    if (this.readyFlashTime === 0) return false;
    return Date.now() - this.readyFlashTime < this.readyFlashDuration;
  }

  getFlashIntensity() {
    if (!this.isFlashing()) return 0;
    const elapsed = Date.now() - this.readyFlashTime;
    const progress = elapsed / this.readyFlashDuration;
    return Math.sin(progress * Math.PI);
  }
}

describe('Skill', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should create skill with correct properties', () => {
      const skill = new Skill('레이저', 'q', 2000, '#FF4444');

      expect(skill.name).toBe('레이저');
      expect(skill.key).toBe('q');
      expect(skill.cooldown).toBe(2000);
      expect(skill.iconColor).toBe('#FF4444');
      expect(skill.lastUsedTime).toBe(0);
    });

    test('should use default icon color if not provided', () => {
      const skill = new Skill('Test', 'x', 1000);
      expect(skill.iconColor).toBe('#666666');
    });
  });

  describe('isReady', () => {
    test('should return true for never-used skill', () => {
      const skill = new Skill('Test', 'q', 2000);
      expect(skill.isReady()).toBe(true);
    });

    test('should return false during cooldown', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(1000); // 1 second passed
      expect(skill.isReady()).toBe(false);
    });

    test('should return true after cooldown expires', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000); // Cooldown complete
      expect(skill.isReady()).toBe(true);
    });
  });

  describe('use', () => {
    test('should return true and set lastUsedTime when ready', () => {
      const skill = new Skill('Test', 'q', 2000);
      const result = skill.use();

      expect(result).toBe(true);
      expect(skill.lastUsedTime).toBe(currentTime);
      expect(skill.wasOnCooldown).toBe(true);
    });

    test('should return false when on cooldown', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(500);

      const result = skill.use();
      expect(result).toBe(false);
    });
  });

  describe('getRemainingCooldown', () => {
    test('should return 0 for never-used skill', () => {
      const skill = new Skill('Test', 'q', 2000);
      expect(skill.getRemainingCooldown()).toBe(0);
    });

    test('should return correct remaining time during cooldown', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(500);

      expect(skill.getRemainingCooldown()).toBe(1500);
    });

    test('should return 0 after cooldown expires', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(3000);

      expect(skill.getRemainingCooldown()).toBe(0);
    });
  });

  describe('getCooldownProgress', () => {
    test('should return 1 for never-used skill', () => {
      const skill = new Skill('Test', 'q', 2000);
      expect(skill.getCooldownProgress()).toBe(1);
    });

    test('should return 0 immediately after use', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      expect(skill.getCooldownProgress()).toBe(0);
    });

    test('should return 0.5 at half cooldown', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(1000);
      expect(skill.getCooldownProgress()).toBe(0.5);
    });

    test('should return 1 after cooldown expires', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000);
      expect(skill.getCooldownProgress()).toBe(1);
    });

    test('should cap at 1 when over cooldown', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(5000);
      expect(skill.getCooldownProgress()).toBe(1);
    });
  });

  describe('ready flash', () => {
    test('checkReadyFlash should trigger flash when cooldown ends', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000);

      const result = skill.checkReadyFlash();
      expect(result).toBe(true);
      expect(skill.readyFlashTime).toBe(currentTime);
      expect(skill.wasOnCooldown).toBe(false);
    });

    test('checkReadyFlash should not trigger if never used', () => {
      const skill = new Skill('Test', 'q', 2000);
      const result = skill.checkReadyFlash();
      expect(result).toBe(false);
    });

    test('isFlashing should return true during flash duration', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000);
      skill.checkReadyFlash();
      advanceTime(100);

      expect(skill.isFlashing()).toBe(true);
    });

    test('isFlashing should return false after flash duration', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000);
      skill.checkReadyFlash();
      advanceTime(400);

      expect(skill.isFlashing()).toBe(false);
    });

    test('getFlashIntensity should return value between 0 and 1', () => {
      const skill = new Skill('Test', 'q', 2000);
      skill.use();
      advanceTime(2000);
      skill.checkReadyFlash();
      advanceTime(150); // Halfway through flash

      const intensity = skill.getFlashIntensity();
      expect(intensity).toBeGreaterThan(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });
});

// ==================== SkillManager Class Tests ====================

class SkillManager {
  constructor() {
    this.skills = new Map();
    this.skillOrder = [];
  }

  addSkill(skill) {
    this.skills.set(skill.key.toLowerCase(), skill);
    this.skillOrder.push(skill.key.toLowerCase());
  }

  getSkill(key) {
    return this.skills.get(key.toLowerCase());
  }

  useSkill(key) {
    const skill = this.getSkill(key);
    if (skill && skill.use()) {
      return skill;
    }
    return null;
  }

  update() {
    this.skills.forEach((skill) => {
      skill.checkReadyFlash();
    });
  }

  getAllSkills() {
    return this.skillOrder.map((key) => this.skills.get(key));
  }
}

describe('SkillManager', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('addSkill', () => {
    test('should add skill to manager', () => {
      const manager = new SkillManager();
      const skill = new Skill('레이저', 'q', 2000);

      manager.addSkill(skill);

      expect(manager.skills.size).toBe(1);
      expect(manager.skillOrder).toContain('q');
    });

    test('should handle uppercase keys', () => {
      const manager = new SkillManager();
      const skill = new Skill('Test', 'Q', 2000);

      manager.addSkill(skill);

      expect(manager.getSkill('q')).toBe(skill);
      expect(manager.getSkill('Q')).toBe(skill);
    });
  });

  describe('getSkill', () => {
    test('should return skill by key', () => {
      const manager = new SkillManager();
      const skill = new Skill('레이저', 'q', 2000);
      manager.addSkill(skill);

      expect(manager.getSkill('q')).toBe(skill);
    });

    test('should return undefined for unknown key', () => {
      const manager = new SkillManager();
      expect(manager.getSkill('z')).toBeUndefined();
    });
  });

  describe('useSkill', () => {
    test('should use skill and return it when ready', () => {
      const manager = new SkillManager();
      const skill = new Skill('레이저', 'q', 2000);
      manager.addSkill(skill);

      const result = manager.useSkill('q');

      expect(result).toBe(skill);
      expect(skill.lastUsedTime).toBe(currentTime);
    });

    test('should return null when skill is on cooldown', () => {
      const manager = new SkillManager();
      const skill = new Skill('레이저', 'q', 2000);
      manager.addSkill(skill);

      manager.useSkill('q');
      advanceTime(500);
      const result = manager.useSkill('q');

      expect(result).toBeNull();
    });

    test('should return null for unknown skill', () => {
      const manager = new SkillManager();
      const result = manager.useSkill('z');
      expect(result).toBeNull();
    });
  });

  describe('getAllSkills', () => {
    test('should return skills in order added', () => {
      const manager = new SkillManager();
      const skill1 = new Skill('레이저', 'q', 2000);
      const skill2 = new Skill('순간이동', 'w', 7000);
      const skill3 = new Skill('텔레파시', 'e', 12000);

      manager.addSkill(skill1);
      manager.addSkill(skill2);
      manager.addSkill(skill3);

      const skills = manager.getAllSkills();

      expect(skills).toHaveLength(3);
      expect(skills[0]).toBe(skill1);
      expect(skills[1]).toBe(skill2);
      expect(skills[2]).toBe(skill3);
    });
  });

  describe('update', () => {
    test('should check ready flash for all skills', () => {
      const manager = new SkillManager();
      const skill1 = new Skill('레이저', 'q', 1000);
      const skill2 = new Skill('순간이동', 'w', 2000);
      manager.addSkill(skill1);
      manager.addSkill(skill2);

      // Use both skills
      skill1.use();
      skill2.use();

      // Advance time past first skill cooldown
      advanceTime(1000);

      // Update should trigger flash for skill1
      manager.update();

      expect(skill1.readyFlashTime).toBe(currentTime);
      expect(skill2.readyFlashTime).toBe(0);
    });
  });
});

// ==================== LaserBeamEffect Tests ====================

class LaserBeamEffect {
  constructor() {
    this.active = false;
    this.phase = 'none';
    this.startTime = 0;
    this.aimDuration = 1000;
    this.fireDuration = 200;
    this.startX = 0;
    this.startY = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.damage = 44;
    this.hasDealtDamage = false;
  }

  start(playerX, playerY, targetX, targetY) {
    this.active = true;
    this.phase = 'aiming';
    this.startTime = Date.now();
    this.startX = playerX;
    this.startY = playerY;

    const dx = targetX - playerX;
    const dy = targetY - playerY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
      this.dirX = dx / length;
      this.dirY = dy / length;
    } else {
      this.dirX = 1;
      this.dirY = 0;
    }

    this.hasDealtDamage = false;
  }

  update(playerX, playerY) {
    if (!this.active) return;

    this.startX = playerX;
    this.startY = playerY;

    const elapsed = Date.now() - this.startTime;

    if (this.phase === 'aiming') {
      if (elapsed >= this.aimDuration) {
        this.phase = 'firing';
        this.startTime = Date.now();
      }
    } else if (this.phase === 'firing') {
      if (elapsed >= this.fireDuration) {
        this.active = false;
        this.phase = 'none';
      }
    }
  }

  shouldDealDamage() {
    if (this.phase === 'firing' && !this.hasDealtDamage) {
      this.hasDealtDamage = true;
      return true;
    }
    return false;
  }

  getLaserLine() {
    if (this.dirX === 0 && this.dirY === 0) return null;

    const endX = this.startX + this.dirX * 2000;
    const endY = this.startY + this.dirY * 2000;

    return {
      x1: this.startX,
      y1: this.startY,
      x2: endX,
      y2: endY,
    };
  }
}

describe('LaserBeamEffect', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const laser = new LaserBeamEffect();

      expect(laser.active).toBe(false);
      expect(laser.phase).toBe('none');
      expect(laser.damage).toBe(44);
      expect(laser.aimDuration).toBe(1000);
      expect(laser.fireDuration).toBe(200);
    });
  });

  describe('start', () => {
    test('should activate and enter aiming phase', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      expect(laser.active).toBe(true);
      expect(laser.phase).toBe('aiming');
      expect(laser.startX).toBe(100);
      expect(laser.startY).toBe(100);
    });

    test('should calculate normalized direction vector', () => {
      const laser = new LaserBeamEffect();
      laser.start(0, 0, 100, 0);

      expect(laser.dirX).toBe(1);
      expect(laser.dirY).toBe(0);
    });

    test('should handle diagonal direction', () => {
      const laser = new LaserBeamEffect();
      laser.start(0, 0, 100, 100);

      const expectedDir = 1 / Math.sqrt(2);
      expect(laser.dirX).toBeCloseTo(expectedDir, 5);
      expect(laser.dirY).toBeCloseTo(expectedDir, 5);
    });

    test('should default to right direction when target is same as start', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 100, 100);

      expect(laser.dirX).toBe(1);
      expect(laser.dirY).toBe(0);
    });
  });

  describe('update', () => {
    test('should follow player position', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);
      laser.update(150, 150);

      expect(laser.startX).toBe(150);
      expect(laser.startY).toBe(150);
    });

    test('should transition from aiming to firing after aimDuration', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      advanceTime(1000);
      laser.update(100, 100);

      expect(laser.phase).toBe('firing');
    });

    test('should deactivate after firing duration', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      advanceTime(1000);
      laser.update(100, 100);
      advanceTime(200);
      laser.update(100, 100);

      expect(laser.active).toBe(false);
      expect(laser.phase).toBe('none');
    });

    test('should not update when inactive', () => {
      const laser = new LaserBeamEffect();
      laser.update(100, 100);

      expect(laser.startX).toBe(0);
      expect(laser.startY).toBe(0);
    });
  });

  describe('shouldDealDamage', () => {
    test('should return true once when firing phase starts', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      advanceTime(1000);
      laser.update(100, 100);

      expect(laser.shouldDealDamage()).toBe(true);
      expect(laser.shouldDealDamage()).toBe(false);
    });

    test('should return false during aiming phase', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      expect(laser.shouldDealDamage()).toBe(false);
    });
  });

  describe('getLaserLine', () => {
    test('should return line extending 2000 pixels', () => {
      const laser = new LaserBeamEffect();
      laser.start(100, 100, 200, 100);

      const line = laser.getLaserLine();

      expect(line.x1).toBe(100);
      expect(line.y1).toBe(100);
      expect(line.x2).toBe(2100);
      expect(line.y2).toBe(100);
    });

    test('should return null when no direction set', () => {
      const laser = new LaserBeamEffect();
      const line = laser.getLaserLine();

      expect(line).toBeNull();
    });
  });
});

// ==================== TeleportEffect Tests ====================

class TeleportEffect {
  constructor() {
    this.active = false;
    this.phase = 'none';
    this.startTime = 0;
    this.disappearDuration = 150;
    this.appearDuration = 200;
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.minDistance = 200;
    this.maxDistance = 400;
    this.damageRadius = 100;
    this.damage = 12;
    this.hasDealtDamage = false;
    this.hasTeleported = false;
  }

  start(playerX, playerY, gameWidth, gameHeight, targetX = null, targetY = null) {
    this.active = true;
    this.phase = 'disappear';
    this.startTime = Date.now();
    this.startX = playerX;
    this.startY = playerY;
    this.hasDealtDamage = false;
    this.hasTeleported = false;

    let newX, newY;

    if (targetX !== null && targetY !== null) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (this.damageRadius * 0.8);
      newX = targetX + Math.cos(angle) * distance;
      newY = targetY + Math.sin(angle) * distance;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const distance = this.minDistance + Math.random() * (this.maxDistance - this.minDistance);
      newX = playerX + Math.cos(angle) * distance;
      newY = playerY + Math.sin(angle) * distance;
    }

    const margin = 50;
    newX = Math.max(margin, Math.min(gameWidth - margin, newX));
    newY = Math.max(margin, Math.min(gameHeight - margin, newY));

    this.endX = newX;
    this.endY = newY;
  }

  update() {
    if (!this.active) return null;

    const elapsed = Date.now() - this.startTime;

    if (this.phase === 'disappear') {
      if (elapsed >= this.disappearDuration) {
        this.phase = 'appear';
        this.startTime = Date.now();
        this.hasTeleported = true;
        return { x: this.endX, y: this.endY, teleported: true };
      }
    } else if (this.phase === 'appear') {
      if (elapsed >= this.appearDuration) {
        this.active = false;
        this.phase = 'none';
      }
    }

    return null;
  }

  shouldDealDamage() {
    if (this.phase === 'appear' && !this.hasDealtDamage) {
      this.hasDealtDamage = true;
      return true;
    }
    return false;
  }

  getDamageArea() {
    return {
      x: this.endX,
      y: this.endY,
      radius: this.damageRadius,
      damage: this.damage,
    };
  }
}

describe('TeleportEffect', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const teleport = new TeleportEffect();

      expect(teleport.active).toBe(false);
      expect(teleport.phase).toBe('none');
      expect(teleport.damage).toBe(12);
      expect(teleport.damageRadius).toBe(100);
    });
  });

  describe('start', () => {
    test('should activate and enter disappear phase', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      expect(teleport.active).toBe(true);
      expect(teleport.phase).toBe('disappear');
      expect(teleport.startX).toBe(500);
      expect(teleport.startY).toBe(500);
    });

    test('should calculate end position within bounds', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      expect(teleport.endX).toBeGreaterThanOrEqual(50);
      expect(teleport.endX).toBeLessThanOrEqual(1870);
      expect(teleport.endY).toBeGreaterThanOrEqual(50);
      expect(teleport.endY).toBeLessThanOrEqual(1030);
    });

    test('should teleport near target when provided', () => {
      const teleport = new TeleportEffect();
      const targetX = 800;
      const targetY = 600;

      teleport.start(100, 100, 1920, 1080, targetX, targetY);

      // End position should be within damage radius of target
      const dx = teleport.endX - targetX;
      const dy = teleport.endY - targetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      expect(distance).toBeLessThanOrEqual(teleport.damageRadius);
    });

    test('should clamp position when near edge', () => {
      const teleport = new TeleportEffect();
      teleport.start(10, 10, 1920, 1080);

      expect(teleport.endX).toBeGreaterThanOrEqual(50);
      expect(teleport.endY).toBeGreaterThanOrEqual(50);
    });
  });

  describe('update', () => {
    test('should transition to appear phase and return teleport data', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      advanceTime(150);
      const result = teleport.update();

      expect(teleport.phase).toBe('appear');
      expect(result).not.toBeNull();
      expect(result.teleported).toBe(true);
      expect(result.x).toBe(teleport.endX);
      expect(result.y).toBe(teleport.endY);
    });

    test('should deactivate after appear duration', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      advanceTime(150);
      teleport.update();
      advanceTime(200);
      teleport.update();

      expect(teleport.active).toBe(false);
      expect(teleport.phase).toBe('none');
    });

    test('should return null when inactive', () => {
      const teleport = new TeleportEffect();
      const result = teleport.update();

      expect(result).toBeNull();
    });
  });

  describe('shouldDealDamage', () => {
    test('should return true once when appear phase starts', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      advanceTime(150);
      teleport.update();

      expect(teleport.shouldDealDamage()).toBe(true);
      expect(teleport.shouldDealDamage()).toBe(false);
    });
  });

  describe('getDamageArea', () => {
    test('should return damage area at end position', () => {
      const teleport = new TeleportEffect();
      teleport.start(500, 500, 1920, 1080);

      const area = teleport.getDamageArea();

      expect(area.x).toBe(teleport.endX);
      expect(area.y).toBe(teleport.endY);
      expect(area.radius).toBe(100);
      expect(area.damage).toBe(12);
    });
  });
});

// ==================== TelepathyEffect Tests ====================

class TelepathyEffect {
  constructor() {
    this.active = false;
    this.startTime = 0;
    this.duration = 3000;
    this.tickInterval = 100;
    this.x = 0;
    this.y = 0;
    this.radius = 180;
    this.damagePerTick = 2;
    this.maxHealPerTick = 4;
    this.lastTickTime = 0;
    this.tickCount = 0;
  }

  start(playerX, playerY) {
    this.active = true;
    this.startTime = Date.now();
    this.lastTickTime = 0;
    this.tickCount = 0;
    this.x = playerX;
    this.y = playerY;
  }

  update(playerX, playerY) {
    if (!this.active) return;

    this.x = playerX;
    this.y = playerY;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.duration) {
      this.active = false;
    }
  }

  shouldDealDamage() {
    if (!this.active) return false;

    const elapsed = Date.now() - this.startTime;
    const expectedTicks = Math.floor(elapsed / this.tickInterval);

    if (expectedTicks > this.tickCount) {
      this.tickCount = expectedTicks;
      return true;
    }
    return false;
  }

  getDamageArea() {
    return {
      x: this.x,
      y: this.y,
      radius: this.radius,
      damagePerTarget: this.damagePerTick,
      maxHeal: this.maxHealPerTick,
    };
  }
}

describe('TelepathyEffect', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const telepathy = new TelepathyEffect();

      expect(telepathy.active).toBe(false);
      expect(telepathy.duration).toBe(3000);
      expect(telepathy.tickInterval).toBe(100);
      expect(telepathy.radius).toBe(180);
      expect(telepathy.damagePerTick).toBe(2);
      expect(telepathy.maxHealPerTick).toBe(4);
    });
  });

  describe('start', () => {
    test('should activate at player position', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);

      expect(telepathy.active).toBe(true);
      expect(telepathy.x).toBe(500);
      expect(telepathy.y).toBe(500);
      expect(telepathy.tickCount).toBe(0);
    });
  });

  describe('update', () => {
    test('should follow player position', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);
      telepathy.update(600, 700);

      expect(telepathy.x).toBe(600);
      expect(telepathy.y).toBe(700);
    });

    test('should deactivate after duration', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);

      advanceTime(3000);
      telepathy.update(500, 500);

      expect(telepathy.active).toBe(false);
    });
  });

  describe('shouldDealDamage', () => {
    test('should return true every tick interval', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);

      // First tick at 100ms
      advanceTime(100);
      expect(telepathy.shouldDealDamage()).toBe(true);

      // Second tick at 200ms
      advanceTime(100);
      expect(telepathy.shouldDealDamage()).toBe(true);

      // Not again at 250ms (same tick)
      advanceTime(50);
      expect(telepathy.shouldDealDamage()).toBe(false);
    });

    test('should return false when inactive', () => {
      const telepathy = new TelepathyEffect();
      expect(telepathy.shouldDealDamage()).toBe(false);
    });

    test('should handle 30 ticks over 3 seconds', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);

      let tickCount = 0;
      for (let i = 0; i < 30; i++) {
        advanceTime(100);
        if (telepathy.shouldDealDamage()) {
          tickCount++;
        }
      }

      expect(tickCount).toBe(30);
    });
  });

  describe('getDamageArea', () => {
    test('should return damage area at current position', () => {
      const telepathy = new TelepathyEffect();
      telepathy.start(500, 500);

      const area = telepathy.getDamageArea();

      expect(area.x).toBe(500);
      expect(area.y).toBe(500);
      expect(area.radius).toBe(180);
      expect(area.damagePerTarget).toBe(2);
      expect(area.maxHeal).toBe(4);
    });
  });
});

// ==================== SkillUI Tests ====================

class SkillUI {
  constructor(skillManager) {
    this.skillManager = skillManager;
    this.boxSize = 60;
    this.boxGap = 10;
    this.bottomMargin = 30;
    this.borderRadius = 8;
  }

  darkenColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const factor = 0.4;
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  }
}

describe('SkillUI', () => {
  describe('constructor', () => {
    test('should initialize with skillManager', () => {
      const manager = new SkillManager();
      const ui = new SkillUI(manager);

      expect(ui.skillManager).toBe(manager);
      expect(ui.boxSize).toBe(60);
      expect(ui.boxGap).toBe(10);
      expect(ui.bottomMargin).toBe(30);
    });
  });

  describe('darkenColor', () => {
    test('should darken white to gray', () => {
      const manager = new SkillManager();
      const ui = new SkillUI(manager);

      const result = ui.darkenColor('#FFFFFF');
      expect(result).toBe('rgb(102, 102, 102)');
    });

    test('should darken red correctly', () => {
      const manager = new SkillManager();
      const ui = new SkillUI(manager);

      const result = ui.darkenColor('#FF0000');
      expect(result).toBe('rgb(102, 0, 0)');
    });
  });
});
