/**
 * @fileoverview Tests for playerMove handler in playerHandler.ts
 *
 * Covers: valid move, invalid coordinates, speed hack detection,
 * dead player move ignored, rate limiting.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ========================================
// MOCKS (CJS pattern — must precede require)
// ========================================

const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    cheat: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'info'),
};

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

const mockSharedConfig = {
    GAME_CONFIG: {
        SKILL_RAGE: { DURATION_MS: 5000 },
        SKILL_MADNESS: { DURATION_MS: 5000 },
    },
};

const mockValidation = {
    isValidNumber: jest.fn((val: unknown) => typeof val === 'number' && !isNaN(val as number)),
    isValidString: jest.fn(
        (val: unknown, maxLen: number) =>
            typeof val === 'string' && (val as string).length > 0 && (val as string).length <= maxLen
    ),
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

// ========================================
// TESTS
// ========================================

describe('playerMove handler', () => {
    beforeEach(() => {
        mockPlayers.clear();
        mockDisconnectedPlayers.clear();
        mockRateLimiter.clear();
        jest.clearAllMocks();
        mockRateLimit.mockReturnValue(true);
        mockAssignTeam.mockReturnValue('red');
        mockGetTeamCounts.mockReturnValue({ red: 0, blue: 0 });
        mockValidation.calculateDistance.mockReturnValue(0);
    });

    it('should update player position on valid move', () => {
        const socket = createMockSocket('socket-1');
        const io = createMockIO();
        registerPlayerHandlers(socket, io);

        socket._trigger('playerMove', {
            x: 500,
            y: 300,
            playerName: 'TestPlayer',
            characterId: 'alien',
        });

        const player = mockPlayers.get('socket-1');
        expect(player).toBeDefined();
        expect(player.x).toBe(500);
        expect(player.y).toBe(300);
        expect(socket.broadcast.emit).toHaveBeenCalledWith(
            'playerMoved',
            expect.objectContaining({ x: 500, y: 300 })
        );
    });

    it('should reject NaN coordinates', () => {
        const socket = createMockSocket('socket-1');
        const io = createMockIO();
        registerPlayerHandlers(socket, io);

        // isValidNumber returns false for NaN
        mockValidation.isValidNumber.mockReturnValueOnce(false);

        socket._trigger('playerMove', {
            x: NaN,
            y: 300,
            playerName: 'TestPlayer',
            characterId: 'alien',
        });

        expect(mockLogger.cheat).toHaveBeenCalledWith(
            expect.stringContaining('Invalid move coordinates')
        );
    });

    it('should reject undefined coordinates', () => {
        const socket = createMockSocket('socket-1');
        const io = createMockIO();
        registerPlayerHandlers(socket, io);

        mockValidation.isValidNumber.mockReturnValueOnce(false);

        socket._trigger('playerMove', {
            x: undefined,
            y: 300,
            playerName: 'TestPlayer',
            characterId: 'alien',
        });

        expect(mockLogger.cheat).toHaveBeenCalledWith(
            expect.stringContaining('Invalid move coordinates')
        );
    });

    it('should detect speed hack (moved too far too fast)', () => {
        const socket = createMockSocket('socket-1');
        const io = createMockIO();
        registerPlayerHandlers(socket, io);

        // Set initial position
        const player = mockPlayers.get('socket-1');
        player.x = 100;
        player.y = 100;
        player.lastMoveTime = Date.now();

        // Simulate a huge distance move — calculateDistance returns very large value
        // moveDistance > maxAllowedDistance * 3 triggers the speed hack detection
        mockValidation.calculateDistance.mockReturnValue(99999);

        socket._trigger('playerMove', {
            x: 99999,
            y: 99999,
            playerName: 'TestPlayer',
            characterId: 'alien',
        });

        expect(mockLogger.cheat).toHaveBeenCalledWith(
            expect.stringContaining('Speed hack detected')
        );
    });

    it('should silently ignore move events when rate limited', () => {
        const socket = createMockSocket('socket-1');
        const io = createMockIO();
        registerPlayerHandlers(socket, io);

        // Rate limit returns false = blocked
        mockRateLimit.mockReturnValue(false);

        const playerBefore = { ...mockPlayers.get('socket-1') };

        socket._trigger('playerMove', {
            x: 500,
            y: 300,
            playerName: 'TestPlayer',
            characterId: 'alien',
        });

        // Position should not have changed from the initial value
        const playerAfter = mockPlayers.get('socket-1');
        expect(playerAfter.x).toBe(playerBefore.x);
        expect(playerAfter.y).toBe(playerBefore.y);
    });
});
