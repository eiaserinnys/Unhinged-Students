// ========================================
// SHARED GAME CONFIGURATION
// Single Source of Truth (SSOT) for gameplay constants
// Server-authoritative values that both server and client should reference
// ========================================

export interface DummyPosition {
    offsetX: number;
    offsetY: number;
    name: string;
}

export interface GameConfigType {
    WORLD: {
        WIDTH: number;
        HEIGHT: number;
    };
    PLAYER: {
        SPEED: number;
        MAX_HP: number;
        RESPAWN_DELAY_MS: number;
        RESPAWN_X: number;
        RESPAWN_Y: number;
    };
    COMBAT: {
        ATTACK_POWER: number;
        ATTACK_RANGE: number;
        ATTACK_COOLDOWN_MS: number;
        HIT_RADIUS: number;
        DUMMY_RADIUS_BONUS: number;
    };
    KNOCKBACK: {
        MIN_DISTANCE: number;
        MAX_DISTANCE: number;
        MULTIPLIER_MIN: number;
        MULTIPLIER_MAX: number;
        BOUNDARY_MARGIN: number;
        LASER_DISTANCE: number;
    };
    SKILL_LASER: {
        DAMAGE: number;
        MAX_LENGTH: number;
        COOLDOWN_MS: number;
    };
    SKILL_TELEPORT: {
        MAX_DISTANCE: number;
        MIN_DISTANCE: number;
        DAMAGE_RADIUS: number;
        DAMAGE: number;
        COOLDOWN_MS: number;
    };
    SKILL_TELEPATHY: {
        RADIUS: number;
        DAMAGE_PER_TICK: number;
        MAX_HEAL_PER_TICK: number;
        DURATION_MS: number;
        COOLDOWN_MS: number;
        TICK_INTERVAL_MS: number;
    };
    SHARD: {
        MAX_COUNT: number;
        INITIAL_COUNT: number;
        SPAWN_MARGIN: number;
        COLLECT_DISTANCE: number;
        RESPAWN_MIN_MS: number;
        RESPAWN_VARIANCE_MS: number;
        SHARDS_PER_LEVEL: number;
    };
    DUMMY: {
        MAX_HP: number;
        RESPAWN_DELAY_MS: number;
        POSITIONS: DummyPosition[];
    };
    CHAT: {
        MAX_MESSAGE_LENGTH: number;
    };
    TEAM: {
        RED: 'red';
        BLUE: 'blue';
        MAX_PLAYERS_PER_TEAM: number;
    };
    SKILL_WAVE: {
        RADIUS: number;
        DAMAGE: number;
        CONFUSION_DURATION_MS: number;
        COOLDOWN_MS: number;
    };
    SKILL_MADNESS: {
        RADIUS: number;
        DAMAGE_PER_TICK: number;
        DURATION_MS: number;
        TICK_INTERVAL_MS: number;
        COOLDOWN_MS: number;
    };
    SKILL_POT_SMASH: {
        DAMAGE: number;
        SPLASH_DAMAGE: number;
        RANGE: number;
        ANGLE: number;
        SPLASH_RADIUS: number;
        COOLDOWN_MS: number;
    };
    SKILL_CURRY_RECOVERY: {
        MAX_STORED_DAMAGE: number;
        STORE_RATIO: number;
        COOLDOWN_MS: number;
    };
    SKILL_SPIN_THROW: {
        GRAB_RANGE: number;
        THROW_DISTANCE: number;
        DAMAGE: number;
        COLLISION_DAMAGE: number;
        COLLISION_RADIUS: number;
        COOLDOWN_MS: number;
    };
    SKILL_RAGE: {
        DURATION_MS: number;
        DAMAGE_MULTIPLIER: number;
        THROW_MULTIPLIER: number;
        COOLDOWN_MS: number;
    };
    HULK_PASSIVE: {
        MAX_STACKS: number;
        DAMAGE_PER_STACK: number;
        THROW_PER_STACK: number;
        STACK_DURATION_MS: number;
    };
    HULK_STATS: {
        MAX_HP: number;
    };
    SKILL_RAT_ILLUSION: {
        COOLDOWN_MS: number;
        RAT_COUNT: number;
        DURATION_MS: number;
        HP_DRAIN_PER_SECOND: number;
        RAT_SPEED: number;
        EFFECT_RADIUS: number;
        DUMMY_DAMAGE_MULTIPLIER: number;
    };
    SKILL_SLEEP_POWDER: {
        COOLDOWN_MS: number;
        RADIUS: number;
        SLEEP_DURATION_MS: number;
    };
    SKILL_RAT_BOMB: {
        COOLDOWN_MS: number;
        EXPLOSION_DAMAGE: number;
        EXPLOSION_RADIUS: number;
        RAT_COUNT: number;
        RAT_DAMAGE: number;
        RAT_DURATION_MS: number;
    };
    SKILL_DOLL_HUG: {
        COOLDOWN_MS: number;
        SHIELD_HP: number;
        REFLECT_RATIO: number;
        DURATION_MS: number;
        WEAK_POINTS: number;
    };
    SKILL_RAT_REVIVE: {
        COOLDOWN_MS: number;
        REVIVE_HP_RATIO: number;
    };
    SQUEAK_STATS: {
        MAX_HP: number;
        SPEED: number;
    };
}

