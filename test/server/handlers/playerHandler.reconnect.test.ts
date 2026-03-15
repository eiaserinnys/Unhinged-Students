/**
 * @fileoverview Tests for player reconnection with grace period
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    cheat: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'info'),
};

// Mock config
const mockConfig = {
    SERVER_CONFIG: {
        WORLD: { WIDTH: 1920, HEIGHT: 1080 },
        PLAYER: {
            SPEED: 300,
            MAX_HP: 100,
            RESPAWN_DELAY_MS: 3000,
            RESPAWN_X: 960,
            RESPAWN_Y: 540,
            SPEED_TOLERANCE: 1.5,
            MAX_MOVE_DISTANCE_PER_TICK: 45,
        },
        COMBAT: { ATTACK_POWER: 10, ATTACK_RANGE: 150, ATTACK_COOLDOWN_MS: 500, HIT_RADIUS: 67.5 },
        HULK_STATS: { MAX_HP: 150 },
        SHARD: { SHARDS_PER_LEVEL: 3, COLLECT_DISTANCE: 100 },
        DUMMY: { MAX_HP: 30, RESPAWN_DELAY_MS: 5000, POSITIONS: [] },
        CHAT: { MAX_MESSAGE_LENGTH: 200 },
        TEAM: { RED: 'red', BLUE: 'blue', MAX_PLAYERS_PER_TEAM: 5 },
        RECONNECT_GRACE_PERIOD_MS: 30000,
        RATE_LIMIT: { MOVE_MS: 50 },
        SKILL_RAGE: { DURATION_MS: 5000, DAMAGE_MULTIPLIER: 2.0, THROW_MULTIPLIER: 1.5, COOLDOWN_MS: 20000 },
        SKILL_MADNESS: { RADIUS: 150, DAMAGE_PER_TICK: 1, DURATION_MS: 5000, TICK_INTERVAL_MS: 200, COOLDOWN_MS: 10000 },
    },
    PLAYER_SPEED: 300,
    PLAYER_SPEED_TOLERANCE: 1.5,
    RATE_LIMIT_MOVE: 50,
};

// Mock shared config (GAME_CONFIG used by playerHandler for time-based cleanup)
const mockSharedConfig = {
    GAME_CONFIG: {
        SKILL_RAGE: { DURATION_MS: 5000 },
        SKILL_MADNESS: { DURATION_MS: 5000 },
    },
};

// Mock validation
const mockValidation = {
    isValidNumber: jest.fn((val: unknown) => typeof val === 'number' && !isNaN(val as number)),
    isValidString: jest.fn((val: unknown, maxLen: number) => typeof val === 'string' && (val as string).length > 0 && (val as string).length <= maxLen),
    isValidPositiveInt: jest.fn((val: unknown) => Number.isInteger(val) && (val as number) > 0),
    clampCoordinates: jest.fn((x: number, y: number) => ({ x, y })),
    calculateDistance: jest.fn(() => 0),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayers = new Map<string, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDisconnectedPlayers = new Map<string, any>();
const mockShards = new Map<string, unknown>();
const mockDummies = new Map<string, unknown>();
const mockRateLimiter = new Map<string, number>();
const mockRateLimit = jest.fn(() => true);
const mockCleanupRateLimiter = jest.fn();
const mockAssignTeam = jest.fn(() => 'red');
const mockGetTeamCounts = jest.fn(() => ({ red: 0, blue: 0 }));

const mockGameState = {
    players: mockPlayers,
    disconnectedPlayers: mockDisconnectedPlayers,
    shards: mockShards,
    dummies: mockDummies,
    rateLimiter: mockRateLimiter,
    rateLimit: mockRateLimit,
    cleanupRateLimiter: mockCleanupRateLimiter,
    assignTeam: mockAssignTeam,
    getTeamCounts: mockGetTeamCounts,
};

// Setup mocks
jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../server/config', () => mockConfig);
jest.mock('../../../shared/config', () => mockSharedConfig);
jest.mock('../../../server/validation', () => mockValidation);
jest.mock('../../../server/gameState', () => mockGameState);

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerPlayerHandlers } = require('../../../server/handlers/playerHandler');

type EventHandler = (...args: unknown[]) => void;

function createMockSocket(id: string) {
    const handlers = new Map<string, EventHandler>();
    return {
        id,
        on: jest.fn((event: string, handler: EventHandler) => {
            handlers.set(event, handler);
        }),
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        _handlers: handlers,
        _trigger(event: string, ...args: unknown[]) {
            const handler = this._handlers.get(event);
            if (handler) handler(...args);
        },
    };
}

function createMockIO() {
    const toEmit = jest.fn();
    return {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: toEmit }),
    };
}

describe('Player Reconnection', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockPlayers.clear();
        mockDisconnectedPlayers.clear();
        mockRateLimiter.clear();
        jest.clearAllMocks();
        mockRateLimit.mockReturnValue(true);
        mockAssignTeam.mockReturnValue('red');
        mockGetTeamCounts.mockReturnValue({ red: 0, blue: 0 });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('identify event', () => {
        it('should record persistentId on new player', () => {
            const socket = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket, io);

            socket._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });

            const player = mockPlayers.get('socket-1');
            expect(player).toBeDefined();
            expect(player.persistentId).toBe('uuid-abc');
            expect(player.playerName).toBe('TestPlayer');
        });

        it('should reject invalid persistentId', () => {
            const socket = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket, io);

            socket._trigger('identify', {
                playerId: '',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });

            const player = mockPlayers.get('socket-1');
            expect(player.persistentId).toBeUndefined();
            expect(mockLogger.cheat).toHaveBeenCalled();
        });
    });

    describe('disconnect with grace period', () => {
        it('should save state to disconnectedPlayers when player has persistentId', () => {
            const socket = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket, io);

            socket._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });

            // Modify player state
            const player = mockPlayers.get('socket-1');
            player.x = 500;
            player.y = 300;
            player.currentHP = 75;
            player.level = 3;

            // Disconnect
            socket._trigger('disconnect');

            expect(mockPlayers.has('socket-1')).toBe(false);
            expect(mockDisconnectedPlayers.has('uuid-abc')).toBe(true);

            const saved = mockDisconnectedPlayers.get('uuid-abc');
            expect(saved.playerState.x).toBe(500);
            expect(saved.playerState.y).toBe(300);
            expect(saved.playerState.currentHP).toBe(75);
            expect(saved.playerState.level).toBe(3);

            // Should emit playerTemporarilyDisconnected
            expect(socket.broadcast.emit).toHaveBeenCalledWith('playerTemporarilyDisconnected', {
                playerId: 'socket-1',
            });
        });

        it('should emit playerLeft immediately when player has no persistentId', () => {
            const socket = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket, io);

            socket._trigger('disconnect');

            expect(mockPlayers.has('socket-1')).toBe(false);
            expect(mockDisconnectedPlayers.size).toBe(0);
            expect(socket.broadcast.emit).toHaveBeenCalledWith('playerLeft', {
                playerId: 'socket-1',
            });
        });

        it('should delete state and emit playerLeft after grace period expires', () => {
            const socket = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket, io);

            socket._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });
            socket._trigger('disconnect');

            expect(mockDisconnectedPlayers.has('uuid-abc')).toBe(true);

            // Advance time past grace period (30 seconds)
            jest.advanceTimersByTime(30001);

            expect(mockDisconnectedPlayers.has('uuid-abc')).toBe(false);
            expect(io.emit).toHaveBeenCalledWith('playerLeft', {
                playerId: 'socket-1',
            });
        });
    });

    describe('reconnection within grace period', () => {
        it('should restore player state on reconnection', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'curry-bear',
            });

            const player = mockPlayers.get('socket-1');
            player.x = 500;
            player.y = 300;
            player.currentHP = 75;
            player.level = 3;
            player.experience = 2;
            player.storedDamage = 25;
            player.shardCollectCount = 8;
            player.team = 'blue';

            socket1._trigger('disconnect');
            expect(mockPlayers.has('socket-1')).toBe(false);

            // Reconnect with new socket
            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);

            socket2._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'curry-bear',
            });

            const restored = mockPlayers.get('socket-2');
            expect(restored).toBeDefined();
            expect(restored.x).toBe(500);
            expect(restored.y).toBe(300);
            expect(restored.currentHP).toBe(75);
            expect(restored.level).toBe(3);
            expect(restored.experience).toBe(2);
            expect(restored.persistentId).toBe('uuid-abc');
            expect(restored.storedDamage).toBe(25);
            expect(restored.shardCollectCount).toBe(8);

            // disconnectedPlayers should be cleaned up
            expect(mockDisconnectedPlayers.has('uuid-abc')).toBe(false);

            // Should emit reconnected to the client
            expect(socket2.emit).toHaveBeenCalledWith('reconnected', expect.objectContaining({
                playerId: 'socket-2',
                x: 500,
                y: 300,
                currentHP: 75,
                level: 3,
                experience: 2,
            }));

            // Should broadcast playerReconnected
            expect(socket2.broadcast.emit).toHaveBeenCalledWith('playerReconnected', expect.objectContaining({
                playerId: 'socket-2',
            }));
        });

        it('should clear cleanup timer on reconnection', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });
            socket1._trigger('disconnect');

            // Reconnect
            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);
            socket2._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });

            // Advance time past original grace period
            jest.advanceTimersByTime(35000);

            // Player should still be active
            expect(mockPlayers.has('socket-2')).toBe(true);
            // playerLeft should NOT have been called for this player
            const playerLeftCalls = (io.emit as jest.MockedFunction<typeof io.emit>).mock.calls.filter(
                (call: unknown[]) => call[0] === 'playerLeft'
            );
            expect(playerLeftCalls.length).toBe(0);
        });

        it('should treat different UUID as new player', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });
            const player = mockPlayers.get('socket-1');
            player.currentHP = 50;
            socket1._trigger('disconnect');

            // Connect with different UUID
            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);
            socket2._trigger('identify', {
                playerId: 'uuid-xyz',
                playerName: 'DifferentPlayer',
                characterId: 'alien',
            });

            const newPlayer = mockPlayers.get('socket-2');
            expect(newPlayer.currentHP).toBe(100); // Default HP
            expect(newPlayer.persistentId).toBe('uuid-xyz');

            // Original saved state should still exist
            expect(mockDisconnectedPlayers.has('uuid-abc')).toBe(true);
        });
    });

    describe('time-based state cleanup on reconnection', () => {
        it('should expire rageActive if elapsed time exceeds rage duration', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'big-sis-hulk',
            });
            const player = mockPlayers.get('socket-1');
            player.rageActive = true;
            player.rageStartTime = Date.now();
            player.characterId = 'big-sis-hulk';

            socket1._trigger('disconnect');

            // Advance time beyond rage duration (5 seconds)
            jest.advanceTimersByTime(6000);

            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);
            socket2._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'big-sis-hulk',
            });

            const restored = mockPlayers.get('socket-2');
            expect(restored.rageActive).toBe(false);
        });

        it('should keep rageActive if reconnection is within rage duration', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'big-sis-hulk',
            });
            const player = mockPlayers.get('socket-1');
            player.rageActive = true;
            player.rageStartTime = Date.now();

            socket1._trigger('disconnect');

            // 2 seconds < 5 seconds rage duration
            jest.advanceTimersByTime(2000);

            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);
            socket2._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'big-sis-hulk',
            });

            const restored = mockPlayers.get('socket-2');
            expect(restored.rageActive).toBe(true);
        });

        it('should always clear confusion and rat illusion on reconnection', () => {
            const socket1 = createMockSocket('socket-1');
            const io = createMockIO();
            registerPlayerHandlers(socket1, io);

            socket1._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });
            const player = mockPlayers.get('socket-1');
            player.confusedUntil = Date.now() + 10000;
            player.ratIllusionUntil = Date.now() + 10000;

            socket1._trigger('disconnect');
            jest.advanceTimersByTime(1000);

            const socket2 = createMockSocket('socket-2');
            registerPlayerHandlers(socket2, io);
            socket2._trigger('identify', {
                playerId: 'uuid-abc',
                playerName: 'TestPlayer',
                characterId: 'alien',
            });

            const restored = mockPlayers.get('socket-2');
            expect(restored.confusedUntil).toBeUndefined();
            expect(restored.ratIllusionUntil).toBeUndefined();
        });
    });
});
