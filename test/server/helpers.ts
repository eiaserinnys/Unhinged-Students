/**
 * @fileoverview Shared test helpers for server handler tests.
 *
 * Provides reusable mock factories for socket, io, player, and common
 * mock modules (logger, config, validation, gameState).
 */

import { jest } from '@jest/globals';

// ========================================
// TYPE DEFINITIONS
// ========================================

export type EventHandler = (...args: unknown[]) => void;

export interface MockPlayer {
    playerId?: string;
    socketId?: string;
    persistentId?: string;
    team?: string;
    x: number;
    y: number;
    playerName?: string;
    level?: number;
    experience?: number;
    currentHP: number;
    maxHP: number;
    deathTime?: number;
    isDead: boolean;
    characterId?: string;
    lastMoveTime?: number;
    shardCollectCount?: number;
    storedDamage?: number;
    rageActive?: boolean;
    rageStartTime?: number;
    rageStacks?: number;
    rageTimeout?: ReturnType<typeof setTimeout>;
    telepathyLastTickTime?: number;
    madnessLastTickTime?: number;
    madnessStartTime?: number;
    confusedUntil?: number;
    ratIllusionUntil?: number;
}

// ========================================
// MOCK FACTORIES
// ========================================

/**
 * Create a mock socket with event handler tracking.
 * Use `socket._trigger(event, ...args)` to simulate incoming events.
 */
export function createMockSocket(id: string) {
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

/**
 * Create a mock Socket.IO server instance.
 */
export function createMockIO() {
    const toEmit = jest.fn();
    return {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: toEmit }),
    };
}

/**
 * Create a mock player with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
export function createMockPlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
    return {
        playerId: 'test-socket-1',
        x: 100,
        y: 100,
        currentHP: 100,
        maxHP: 100,
        isDead: false,
        level: 1,
        experience: 0,
        playerName: 'TestPlayer',
        characterId: 'alien',
        team: 'red',
        deathTime: 0,
        ...overrides,
    };
}

// ========================================
// MOCK MODULE FACTORIES
// ========================================

/**
 * Create the standard mock logger used by server handler tests.
 */
export function createMockLogger() {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        cheat: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        getLevel: jest.fn(() => 'info'),
    };
}

/**
 * Create mock validation helpers matching server/validation.ts API.
 */
export function createMockValidation() {
    return {
        isValidNumber: jest.fn((val: unknown) => typeof val === 'number' && !isNaN(val as number)),
        isValidString: jest.fn(
            (val: unknown, maxLen: number) =>
                typeof val === 'string' &&
                (val as string).length > 0 &&
                (val as string).length <= maxLen
        ),
        isValidPositiveInt: jest.fn(
            (val: unknown) => Number.isInteger(val) && (val as number) >= 0
        ),
        clampCoordinates: jest.fn((x: number, y: number) => ({ x, y })),
        calculateDistance: jest.fn(() => 0),
    };
}
