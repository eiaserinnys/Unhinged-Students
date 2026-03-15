/**
 * @fileoverview Tests for shardHandler.ts — shard collection logic
 *
 * Covers: valid collection, already collected, player too far,
 * level up on shard threshold.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ========================================
// MOCKS
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
        SHARD: {
            SHARDS_PER_LEVEL: 3,
            COLLECT_DISTANCE: 100,
            RESPAWN_MIN_MS: 3000,
            RESPAWN_VARIANCE_MS: 2000,
        },
    },
    SHARD_COLLECT_DISTANCE: 100,
};

const mockValidation = {
    isValidPositiveInt: jest.fn((val: unknown) => Number.isInteger(val) && (val as number) >= 0),
    calculateDistance: jest.fn(() => 0),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayers = new Map<string, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockShards = new Map<number, any>();

const mockGameState = {
    players: mockPlayers,
    shards: mockShards,
};

jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../server/config', () => mockConfig);
jest.mock('../../../server/validation', () => mockValidation);
jest.mock('../../../server/gameState', () => mockGameState);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerShardHandlers } = require('../../../server/handlers/shardHandler');

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
    return {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
}

// ========================================
// TESTS
// ========================================

describe('shardHandler', () => {
    let socket: ReturnType<typeof createMockSocket>;
    let io: ReturnType<typeof createMockIO>;

    beforeEach(() => {
        mockPlayers.clear();
        mockShards.clear();
        jest.clearAllMocks();
        mockValidation.calculateDistance.mockReturnValue(0);

        socket = createMockSocket('socket-1');
        io = createMockIO();

        mockPlayers.set('socket-1', {
            playerId: 'socket-1',
            x: 100,
            y: 100,
            isDead: false,
            level: 1,
            experience: 0,
            shardCollectCount: 0,
        });

        registerShardHandlers(socket, io);
    });

    it('should collect a valid shard when player is in range', () => {
        mockShards.set(1, { id: 1, x: 110, y: 100, collected: false, collectedTime: 0, respawnDelay: 0 });
        mockValidation.calculateDistance.mockReturnValue(10); // within range

        socket._trigger('collectShard', { shardId: 1 });

        const shard = mockShards.get(1);
        expect(shard.collected).toBe(true);
        expect(shard.collectedTime).toBeGreaterThan(0);
        expect(io.emit).toHaveBeenCalledWith(
            'shardCollected',
            expect.objectContaining({ shardId: 1, playerId: 'socket-1' })
        );
    });

    it('should reject collection of already-collected shard', () => {
        mockShards.set(1, { id: 1, x: 110, y: 100, collected: true, collectedTime: Date.now(), respawnDelay: 3000 });

        socket._trigger('collectShard', { shardId: 1 });

        // io.emit should NOT have been called with shardCollected
        expect(io.emit).not.toHaveBeenCalledWith('shardCollected', expect.any(Object));
    });

    it('should reject collection when player is too far from shard', () => {
        mockShards.set(1, { id: 1, x: 500, y: 500, collected: false, collectedTime: 0, respawnDelay: 0 });
        mockValidation.calculateDistance.mockReturnValue(200); // beyond SHARD_COLLECT_DISTANCE=100

        socket._trigger('collectShard', { shardId: 1 });

        const shard = mockShards.get(1);
        expect(shard.collected).toBe(false);
        expect(mockLogger.cheat).toHaveBeenCalledWith(
            expect.stringContaining('Remote shard collection')
        );
    });

    it('should level up player when shard threshold is reached', () => {
        const player = mockPlayers.get('socket-1');
        // Player has collected 2 shards already; next one triggers level up (SHARDS_PER_LEVEL=3)
        player.shardCollectCount = 2;
        player.level = 1;

        mockShards.set(1, { id: 1, x: 110, y: 100, collected: false, collectedTime: 0, respawnDelay: 0 });
        mockValidation.calculateDistance.mockReturnValue(10);

        socket._trigger('collectShard', { shardId: 1 });

        expect(player.level).toBe(2); // newLevel = floor(3 / 3) + 1 = 2
        expect(player.experience).toBe(0); // newExperience = 3 % 3 = 0
        expect(io.emit).toHaveBeenCalledWith(
            'shardCollected',
            expect.objectContaining({ level: 2, experience: 0 })
        );
    });

    it('should reject collection by dead player', () => {
        const player = mockPlayers.get('socket-1');
        player.isDead = true;

        mockShards.set(1, { id: 1, x: 110, y: 100, collected: false, collectedTime: 0, respawnDelay: 0 });

        socket._trigger('collectShard', { shardId: 1 });

        const shard = mockShards.get(1);
        expect(shard.collected).toBe(false);
        expect(io.emit).not.toHaveBeenCalledWith('shardCollected', expect.any(Object));
    });
});
