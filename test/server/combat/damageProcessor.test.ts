/**
 * Damage Processor Tests
 * Tests for shared damage processing utilities
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

// Mock logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    cheat: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'debug'),
};

// Mock validation
const mockValidation = {
    calculateDistance: jest.fn((x1: number, y1: number, x2: number, y2: number) =>
        Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    ),
    calculateKnockbackDistance: jest.fn(() => 50),
    calculateKnockbackEndPosition: jest.fn(
        (_ax: number, _ay: number, tx: number, ty: number, dist: number) => ({
            x: tx + dist,
            y: ty,
        })
    ),
    isValidNumber: jest.fn(() => true),
    isValidString: jest.fn(() => true),
    clampCoordinates: jest.fn((x: number, y: number) => ({ x, y })),
};

// Mock combat
const mockCombat = {
    checkAndHandleDeath: jest.fn(() => false),
};

// Mock game state
interface MockPlayer {
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
    isDead: boolean;
}

interface MockDummy {
    id: string;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
    deathTime?: number;
}

const mockPlayers = new Map<string, MockPlayer>();
const mockDummies = new Map<string, MockDummy>();

const mockGameState = {
    players: mockPlayers,
    dummies: mockDummies,
};

jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../server/validation', () => mockValidation);
jest.mock('../../../shared/combat', () => mockCombat);
jest.mock('../../../server/gameState', () => mockGameState);

interface HitPlayer {
    playerId: string;
    currentHP: number;
    x?: number;
    y?: number;
}

interface KilledPlayer {
    playerId: string;
    killedBy: string;
    respawnDelay: number;
}

interface HitDummy {
    dummyId: string;
    currentHP: number;
}

interface ProcessAreaDamageResult {
    hitPlayers: HitPlayer[];
    killedPlayers: KilledPlayer[];
}

interface ProcessDummyDamageResult {
    hitDummies: HitDummy[];
}

interface BroadcastOptions {
    playerDamageEvent?: string;
    dummyDamageEvent?: string;
}

interface MockIo {
    emit: Mock;
}

describe('DamageProcessor', () => {
    let processAreaDamageToPlayers: (params: {
        attackerId: string;
        x: number;
        y: number;
        radius: number;
        damage: number;
        respawnDelay: number;
        applyKnockback?: boolean;
        knockbackDistance?: number;
    }) => ProcessAreaDamageResult;

    let processAreaDamageToDummies: (params: {
        attackerId: string;
        x: number;
        y: number;
        radius: number;
        damage: number;
    }) => ProcessDummyDamageResult;

    let broadcastDamageEvents: (
        io: MockIo,
        attackerId: string,
        hitPlayers: HitPlayer[],
        killedPlayers: KilledPlayer[],
        hitDummies: HitDummy[],
        options?: BroadcastOptions
    ) => void;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlayers.clear();
        mockDummies.clear();

        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const module = require('../../../server/handlers/combat/damageProcessor');
            processAreaDamageToPlayers = module.processAreaDamageToPlayers;
            processAreaDamageToDummies = module.processAreaDamageToDummies;
            broadcastDamageEvents = module.broadcastDamageEvents;
        });
    });

    describe('processAreaDamageToPlayers', () => {
        it('should return empty arrays when no players exist', () => {
            const result = processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
            });

            expect(result.hitPlayers).toEqual([]);
            expect(result.killedPlayers).toEqual([]);
        });

        it('should skip the attacker', () => {
            mockPlayers.set('attacker-1', {
                x: 100,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            const result = processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
            });

            expect(result.hitPlayers).toEqual([]);
        });

        it('should skip dead players', () => {
            mockPlayers.set('victim-1', {
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: true,
            });

            const result = processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
            });

            expect(result.hitPlayers).toEqual([]);
        });

        it('should damage players within range', () => {
            mockPlayers.set('victim-1', {
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            const result = processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
            });

            expect(result.hitPlayers.length).toBe(1);
            expect(result.hitPlayers[0].playerId).toBe('victim-1');
            expect(result.hitPlayers[0].currentHP).toBe(90);
        });

        it('should not damage players out of range', () => {
            mockPlayers.set('victim-1', {
                x: 200,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            const result = processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
            });

            expect(result.hitPlayers).toEqual([]);
        });

        it('should apply knockback when enabled', () => {
            mockPlayers.set('victim-1', {
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
                applyKnockback: true,
            });

            expect(mockValidation.calculateKnockbackDistance).toHaveBeenCalled();
            expect(mockValidation.calculateKnockbackEndPosition).toHaveBeenCalled();
        });

        it('should not apply knockback when disabled', () => {
            mockPlayers.set('victim-1', {
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
                applyKnockback: false,
            });

            expect(mockValidation.calculateKnockbackEndPosition).not.toHaveBeenCalled();
        });

        it('should use custom knockback distance when provided', () => {
            mockPlayers.set('victim-1', {
                x: 110,
                y: 100,
                currentHP: 100,
                maxHP: 100,
                isDead: false,
            });

            processAreaDamageToPlayers({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
                respawnDelay: 3000,
                knockbackDistance: 100,
            });

            expect(mockValidation.calculateKnockbackEndPosition).toHaveBeenCalledWith(
                100,
                100,
                110,
                100,
                100
            );
        });
    });

    describe('processAreaDamageToDummies', () => {
        it('should return empty array when no dummies exist', () => {
            const result = processAreaDamageToDummies({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
            });

            expect(result.hitDummies).toEqual([]);
        });

        it('should skip dead dummies', () => {
            mockDummies.set('dummy-1', {
                id: 'dummy-1',
                x: 110,
                y: 100,
                currentHP: 0,
                maxHP: 100,
            });

            const result = processAreaDamageToDummies({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
            });

            expect(result.hitDummies).toEqual([]);
        });

        it('should damage dummies within range (including radius bonus)', () => {
            mockDummies.set('dummy-1', {
                id: 'dummy-1',
                x: 160, // 60 pixels away, within 50 + 67.5 = 117.5
                y: 100,
                currentHP: 100,
                maxHP: 100,
            });

            const result = processAreaDamageToDummies({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
            });

            expect(result.hitDummies.length).toBe(1);
            expect(result.hitDummies[0].dummyId).toBe('dummy-1');
            expect(result.hitDummies[0].currentHP).toBe(90);
        });

        it('should set deathTime when dummy dies', () => {
            const dummy: MockDummy = {
                id: 'dummy-1',
                x: 110,
                y: 100,
                currentHP: 5,
                maxHP: 100,
            };
            mockDummies.set('dummy-1', dummy);

            processAreaDamageToDummies({
                attackerId: 'attacker-1',
                x: 100,
                y: 100,
                radius: 50,
                damage: 10,
            });

            expect(dummy.currentHP).toBe(0);
            expect(dummy.deathTime).toBeDefined();
        });
    });

    describe('broadcastDamageEvents', () => {
        let mockIo: MockIo;

        beforeEach(() => {
            mockIo = {
                emit: jest.fn(),
            };
        });

        it('should emit playerDamaged when hitPlayers is not empty', () => {
            const hitPlayers = [{ playerId: 'victim-1', currentHP: 90 }];

            broadcastDamageEvents(mockIo, 'attacker-1', hitPlayers, [], []);

            expect(mockIo.emit).toHaveBeenCalledWith('playerDamaged', {
                attackerId: 'attacker-1',
                hitPlayers,
            });
        });

        it('should emit playerDied for each killed player', () => {
            const killedPlayers = [
                { playerId: 'victim-1', killedBy: 'attacker-1', respawnDelay: 3000 },
                { playerId: 'victim-2', killedBy: 'attacker-1', respawnDelay: 3000 },
            ];

            broadcastDamageEvents(mockIo, 'attacker-1', [], killedPlayers, []);

            expect(mockIo.emit).toHaveBeenCalledWith('playerDied', killedPlayers[0]);
            expect(mockIo.emit).toHaveBeenCalledWith('playerDied', killedPlayers[1]);
        });

        it('should emit dummyDamaged when hitDummies is not empty', () => {
            const hitDummies = [{ dummyId: 'dummy-1', currentHP: 90 }];

            broadcastDamageEvents(mockIo, 'attacker-1', [], [], hitDummies);

            expect(mockIo.emit).toHaveBeenCalledWith('dummyDamaged', {
                attackerId: 'attacker-1',
                hitDummies,
            });
        });

        it('should not emit events for empty arrays', () => {
            broadcastDamageEvents(mockIo, 'attacker-1', [], [], []);

            expect(mockIo.emit).not.toHaveBeenCalled();
        });

        it('should use custom event names when provided', () => {
            const hitPlayers = [{ playerId: 'victim-1', currentHP: 90 }];
            const hitDummies = [{ dummyId: 'dummy-1', currentHP: 90 }];

            broadcastDamageEvents(mockIo, 'attacker-1', hitPlayers, [], hitDummies, {
                playerDamageEvent: 'telepathyTick',
                dummyDamageEvent: 'telepathyTickDummy',
            });

            expect(mockIo.emit).toHaveBeenCalledWith('telepathyTick', expect.any(Object));
            expect(mockIo.emit).toHaveBeenCalledWith('telepathyTickDummy', expect.any(Object));
        });
    });
});
