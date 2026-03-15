// Game Configuration - Client-side config extending shared SSOT
// Shared gameplay values come from shared/config.ts (server-authoritative)
// This file adds client-only visual/UI settings on top

import { GAME_CONFIG as SHARED_CONFIG } from '../shared/config';
import type { GameConfig } from './types/index.js';

// Asset base path - automatically set by Vite based on build configuration
// In development: '' (empty, relative paths work)
// In production: '/game' (nginx serves from /game/)
export const ASSET_BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export const GAME_CONFIG: GameConfig = {
    // Spread all shared config as base (CHAT, TEAM, etc. are included at runtime)
    ...SHARED_CONFIG,

    // =====================================
    // WORLD — add ASPECT_RATIO
    // =====================================
    WORLD: {
        ...SHARED_CONFIG.WORLD,
        ASPECT_RATIO: 16 / 9,
    },

    // =====================================
    // PLAYER — add client display/UX fields
    // (RESPAWN_X, RESPAWN_Y from shared remain as extra runtime props)
    // =====================================
    PLAYER: {
        ...SHARED_CONFIG.PLAYER,
        MAX_LEVEL: 30,
        DISPLAY_SIZE_RATIO: 8, // canvasHeight / 8
        INVINCIBILITY_MS: 300, // 300ms after being hit
    },

    // =====================================
    // COMBAT — add animation timing
    // (HIT_RADIUS from shared remains as extra runtime prop)
    // =====================================
    COMBAT: {
        ...SHARED_CONFIG.COMBAT,
        ATTACK_ANIMATION_MS: 200,
    },

    // =====================================
    // KNOCKBACK — add duration
    // (MULTIPLIER_*, LASER_DISTANCE from shared remain as extra runtime props)
    // =====================================
    KNOCKBACK: {
        ...SHARED_CONFIG.KNOCKBACK,
        DURATION_MS: 200,
    },

    // =====================================
    // VISUAL EFFECTS — client only
    // =====================================
    EFFECTS: {
        HIT_FLASH_DURATION_MS: 100,
        HIT_VIGNETTE_DURATION_MS: 300,
        CHAT_BUBBLE_DURATION_MS: 3000,
    },

    // =====================================
    // SKILLS - LASER (Q) — add visual timing/color
    // =====================================
    SKILL_LASER: {
        ...SHARED_CONFIG.SKILL_LASER,
        AIM_DURATION_MS: 1000,
        FIRE_DURATION_MS: 200,
        READY_FLASH_DURATION_MS: 300,
        COLOR: '#FF4444',
    },

    // =====================================
    // SKILLS - TELEPORT (W) — add visual timing/color
    // =====================================
    SKILL_TELEPORT: {
        ...SHARED_CONFIG.SKILL_TELEPORT,
        DISAPPEAR_DURATION_MS: 150,
        APPEAR_DURATION_MS: 200,
        COLOR: '#44FF44',
    },

    // =====================================
    // SKILLS - TELEPATHY (E) — add color
    // =====================================
    SKILL_TELEPATHY: {
        ...SHARED_CONFIG.SKILL_TELEPATHY,
        COLOR: '#8B5CF6',
    },

    // =====================================
    // CRAZY-EYES - WAVE ATTACK — add visual timing/color
    // =====================================
    SKILL_WAVE: {
        ...SHARED_CONFIG.SKILL_WAVE,
        EXPAND_DURATION_MS: 500,
        COLOR: '#FF69B4',
    },

    // =====================================
    // CRAZY-EYES - MADNESS WALK — add color, derive DAMAGE_PER_SECOND
    // =====================================
    SKILL_MADNESS: {
        ...SHARED_CONFIG.SKILL_MADNESS,
        DAMAGE_PER_SECOND: SHARED_CONFIG.SKILL_MADNESS.DAMAGE_PER_TICK * (1000 / SHARED_CONFIG.SKILL_MADNESS.TICK_INTERVAL_MS),
        COLOR: '#9400D3',
    },

    // =====================================
    // CURRY-BEAR - POT SMASH — add visual timing/color
    // =====================================
    SKILL_POT_SMASH: {
        ...SHARED_CONFIG.SKILL_POT_SMASH,
        EFFECT_DURATION_MS: 300,
        COLOR: '#FFD700',
    },

    // =====================================
    // CURRY-BEAR - CURRY RECOVERY — add visual timing/color
    // =====================================
    SKILL_CURRY_RECOVERY: {
        ...SHARED_CONFIG.SKILL_CURRY_RECOVERY,
        EFFECT_DURATION_MS: 500,
        COLOR: '#FFA500',
    },

    // =====================================
    // HULK-SISTER - SPIN THROW — add visual timing/color
    // =====================================
    SKILL_SPIN_THROW: {
        ...SHARED_CONFIG.SKILL_SPIN_THROW,
        EFFECT_DURATION_MS: 500,
        COLOR: '#FF6347',
    },

    // =====================================
    // HULK-SISTER - RAGE — add color
    // =====================================
    SKILL_RAGE: {
        ...SHARED_CONFIG.SKILL_RAGE,
        COLOR: '#FF0000',
    },

    // =====================================
    // HULK-SISTER - PASSIVE & STATS
    // (shared와 동일하지만, 개별 섹션의 spread 패턴을 일관되게 유지)
    // =====================================
    HULK_PASSIVE: {
        ...SHARED_CONFIG.HULK_PASSIVE,
    },

    HULK_STATS: {
        ...SHARED_CONFIG.HULK_STATS,
    },

    // =====================================
    // SQUEAK-SQUEAK skills — client only (not in shared yet)
    // =====================================
    SKILL_RAT_ILLUSION: {
        COOLDOWN_MS: 5000,
        RAT_COUNT: 5,
        DURATION_MS: 5000,
        HP_DRAIN_PER_SECOND: 10,
        RAT_SPEED: 150,
        EFFECT_RADIUS: 200,
        COLOR: '#FFB6C1',
    },

    SKILL_SLEEP_POWDER: {
        COOLDOWN_MS: 12000,
        RADIUS: 150,
        SLEEP_DURATION_MS: 3000,
        EFFECT_DURATION_MS: 500,
        COLOR: '#9370DB',
    },

    SKILL_RAT_BOMB: {
        COOLDOWN_MS: 8000,
        EXPLOSION_DAMAGE: 25,
        EXPLOSION_RADIUS: 120,
        RAT_COUNT: 4,
        RAT_DAMAGE: 8,
        RAT_DURATION_MS: 4000,
        EFFECT_DURATION_MS: 500,
        COLOR: '#FF6B6B',
    },

    SKILL_DOLL_HUG: {
        COOLDOWN_MS: 15000,
        SHIELD_HP: 50,
        REFLECT_RATIO: 0.5,
        DURATION_MS: 5000,
        WEAK_POINTS: 3,
        EFFECT_DURATION_MS: 500,
        COLOR: '#FFC0CB',
    },

    SKILL_RAT_REVIVE: {
        COOLDOWN_MS: 60000,
        REVIVE_HP_RATIO: 0.5,
        EFFECT_DURATION_MS: 1500,
        COLOR: '#FFD700',
    },

    SQUEAK_STATS: {
        MAX_HP: 70,
        SPEED: 350,
    },

    // =====================================
    // SHARDS — shared base + client visual fields
    // =====================================
    SHARD: {
        ...SHARED_CONFIG.SHARD,
        SIZE: 20,
        RESPAWN_INTERVAL_MS: 5000,
        MAX_EFFECTS: 10,
        COLOR: '#00ffff',
    },

    // =====================================
    // DUMMY — shared values
    // =====================================
    DUMMY: {
        ...SHARED_CONFIG.DUMMY,
    },

    // =====================================
    // UI — client only
    // =====================================
    UI: {
        SKILL_BOX_SIZE: 60,
        SKILL_BOX_GAP: 10,
        SKILL_BOX_BOTTOM_MARGIN: 30,
        SKILL_BOX_BORDER_RADIUS: 8,
    },

    // =====================================
    // PARTICLES — client only
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
