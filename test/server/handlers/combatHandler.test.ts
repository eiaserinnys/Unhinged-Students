/**
 * Combat Handler Tests - Phase 2
 *
 * Server-side combat handler security validation tests
 * Tests for CRITICAL and HIGH security issues
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    cheat: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'debug'),
};

// Mock config
const mockConfig = {
    SERVER_CONFIG: {
        KNOCKBACK: {
            LASER_DISTANCE: 50,
            BOUNDARY_MARGIN: 50,
        },
        SKILL_TELEPATHY: {
            RADIUS: 180,
            DAMAGE_PER_TICK: 2,
            MAX_HEAL_PER_TICK: 4,
            DURATION_MS: 3000,
            TICK_INTERVAL_MS: 200, // 200ms between ticks
        },
        SKILL_MADNESS: {
            RADIUS: 150,
            DAMAGE_PER_TICK: 1,
            DURATION_MS: 5000,
            TICK_INTERVAL_MS: 200,
            COOLDOWN_MS: 10000,
        },
        SKILL_RAGE: {
            DURATION_MS: 5000,
            DAMAGE_MULTIPLIER: 2.0,
            THROW_MULTIPLIER: 1.5,
            COOLDOWN_MS: 20000,
        },
        SKILL_SPIN_THROW: {
            GRAB_RANGE: 150,
            THROW_DISTANCE: 300,
            DAMAGE: 30,
            COLLISION_DAMAGE: 20,
            COOLDOWN_MS: 2000,
        },
        HULK_PASSIVE: {
            MAX_STACKS: 10,
            DAMAGE_PER_STACK: 0.1,
            THROW_PER_STACK: 0.05,
            STACK_DURATION_MS: 10000,
        },
        PLAYER: {
            RESPAWN_DELAY_MS: 3000,
        },
    },
    TELEPATHY_RADIUS: 180,
    TELEPATHY_DAMAGE_PER_TICK: 2,
    TELEPATHY_MAX_HEAL_PER_TICK: 4,
    PLAYER_RESPAWN_DELAY: 3000,
    RATE_LIMIT_ATTACK: 500,
    RATE_LIMIT_TELEPORT: 8000,
    RATE_LIMIT_TELEPORT_DAMAGE: 8000,
    RATE_LIMIT_LASER: 10000,
    RATE_LIMIT_TELEPATHY: 15000,
    RATE_LIMIT_WAVE: 2000,
    RATE_LIMIT_MADNESS: 10000,
    RATE_LIMIT_POT_SMASH: 1500,
    RATE_LIMIT_CURRY_RECOVERY: 8000,
    RATE_LIMIT_RAGE: 20000,
    RATE_LIMIT_SPIN_THROW: 2000,
    ATTACK_POWER: 10,
    ATTACK_RANGE: 150,
    TELEPORT_MAX_DISTANCE: 400,
    TELEPORT_DAMAGE_RADIUS: 100,
    TELEPORT_DAMAGE: 12,
    LASER_DAMAGE: 44,
    LASER_MAX_LENGTH: 2000,
    WAVE_RADIUS: 250,
    WAVE_DAMAGE: 15,
    WAVE_CONFUSION_DURATION: 3000,
    MADNESS_RADIUS: 150,
    MADNESS_DAMAGE_PER_TICK: 1,
    POT_SMASH_DAMAGE: 45,
    POT_SMASH_SPLASH_DAMAGE: 20,
    POT_SMASH_RANGE: 250,
    POT_SMASH_ANGLE: 150,
    POT_SMASH_SPLASH_RADIUS: 120,
    CURRY_RECOVERY_MAX_STORED: 50,
    CURRY_RECOVERY_STORE_RATIO: 0.5,
};

// Mock validation
const mockValidation = {
    isValidNumber: jest.fn(
        (val: unknown) => typeof val === 'number' && Number.isFinite(val as number)
    ),
    clampCoordinates: jest.fn((x: number, y: number) => ({ x, y })),
    calculateDistance: jest.fn((x1: number, y1: number, x2: number, y2: number) =>
        Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    ),
    calculateKnockbackDistance: jest.fn(() => 50),
    calculateKnockbackEndPosition: jest.fn((_ax: number, _ay: number, tx: number, _ty: number) => ({
        x: tx + 50,
        y: _ty,
    })),
    lineCircleIntersect: jest.fn(() => false),
};

// Mock game state
interface MockPlayer {
    playerId?: string;
    socketId?: string;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
    isDead: boolean;
    level?: number;
    characterId?: string;
    telepathyLastTickTime?: number;
    madnessLastTickTime?: number;
    madnessStartTime?: number;
    rageActive?: boolean;
    rageStartTime?: number;
    rageStacks?: number;
    rageTimeout?: ReturnType<typeof setTimeout>;
    storedDamage?: number;
}

const mockPlayers = new Map<string, MockPlayer>();
const mockDummies = new Map<string, unknown>();
const mockRateLimit = jest.fn(() => true);

const mockGameState = {
    players: mockPlayers,
    dummies: mockDummies,
    rateLimit: mockRateLimit,
};

// Setup mocks before requiring the module
jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../server/config', () => mockConfig);
jest.mock('../../../server/validation', () => mockValidation);
jest.mock('../../../server/gameState', () => mockGameState);

type EventHandler = (data: Record<string, unknown>) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockSocket = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockIo = any;

describe('CombatHandler Security', () => {
    let socket: MockSocket;
    let io: MockIo;
    let registerCombatHandlers: (socket: MockSocket, io: MockIo) => void;
    let handlers: Record<string, EventHandler>;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        mockPlayers.clear();
        mockDummies.clear();

        // Create mock socket
        handlers = {};
        socket = {
            id: 'test-socket-1',
            on: jest.fn((event: string, handler: EventHandler) => {
                handlers[event] = handler;
            }),
            broadcast: {
                emit: jest.fn(),
            },
        };

        // Create mock io
        io = {
            emit: jest.fn(),
            to: jest.fn(() => ({ emit: jest.fn() })),
        };

        // Import the module (this will use our mocks)
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const module = require('../../../server/handlers/combat');
            registerCombatHandlers = module.registerCombatHandlers;
        });

        // Register handlers
        registerCombatHandlers(socket, io);

        // Add a test player
        mockPlayers.set('test-socket-1', {
            x: 100,
            y: 100,
            currentHP: 100,
            maxHP: 100,
            isDead: false,
            level: 1,
        });
    });

    describe('laserAiming - Direction Vector Validation', () => {
        it('should reject direction vectors with invalid length (too long)', () => {
            // Arrange
            const data = {
                x: 100,
                y: 100,
                dirX: 2.0, // Invalid: should be normalized (length ~1)
                dirY: 2.0,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Invalid laser direction')
            );
            expect(socket.broadcast.emit).not.toHaveBeenCalled();
        });

        it('should reject direction vectors with invalid length (too short)', () => {
            // Arrange
            const data = {
                x: 100,
                y: 100,
                dirX: 0.1, // Invalid: should be normalized
                dirY: 0.1,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Invalid laser direction')
            );
            expect(socket.broadcast.emit).not.toHaveBeenCalled();
        });

        it('should reject direction vectors with zero length', () => {
            // Arrange
            const data = {
                x: 100,
                y: 100,
                dirX: 0,
                dirY: 0,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Invalid laser direction')
            );
            expect(socket.broadcast.emit).not.toHaveBeenCalled();
        });

        it('should accept valid normalized direction vectors', () => {
            // Arrange
            const data = {
                x: 100,
                y: 100,
                dirX: 1.0, // Valid: normalized
                dirY: 0.0,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(mockLogger.cheat).not.toHaveBeenCalled();
            expect(socket.broadcast.emit).toHaveBeenCalledWith('laserAiming', expect.any(Object));
        });

        it('should accept direction vectors within tolerance (0.9 - 1.1)', () => {
            // Arrange - diagonal vector, length ~0.99
            const data = {
                x: 100,
                y: 100,
                dirX: 0.7,
                dirY: 0.7,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(mockLogger.cheat).not.toHaveBeenCalled();
            expect(socket.broadcast.emit).toHaveBeenCalled();
        });

        it('should use server-side player position instead of client position', () => {
            // Arrange
            const serverPlayer = mockPlayers.get('test-socket-1')!;
            serverPlayer.x = 200;
            serverPlayer.y = 300;

            const data = {
                x: 999, // Client sends wrong position
                y: 999,
                dirX: 1.0,
                dirY: 0.0,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(socket.broadcast.emit).toHaveBeenCalledWith('laserAiming', {
                playerId: 'test-socket-1',
                x: 200, // Server position used
                y: 300,
                dirX: 1.0,
                dirY: 0.0,
            });
        });

        it('should not process if player does not exist', () => {
            // Arrange
            mockPlayers.delete('test-socket-1');
            const data = {
                x: 100,
                y: 100,
                dirX: 1.0,
                dirY: 0.0,
            };

            // Act
            handlers.laserAiming(data);

            // Assert
            expect(socket.broadcast.emit).not.toHaveBeenCalled();
        });
    });

    describe('telepathyDamage - Tick Rate Validation', () => {
        beforeEach(() => {
            // Reset player with telepathy tracking
            mockPlayers.set('test-socket-1', {
                x: 100,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
                level: 1,
                telepathyLastTickTime: 0,
            });
        });

        it('should reject telepathy damage ticks that are too fast', () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            player.telepathyLastTickTime = Date.now(); // Last tick just now

            // Act - Try to send another tick immediately (too fast)
            handlers.telepathyDamage({});

            // Assert
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Telepathy tick too fast')
            );
            // Should not process damage
            expect(io.emit).not.toHaveBeenCalledWith('telepathyTick', expect.any(Object));
        });

        it('should accept telepathy damage ticks at valid intervals', async () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            const tickInterval = mockConfig.SERVER_CONFIG.SKILL_TELEPATHY.TICK_INTERVAL_MS;
            // Set last tick to long enough ago
            player.telepathyLastTickTime = Date.now() - tickInterval - 100;

            // Add a target to damage
            mockPlayers.set('test-socket-2', {
                x: 110, // Within telepathy radius
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            // Act
            handlers.telepathyDamage({});

            // Assert
            expect(mockLogger.cheat).not.toHaveBeenCalledWith(
                expect.stringContaining('Telepathy tick too fast')
            );
        });

        it('should update last tick time after successful tick', () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            player.telepathyLastTickTime = 0; // First tick

            const beforeTime = Date.now();

            // Act
            handlers.telepathyDamage({});

            // Assert
            expect(player.telepathyLastTickTime).toBeGreaterThanOrEqual(beforeTime);
        });

        it('should allow first telepathy tick (no previous tick time)', () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            delete player.telepathyLastTickTime; // No previous tick

            // Act
            handlers.telepathyDamage({});

            // Assert
            expect(mockLogger.cheat).not.toHaveBeenCalledWith(
                expect.stringContaining('Telepathy tick too fast')
            );
        });

        it('should use 90% of tick interval as minimum (tolerance for network latency)', () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            const tickInterval = mockConfig.SERVER_CONFIG.SKILL_TELEPATHY.TICK_INTERVAL_MS;
            // Set last tick to 91% of interval ago (should be allowed with 90% tolerance)
            player.telepathyLastTickTime = Date.now() - Math.floor(tickInterval * 0.91);

            // Act
            handlers.telepathyDamage({});

            // Assert
            expect(mockLogger.cheat).not.toHaveBeenCalledWith(
                expect.stringContaining('Telepathy tick too fast')
            );
        });

        it('should reject tick at 80% of interval (below tolerance)', () => {
            // Arrange
            const player = mockPlayers.get('test-socket-1')!;
            const tickInterval = mockConfig.SERVER_CONFIG.SKILL_TELEPATHY.TICK_INTERVAL_MS;
            // Set last tick to only 80% of interval ago (should be rejected)
            player.telepathyLastTickTime = Date.now() - Math.floor(tickInterval * 0.8);

            // Act
            handlers.telepathyDamage({});

            // Assert
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Telepathy tick too fast')
            );
        });
    });

    describe('madnessDamage - Tick Rate and Duration Validation', () => {
        beforeEach(() => {
            mockPlayers.set('test-socket-1', {
                x: 100,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
                characterId: 'crazy-eyes',
                madnessStartTime: Date.now(),
                madnessLastTickTime: 0,
            });
        });

        it('should reject madness ticks that are too fast', () => {
            const player = mockPlayers.get('test-socket-1')!;
            player.madnessLastTickTime = Date.now(); // Last tick just now

            handlers.madnessDamage({});

            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Madness tick too fast')
            );
        });

        it('should accept madness ticks at valid intervals', () => {
            const player = mockPlayers.get('test-socket-1')!;
            const tickInterval = mockConfig.SERVER_CONFIG.SKILL_MADNESS.TICK_INTERVAL_MS;
            player.madnessLastTickTime = Date.now() - tickInterval - 100;

            handlers.madnessDamage({});

            expect(mockLogger.cheat).not.toHaveBeenCalledWith(
                expect.stringContaining('Madness tick too fast')
            );
        });

        it('should reject madness damage after duration exceeded', () => {
            const player = mockPlayers.get('test-socket-1')!;
            const duration = mockConfig.SERVER_CONFIG.SKILL_MADNESS.DURATION_MS;
            player.madnessStartTime = Date.now() - duration - 1000; // Well past duration
            player.madnessLastTickTime = 0;

            handlers.madnessDamage({});

            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Madness duration exceeded')
            );
        });

        it('should accept madness damage within duration', () => {
            const player = mockPlayers.get('test-socket-1')!;
            player.madnessStartTime = Date.now() - 1000; // 1 second into 5 second duration
            player.madnessLastTickTime = 0;

            handlers.madnessDamage({});

            expect(mockLogger.cheat).not.toHaveBeenCalledWith(
                expect.stringContaining('Madness duration exceeded')
            );
        });

        it('should reject madness damage without prior madnessStart', () => {
            const player = mockPlayers.get('test-socket-1')!;
            player.madnessStartTime = undefined; // No madnessStart was sent

            handlers.madnessDamage({});

            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Madness damage without madnessStart')
            );
        });
    });

    describe('rageStart - Server-side Timer', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            mockPlayers.set('test-socket-1', {
                playerId: 'test-socket-1',
                x: 100,
                y: 100,
                currentHP: 150,
                maxHP: 150,
                isDead: false,
                characterId: 'big-sis-hulk',
                rageActive: false,
            });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should auto-end rage after DURATION_MS', () => {
            handlers.rageStart({});

            const player = mockPlayers.get('test-socket-1')!;
            expect(player.rageActive).toBe(true);

            // Advance time past rage duration
            jest.advanceTimersByTime(mockConfig.SERVER_CONFIG.SKILL_RAGE.DURATION_MS + 100);

            expect(player.rageActive).toBe(false);
            expect(io.emit).toHaveBeenCalledWith('playerRageEnd', {
                playerId: 'test-socket-1',
            });
        });

        it('should clear timer on early rage end', () => {
            handlers.rageStart({});
            const player = mockPlayers.get('test-socket-1')!;
            expect(player.rageActive).toBe(true);

            // End rage early
            handlers.rageEnd({});
            expect(player.rageActive).toBe(false);
            expect(player.rageTimeout).toBeUndefined();

            // Advance time - should NOT trigger auto-end again
            jest.advanceTimersByTime(mockConfig.SERVER_CONFIG.SKILL_RAGE.DURATION_MS + 100);
            // io.emit should only have been called once for rageEnd (from early end)
        });

        it('should reject rage from non hulk-sister', () => {
            const player = mockPlayers.get('test-socket-1')!;
            player.characterId = 'alien';

            handlers.rageStart({});

            expect(player.rageActive).not.toBe(true);
            expect(mockLogger.cheat).toHaveBeenCalledWith(
                expect.stringContaining('Non hulk-sister')
            );
        });
    });

    describe('applyDamageWithPassives - Hulk Passive Stacks', () => {
        beforeEach(() => {
            mockPlayers.set('test-socket-1', {
                x: 100,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
                characterId: 'alien',
            });
        });

        it('should increment rage stacks for hulk-sister when damaged', () => {
            // Set up a hulk-sister as target
            mockPlayers.set('test-socket-2', {
                playerId: 'test-socket-2',
                socketId: 'test-socket-2',
                x: 110,
                y: 100,
                currentHP: 150,
                maxHP: 150,
                isDead: false,
                characterId: 'big-sis-hulk',
                rageStacks: 0,
            });

            // Trigger an attack that hits test-socket-2
            mockRateLimit.mockReturnValue(true);
            handlers.playerAttack({ x: 100, y: 100 });

            const hulk = mockPlayers.get('test-socket-2')!;
            expect(hulk.rageStacks).toBe(1);
        });

        it('should not exceed MAX_STACKS', () => {
            mockPlayers.set('test-socket-2', {
                playerId: 'test-socket-2',
                socketId: 'test-socket-2',
                x: 110,
                y: 100,
                currentHP: 150,
                maxHP: 150,
                isDead: false,
                characterId: 'big-sis-hulk',
                rageStacks: mockConfig.SERVER_CONFIG.HULK_PASSIVE.MAX_STACKS,
            });

            mockRateLimit.mockReturnValue(true);
            handlers.playerAttack({ x: 100, y: 100 });

            const hulk = mockPlayers.get('test-socket-2')!;
            expect(hulk.rageStacks).toBe(mockConfig.SERVER_CONFIG.HULK_PASSIVE.MAX_STACKS);
        });

        it('should store damage for curry-bear when damaged', () => {
            mockPlayers.set('test-socket-2', {
                playerId: 'test-socket-2',
                socketId: 'test-socket-2',
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
                characterId: 'curry-bear',
                storedDamage: 0,
            });

            mockRateLimit.mockReturnValue(true);
            handlers.playerAttack({ x: 100, y: 100 });

            const curry = mockPlayers.get('test-socket-2')!;
            expect(curry.storedDamage).toBeGreaterThan(0);
        });
    });

    describe('Skill Rate Limiting', () => {
        it('should rate limit teleport', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.teleport({ startX: 100, startY: 100, endX: 200, endY: 200 });

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('playerTeleport', expect.any(Object));
        });

        it('should rate limit wave attack', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.waveAttack({});

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('playerWave', expect.any(Object));
        });

        it('should rate limit laser attack', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.laserAttack({ x1: 100, y1: 100, x2: 200, y2: 200 });

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('laserFired', expect.any(Object));
        });

        it('should rate limit pot smash', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.potSmash({ dirX: 1, dirY: 0 });

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('playerPotSmash', expect.any(Object));
        });

        it('should rate limit curry recovery', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.curryRecovery({});

            expect(io.emit).not.toHaveBeenCalledWith('playerCurryRecovery', expect.any(Object));
        });

        it('should rate limit madness start', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.madnessStart({});

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('playerMadnessStart', expect.any(Object));
        });

        it('should rate limit telepathy', () => {
            mockRateLimit.mockReturnValue(false);

            handlers.telepathy({ x: 100, y: 100, radius: 180 });

            expect(socket.broadcast.emit).not.toHaveBeenCalledWith('playerTelepathy', expect.any(Object));
        });

        it('should rate limit rage start', () => {
            mockRateLimit.mockReturnValue(false);
            const player = mockPlayers.get('test-socket-1')!;
            player.characterId = 'big-sis-hulk';

            handlers.rageStart({});

            expect(player.rageActive).not.toBe(true);
        });
    });
});
