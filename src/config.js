// Game Configuration - Centralized constants for Unhinged Students
// This file consolidates all magic numbers to improve maintainability

const GAME_CONFIG = {
    // =====================================
    // WORLD
    // =====================================
    WORLD: {
        WIDTH: 1920,
        HEIGHT: 1080,
        ASPECT_RATIO: 16 / 9,
    },

    // =====================================
    // PLAYER
    // =====================================
    PLAYER: {
        SPEED: 300,                     // pixels per second
        MAX_HP: 100,
        MAX_LEVEL: 30,
        DISPLAY_SIZE_RATIO: 8,          // canvasHeight / 8
        RESPAWN_DELAY_MS: 5000,         // 5 seconds
        INVINCIBILITY_MS: 300,          // 300ms after being hit
    },

    // =====================================
    // COMBAT
    // =====================================
    COMBAT: {
        ATTACK_POWER: 10,
        ATTACK_RANGE: 150,
        ATTACK_COOLDOWN_MS: 500,        // 0.5 seconds
        ATTACK_ANIMATION_MS: 200,
    },

    // =====================================
    // KNOCKBACK
    // =====================================
    KNOCKBACK: {
        MIN_DISTANCE: 30,               // at max attack range
        MAX_DISTANCE: 100,              // at 0 distance
        DURATION_MS: 200,
        BOUNDARY_MARGIN: 50,
    },

    // =====================================
    // VISUAL EFFECTS
    // =====================================
    EFFECTS: {
        HIT_FLASH_DURATION_MS: 100,
        HIT_VIGNETTE_DURATION_MS: 300,
        CHAT_BUBBLE_DURATION_MS: 3000,
    },

    // =====================================
    // SKILLS - LASER (Q)
    // =====================================
    SKILL_LASER: {
        COOLDOWN_MS: 2000,              // 2 seconds
        AIM_DURATION_MS: 1000,          // 1 second aiming
        FIRE_DURATION_MS: 200,          // 0.2 second firing flash
        DAMAGE: 44,                     // 2x normal attack
        MAX_LENGTH: 2000,
        READY_FLASH_DURATION_MS: 300,
        COLOR: '#FF4444',               // Red
    },

    // =====================================
    // SKILLS - TELEPORT (W)
    // =====================================
    SKILL_TELEPORT: {
        COOLDOWN_MS: 7000,              // 7 seconds
        DISAPPEAR_DURATION_MS: 150,
        APPEAR_DURATION_MS: 200,
        MIN_DISTANCE: 200,
        MAX_DISTANCE: 400,
        DAMAGE_RADIUS: 100,
        DAMAGE: 12,
        COLOR: '#44FF44',               // Green
    },

    // =====================================
    // SKILLS - TELEPATHY (E)
    // =====================================
    SKILL_TELEPATHY: {
        COOLDOWN_MS: 12000,             // 12 seconds
        DURATION_MS: 3000,              // 3 second channeling
        TICK_INTERVAL_MS: 100,          // 0.1 second tick
        RADIUS: 180,
        DAMAGE_PER_TICK: 2,
        MAX_HEAL_PER_TICK: 4,
        COLOR: '#8B5CF6',               // Purple
    },

    // =====================================
    // SHARDS
    // =====================================
    SHARD: {
        SIZE: 20,
        SPAWN_MARGIN: 100,
        MAX_COUNT: 40,
        RESPAWN_INTERVAL_MS: 5000,
        MAX_EFFECTS: 10,                // Performance cap for collection effects
        COLOR: '#00ffff',               // Cyan
    },

    // =====================================
    // DUMMY (Test NPCs)
    // =====================================
    DUMMY: {
        MAX_HP: 30,                     // 3 hits to kill
        RESPAWN_DELAY_MS: 5000,
        POSITIONS: [
            { offsetX: 300, offsetY: 0, name: 'Dummy 1' },
            { offsetX: -300, offsetY: 0, name: 'Dummy 2' },
            { offsetX: 0, offsetY: 300, name: 'Dummy 3' },
        ],
    },

    // =====================================
    // UI
    // =====================================
    UI: {
        SKILL_BOX_SIZE: 60,
        SKILL_BOX_GAP: 10,
        SKILL_BOX_BOTTOM_MARGIN: 30,
        SKILL_BOX_BORDER_RADIUS: 8,
    },

    // =====================================
    // PARTICLES
    // =====================================
    PARTICLE: {
        COLLECT_COUNT: 20,
        MIN_SIZE: 4,
        SIZE_VARIANCE: 4,
        MIN_SPEED: 2,
        SPEED_VARIANCE: 3,
        MIN_DECAY: 0.02,
        DECAY_VARIANCE: 0.02,
        FRICTION: 0.95,
    },
};

// Export for Node.js (server-side) if module is defined
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONFIG };
}
