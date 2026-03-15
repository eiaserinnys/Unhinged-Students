// ========================================
// SERVER CONFIGURATION
// Extends shared GAME_CONFIG with server-specific settings
// (Anti-cheat: ignore client values, use these)
// ========================================

import { GAME_CONFIG, type GameConfigType } from '../shared/config';

// Server-specific configuration
interface ServerOnlyConfig {
    PLAYER: {
        SPEED_TOLERANCE: number;
    };
    RECONNECT_GRACE_PERIOD_MS: number;
    RATE_LIMIT: {
        MOVE_MS: number;
        ATTACK_MS: number;
        CHAT_MS: number;
        TELEPORT_MS: number;
        TELEPORT_DAMAGE_MS: number;
        LASER_MS: number;
        TELEPATHY_MS: number;
        WAVE_MS: number;
        MADNESS_MS: number;
        POT_SMASH_MS: number;
        CURRY_RECOVERY_MS: number;
        RAGE_MS: number;
        SPIN_THROW_MS: number;
    };
}

const SERVER_ONLY_CONFIG: ServerOnlyConfig = {
    // Player server-specific settings
    PLAYER: {
        SPEED_TOLERANCE: 1.5, // Allow 50% variance for network latency
    },

    // Reconnection grace period - player state preserved for this duration
    RECONNECT_GRACE_PERIOD_MS: 30000, // 30 seconds

    // Rate limiting (in milliseconds) - server-only
    RATE_LIMIT: {
        MOVE_MS: 50,
        ATTACK_MS: GAME_CONFIG.COMBAT.ATTACK_COOLDOWN_MS,
        CHAT_MS: 1000,
        TELEPORT_MS: GAME_CONFIG.SKILL_TELEPORT.COOLDOWN_MS,
        TELEPORT_DAMAGE_MS: GAME_CONFIG.SKILL_TELEPORT.COOLDOWN_MS,
        LASER_MS: GAME_CONFIG.SKILL_LASER.COOLDOWN_MS,
        TELEPATHY_MS: GAME_CONFIG.SKILL_TELEPATHY.COOLDOWN_MS,
        WAVE_MS: GAME_CONFIG.SKILL_WAVE.COOLDOWN_MS,
        MADNESS_MS: GAME_CONFIG.SKILL_MADNESS.COOLDOWN_MS,
        POT_SMASH_MS: GAME_CONFIG.SKILL_POT_SMASH.COOLDOWN_MS,
        CURRY_RECOVERY_MS: GAME_CONFIG.SKILL_CURRY_RECOVERY.COOLDOWN_MS,
        RAGE_MS: GAME_CONFIG.SKILL_RAGE.COOLDOWN_MS,
        SPIN_THROW_MS: GAME_CONFIG.SKILL_SPIN_THROW.COOLDOWN_MS,
    },
};

// Extended server config type
export interface ServerConfigType extends GameConfigType {
    PLAYER: GameConfigType['PLAYER'] &
        ServerOnlyConfig['PLAYER'] & {
            MAX_MOVE_DISTANCE_PER_TICK: number;
        };
    RECONNECT_GRACE_PERIOD_MS: number;
    RATE_LIMIT: ServerOnlyConfig['RATE_LIMIT'];
}

// Merge configurations
export const SERVER_CONFIG: ServerConfigType = {
    // Spread shared config
    ...GAME_CONFIG,

    // Override/extend PLAYER with server-specific settings
    PLAYER: {
        ...GAME_CONFIG.PLAYER,
        ...SERVER_ONLY_CONFIG.PLAYER,
        MAX_MOVE_DISTANCE_PER_TICK: 0, // Will be computed below
    },

    // Add server-only sections
    RECONNECT_GRACE_PERIOD_MS: SERVER_ONLY_CONFIG.RECONNECT_GRACE_PERIOD_MS,
    RATE_LIMIT: SERVER_ONLY_CONFIG.RATE_LIMIT,
};

// Computed values
SERVER_CONFIG.PLAYER.MAX_MOVE_DISTANCE_PER_TICK =
    SERVER_CONFIG.PLAYER.SPEED * SERVER_CONFIG.PLAYER.SPEED_TOLERANCE * 0.1;

// Re-export GAME_CONFIG for consumers that need it
export { GAME_CONFIG };
