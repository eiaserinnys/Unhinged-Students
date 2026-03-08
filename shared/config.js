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

    // =====================================
    // TEAM
    // =====================================
    TEAM: {
        RED: 'red',
        BLUE: 'blue',
        MAX_PLAYERS_PER_TEAM: 5,
    },

    // =====================================
    // Crazy-Eyes - Wave Attack (기본 공격)
    // =====================================
    SKILL_WAVE: {
        RADIUS: 250,
        DAMAGE: 15,
        CONFUSION_DURATION_MS: 3000,    // 혼란 지속 3초
        COOLDOWN_MS: 2000,
    },

    // =====================================
    // Crazy-Eyes - Madness Walk (광기 산책)
    // =====================================
    SKILL_MADNESS: {
        RADIUS: 150,
        DAMAGE_PER_TICK: 1,             // 틱당 1 데미지 (초당 5)
        DURATION_MS: 5000,
        TICK_INTERVAL_MS: 200,
        COOLDOWN_MS: 10000,
    },

    // =====================================
    // Curry-Bear - Pot Smash (냄비 내려치기)
    // =====================================
    SKILL_POT_SMASH: {
        DAMAGE: 45,                     // 메인 데미지
        SPLASH_DAMAGE: 20,              // 스플래시 데미지
        RANGE: 250,                     // 부채꼴 거리
        ANGLE: 150,                     // 부채꼴 각도
        SPLASH_RADIUS: 120,             // 스플래시 범위
        COOLDOWN_MS: 1500,
    },

    // =====================================
    // Curry-Bear - Curry Recovery (카레 회복)
    // =====================================
    SKILL_CURRY_RECOVERY: {
        MAX_STORED_DAMAGE: 50,          // 최대 저장 가능한 대미지
        STORE_RATIO: 0.5,               // 받은 대미지의 50% 저장
        COOLDOWN_MS: 8000,
    },

    // =====================================
    // Hulk-Sister - Spin Throw (돌려 던지기)
    // =====================================
    SKILL_SPIN_THROW: {
        GRAB_RANGE: 150,                // 잡기 범위
        THROW_DISTANCE: 300,            // 던지는 거리
        DAMAGE: 30,                     // 기본 대미지
        COLLISION_DAMAGE: 20,           // 충돌 대미지
        COOLDOWN_MS: 2000,
    },

    // =====================================
    // Hulk-Sister - Rage (폭주)
    // =====================================
    SKILL_RAGE: {
        DURATION_MS: 5000,              // 5초간 지속
        DAMAGE_MULTIPLIER: 2.0,         // 대미지 2배
        THROW_MULTIPLIER: 1.5,          // 던지기 거리 1.5배
        COOLDOWN_MS: 20000,
    },

    // =====================================
    // Hulk-Sister - Passive (분노 스택)
    // =====================================
    HULK_PASSIVE: {
        MAX_STACKS: 10,                 // 최대 분노 스택
        DAMAGE_PER_STACK: 0.1,          // 스택당 10% 대미지 증가
        THROW_PER_STACK: 0.05,          // 스택당 5% 던지기 거리 증가
        STACK_DURATION_MS: 10000,       // 스택 유지 시간
    },

    // =====================================
    // Hulk-Sister - Stats
    // =====================================
    HULK_STATS: {
        MAX_HP: 150,                    // 높은 체력!
    },
};

// Export for Node.js (server-side)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_CONFIG };
}
