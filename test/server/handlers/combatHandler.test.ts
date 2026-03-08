/**
 * Combat Handler Tests - Phase 2
 *
 * Server-side combat handler security validation tests
 * Tests for CRITICAL and HIGH security issues
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

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
        PLAYER: {
            RESPAWN_DELAY_MS: 3000,
        },
    },
    TELEPATHY_RADIUS: 180,
    TELEPATHY_DAMAGE_PER_TICK: 2,
    TELEPATHY_MAX_HEAL_PER_TICK: 4,
    PLAYER_RESPAWN_DELAY: 3000,
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
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
    isDead: boolean;
    level?: number;
    telepathyLastTickTime?: number;
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
            const module = require('../../../server/handlers/combatHandler');
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
});
