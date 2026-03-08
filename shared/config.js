// ========================================
// SHARED GAME CONFIGURATION
// Single Source of Truth (SSOT) for gameplay constants
// Server-authoritative values that both server and client should reference
// ========================================

const GAME_CONFIG = {
    // =====================================
    // WORLD
    // =====================================
    WORLD: {
        WIDTH: 1920,
        HEIGHT: 1080,
    },

    // =====================================
    // PLAYER
    // =====================================
    PLAYER: {
        SPEED: 300,                     // pixels per second
        MAX_HP: 100,
        RESPAWN_DELAY_MS: 3000,         // 3 seconds (server-authoritative)
        RESPAWN_X: 960,                 // Center of game world
        RESPAWN_Y: 540,
    },

    // =====================================
    // COMBAT
    // =====================================
    COMBAT: {
        ATTACK_POWER: 10,
        ATTACK_RANGE: 150,
        ATTACK_COOLDOWN_MS: 500,
        HIT_RADIUS: 67.5,               // Half of character size for collision
    },

    // =====================================
    // KNOCKBACK
    // =====================================
    KNOCKBACK: {
        MIN_DISTANCE: 30,
        MAX_DISTANCE: 100,
        MULTIPLIER_MIN: 1.25,
        MULTIPLIER_MAX: 2.5,
        BOUNDARY_MARGIN: 50,
        LASER_DISTANCE: 50,             // Fixed knockback for laser
    },

    // =====================================
    // SKILL - LASER (Q)
    // =====================================
    SKILL_LASER: {
        DAMAGE: 44,
        MAX_LENGTH: 2000,
        COOLDOWN_MS: 10000,             // 10 seconds (server-authoritative)
    },

    // =====================================
    // SKILL - TELEPORT (W)
    // =====================================
    SKILL_TELEPORT: {
        MAX_DISTANCE: 400,
        MIN_DISTANCE: 200,
        DAMAGE_RADIUS: 100,
        DAMAGE: 12,
        COOLDOWN_MS: 8000,              // 8 seconds
    },

    // =====================================
    // SKILL - TELEPATHY (E)
    // =====================================
    SKILL_TELEPATHY: {
        RADIUS: 180,
        DAMAGE_PER_TICK: 2,
        MAX_HEAL_PER_TICK: 4,
        DURATION_MS: 3000,
        COOLDOWN_MS: 15000,             // 15 seconds (server-authoritative)
        TICK_INTERVAL_MS: 200,          // 200ms between ticks (server validation)
    },

    // =====================================
    // SHARD
    // =====================================
    SHARD: {
        MAX_COUNT: 40,
        INITIAL_COUNT: 20,
        SPAWN_MARGIN: 100,
        COLLECT_DISTANCE: 100,
        RESPAWN_MIN_MS: 3000,
        RESPAWN_VARIANCE_MS: 2000,
    },

    // =====================================
    // DUMMY (Test NPCs)
    // =====================================
    DUMMY: {
        MAX_HP: 30,
        RESPAWN_DELAY_MS: 5000,
        POSITIONS: [
            { offsetX: 300, offsetY: 0, name: 'Dummy 1' },
            { offsetX: -300, offsetY: 0, name: 'Dummy 2' },
            { offsetX: 0, offsetY: 300, name: 'Dummy 3' },
        ],
    },

    // =====================================
    // CHAT
    // =====================================
    CHAT: {
        MAX_MESSAGE_LENGTH: 200,
    },
};

// Export for Node.js (server-side)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONFIG };
}
