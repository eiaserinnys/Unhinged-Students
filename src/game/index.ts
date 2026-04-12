/**
 * Game submodules barrel export
 */

export type {
    WaveEffectState,
    PotSmashEffectState,
    SpinThrowEffectState,
    RatState,
    RatIllusionEffectState,
    EnemyTarget,
    RatIllusionOnMeData,
} from './types.js';

export {
    renderHitVignette,
    renderWaitingTeam,
    renderTeamAnnounce,
    renderDeathScreen,
    renderWaveEffect,
    renderPotSmashEffect,
    renderMadnessEffect,
    renderRageEffect,
    renderRatIllusionEffect,
    renderConfusionEffect,
    renderCurryRecoveryEffect,
    renderStoredDamageUI,
    drawCuteRat,
} from './renderEffects.js';

export {
    initSkillSystem,
    initializeCharacterSkills,
    handleQSkill,
    handleWSkill,
    handleESkill,
    handleRSkill,
    handleTSkill,
    cleanupSkillSystem,
    getLaserBeamEffect,
    getTeleportEffect,
    getTelepathyEffect,
    getSkillManager,
    getWaveEffect,
    getPotSmashEffect,
    getSpinThrowEffect,
    getRatIllusionEffect,
    setRatIllusionEffect,
} from './skillExecutor.js';

export {
    updateStoredDamage,
    triggerCurryRecoveryEffect,
    startRatIllusionOnMe,
    endRatIllusionOnMe,
} from './combatState.js';

// Match UI (from uiRenderer)
export {
    renderMatchTimer,
    renderScoreboard,
    renderMatchResult,
} from '../rendering/uiRenderer.js';
