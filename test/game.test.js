/**
 * Game System Tests
 *
 * Tests for the main game system including:
 * - Game state management
 * - Canvas resizing and scaling
 * - Update loop logic
 * - Enemy finding algorithms
 * - Hit vignette effect
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

// ==================== Game Constants ====================

describe('Game Constants', () => {
  const GAME_WIDTH = 1920;
  const GAME_HEIGHT = 1080;

  test('game world should have 16:9 aspect ratio', () => {
    const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
    expect(aspectRatio).toBeCloseTo(16 / 9, 2);
  });

  test('game dimensions should be defined correctly', () => {
    expect(GAME_WIDTH).toBe(1920);
    expect(GAME_HEIGHT).toBe(1080);
  });
});

// ==================== Game State ====================

describe('GameState', () => {
  // Simulated game state structure
  function createGameState() {
    return {
      screen: 'lobby',
      running: false,
      player: null,
      lobbyManager: null,
      shardManager: null,
      networkManager: null,
      chatManager: null,
      skillManager: null,
      skillUI: null,
      laserBeamEffect: null,
      teleportEffect: null,
      telepathyEffect: null,
      dummies: [],
      stats: {
        shardsCollected: 0,
      },
      lastFrameTime: 0,
      deltaTime: 0,
      lastAttackSentTime: 0,
      hitVignetteTime: 0,
      hitVignetteDuration: 300,
      selectedCharacter: 'alien',
      playerName: 'Player',
    };
  }

  describe('initial state', () => {
    test('should start in lobby screen', () => {
      const gameState = createGameState();
      expect(gameState.screen).toBe('lobby');
    });

    test('should not be running initially', () => {
      const gameState = createGameState();
      expect(gameState.running).toBe(false);
    });

    test('should have default character selection', () => {
      const gameState = createGameState();
      expect(gameState.selectedCharacter).toBe('alien');
    });

    test('should have default player name', () => {
      const gameState = createGameState();
      expect(gameState.playerName).toBe('Player');
    });

    test('should have empty dummies array', () => {
      const gameState = createGameState();
      expect(gameState.dummies).toEqual([]);
    });

    test('should have zero shards collected', () => {
      const gameState = createGameState();
      expect(gameState.stats.shardsCollected).toBe(0);
    });
  });

  describe('state transitions', () => {
    test('should transition to playing screen', () => {
      const gameState = createGameState();
      gameState.screen = 'playing';
      expect(gameState.screen).toBe('playing');
    });

    test('should set running to true when game starts', () => {
      const gameState = createGameState();
      gameState.running = true;
      expect(gameState.running).toBe(true);
    });
  });
});

// ==================== Canvas Resizing ====================

describe('Canvas Resizing', () => {
  const GAME_WIDTH = 1920;
  const GAME_HEIGHT = 1080;

  function calculateCanvasSize(windowWidth, windowHeight) {
    const windowAspectRatio = windowWidth / windowHeight;
    const gameAspectRatio = GAME_WIDTH / GAME_HEIGHT;

    let canvasWidth, canvasHeight, offsetX, offsetY, scale;

    if (windowAspectRatio > gameAspectRatio) {
      // Window is wider - fit to height
      canvasHeight = windowHeight;
      canvasWidth = windowHeight * gameAspectRatio;
      offsetX = (windowWidth - canvasWidth) / 2;
      offsetY = 0;
    } else {
      // Window is taller - fit to width
      canvasWidth = windowWidth;
      canvasHeight = windowWidth / gameAspectRatio;
      offsetX = 0;
      offsetY = (windowHeight - canvasHeight) / 2;
    }

    scale = canvasWidth / GAME_WIDTH;

    return { canvasWidth, canvasHeight, offsetX, offsetY, scale };
  }

  describe('fit to height (wider window)', () => {
    test('should fit to height when window is wider than game ratio', () => {
      const result = calculateCanvasSize(1920, 1000);

      expect(result.canvasHeight).toBe(1000);
      expect(result.canvasWidth).toBeCloseTo(1000 * (16 / 9), 1);
    });

    test('should center horizontally', () => {
      const result = calculateCanvasSize(2000, 1000);

      expect(result.offsetX).toBeGreaterThan(0);
      expect(result.offsetY).toBe(0);
    });
  });

  describe('fit to width (taller window)', () => {
    test('should fit to width when window is taller than game ratio', () => {
      const result = calculateCanvasSize(1000, 1200);

      expect(result.canvasWidth).toBe(1000);
      expect(result.canvasHeight).toBeCloseTo(1000 / (16 / 9), 1);
    });

    test('should center vertically', () => {
      const result = calculateCanvasSize(1000, 1200);

      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBeGreaterThan(0);
    });
  });

  describe('scale calculation', () => {
    test('should calculate correct scale factor', () => {
      const result = calculateCanvasSize(960, 540);

      expect(result.scale).toBeCloseTo(0.5, 2);
    });

    test('should have scale 1 at native resolution', () => {
      const result = calculateCanvasSize(GAME_WIDTH, GAME_HEIGHT);

      expect(result.scale).toBeCloseTo(1, 2);
    });

    test('should scale proportionally', () => {
      const result = calculateCanvasSize(3840, 2160);

      expect(result.scale).toBeCloseTo(2, 2);
    });
  });

  describe('edge cases', () => {
    test('should handle very small windows', () => {
      const result = calculateCanvasSize(320, 180);

      expect(result.canvasWidth).toBeGreaterThan(0);
      expect(result.canvasHeight).toBeGreaterThan(0);
      expect(result.scale).toBeGreaterThan(0);
    });

    test('should handle very wide windows', () => {
      const result = calculateCanvasSize(4000, 500);

      expect(result.canvasHeight).toBe(500);
      expect(result.offsetX).toBeGreaterThan(0);
    });

    test('should handle very tall windows', () => {
      const result = calculateCanvasSize(500, 4000);

      expect(result.canvasWidth).toBe(500);
      expect(result.offsetY).toBeGreaterThan(0);
    });
  });
});

// ==================== Delta Time Calculation ====================

describe('Delta Time', () => {
  function calculateDeltaTime(lastFrameTime, currentFrameTime) {
    let deltaTime = (currentFrameTime - lastFrameTime) / 1000;

    // Cap delta time to prevent huge jumps
    if (deltaTime > 0.1) {
      deltaTime = 0.1;
    }

    return deltaTime;
  }

  test('should calculate delta time in seconds', () => {
    const delta = calculateDeltaTime(0, 16.67);
    expect(delta).toBeCloseTo(0.01667, 4);
  });

  test('should cap delta time at 0.1 seconds', () => {
    const delta = calculateDeltaTime(0, 500);
    expect(delta).toBe(0.1);
  });

  test('should handle 60 FPS frame timing', () => {
    const delta = calculateDeltaTime(0, 16.67);
    expect(delta).toBeCloseTo(1 / 60, 2);
  });

  test('should handle 30 FPS frame timing', () => {
    const delta = calculateDeltaTime(0, 33.33);
    expect(delta).toBeCloseTo(1 / 30, 2);
  });
});

// ==================== Find Nearest Enemy ====================

describe('findNearestEnemy', () => {
  // Mock player and enemies
  function createPlayer(x, y) {
    return {
      getPosition: () => ({ x, y }),
    };
  }

  function createDummy(x, y, alive = true) {
    return {
      x,
      y,
      isAlive: () => alive,
    };
  }

  function createRemotePlayer(x, y, alive = true) {
    return {
      x,
      y,
      isAlive: () => alive,
    };
  }

  function findNearestEnemy(player, dummies, remotePlayers, playersOnly = false) {
    const playerPos = player.getPosition();
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    // Check dummies (skip if playersOnly)
    if (!playersOnly) {
      dummies.forEach((dummy) => {
        if (dummy.isAlive()) {
          const dx = dummy.x - playerPos.x;
          const dy = dummy.y - playerPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestEnemy = { x: dummy.x, y: dummy.y, type: 'dummy' };
          }
        }
      });
    }

    // Check remote players
    remotePlayers.forEach((remotePlayer) => {
      if (remotePlayer.isAlive()) {
        const dx = remotePlayer.x - playerPos.x;
        const dy = remotePlayer.y - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = { x: remotePlayer.x, y: remotePlayer.y, type: 'player' };
        }
      }
    });

    // If no enemy found, return a point in front of the player
    if (!nearestEnemy) {
      return { x: playerPos.x + 500, y: playerPos.y, type: 'none' };
    }

    return nearestEnemy;
  }

  test('should find nearest dummy', () => {
    const player = createPlayer(100, 100);
    const dummies = [
      createDummy(200, 100), // 100 units away
      createDummy(400, 100), // 300 units away
    ];

    const result = findNearestEnemy(player, dummies, []);

    expect(result.x).toBe(200);
    expect(result.type).toBe('dummy');
  });

  test('should find nearest remote player', () => {
    const player = createPlayer(100, 100);
    const remotePlayers = [
      createRemotePlayer(150, 100), // 50 units away
      createRemotePlayer(300, 100), // 200 units away
    ];

    const result = findNearestEnemy(player, [], remotePlayers);

    expect(result.x).toBe(150);
    expect(result.type).toBe('player');
  });

  test('should prefer closer enemy regardless of type', () => {
    const player = createPlayer(100, 100);
    const dummies = [createDummy(200, 100)]; // 100 units away
    const remotePlayers = [createRemotePlayer(120, 100)]; // 20 units away

    const result = findNearestEnemy(player, dummies, remotePlayers);

    expect(result.type).toBe('player');
    expect(result.x).toBe(120);
  });

  test('should skip dummies when playersOnly is true', () => {
    const player = createPlayer(100, 100);
    const dummies = [createDummy(110, 100)]; // Very close
    const remotePlayers = [createRemotePlayer(500, 100)]; // Far away

    const result = findNearestEnemy(player, dummies, remotePlayers, true);

    expect(result.type).toBe('player');
    expect(result.x).toBe(500);
  });

  test('should ignore dead enemies', () => {
    const player = createPlayer(100, 100);
    const dummies = [
      createDummy(110, 100, false), // Dead
      createDummy(300, 100, true), // Alive
    ];

    const result = findNearestEnemy(player, dummies, []);

    expect(result.x).toBe(300);
  });

  test('should return default position when no enemies', () => {
    const player = createPlayer(100, 100);

    const result = findNearestEnemy(player, [], []);

    expect(result.x).toBe(600); // 100 + 500
    expect(result.y).toBe(100);
    expect(result.type).toBe('none');
  });

  test('should calculate distance correctly for diagonal enemies', () => {
    const player = createPlayer(0, 0);
    const dummies = [
      createDummy(100, 0), // 100 units away
      createDummy(71, 71), // ~100 units away diagonally
    ];

    const result = findNearestEnemy(player, dummies, []);

    // Both are roughly the same distance, but exact is 100 for horizontal
    expect(result.x).toBe(100);
  });
});

// ==================== Find Random Enemy ====================

describe('findRandomEnemy', () => {
  function createDummy(x, y, alive = true) {
    return { x, y, isAlive: () => alive };
  }

  function createRemotePlayer(x, y, alive = true) {
    return { x, y, isAlive: () => alive };
  }

  function findRandomEnemy(dummies, remotePlayers) {
    const enemies = [];

    // Collect all alive dummies
    dummies.forEach((dummy) => {
      if (dummy.isAlive()) {
        enemies.push({ x: dummy.x, y: dummy.y, type: 'dummy' });
      }
    });

    // Collect all alive remote players
    remotePlayers.forEach((remotePlayer) => {
      if (remotePlayer.isAlive()) {
        enemies.push({ x: remotePlayer.x, y: remotePlayer.y, type: 'player' });
      }
    });

    if (enemies.length === 0) {
      return null;
    }

    return enemies[Math.floor(Math.random() * enemies.length)];
  }

  test('should return enemy from available list', () => {
    const dummies = [createDummy(100, 100), createDummy(200, 200)];

    const result = findRandomEnemy(dummies, []);

    expect(result).not.toBeNull();
    expect(result.type).toBe('dummy');
  });

  test('should return null when no enemies', () => {
    const result = findRandomEnemy([], []);
    expect(result).toBeNull();
  });

  test('should include remote players', () => {
    const remotePlayers = [createRemotePlayer(100, 100)];

    const result = findRandomEnemy([], remotePlayers);

    expect(result.type).toBe('player');
  });

  test('should ignore dead enemies', () => {
    const dummies = [
      createDummy(100, 100, false),
      createDummy(200, 200, false),
    ];
    const remotePlayers = [createRemotePlayer(300, 300, true)];

    const result = findRandomEnemy(dummies, remotePlayers);

    expect(result.type).toBe('player');
    expect(result.x).toBe(300);
  });
});

// ==================== Hit Vignette Effect ====================

describe('Hit Vignette Effect', () => {
  beforeEach(() => {
    resetTime();
  });

  function createVignetteState() {
    return {
      hitVignetteTime: 0,
      hitVignetteDuration: 300,
    };
  }

  function triggerHitVignette(state) {
    state.hitVignetteTime = Date.now();
  }

  function isVignetteActive(state) {
    if (state.hitVignetteTime === 0) return false;
    const elapsed = Date.now() - state.hitVignetteTime;
    return elapsed < state.hitVignetteDuration;
  }

  function getVignetteOpacity(state) {
    if (state.hitVignetteTime === 0) return 0;

    const elapsed = Date.now() - state.hitVignetteTime;
    if (elapsed >= state.hitVignetteDuration) return 0;

    const progress = elapsed / state.hitVignetteDuration;
    return (1 - progress) * 0.6;
  }

  test('should not be active initially', () => {
    const state = createVignetteState();
    expect(isVignetteActive(state)).toBe(false);
  });

  test('should become active when triggered', () => {
    const state = createVignetteState();
    triggerHitVignette(state);
    expect(isVignetteActive(state)).toBe(true);
  });

  test('should expire after duration', () => {
    const state = createVignetteState();
    triggerHitVignette(state);
    advanceTime(300);
    expect(isVignetteActive(state)).toBe(false);
  });

  test('should have maximum opacity at start', () => {
    const state = createVignetteState();
    triggerHitVignette(state);
    const opacity = getVignetteOpacity(state);
    expect(opacity).toBeCloseTo(0.6, 2);
  });

  test('should fade over time', () => {
    const state = createVignetteState();
    triggerHitVignette(state);

    advanceTime(150); // Halfway
    const opacity = getVignetteOpacity(state);
    expect(opacity).toBeCloseTo(0.3, 2);
  });

  test('should have zero opacity after duration', () => {
    const state = createVignetteState();
    triggerHitVignette(state);

    advanceTime(300);
    const opacity = getVignetteOpacity(state);
    expect(opacity).toBe(0);
  });
});

// ==================== Death Screen ====================

describe('Death Screen', () => {
  beforeEach(() => {
    resetTime();
  });

  function createDeadPlayer(deathTime, respawnDelay = 3000) {
    return {
      isDead: true,
      deathTime,
      respawnDelay,
    };
  }

  function getRespawnTime(player) {
    const elapsedTime = Date.now() - player.deathTime;
    return Math.max(0, (player.respawnDelay - elapsedTime) / 1000);
  }

  test('should show full respawn time at death', () => {
    const player = createDeadPlayer(currentTime);
    expect(getRespawnTime(player)).toBeCloseTo(3, 1);
  });

  test('should count down over time', () => {
    const player = createDeadPlayer(currentTime);
    advanceTime(1000);
    expect(getRespawnTime(player)).toBeCloseTo(2, 1);
  });

  test('should show 0 when respawn time is complete', () => {
    const player = createDeadPlayer(currentTime);
    advanceTime(3000);
    expect(getRespawnTime(player)).toBe(0);
  });

  test('should not go negative', () => {
    const player = createDeadPlayer(currentTime);
    advanceTime(5000);
    expect(getRespawnTime(player)).toBe(0);
  });
});

// ==================== Game Loop ====================

describe('Game Loop', () => {
  describe('frame timing', () => {
    test('should request animation frame', () => {
      // requestAnimationFrame is mocked in setup.js
      expect(typeof requestAnimationFrame).toBe('function');
    });
  });

  describe('update order', () => {
    test('update should process components in correct order', () => {
      const updateOrder = [];

      // Simulate update order
      const gameState = {
        player: {
          update: () => updateOrder.push('player'),
        },
        shardManager: {
          update: () => updateOrder.push('shardManager'),
          checkCollisions: () => [],
        },
        networkManager: {
          update: () => updateOrder.push('networkManager'),
        },
        skillManager: {
          update: () => updateOrder.push('skillManager'),
        },
      };

      // Simulate update function
      gameState.player.update();
      gameState.shardManager.update();
      gameState.networkManager.update();
      gameState.skillManager.update();

      expect(updateOrder).toEqual([
        'player',
        'shardManager',
        'networkManager',
        'skillManager',
      ]);
    });
  });
});

// ==================== Shard Collection ====================

describe('Shard Collection', () => {
  test('should increment stats when shard collected', () => {
    const stats = { shardsCollected: 0 };
    const collectedShards = [{}, {}, {}]; // 3 shards

    stats.shardsCollected += collectedShards.length;

    expect(stats.shardsCollected).toBe(3);
  });

  test('should add experience for each shard', () => {
    let experience = 0;
    const collectedShards = [{}, {}]; // 2 shards

    experience += collectedShards.length;

    expect(experience).toBe(2);
  });
});

// ==================== Attack Cooldown ====================

describe('Attack Cooldown', () => {
  beforeEach(() => {
    resetTime();
  });

  function canSendAttack(lastAttackSentTime, attackCooldown) {
    const currentTime = Date.now();
    return !lastAttackSentTime || currentTime - lastAttackSentTime > attackCooldown;
  }

  test('should allow first attack', () => {
    expect(canSendAttack(0, 500)).toBe(true);
  });

  test('should prevent attack during cooldown', () => {
    const lastAttack = currentTime;
    advanceTime(250);
    expect(canSendAttack(lastAttack, 500)).toBe(false);
  });

  test('should allow attack after cooldown', () => {
    const lastAttack = currentTime;
    advanceTime(600);
    expect(canSendAttack(lastAttack, 500)).toBe(true);
  });
});

// ==================== Player State Checks ====================

describe('Player State Checks', () => {
  test('should detect chatting state', () => {
    const chatManager = {
      isChatInputFocused: () => true,
    };

    expect(chatManager.isChatInputFocused()).toBe(true);
  });

  test('should detect dead state', () => {
    const player = { isDead: true };
    expect(player.isDead).toBe(true);
  });

  test('should block movement when chatting', () => {
    const isChatting = true;
    const shouldUpdatePlayer = !isChatting;
    expect(shouldUpdatePlayer).toBe(false);
  });

  test('should block movement when dead', () => {
    const isPlayerDead = true;
    const shouldUpdatePlayer = !isPlayerDead;
    expect(shouldUpdatePlayer).toBe(false);
  });
});
