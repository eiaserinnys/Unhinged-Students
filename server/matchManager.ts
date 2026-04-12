/**
 * @fileoverview Match Manager — server-authoritative match lifecycle
 *
 * Manages match state (waiting → playing → ended), team kill tracking,
 * timer synchronization, and automatic match reset.
 */
import logger from '../logger';
import { GAME_CONFIG } from '../shared/config';
import { players } from './gameState';
import type {
    TypedServer,
    Team,
    MatchState,
    MatchWinner,
    TeamKills,
} from './types';

// ========================================
// STATE
// ========================================

let matchState: MatchState = 'waiting';
let matchStartTime = 0;
let teamKills: TeamKills = { red: 0, blue: 0 };
let timeSyncInterval: ReturnType<typeof setInterval> | null = null;
let matchEndTimeout: ReturnType<typeof setTimeout> | null = null;
let resetTimeout: ReturnType<typeof setTimeout> | null = null;

// ========================================
// GETTERS (for tests & external reads)
// ========================================

export function getMatchState(): MatchState {
    return matchState;
}

export function getTeamKills(): TeamKills {
    return { ...teamKills };
}

export function getRemainingMs(): number {
    if (matchState !== 'playing') return 0;
    const elapsed = Date.now() - matchStartTime;
    return Math.max(0, GAME_CONFIG.MATCH.DURATION_MS - elapsed);
}

// ========================================
// MATCH LIFECYCLE
// ========================================

export function startMatch(io: TypedServer): void {
    if (matchState === 'playing') return;

    matchState = 'playing';
    matchStartTime = Date.now();
    teamKills = { red: 0, blue: 0 };

    logger.info('Match started');

    // Broadcast initial time sync
    broadcastTimeSync(io);

    // Periodic time + score sync
    timeSyncInterval = setInterval(() => {
        broadcastTimeSync(io);
    }, GAME_CONFIG.MATCH.TIME_SYNC_INTERVAL_MS);

    // Schedule match end
    matchEndTimeout = setTimeout(() => {
        endMatch(io);
    }, GAME_CONFIG.MATCH.DURATION_MS);
}

export function endMatch(io: TypedServer): void {
    if (matchState !== 'playing') return;

    matchState = 'ended';
    clearTimers();

    const winner = determineWinner();
    const durationMs = Date.now() - matchStartTime;

    logger.info(`Match ended — winner: ${winner}, red: ${teamKills.red}, blue: ${teamKills.blue}`);

    io.emit('matchEnd', {
        winner,
        teamKills: { ...teamKills },
        durationMs,
    });

    // Auto-reset after result display
    resetTimeout = setTimeout(() => {
        resetMatch(io);
    }, GAME_CONFIG.MATCH.RESULT_DISPLAY_MS);
}

export function resetMatch(io: TypedServer): void {
    matchState = 'waiting';
    matchStartTime = 0;
    teamKills = { red: 0, blue: 0 };
    clearTimers();

    logger.info('Match reset — waiting for players');
    io.emit('matchReset');

    // Auto-start if enough players
    checkAutoStart(io);
}

// ========================================
// KILL TRACKING
// ========================================

export function recordKill(killerTeam: Team, io: TypedServer): void {
    if (matchState !== 'playing') return;

    teamKills[killerTeam]++;
    logger.debug(`Kill recorded for ${killerTeam} — red: ${teamKills.red}, blue: ${teamKills.blue}`);

    io.emit('matchScoreUpdate', {
        teamKills: { ...teamKills },
    });
}

// ========================================
// AUTO-START CHECK
// ========================================

export function checkAutoStart(io: TypedServer): void {
    if (matchState !== 'waiting') return;

    const playerCount = players.size;
    if (playerCount >= GAME_CONFIG.MATCH.MIN_PLAYERS_TO_START) {
        startMatch(io);
    }
}

// ========================================
// INTERNALS
// ========================================

function determineWinner(): MatchWinner {
    if (teamKills.red > teamKills.blue) return 'red';
    if (teamKills.blue > teamKills.red) return 'blue';
    return 'draw';
}

function broadcastTimeSync(io: TypedServer): void {
    io.emit('matchTimeSync', {
        remainingMs: getRemainingMs(),
        teamKills: { ...teamKills },
    });
}

function clearTimers(): void {
    if (timeSyncInterval) {
        clearInterval(timeSyncInterval);
        timeSyncInterval = null;
    }
    if (matchEndTimeout) {
        clearTimeout(matchEndTimeout);
        matchEndTimeout = null;
    }
    if (resetTimeout) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
    }
}

// For testing: reset all internal state
export function _resetForTest(): void {
    matchState = 'waiting';
    matchStartTime = 0;
    teamKills = { red: 0, blue: 0 };
    clearTimers();
}
