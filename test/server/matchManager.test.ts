/**
 * Tests for MatchManager — match lifecycle, kill tracking, timer
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock logger before any imports that use it
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'debug'),
};
jest.mock('../../logger', () => mockLogger);

import {
    startMatch,
    endMatch,
    resetMatch,
    recordKill,
    checkAutoStart,
    getMatchState,
    getTeamKills,
    getRemainingMs,
    _resetForTest,
} from '../../server/matchManager';
import { players } from '../../server/gameState';
import type { TypedServer, Player } from '../../server/types';

// Mock io
function createMockIO(): TypedServer {
    const emittedEvents: { event: string; data: unknown }[] = [];
    return {
        emit: jest.fn((event: string, data?: unknown) => {
            emittedEvents.push({ event, data });
            return true;
        }),
        _emittedEvents: emittedEvents,
    } as unknown as TypedServer;
}

function createPlayer(id: string, team: 'red' | 'blue'): Player {
    return {
        playerId: id,
        team,
        x: 100,
        y: 100,
        playerName: `Player-${id}`,
        level: 1,
        experience: 0,
        characterId: 'alien',
        currentHP: 100,
        maxHP: 100,
        deathTime: 0,
        isDead: false,
    };
}

describe('MatchManager', () => {
    let io: TypedServer;

    beforeEach(() => {
        _resetForTest();
        players.clear();
        io = createMockIO();
        jest.useFakeTimers();
    });

    afterEach(() => {
        _resetForTest();
        players.clear();
        jest.useRealTimers();
    });

    describe('startMatch', () => {
        it('transitions state from waiting to playing', () => {
            expect(getMatchState()).toBe('waiting');
            startMatch(io);
            expect(getMatchState()).toBe('playing');
        });

        it('resets team kills to zero', () => {
            startMatch(io);
            expect(getTeamKills()).toEqual({ red: 0, blue: 0 });
        });

        it('emits matchTimeSync immediately', () => {
            startMatch(io);
            expect(io.emit).toHaveBeenCalledWith('matchTimeSync', expect.objectContaining({
                teamKills: { red: 0, blue: 0 },
            }));
        });

        it('does not start if already playing', () => {
            startMatch(io);
            const callCount = (io.emit as jest.Mock).mock.calls.length;
            startMatch(io); // second call should be no-op
            expect((io.emit as jest.Mock).mock.calls.length).toBe(callCount);
        });
    });

    describe('endMatch', () => {
        it('transitions state to ended', () => {
            startMatch(io);
            endMatch(io);
            expect(getMatchState()).toBe('ended');
        });

        it('emits matchEnd with correct winner (red wins)', () => {
            startMatch(io);
            recordKill('red', io);
            recordKill('red', io);
            recordKill('blue', io);
            endMatch(io);

            expect(io.emit).toHaveBeenCalledWith('matchEnd', expect.objectContaining({
                winner: 'red',
                teamKills: { red: 2, blue: 1 },
            }));
        });

        it('emits matchEnd with draw when kills are equal', () => {
            startMatch(io);
            recordKill('red', io);
            recordKill('blue', io);
            endMatch(io);

            expect(io.emit).toHaveBeenCalledWith('matchEnd', expect.objectContaining({
                winner: 'draw',
                teamKills: { red: 1, blue: 1 },
            }));
        });

        it('does nothing if not playing', () => {
            const callCount = (io.emit as jest.Mock).mock.calls.length;
            endMatch(io);
            expect((io.emit as jest.Mock).mock.calls.length).toBe(callCount);
        });
    });

    describe('resetMatch', () => {
        it('transitions state back to waiting', () => {
            startMatch(io);
            endMatch(io);
            resetMatch(io);
            expect(getMatchState()).toBe('waiting');
        });

        it('emits matchReset', () => {
            startMatch(io);
            endMatch(io);
            resetMatch(io);
            expect(io.emit).toHaveBeenCalledWith('matchReset');
        });

        it('auto-starts if enough players are connected', () => {
            players.set('p1', createPlayer('p1', 'red'));
            players.set('p2', createPlayer('p2', 'blue'));
            resetMatch(io);
            expect(getMatchState()).toBe('playing');
        });
    });

    describe('recordKill', () => {
        it('increments team kill count', () => {
            startMatch(io);
            recordKill('red', io);
            expect(getTeamKills().red).toBe(1);
            expect(getTeamKills().blue).toBe(0);
        });

        it('emits matchScoreUpdate', () => {
            startMatch(io);
            recordKill('blue', io);
            expect(io.emit).toHaveBeenCalledWith('matchScoreUpdate', {
                teamKills: { red: 0, blue: 1 },
            });
        });

        it('does nothing when match is not playing', () => {
            recordKill('red', io);
            expect(getTeamKills().red).toBe(0);
        });
    });

    describe('checkAutoStart', () => {
        it('starts match when enough players', () => {
            players.set('p1', createPlayer('p1', 'red'));
            players.set('p2', createPlayer('p2', 'blue'));
            checkAutoStart(io);
            expect(getMatchState()).toBe('playing');
        });

        it('does not start with fewer than minimum players', () => {
            players.set('p1', createPlayer('p1', 'red'));
            checkAutoStart(io);
            expect(getMatchState()).toBe('waiting');
        });

        it('does not start if already playing', () => {
            players.set('p1', createPlayer('p1', 'red'));
            players.set('p2', createPlayer('p2', 'blue'));
            startMatch(io);
            const callCount = (io.emit as jest.Mock).mock.calls.length;
            checkAutoStart(io); // should be no-op
            expect((io.emit as jest.Mock).mock.calls.length).toBe(callCount);
        });
    });

    describe('timer', () => {
        it('returns remaining time while playing', () => {
            startMatch(io);
            // Just started, remaining should be close to DURATION_MS
            expect(getRemainingMs()).toBeGreaterThan(0);
        });

        it('returns 0 when not playing', () => {
            expect(getRemainingMs()).toBe(0);
        });

        it('auto-ends match when timer expires', () => {
            startMatch(io);
            // Fast-forward past match duration
            jest.advanceTimersByTime(180001);
            expect(getMatchState()).toBe('ended');
            expect(io.emit).toHaveBeenCalledWith('matchEnd', expect.anything());
        });

        it('auto-resets after result display period', () => {
            startMatch(io);
            jest.advanceTimersByTime(180001); // match ends
            jest.advanceTimersByTime(8001);   // result display ends
            expect(getMatchState()).toBe('waiting');
        });

        it('broadcasts time sync every second', () => {
            startMatch(io);
            const initialCalls = (io.emit as jest.Mock).mock.calls.filter(
                (c: unknown[]) => c[0] === 'matchTimeSync'
            ).length;

            jest.advanceTimersByTime(3000);

            const afterCalls = (io.emit as jest.Mock).mock.calls.filter(
                (c: unknown[]) => c[0] === 'matchTimeSync'
            ).length;

            // Should have at least 3 more syncs (1 per second)
            expect(afterCalls - initialCalls).toBeGreaterThanOrEqual(3);
        });
    });
});