export const GAME_CONFIG: GameConfigType = {
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
        SPEED: 300, // pixels per second
        MAX_HP: 100,
        RESPAWN_DELAY_MS: 3000, // 3 seconds (server-authoritative)
        RESPAWN_X: 960, // Center of game world
        RESPAWN_Y: 540,
    },

    // =====================================
    // COMBAT
    // =====================================
    COMBAT: {
        ATTACK_POWER: 10,
        ATTACK_RANGE: 150,
        ATTACK_COOLDOWN_MS: 500,
        HIT_RADIUS: 67.5, // Half of character size for collision
        DUMMY_RADIUS_BONUS: 67.5, // Extra radius for dummy hit detection
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
        LASER_DISTANCE: 50, // Fixed knockback for laser
    },

    // =====================================
    // SKILL - LASER (Q)
    // =====================================
    SKILL_LASER: {
        DAMAGE: 44,
        MAX_LENGTH: 2000,
        COOLDOWN_MS: 10000, // 10 seconds (server-authoritative)
    },

    // =====================================
    // SKILL - TELEPORT (W)
    // =====================================
    SKILL_TELEPORT: {
        MAX_DISTANCE: 400,
        MIN_DISTANCE: 200,
        DAMAGE_RADIUS: 100,
        DAMAGE: 12,
        COOLDOWN_MS: 8000, // 8 seconds
    },

    // =====================================
    // SKILL - TELEPATHY (E)
    // =====================================
    SKILL_TELEPATHY: {
        RADIUS: 180,
        DAMAGE_PER_TICK: 2,
        MAX_HEAL_PER_TICK: 4,
        DURATION_MS: 3000,
        COOLDOWN_MS: 15000, // 15 seconds (server-authoritative)
        TICK_INTERVAL_MS: 200, // 200ms between ticks (server validation)
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
        SHARDS_PER_LEVEL: 3, // Shards needed to gain one level
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
        CONFUSION_DURATION_MS: 3000, // 혼란 지속 3초
        COOLDOWN_MS: 2000,
    },

    // =====================================
    // Crazy-Eyes - Madness Walk (광기 산책)
    // =====================================
    SKILL_MADNESS: {
        RADIUS: 150,
        DAMAGE_PER_TICK: 1, // 틱당 1 데미지 (초당 5)
        DURATION_MS: 5000,
        TICK_INTERVAL_MS: 200,
        COOLDOWN_MS: 10000,
    },

    // =====================================
    // Curry-Bear - Pot Smash (냄비 내려치기)
    // =====================================
    SKILL_POT_SMASH: {
        DAMAGE: 45, // 메인 데미지
        SPLASH_DAMAGE: 20, // 스플래시 데미지
        RANGE: 250, // 부채꼴 거리
        ANGLE: 150, // 부채꼴 각도
        SPLASH_RADIUS: 120, // 스플래시 범위
        COOLDOWN_MS: 1500,
    },

    // =====================================
    // Curry-Bear - Curry Recovery (카레 회복)
    // =====================================
    SKILL_CURRY_RECOVERY: {
        MAX_STORED_DAMAGE: 50, // 최대 저장 가능한 대미지
        STORE_RATIO: 0.5, // 받은 대미지의 50% 저장
        COOLDOWN_MS: 8000,
    },

    // =====================================
    // Hulk-Sister - Spin Throw (돌려 던지기)
    // =====================================
    SKILL_SPIN_THROW: {
        GRAB_RANGE: 150, // 잡기 범위
        THROW_DISTANCE: 300, // 던지는 거리
        DAMAGE: 30, // 기본 대미지
        COLLISION_DAMAGE: 20, // 충돌 대미지
        COLLISION_RADIUS: 80, // 충돌 판정 반경
        COOLDOWN_MS: 2000,
    },

    // =====================================
    // Hulk-Sister - Rage (폭주)
    // =====================================
    SKILL_RAGE: {
        DURATION_MS: 5000, // 5초간 지속
        DAMAGE_MULTIPLIER: 2.0, // 대미지 2배
        THROW_MULTIPLIER: 1.5, // 던지기 거리 1.5배
        COOLDOWN_MS: 20000,
    },

    // =====================================
    // Hulk-Sister - Passive (분노 스택)
    // =====================================
    HULK_PASSIVE: {
        MAX_STACKS: 10, // 최대 분노 스택
        DAMAGE_PER_STACK: 0.1, // 스택당 10% 대미지 증가
        THROW_PER_STACK: 0.05, // 스택당 5% 던지기 거리 증가
        STACK_DURATION_MS: 10000, // 스택 유지 시간
    },

    // =====================================
    // Hulk-Sister - Stats
    // =====================================
    HULK_STATS: {
        MAX_HP: 150, // 높은 체력!
    },

    // =====================================
    // Squeak-Squeak - Rat Illusion (기본 공격)
    // =====================================
    SKILL_RAT_ILLUSION: {
        COOLDOWN_MS: 5000,
        RAT_COUNT: 5,
        DURATION_MS: 5000,
        HP_DRAIN_PER_SECOND: 10,
        RAT_SPEED: 150,
        EFFECT_RADIUS: 200,
        DUMMY_DAMAGE_MULTIPLIER: 3, // 더미에게는 N초치 데미지를 한번에
    },

    // =====================================
    // Squeak-Squeak - Sleep Powder
    // =====================================
    SKILL_SLEEP_POWDER: {
        COOLDOWN_MS: 12000,
        RADIUS: 150,
        SLEEP_DURATION_MS: 3000,
    },

    // =====================================
    // Squeak-Squeak - Rat Bomb
    // =====================================
    SKILL_RAT_BOMB: {
        COOLDOWN_MS: 8000,
        EXPLOSION_DAMAGE: 25,
        EXPLOSION_RADIUS: 120,
        RAT_COUNT: 4,
        RAT_DAMAGE: 8,
        RAT_DURATION_MS: 4000,
    },

    // =====================================
    // Squeak-Squeak - Doll Hug
    // =====================================
    SKILL_DOLL_HUG: {
        COOLDOWN_MS: 15000,
        SHIELD_HP: 50,
        REFLECT_RATIO: 0.5,
        DURATION_MS: 5000,
        WEAK_POINTS: 3,
    },

    // =====================================
    // Squeak-Squeak - Rat Revive
    // =====================================
    SKILL_RAT_REVIVE: {
        COOLDOWN_MS: 60000,
        REVIVE_HP_RATIO: 0.5,
    },

    // =====================================
    // Squeak-Squeak - Stats
    // =====================================
    SQUEAK_STATS: {
        MAX_HP: 70,
        SPEED: 350,
    },
};
