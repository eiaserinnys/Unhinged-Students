/**
 * @fileoverview Tests for ratIllusionHandler (Squeak-Squeak Q skill)
 *
 * Covers: rate limiting, caster validation, target selection,
 * HP drain, auto-end, rat click success/fail, disconnect cleanup.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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

const mockSharedConfig = {
    GAME_CONFIG: {
        SKILL_RAT_ILLUSION: {
            COOLDOWN_MS: 5000,
            RAT_COUNT: 5,
            DURATION_MS: 5000,
            HP_DRAIN_PER_SECOND: 10,
            EFFECT_RADIUS: 200,
            DUMMY_DAMAGE_MULTIPLIER: 3,
        },
        PLAYER: { RESPAWN_DELAY_MS: 3000 },
    },
};

const mockServerConfig = {
    SERVER_CONFIG: {
        RATE_LIMIT: { RAT_ILLUSION_MS: 5000 },
        PLAYER: { RESPAWN_DELAY_MS: 3000 },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayers = new Map<string, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDummies = new Map<number, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRateLimit: jest.Mock = jest.fn(() => true);

const mockGameState = {
    players: mockPlayers,
    dummies: mockDummies,
    rateLimit: mockRateLimit,
};

jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../shared/config', () => mockSharedConfig);
jest.mock('../../../server/config', () => mockServerConfig);
jest.mock('../../../server/gameState', () => mockGameState);

// ========================================
// HELPERS
// ========================================

type EventHandler = (...args: unknown[]) => void;

function createSocket(id: string) {
    const handlers = new Map<string, EventHandler>();
    const toEmitFn = jest.fn();
    return {
        id,
        on: jest.fn((event: string, handler: EventHandler) => {
            handlers.set(event, handler);
        }),
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        _handlers: handlers,
        _toEmit: toEmitFn,
        _trigger(event: string, ...args: unknown[]) {
            const h = this._handlers.get(event);
            if (h) h(...args);
        },
    };
}

function createIO() {
    const toEmit = jest.fn();
    return {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: toEmit }),
        _toEmit: toEmit,
    };
}

function createPlayer(overrides: Record<string, unknown> = {}) {
    return {
        x: 100,
        y: 100,
        currentHP: 100,
        maxHP: 100,
        isDead: false,
        team: 'red',
        ...overrides,
    };
}

// ========================================
// TESTS
// ========================================

describe('ratIllusionHandler', () => {
    let socket: ReturnType<typeof createSocket>;
    let io: ReturnType<typeof createIO>;
    let registerRatIllusionHandlers: (s: unknown, i: unknown) => void;

    beforeEach(() => {
        jest.useFakeTimers();
        mockPlayers.clear();
        mockDummies.clear();
        jest.clearAllMocks();
        mockRateLimit.mockReturnValue(true);

        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mod = require('../../../server/handlers/combat/ratIllusionHandler');
            registerRatIllusionHandlers = mod.registerRatIllusionHandlers;
        });

        socket = createSocket('caster-1');
        io = createIO();
        registerRatIllusionHandlers(socket, io);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ----------------------------------------
    describe('rate limiting', () => {
        it('should block ratIllusion when rate limited', () => {
            mockRateLimit.mockReturnValue(false);
            mockPlayers.set('caster-1', createPlayer());
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 110 }));

            socket._trigger('ratIllusion', {});

            expect(io.emit).not.toHaveBeenCalled();
            expect(socket.emit).not.toHaveBeenCalled();
            expect(io.to).not.toHaveBeenCalled();
        });

        it('should call rateLimit with correct key and interval', () => {
            mockPlayers.set('caster-1', createPlayer());
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 110 }));

            socket._trigger('ratIllusion', {});

            expect(mockRateLimit).toHaveBeenCalledWith(
                'caster-1',
                'ratIllusion',
                mockServerConfig.SERVER_CONFIG.RATE_LIMIT.RAT_ILLUSION_MS
            );
        });
    });

    // ----------------------------------------
    describe('caster validation', () => {
        it('should ignore if caster not found', () => {
            socket._trigger('ratIllusion', {});
            expect(io.emit).not.toHaveBeenCalled();
        });

        it('should ignore if caster is dead', () => {
            mockPlayers.set('caster-1', createPlayer({ isDead: true }));
            socket._trigger('ratIllusion', {});
            expect(io.emit).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------
    describe('target selection', () => {
        it('should auto-target nearest enemy', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('near', createPlayer({ team: 'blue', x: 50, y: 0 }));
            mockPlayers.set('far', createPlayer({ team: 'blue', x: 500, y: 0 }));

            socket._trigger('ratIllusion', {});

            expect(io.to).toHaveBeenCalledWith('near');
        });

        it('should not target same-team players', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0, team: 'red' }));
            mockPlayers.set('ally', createPlayer({ team: 'red', x: 50, y: 0 }));

            socket._trigger('ratIllusion', {});

            expect(io.to).not.toHaveBeenCalled();
        });

        it('should not target dead players', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('dead-enemy', createPlayer({ team: 'blue', x: 50, y: 0, isDead: true }));

            socket._trigger('ratIllusion', {});

            expect(io.to).not.toHaveBeenCalled();
        });

        it('should use specified targetId when provided', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('near', createPlayer({ team: 'blue', x: 50, y: 0 }));
            mockPlayers.set('far', createPlayer({ team: 'blue', x: 500, y: 0 }));

            socket._trigger('ratIllusion', { targetId: 'far' });

            expect(io.to).toHaveBeenCalledWith('far');
        });
    });

    // ----------------------------------------
    describe('illusion effect', () => {
        beforeEach(() => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0 }));
        });

        it('should send ratIllusionStart to target only (without real rat index)', () => {
            socket._trigger('ratIllusion', {});

            expect(io.to).toHaveBeenCalledWith('target-1');
            expect(io._toEmit).toHaveBeenCalledWith(
                'ratIllusionStart',
                expect.objectContaining({
                    ratCount: 5,
                    duration: 5000,
                })
            );
            // real rat index must NOT be sent to target
            const callArgs = (io._toEmit as jest.Mock).mock.calls[0] as [string, Record<string, unknown>];
            expect(callArgs[1]).not.toHaveProperty('realRatIndex');
        });

        it('should send ratIllusionCast back to caster', () => {
            socket._trigger('ratIllusion', {});

            expect(socket.emit).toHaveBeenCalledWith(
                'ratIllusionCast',
                expect.objectContaining({ targetId: 'target-1' })
            );
        });

        it('should broadcast ratIllusionEffect to others', () => {
            socket._trigger('ratIllusion', {});

            expect(socket.broadcast.emit).toHaveBeenCalledWith(
                'ratIllusionEffect',
                expect.objectContaining({ casterId: 'caster-1', targetId: 'target-1' })
            );
        });

        it('should drain target HP by HP_DRAIN_PER_SECOND every second', () => {
            socket._trigger('ratIllusion', {});
            const target = mockPlayers.get('target-1')!;
            expect(target.currentHP).toBe(100);

            jest.advanceTimersByTime(1000);
            expect(target.currentHP).toBe(90);

            jest.advanceTimersByTime(1000);
            expect(target.currentHP).toBe(80);
        });

        it('should broadcast ratIllusionDrain when draining', () => {
            socket._trigger('ratIllusion', {});
            jest.advanceTimersByTime(1000);

            expect(io.emit).toHaveBeenCalledWith(
                'ratIllusionDrain',
                expect.objectContaining({ targetId: 'target-1', damage: 10 })
            );
        });

        it('should auto-end illusion after DURATION_MS', () => {
            socket._trigger('ratIllusion', {});

            jest.advanceTimersByTime(5001);

            const endCalls = (io.emit as jest.Mock).mock.calls.filter(
                (c) => c[0] === 'ratIllusionEnd'
            );
            expect(endCalls.length).toBeGreaterThan(0);
            expect(endCalls[0][1]).toMatchObject({ targetId: 'target-1', reason: 'timeout' });
        });

        it('should emit playerDied when target HP reaches 0', () => {
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0, currentHP: 5 }));
            socket._trigger('ratIllusion', {});

            jest.advanceTimersByTime(1000);

            expect(io.emit).toHaveBeenCalledWith(
                'playerDied',
                expect.objectContaining({ playerId: 'target-1', killedBy: 'caster-1' })
            );
        });
    });

    // ----------------------------------------
    describe('rat click', () => {
        it('should end illusion and emit success when real rat is found', () => {
            // Fix realRatIndex = 2 via Math.random mock
            const origRandom = Math.random;
            Math.random = () => 0.5; // floor(0.5 * 5) = 2

            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0 }));
            socket._trigger('ratIllusion', {});
            Math.random = origRandom;

            const targetSocket = createSocket('target-1');
            registerRatIllusionHandlers(targetSocket, io);

            jest.clearAllMocks();
            targetSocket._trigger('ratClick', { ratIndex: 2 }); // 진짜 쥐

            expect(io._toEmit).toHaveBeenCalledWith('ratIllusionSuccess', expect.any(Object));
        });

        it('should emit ratIllusionFail when wrong rat is clicked', () => {
            // Fix realRatIndex = 4 via Math.random mock
            const origRandom = Math.random;
            Math.random = () => 0.9; // floor(0.9 * 5) = 4

            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0 }));
            socket._trigger('ratIllusion', {});
            Math.random = origRandom;

            const targetSocket = createSocket('target-1');
            registerRatIllusionHandlers(targetSocket, io);

            jest.clearAllMocks();
            targetSocket._trigger('ratClick', { ratIndex: 0 }); // 가짜 쥐 (real=4)

            expect(io._toEmit).toHaveBeenCalledWith('ratIllusionFail', expect.any(Object));
        });

        it('should ignore rat click when no active illusion', () => {
            const targetSocket = createSocket('target-1');
            registerRatIllusionHandlers(targetSocket, io);

            targetSocket._trigger('ratClick', { ratIndex: 0 });

            expect(io.to).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------
    describe('disconnect cleanup', () => {
        it('should end illusion when target disconnects', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0 }));
            socket._trigger('ratIllusion', {});

            jest.clearAllMocks();

            const targetSocket = createSocket('target-1');
            registerRatIllusionHandlers(targetSocket, io);
            targetSocket._trigger('disconnect');

            const endCalls = (io.emit as jest.Mock).mock.calls.filter(
                (c) => c[0] === 'ratIllusionEnd'
            );
            expect(endCalls.length).toBeGreaterThan(0);
        });

        it('should end illusion when caster disconnects', () => {
            mockPlayers.set('caster-1', createPlayer({ x: 0, y: 0 }));
            mockPlayers.set('target-1', createPlayer({ team: 'blue', x: 50, y: 0 }));
            socket._trigger('ratIllusion', {});

            jest.clearAllMocks();
            socket._trigger('disconnect');

            const endCalls = (io.emit as jest.Mock).mock.calls.filter(
                (c) => c[0] === 'ratIllusionEnd'
            );
            expect(endCalls.length).toBeGreaterThan(0);
        });
    });
});
