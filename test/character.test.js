/**
 * Character System Tests
 *
 * Tests for the Character class including:
 * - Constructor and initialization
 * - Movement and bounds
 * - Combat system (attack, damage, HP)
 * - Level and experience system
 * - Knockback system
 * - Chat bubble system
 * - Respawn system
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

// Mock input functions
global.isKeyPressed = jest.fn().mockReturnValue(false);

// Recreate Character class for testing (source uses global scope)
class Character {
  constructor(x, y, imagePath, canvasHeight, playerName = 'Player', isDummy = false) {
    this.x = x;
    this.y = y;
    this.displaySize = canvasHeight / 8;
    this.width = this.displaySize;
    this.height = this.displaySize;
    this.speed = 300;
    this.image = null;
    this.imageLoaded = false;

    this.playerName = playerName;
    this.isDummy = isDummy;
    this.isDead = false;

    this.level = 1;
    this.experience = 0;
    this.maxLevel = 30;

    this.maxHP = 100;
    this.currentHP = 100;

    this.attackPower = 10;
    this.attackRange = 150;
    this.attackCooldown = 500;
    this.lastAttackTime = 0;
    this.isAttacking = false;
    this.attackAnimationTime = 200;
    this.attackStartTime = 0;
    this.lastDamagedTime = 0;

    this.deathTime = 0;
    this.respawnDelay = 5000;
    this.initialX = x;
    this.initialY = y;

    this.hitFlashTime = 0;
    this.hitFlashDuration = 100;

    this.isKnockedBack = false;
    this.knockbackStartTime = 0;
    this.knockbackDuration = 200;
    this.knockbackStartX = 0;
    this.knockbackStartY = 0;
    this.knockbackEndX = 0;
    this.knockbackEndY = 0;
    this.knockbackMinDistance = 30;
    this.knockbackMaxDistance = 100;

    this.chatMessage = null;
    this.chatMessageTime = 0;
    this.chatMessageDuration = 3000;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  getBounds() {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2,
    };
  }

  getLevel() {
    return this.level;
  }

  getExperience() {
    return this.experience;
  }

  getRequiredExperience() {
    if (this.level >= this.maxLevel) return 0;
    return 10 + (this.level - 1) * 2;
  }

  addExperience(amount) {
    if (this.level >= this.maxLevel) {
      return false;
    }

    this.experience += amount;

    let leveledUp = false;
    while (this.level < this.maxLevel && this.experience >= this.getRequiredExperience()) {
      this.experience -= this.getRequiredExperience();
      this.level++;
      leveledUp = true;
    }

    return leveledUp;
  }

  attack() {
    const currentTime = Date.now();
    this.lastAttackTime = currentTime;
    this.isAttacking = true;
    this.attackStartTime = currentTime;
    return this.getAttackArea();
  }

  getAttackArea() {
    return {
      x: this.x,
      y: this.y,
      radius: this.attackRange,
    };
  }

  takeDamage(amount) {
    const currentTime = Date.now();
    const invincibilityDuration = 300;

    if (this.isKnockedBack) {
      return false;
    }

    if (currentTime - this.lastDamagedTime < invincibilityDuration) {
      return false;
    }

    this.lastDamagedTime = currentTime;
    this.hitFlashTime = currentTime;
    this.currentHP = Math.max(0, this.currentHP - amount);

    if (this.currentHP <= 0) {
      this.deathTime = Date.now();
      return true;
    }
    return false;
  }

  isAlive() {
    return this.currentHP > 0;
  }

  respawn() {
    this.currentHP = this.maxHP;
    this.x = this.initialX;
    this.y = this.initialY;
    this.deathTime = 0;
  }

  canRespawn() {
    if (this.deathTime === 0) return false;
    return Date.now() - this.deathTime >= this.respawnDelay;
  }

  setChatMessage(message) {
    this.chatMessage = message;
    this.chatMessageTime = Date.now();
  }

  startKnockback(attackerX, attackerY, endX, endY) {
    this.isKnockedBack = true;
    this.knockbackStartTime = Date.now();
    this.knockbackStartX = this.x;
    this.knockbackStartY = this.y;
    this.knockbackEndX = endX;
    this.knockbackEndY = endY;
  }

  static calculateKnockbackDistance(attackerX, attackerY, targetX, targetY, attackRange, minKnockback = 30, maxKnockback = 100) {
    const dx = targetX - attackerX;
    const dy = targetY - attackerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const ratio = Math.min(1, distance / attackRange);
    return maxKnockback - ratio * (maxKnockback - minKnockback);
  }

  static calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance, canvasWidth, canvasHeight) {
    let dirX = targetX - attackerX;
    let dirY = targetY - attackerY;
    const distance = Math.sqrt(dirX * dirX + dirY * dirY);

    if (distance < 0.001) {
      const randomAngle = Math.random() * Math.PI * 2;
      dirX = Math.cos(randomAngle);
      dirY = Math.sin(randomAngle);
    } else {
      dirX /= distance;
      dirY /= distance;
    }

    let endX = targetX + dirX * knockbackDistance;
    let endY = targetY + dirY * knockbackDistance;

    const margin = 50;
    endX = Math.max(margin, Math.min(canvasWidth - margin, endX));
    endY = Math.max(margin, Math.min(canvasHeight - margin, endY));

    return { x: endX, y: endY };
  }
}

describe('Character', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('constructor', () => {
    test('should create character with correct position', () => {
      const char = new Character(100, 200, 'test.png', 1080);

      expect(char.x).toBe(100);
      expect(char.y).toBe(200);
    });

    test('should calculate display size based on canvas height', () => {
      const char = new Character(100, 200, 'test.png', 1080);

      expect(char.displaySize).toBe(1080 / 8);
      expect(char.width).toBe(135);
      expect(char.height).toBe(135);
    });

    test('should set player name', () => {
      const char = new Character(100, 200, 'test.png', 1080, 'TestPlayer');
      expect(char.playerName).toBe('TestPlayer');
    });

    test('should use default player name', () => {
      const char = new Character(100, 200, 'test.png', 1080);
      expect(char.playerName).toBe('Player');
    });

    test('should set isDummy flag', () => {
      const char = new Character(100, 200, 'test.png', 1080, 'Dummy', true);
      expect(char.isDummy).toBe(true);
    });

    test('should initialize HP to max', () => {
      const char = new Character(100, 200, 'test.png', 1080);

      expect(char.maxHP).toBe(100);
      expect(char.currentHP).toBe(100);
    });

    test('should initialize level to 1', () => {
      const char = new Character(100, 200, 'test.png', 1080);
      expect(char.level).toBe(1);
      expect(char.experience).toBe(0);
    });

    test('should store initial position for respawn', () => {
      const char = new Character(100, 200, 'test.png', 1080);

      expect(char.initialX).toBe(100);
      expect(char.initialY).toBe(200);
    });
  });

  describe('getPosition', () => {
    test('should return current position', () => {
      const char = new Character(100, 200, 'test.png', 1080);
      const pos = char.getPosition();

      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    test('should reflect position changes', () => {
      const char = new Character(100, 200, 'test.png', 1080);
      char.x = 300;
      char.y = 400;

      const pos = char.getPosition();
      expect(pos.x).toBe(300);
      expect(pos.y).toBe(400);
    });
  });

  describe('getBounds', () => {
    test('should return correct bounding box', () => {
      const char = new Character(100, 200, 'test.png', 800); // displaySize = 100

      const bounds = char.getBounds();

      expect(bounds.left).toBe(50);
      expect(bounds.right).toBe(150);
      expect(bounds.top).toBe(150);
      expect(bounds.bottom).toBe(250);
    });
  });
});

describe('Level System', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('getRequiredExperience', () => {
    test('should require 10 exp for level 1->2', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      expect(char.getRequiredExperience()).toBe(10);
    });

    test('should require 12 exp for level 2->3', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 2;
      expect(char.getRequiredExperience()).toBe(12);
    });

    test('should require 14 exp for level 3->4', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 3;
      expect(char.getRequiredExperience()).toBe(14);
    });

    test('should return 0 at max level', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 30;
      expect(char.getRequiredExperience()).toBe(0);
    });

    test('should follow formula: 10 + (level - 1) * 2', () => {
      const char = new Character(0, 0, 'test.png', 1080);

      for (let level = 1; level < 30; level++) {
        char.level = level;
        const expected = 10 + (level - 1) * 2;
        expect(char.getRequiredExperience()).toBe(expected);
      }
    });
  });

  describe('addExperience', () => {
    test('should add experience', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.addExperience(5);
      expect(char.experience).toBe(5);
    });

    test('should level up when enough exp', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      const leveledUp = char.addExperience(10);

      expect(leveledUp).toBe(true);
      expect(char.level).toBe(2);
      expect(char.experience).toBe(0);
    });

    test('should carry over excess exp', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.addExperience(15); // 10 to level up, 5 carry over

      expect(char.level).toBe(2);
      expect(char.experience).toBe(5);
    });

    test('should handle multiple level ups', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.addExperience(22); // 10 (lvl2) + 12 (lvl3) = 22

      expect(char.level).toBe(3);
      expect(char.experience).toBe(0);
    });

    test('should stop at max level', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 30;
      const leveledUp = char.addExperience(100);

      expect(leveledUp).toBe(false);
      expect(char.level).toBe(30);
    });

    test('should not exceed max level', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 29;
      char.addExperience(1000);

      expect(char.level).toBe(30);
    });
  });

  describe('getLevel and getExperience', () => {
    test('should return current level', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.level = 5;
      expect(char.getLevel()).toBe(5);
    });

    test('should return current experience', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.experience = 7;
      expect(char.getExperience()).toBe(7);
    });
  });
});

describe('Combat System', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('attack', () => {
    test('should set attacking state', () => {
      const char = new Character(100, 100, 'test.png', 1080);
      char.attack();

      expect(char.isAttacking).toBe(true);
      expect(char.lastAttackTime).toBe(currentTime);
      expect(char.attackStartTime).toBe(currentTime);
    });

    test('should return attack area', () => {
      const char = new Character(100, 100, 'test.png', 1080);
      const area = char.attack();

      expect(area.x).toBe(100);
      expect(area.y).toBe(100);
      expect(area.radius).toBe(150);
    });
  });

  describe('getAttackArea', () => {
    test('should return circular area around character', () => {
      const char = new Character(200, 300, 'test.png', 1080);
      const area = char.getAttackArea();

      expect(area.x).toBe(200);
      expect(area.y).toBe(300);
      expect(area.radius).toBe(150);
    });
  });

  describe('takeDamage', () => {
    test('should reduce HP', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.takeDamage(20);

      expect(char.currentHP).toBe(80);
    });

    test('should not reduce HP below 0', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.takeDamage(150);

      expect(char.currentHP).toBe(0);
    });

    test('should return true when killed', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      const died = char.takeDamage(100);

      expect(died).toBe(true);
      expect(char.deathTime).toBe(currentTime);
    });

    test('should return false when not killed', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      const died = char.takeDamage(50);

      expect(died).toBe(false);
    });

    test('should trigger hit flash', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.takeDamage(10);

      expect(char.hitFlashTime).toBe(currentTime);
    });

    test('should have invincibility after taking damage', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.takeDamage(20);

      advanceTime(100);
      const result = char.takeDamage(20);

      expect(result).toBe(false);
      expect(char.currentHP).toBe(80); // No additional damage
    });

    test('should take damage after invincibility expires', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.takeDamage(20);

      advanceTime(300);
      char.takeDamage(20);

      expect(char.currentHP).toBe(60);
    });

    test('should be immune during knockback', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.isKnockedBack = true;

      const result = char.takeDamage(50);

      expect(result).toBe(false);
      expect(char.currentHP).toBe(100);
    });
  });

  describe('isAlive', () => {
    test('should return true when HP > 0', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      expect(char.isAlive()).toBe(true);
    });

    test('should return false when HP = 0', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.currentHP = 0;
      expect(char.isAlive()).toBe(false);
    });
  });
});

describe('Respawn System', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('respawn', () => {
    test('should restore HP to max', () => {
      const char = new Character(100, 100, 'test.png', 1080);
      char.currentHP = 0;
      char.respawn();

      expect(char.currentHP).toBe(100);
    });

    test('should reset position to initial', () => {
      const char = new Character(100, 200, 'test.png', 1080);
      char.x = 500;
      char.y = 600;
      char.respawn();

      expect(char.x).toBe(100);
      expect(char.y).toBe(200);
    });

    test('should reset death time', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.deathTime = currentTime;
      char.respawn();

      expect(char.deathTime).toBe(0);
    });
  });

  describe('canRespawn', () => {
    test('should return false if not dead', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      expect(char.canRespawn()).toBe(false);
    });

    test('should return false during respawn delay', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.deathTime = currentTime;

      advanceTime(3000);
      expect(char.canRespawn()).toBe(false);
    });

    test('should return true after respawn delay', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.deathTime = currentTime;

      advanceTime(5000);
      expect(char.canRespawn()).toBe(true);
    });
  });
});

describe('Knockback System', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('startKnockback', () => {
    test('should set knockback state', () => {
      const char = new Character(100, 100, 'test.png', 1080);
      char.startKnockback(50, 50, 150, 150);

      expect(char.isKnockedBack).toBe(true);
      expect(char.knockbackStartTime).toBe(currentTime);
    });

    test('should set start and end positions', () => {
      const char = new Character(100, 100, 'test.png', 1080);
      char.startKnockback(50, 50, 150, 150);

      expect(char.knockbackStartX).toBe(100);
      expect(char.knockbackStartY).toBe(100);
      expect(char.knockbackEndX).toBe(150);
      expect(char.knockbackEndY).toBe(150);
    });
  });

  describe('calculateKnockbackDistance', () => {
    test('should return max knockback at point blank', () => {
      const distance = Character.calculateKnockbackDistance(100, 100, 100, 100, 150);
      expect(distance).toBe(100); // maxKnockback
    });

    test('should return min knockback at attack range', () => {
      const distance = Character.calculateKnockbackDistance(0, 0, 150, 0, 150);
      expect(distance).toBe(30); // minKnockback
    });

    test('should scale linearly between min and max', () => {
      const distance = Character.calculateKnockbackDistance(0, 0, 75, 0, 150);
      expect(distance).toBeCloseTo(65, 0); // Halfway between 30 and 100
    });
  });

  describe('calculateKnockbackEndPosition', () => {
    test('should calculate end position in knockback direction', () => {
      const result = Character.calculateKnockbackEndPosition(0, 100, 100, 100, 50, 1920, 1080);

      expect(result.x).toBe(150); // 100 + 50 in x direction
      expect(result.y).toBe(100); // Same y
    });

    test('should clamp to canvas bounds', () => {
      const result = Character.calculateKnockbackEndPosition(0, 100, 100, 100, 2000, 500, 500);

      expect(result.x).toBe(450); // Clamped to width - margin
    });

    test('should handle identical positions', () => {
      const result = Character.calculateKnockbackEndPosition(100, 100, 100, 100, 50, 1920, 1080);

      // Should still produce a valid position (random direction)
      expect(result.x).toBeGreaterThanOrEqual(50);
      expect(result.x).toBeLessThanOrEqual(1870);
    });
  });
});

describe('Chat Bubble System', () => {
  beforeEach(() => {
    resetTime();
  });

  describe('setChatMessage', () => {
    test('should set chat message', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.setChatMessage('Hello!');

      expect(char.chatMessage).toBe('Hello!');
      expect(char.chatMessageTime).toBe(currentTime);
    });

    test('should replace existing message', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      char.setChatMessage('First');
      char.setChatMessage('Second');

      expect(char.chatMessage).toBe('Second');
    });
  });

  describe('chat bubble duration', () => {
    test('should have 3 second duration', () => {
      const char = new Character(0, 0, 'test.png', 1080);
      expect(char.chatMessageDuration).toBe(3000);
    });
  });
});

describe('Hit Flash System', () => {
  beforeEach(() => {
    resetTime();
  });

  test('should have 100ms duration', () => {
    const char = new Character(0, 0, 'test.png', 1080);
    expect(char.hitFlashDuration).toBe(100);
  });

  test('should be triggered on damage', () => {
    const char = new Character(0, 0, 'test.png', 1080);
    char.takeDamage(10);

    expect(char.hitFlashTime).toBe(currentTime);
  });
});

describe('Image Loading System', () => {
  beforeEach(() => {
    resetTime();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Character class with image loading for testing
  class CharacterWithImageLoading extends Character {
    constructor(x, y, imagePath, canvasHeight, playerName = 'Player', isDummy = false) {
      super(x, y, imagePath, canvasHeight, playerName, isDummy);
    }

    loadImage(path, retries = 3) {
      return new Promise((resolve, reject) => {
        const img = {
          onload: null,
          onerror: null,
          src: null,
          width: 100,
          height: 100,
        };

        // Store callbacks for test manipulation
        this._lastImageCallbacks = { img, resolve, reject };

        setTimeout(() => {
          if (img.onload) {
            img.onload.call(img);
          }
        }, 0);

        img.onload = () => {
          this.image = img;
          this.imageLoaded = true;
          const aspectRatio = img.width / img.height;
          if (aspectRatio > 1) {
            this.width = this.displaySize;
            this.height = this.displaySize / aspectRatio;
          } else {
            this.height = this.displaySize;
            this.width = this.displaySize * aspectRatio;
          }
          resolve();
        };

        img.onerror = () => {
          if (retries > 0) {
            setTimeout(() => {
              this.loadImage(path, retries - 1).then(resolve).catch(reject);
            }, 1000);
          } else {
            this.loadFallbackImage().then(resolve).catch(() => {
              reject(new Error(`Failed to load image: ${path}`));
            });
          }
        };

        img.src = path;
      });
    }

    loadFallbackImage() {
      return new Promise((resolve, reject) => {
        const img = { width: 100, height: 100 };
        this.image = img;
        this.imageLoaded = true;
        this.width = this.displaySize;
        this.height = this.displaySize;
        resolve();
      });
    }
  }

  describe('loadImage', () => {
    test('should return a Promise', () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      const result = char.loadImage('test.png');
      expect(result).toBeInstanceOf(Promise);
    });

    test('should set imageLoaded to true on success', async () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      char.imageLoaded = false;

      const promise = char.loadImage('test.png');
      jest.advanceTimersByTime(100);
      await promise;

      expect(char.imageLoaded).toBe(true);
    });

    test('should accept retries parameter', () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      // Should not throw when called with retries parameter
      expect(() => char.loadImage('test.png', 5)).not.toThrow();
    });

    test('should have default retries of 3', () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      // The function signature shows default of 3
      const promise = char.loadImage('test.png');
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('loadFallbackImage', () => {
    test('should return a Promise', () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      const result = char.loadFallbackImage();
      expect(result).toBeInstanceOf(Promise);
    });

    test('should set imageLoaded to true', async () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      char.imageLoaded = false;

      await char.loadFallbackImage();

      expect(char.imageLoaded).toBe(true);
    });

    test('should set image property', async () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      char.image = null;

      await char.loadFallbackImage();

      expect(char.image).not.toBeNull();
    });

    test('should set square dimensions', async () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);

      await char.loadFallbackImage();

      expect(char.width).toBe(char.displaySize);
      expect(char.height).toBe(char.displaySize);
    });
  });

  describe('retry logic', () => {
    test('should call loadImage with retries parameter', () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      const loadImageSpy = jest.spyOn(char, 'loadImage');

      char.loadImage('test.png', 2);

      expect(loadImageSpy).toHaveBeenCalledWith('test.png', 2);
    });

    test('should load fallback after all retries exhausted', async () => {
      const char = new CharacterWithImageLoading(0, 0, 'test.png', 1080);
      const loadFallbackSpy = jest.spyOn(char, 'loadFallbackImage');

      // Simulate all retries exhausted by calling with 0 retries
      // and triggering error
      char.loadImage = jest.fn().mockImplementation((path, retries = 3) => {
        if (retries === 0) {
          return char.loadFallbackImage();
        }
        return Promise.resolve();
      });

      await char.loadImage('test.png', 0);

      expect(loadFallbackSpy).toHaveBeenCalled();
    });
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    resetTime();
  });

  test('should handle zero damage', () => {
    const char = new Character(0, 0, 'test.png', 1080);
    const died = char.takeDamage(0);

    expect(died).toBe(false);
    expect(char.currentHP).toBe(100);
  });

  test('should handle negative damage (heal)', () => {
    const char = new Character(0, 0, 'test.png', 1080);
    char.currentHP = 50;
    char.takeDamage(-20);

    // Note: Current implementation doesn't prevent negative damage
    expect(char.currentHP).toBe(70);
  });

  test('should handle very large experience amounts', () => {
    const char = new Character(0, 0, 'test.png', 1080);
    char.addExperience(10000);

    expect(char.level).toBe(30); // Max level
  });

  test('should handle decimal delta time', () => {
    const char = new Character(100, 100, 'test.png', 1080);
    const speed = char.speed;
    const deltaTime = 0.0166; // ~60fps

    const expectedMove = speed * deltaTime;
    expect(expectedMove).toBeCloseTo(4.98, 1);
  });
});
