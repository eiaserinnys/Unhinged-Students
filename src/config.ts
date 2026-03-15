// Game Configuration - Centralized constants for Unhinged Students
// This file consolidates all magic numbers to improve maintainability

import type { GameConfig } from './types/index.js';

// Asset base path - automatically set by Vite based on build configuration
// In development: '' (empty, relative paths work)
// In production: '/game' (nginx serves from /game/)
export const ASSET_BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export const GAME_CONFIG: GameConfig = {
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
        SPEED: 300, // pixels per second
        MAX_HP: 100,
        MAX_LEVEL: 30,
        DISPLAY_SIZE_RATIO: 8, // canvasHeight / 8
        RESPAWN_DELAY_MS: 5000, // 5 seconds
        INVINCIBILITY_MS: 300, // 300ms after being hit
    },

    // =====================================
    // COMBAT
    // =====================================
    COMBAT: {
        ATTACK_POWER: 10,
        ATTACK_RANGE: 150,
        ATTACK_COOLDOWN_MS: 500, // 0.5 seconds
        ATTACK_ANIMATION_MS: 200,
    },

    // =====================================
    // KNOCKBACK
    // =====================================
    KNOCKBACK: {
        MIN_DISTANCE: 30, // at max attack range
        MAX_DISTANCE: 100, // at 0 distance
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
        COOLDOWN_MS: 2000, // 2 seconds
        AIM_DURATION_MS: 1000, // 1 second aiming
        FIRE_DURATION_MS: 200, // 0.2 second firing flash
        DAMAGE: 44, // 2x normal attack
        MAX_LENGTH: 2000,
        READY_FLASH_DURATION_MS: 300,
        COLOR: '#FF4444', // Red
    },

    // =====================================
    // SKILLS - TELEPORT (W)
    // =====================================
    SKILL_TELEPORT: {
        COOLDOWN_MS: 7000, // 7 seconds
        DISAPPEAR_DURATION_MS: 150,
        APPEAR_DURATION_MS: 200,
        MIN_DISTANCE: 200,
        MAX_DISTANCE: 400,
        DAMAGE_RADIUS: 100,
        DAMAGE: 12,
        COLOR: '#44FF44', // Green
    },

    // =====================================
    // SKILLS - TELEPATHY (E)
    // =====================================
    SKILL_TELEPATHY: {
        COOLDOWN_MS: 12000, // 12 seconds
        DURATION_MS: 3000, // 3 second channeling
        TICK_INTERVAL_MS: 100, // 0.1 second tick
        RADIUS: 180,
        DAMAGE_PER_TICK: 2,
        MAX_HEAL_PER_TICK: 4,
        COLOR: '#8B5CF6', // Purple
    },

    // =====================================
    // CRAZY-EYES - WAVE ATTACK (기본 공격)
    // =====================================
    SKILL_WAVE: {
        COOLDOWN_MS: 2000, // 2 seconds
        EXPAND_DURATION_MS: 500, // 파동 퍼지는 시간
        RADIUS: 250, // 파동 최대 반경
        DAMAGE: 15, // 데미지
        CONFUSION_DURATION_MS: 3000, // 혼란 지속 시간 3초
        COLOR: '#FF69B4', // Hot Pink
    },

    // =====================================
    // CRAZY-EYES - MADNESS WALK (광기 산책)
    // =====================================
    SKILL_MADNESS: {
        COOLDOWN_MS: 10000, // 10 seconds
        DURATION_MS: 5000, // 5 seconds active
        RADIUS: 150, // 데미지 범위
        DAMAGE_PER_SECOND: 5, // 초당 5 데미지
        TICK_INTERVAL_MS: 200, // 0.2초마다 틱
        COLOR: '#9400D3', // Dark Violet
    },

    // =====================================
    // CURRY-BEAR - POT SMASH (냄비 내려치기)
    // =====================================
    SKILL_POT_SMASH: {
        COOLDOWN_MS: 1500, // 1.5 seconds
        DAMAGE: 45, // 메인 데미지 (25 → 45)
        SPLASH_DAMAGE: 20, // 스플래시 데미지 (10 → 20)
        RANGE: 250, // 부채꼴 거리 (120 → 250)
        ANGLE: 150, // 부채꼴 각도 (90 → 150도)
        SPLASH_RADIUS: 120, // 스플래시 범위 (80 → 120)
        EFFECT_DURATION_MS: 300, // 이펙트 지속 시간
        COLOR: '#FFD700', // Gold (카레색)
    },

    // =====================================
    // CURRY-BEAR - CURRY RECOVERY (카레 회복)
    // =====================================
    SKILL_CURRY_RECOVERY: {
        COOLDOWN_MS: 8000, // 8 seconds
        MAX_STORED_DAMAGE: 50, // 최대 저장 가능한 대미지
        STORE_RATIO: 0.5, // 받은 대미지의 50% 저장
        EFFECT_DURATION_MS: 500, // 회복 이펙트 지속 시간
        COLOR: '#FFA500', // Orange (카레색)
    },

    // =====================================
    // HULK-SISTER - SPIN THROW (돌려 던지기)
    // =====================================
    SKILL_SPIN_THROW: {
        COOLDOWN_MS: 2000, // 2 seconds
        GRAB_RANGE: 150, // 잡기 범위
        THROW_DISTANCE: 300, // 던지는 거리
        DAMAGE: 30, // 기본 대미지
        COLLISION_DAMAGE: 20, // 충돌 대미지 (던져진 적이 다른 적과 부딪힐 때)
        EFFECT_DURATION_MS: 500, // 이펙트 지속 시간
        COLOR: '#FF6347', // Tomato (분노색)
    },

    // =====================================
    // HULK-SISTER - RAGE (폭주)
    // =====================================
    SKILL_RAGE: {
        COOLDOWN_MS: 20000, // 20 seconds
        DURATION_MS: 5000, // 5초간 지속
        DAMAGE_MULTIPLIER: 2.0, // 대미지 2배
        THROW_MULTIPLIER: 1.5, // 던지기 거리 1.5배
        COLOR: '#FF0000', // Red (분노!)
    },

    // =====================================
    // HULK-SISTER - PASSIVE (분노 스택)
    // =====================================
    HULK_PASSIVE: {
        MAX_STACKS: 10, // 최대 분노 스택
        DAMAGE_PER_STACK: 0.1, // 스택당 10% 대미지 증가
        THROW_PER_STACK: 0.05, // 스택당 5% 던지기 거리 증가
        STACK_DURATION_MS: 10000, // 스택 유지 시간 (10초)
    },

    // =====================================
    // HULK-SISTER - STATS
    // =====================================
    HULK_STATS: {
        MAX_HP: 150, // 높은 체력!
    },

    // =====================================
    // SQUEAK-SQUEAK - RAT ILLUSION (쥐 환상, Q)
    // =====================================
    SKILL_RAT_ILLUSION: {
        COOLDOWN_MS: 5000, // 5 seconds
        RAT_COUNT: 5, // 쥐 마리 수 (1 진짜 + 4 가짜)
        DURATION_MS: 5000, // 쥐들이 유지되는 시간
        HP_DRAIN_PER_SECOND: 10, // 진짜 쥐를 못 찾으면 초당 10 체력 감소
        RAT_SPEED: 150, // 쥐 이동 속도
        EFFECT_RADIUS: 200, // 쥐들이 퍼지는 반경
        COLOR: '#FFB6C1', // Light Pink
    },

    // =====================================
    // SQUEAK-SQUEAK - SLEEP POWDER (수면 가루, W)
    // =====================================
    SKILL_SLEEP_POWDER: {
        COOLDOWN_MS: 12000, // 12 seconds
        RADIUS: 150, // 수면 가루 범위
        SLEEP_DURATION_MS: 3000, // 3초 수면
        EFFECT_DURATION_MS: 500, // 이펙트 지속
        COLOR: '#9370DB', // Medium Purple
    },

    // =====================================
    // SQUEAK-SQUEAK - RAT BOMB (쥐 폭탄, E)
    // =====================================
    SKILL_RAT_BOMB: {
        COOLDOWN_MS: 8000, // 8 seconds
        EXPLOSION_DAMAGE: 25, // 폭발 데미지
        EXPLOSION_RADIUS: 120, // 폭발 범위
        RAT_COUNT: 4, // 폭탄 터지고 나오는 쥐 마리 수
        RAT_DAMAGE: 8, // 쥐 한 마리당 데미지
        RAT_DURATION_MS: 4000, // 쥐들이 유지되는 시간
        EFFECT_DURATION_MS: 500, // 이펙트 지속
        COLOR: '#FF6B6B', // Light Red
    },

    // =====================================
    // SQUEAK-SQUEAK - DOLL HUG (인형 안고 자기, R)
    // =====================================
    SKILL_DOLL_HUG: {
        COOLDOWN_MS: 15000, // 15 seconds
        SHIELD_HP: 50, // 방어막 체력
        REFLECT_RATIO: 0.5, // 공격의 50% 반사
        DURATION_MS: 5000, // 5초 지속 (집중)
        WEAK_POINTS: 3, // 쥐 모양 약점 (귀2 + 얼굴1)
        EFFECT_DURATION_MS: 500, // 이펙트 지속
        COLOR: '#FFC0CB', // Pink
    },

    // =====================================
    // SQUEAK-SQUEAK - RAT REVIVE (쥐 살리기, T)
    // =====================================
    SKILL_RAT_REVIVE: {
        COOLDOWN_MS: 60000, // 60 seconds (궁극기!)
        REVIVE_HP_RATIO: 0.5, // 최대 체력의 50%로 부활
        EFFECT_DURATION_MS: 1500, // 이펙트 지속 (화려하게!)
        COLOR: '#FFD700', // Gold
    },

    // =====================================
    // SQUEAK-SQUEAK - STATS
    // =====================================
    SQUEAK_STATS: {
        MAX_HP: 70, // 낮은 체력
        SPEED: 350, // 빠른 속도!
    },

    // =====================================
    // SHARDS
    // =====================================
    SHARD: {
        SIZE: 20,
        SPAWN_MARGIN: 100,
        MAX_COUNT: 40,
        RESPAWN_INTERVAL_MS: 5000,
        MAX_EFFECTS: 10, // Performance cap for collection effects
        COLOR: '#00ffff', // Cyan
    },

    // =====================================
    // DUMMY (Test NPCs)
    // =====================================
    DUMMY: {
        MAX_HP: 30, // 3 hits to kill
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

// Default export
export default GAME_CONFIG;

// Backward compatibility: expose to window
window.GAME_CONFIG = GAME_CONFIG;

// Export for Node.js (server-side) if module is defined
// Note: This is for compatibility with server code that might import this
// In ESM, we use export statements instead
