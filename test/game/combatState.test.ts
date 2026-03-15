/**
 * @fileoverview Tests for game/combatState.ts
 *
 * Tests updateStoredDamage and triggerCurryRecoveryEffect.
 * These are simple state-mutation functions that can be tested
 * by mocking their dependencies (gameState, skillExecutor, logger).
 *
 * Note: The source combatState.ts uses .js extensions in its imports
 * (moduleResolution: "bundler" style). We need moduleNameMapper in
 * jest.config to strip .js → .ts, or we mock the bare paths and add
 * the mapping. Since the client jest config doesn't have this mapper,
 * we add it here via jest.config override approach.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ========================================
// MOCKS
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGameState: Record<string, any> = {
    storedDamage: 0,
    maxStoredDamage: 0,
    curryRecoveryActive: false,
    curryRecoveryStartTime: 0,
    player: null,
};

const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock paths without .js extension — jest.mock resolves against the jest resolver,
// not the TypeScript/Vite bundler resolver. The source file's .js imports will be
// resolved by ts-jest's moduleNameMapper (added below in jest config).
jest.mock('../../src/utils/logger', () => ({ logger: mockLogger }));
jest.mock('../../src/core/gameState', () => ({ gameState: mockGameState }));
jest.mock('../../src/game/skillExecutor', () => ({
    getRatIllusionEffect: jest.fn(() => null),
    setRatIllusionEffect: jest.fn(),
}));

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const combatState = require('../../src/game/combatState');
const { updateStoredDamage, triggerCurryRecoveryEffect } = combatState;

// ========================================
// TESTS
// ========================================

describe('combatState', () => {
    beforeEach(() => {
        mockGameState.storedDamage = 0;
        mockGameState.maxStoredDamage = 0;
        mockGameState.curryRecoveryActive = false;
        mockGameState.curryRecoveryStartTime = 0;
        jest.clearAllMocks();
    });

    describe('updateStoredDamage', () => {
        it('should set storedDamage and maxStoredDamage on gameState', () => {
            updateStoredDamage(25, 50);

            expect(mockGameState.storedDamage).toBe(25);
            expect(mockGameState.maxStoredDamage).toBe(50);
        });

        it('should overwrite previous values', () => {
            updateStoredDamage(10, 50);
            updateStoredDamage(30, 50);

            expect(mockGameState.storedDamage).toBe(30);
        });

        it('should handle zero values', () => {
            updateStoredDamage(0, 0);

            expect(mockGameState.storedDamage).toBe(0);
            expect(mockGameState.maxStoredDamage).toBe(0);
        });
    });

    describe('triggerCurryRecoveryEffect', () => {
        it('should activate curry recovery effect', () => {
            triggerCurryRecoveryEffect(25);

            expect(mockGameState.curryRecoveryActive).toBe(true);
            expect(mockGameState.curryRecoveryStartTime).toBeGreaterThan(0);
        });

        it('should reset storedDamage to 0', () => {
            mockGameState.storedDamage = 30;
            triggerCurryRecoveryEffect(30);

            expect(mockGameState.storedDamage).toBe(0);
        });

        it('should set curryRecoveryStartTime to current time', () => {
            const before = Date.now();
            triggerCurryRecoveryEffect(10);
            const after = Date.now();

            expect(mockGameState.curryRecoveryStartTime).toBeGreaterThanOrEqual(before);
            expect(mockGameState.curryRecoveryStartTime).toBeLessThanOrEqual(after);
        });
    });
});
