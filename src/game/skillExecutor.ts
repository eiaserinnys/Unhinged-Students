/**
 * Skill Executor Module
 *
 * Handles execution of character-specific skills (Q, W, E, R, T keys).
 * Extracted from game.ts to reduce file size.
 */

import { GAME_CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { gameState, GAME_WIDTH, GAME_HEIGHT } from '../core/gameState.js';
import {
    Skill,
    SkillManager,
    LaserBeamEffect,
    TeleportEffect,
    TelepathyEffect,
} from '../skill.js';
import { findNearestEnemy, findRandomEnemy } from '../combat/enemyFinder.js';
import type { CharacterType } from '../types/index.js';
import type {
    WaveEffectState,
    PotSmashEffectState,
    SpinThrowEffectState,
    RatIllusionEffectState,
    RatState,
    EnemyTarget,
    RatIllusionOnMeData,
} from './types.js';

// Module-level references to concrete types
let laserBeamEffect: LaserBeamEffect | null = null;
let teleportEffect: TeleportEffect | null = null;
let telepathyEffect: TelepathyEffect | null = null;
let skillManager: SkillManager | null = null;

// Module-level effect states
let waveEffect: WaveEffectState | null = null;
let potSmashEffect: PotSmashEffectState | null = null;
let spinThrowEffect: SpinThrowEffectState | null = null;
let ratIllusionEffect: RatIllusionEffectState | null = null;

// ============================================================
// Getters for module-level state (used by game.ts)
// ============================================================

export function getLaserBeamEffect(): LaserBeamEffect | null {
    return laserBeamEffect;
}
export function getTeleportEffect(): TeleportEffect | null {
    return teleportEffect;
}
export function getTelepathyEffect(): TelepathyEffect | null {
    return telepathyEffect;
}
export function getSkillManager(): SkillManager | null {
    return skillManager;
}
export function getWaveEffect(): WaveEffectState | null {
    return waveEffect;
}
export function getPotSmashEffect(): PotSmashEffectState | null {
    return potSmashEffect;
}
export function getSpinThrowEffect(): SpinThrowEffectState | null {
    return spinThrowEffect;
}
export function getRatIllusionEffect(): RatIllusionEffectState | null {
    return ratIllusionEffect;
}
export function setRatIllusionEffect(effect: RatIllusionEffectState | null): void {
    ratIllusionEffect = effect;
}

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize skill system: creates SkillManager and effect instances.
 * Returns references needed by startGame.
 */
export function initSkillSystem(): {
    skillManager: SkillManager;
    laserBeamEffect: LaserBeamEffect;
    teleportEffect: TeleportEffect;
    telepathyEffect: TelepathyEffect;
} {
    skillManager = new SkillManager();
    laserBeamEffect = new LaserBeamEffect();
    teleportEffect = new TeleportEffect();
    telepathyEffect = new TelepathyEffect();

    return {
        skillManager,
        laserBeamEffect,
        teleportEffect,
        telepathyEffect,
    };
}

/**
 * Initialize skills based on selected character
 */
export function initializeCharacterSkills(characterId: CharacterType): void {
    if (!skillManager) return;

    // Clear existing skills
    skillManager.skills.clear();
    skillManager.skillOrder = [];

    switch (characterId) {
        case 'crazy-eyes':
            skillManager.addSkill(
                new Skill(
                    '이상한 파동',
                    'q',
                    GAME_CONFIG.SKILL_WAVE.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_WAVE.COLOR,
                    '🌀'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '광기 산책',
                    'e',
                    GAME_CONFIG.SKILL_MADNESS.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_MADNESS.COLOR,
                    '👀'
                )
            );
            logger.info('Initialized skills for 눈 돌아가는 사람');
            break;

        case 'curry-bear':
            skillManager.addSkill(
                new Skill(
                    '냄비 내려치기',
                    'q',
                    GAME_CONFIG.SKILL_POT_SMASH.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_POT_SMASH.COLOR,
                    '🍲'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '카레 회복',
                    'e',
                    GAME_CONFIG.SKILL_CURRY_RECOVERY.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_CURRY_RECOVERY.COLOR,
                    '🍛'
                )
            );
            logger.info('Initialized skills for 카레 곰돌이');
            break;

        case 'big-sis-hulk':
            skillManager.addSkill(
                new Skill(
                    '돌려 던지기',
                    'q',
                    GAME_CONFIG.SKILL_SPIN_THROW.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_SPIN_THROW.COLOR,
                    '🌀'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '폭주',
                    'e',
                    GAME_CONFIG.SKILL_RAGE.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_RAGE.COLOR,
                    '🔥'
                )
            );
            logger.info('Initialized skills for 헐크 언니');
            break;

        case 'squeak-squeak':
            skillManager.addSkill(
                new Skill(
                    '쥐 환상',
                    'q',
                    GAME_CONFIG.SKILL_RAT_ILLUSION.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_RAT_ILLUSION.COLOR,
                    '👻'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '수면 가루',
                    'w',
                    GAME_CONFIG.SKILL_SLEEP_POWDER.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_SLEEP_POWDER.COLOR,
                    '😴'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '쥐 폭탄',
                    'e',
                    GAME_CONFIG.SKILL_RAT_BOMB.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_RAT_BOMB.COLOR,
                    '💣'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '인형 안고 자기',
                    'r',
                    GAME_CONFIG.SKILL_DOLL_HUG.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_DOLL_HUG.COLOR,
                    '🧸'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '쥐 살리기',
                    't',
                    GAME_CONFIG.SKILL_RAT_REVIVE.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_RAT_REVIVE.COLOR,
                    '🐭'
                )
            );
            logger.info('Initialized skills for 찍찍찍찍찍 (5 skills)');
            break;

        case 'alien':
        default:
            skillManager.addSkill(
                new Skill(
                    '레이저',
                    'q',
                    GAME_CONFIG.SKILL_LASER.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_LASER.COLOR,
                    '🎇'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '순간이동',
                    'w',
                    GAME_CONFIG.SKILL_TELEPORT.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_TELEPORT.COLOR,
                    '💫'
                )
            );
            skillManager.addSkill(
                new Skill(
                    '텔레파시',
                    'e',
                    GAME_CONFIG.SKILL_TELEPATHY.COOLDOWN_MS,
                    GAME_CONFIG.SKILL_TELEPATHY.COLOR,
                    '👽'
                )
            );
            logger.info('Initialized skills for 외계인');
            break;
    }
}

// ============================================================
// Skill Handlers
// ============================================================

/**
 * Handle Q skill based on selected character
 */
export function handleQSkill(): void {
    if (!gameState.player || !skillManager) return;

    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'crazy-eyes': {
            const waveSkill = skillManager.useSkill('q');
            if (waveSkill) {
                logger.debug(`Used skill: ${waveSkill.name} - wave attack`);

                if (gameState.networkManager) {
                    gameState.networkManager.sendWaveAttack();
                }

                if (!waveEffect) {
                    waveEffect = {
                        active: false,
                        x: 0,
                        y: 0,
                        startTime: 0,
                        duration: GAME_CONFIG.SKILL_WAVE.EXPAND_DURATION_MS,
                        maxRadius: GAME_CONFIG.SKILL_WAVE.RADIUS,
                    };
                }
                waveEffect.active = true;
                waveEffect.x = playerPos.x;
                waveEffect.y = playerPos.y;
                waveEffect.startTime = Date.now();
            }
            break;
        }

        case 'curry-bear': {
            const potSkill = skillManager.useSkill('q');
            if (potSkill) {
                let dirX = 1;
                let dirY = 0;
                const target = findNearestEnemy(false) as EnemyTarget | null;
                if (target) {
                    dirX = target.x - playerPos.x;
                    dirY = target.y - playerPos.y;
                    const len = Math.sqrt(dirX * dirX + dirY * dirY);
                    if (len > 0) {
                        dirX /= len;
                        dirY /= len;
                    }
                }

                logger.debug(`Used skill: ${potSkill.name} - pot smash`);

                if (gameState.networkManager) {
                    gameState.networkManager.sendPotSmash(dirX, dirY);
                }

                if (!potSmashEffect) {
                    potSmashEffect = {
                        active: false,
                        x: 0,
                        y: 0,
                        dirX: 0,
                        dirY: 0,
                        startTime: 0,
                        duration: GAME_CONFIG.SKILL_POT_SMASH.EFFECT_DURATION_MS,
                        range: GAME_CONFIG.SKILL_POT_SMASH.RANGE,
                        angle: GAME_CONFIG.SKILL_POT_SMASH.ANGLE,
                    };
                }
                potSmashEffect.active = true;
                potSmashEffect.x = playerPos.x;
                potSmashEffect.y = playerPos.y;
                potSmashEffect.dirX = dirX;
                potSmashEffect.dirY = dirY;
                potSmashEffect.startTime = Date.now();
            }
            break;
        }

        case 'big-sis-hulk': {
            const target = findNearestEnemy(false) as EnemyTarget | null;
            if (!target || (target.type !== 'dummy' && !target.playerId)) {
                logger.debug('No enemy to grab');
                break;
            }

            const dx = target.x - playerPos.x;
            const dy = target.y - playerPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > GAME_CONFIG.SKILL_SPIN_THROW.GRAB_RANGE) {
                logger.debug('Enemy too far to grab');
                break;
            }

            const throwSkill = skillManager.useSkill('q');
            if (throwSkill) {
                const dirX = dx / distance;
                const dirY = dy / distance;

                logger.debug(`Used skill: ${throwSkill.name} - grabbing ${target.type}`);

                if (gameState.networkManager) {
                    const targetId = target.type === 'dummy' ? target.dummyIndex : target.playerId;
                    gameState.networkManager.sendSpinThrow(targetId, dirX, dirY, target.type);
                }

                if (!spinThrowEffect) {
                    spinThrowEffect = {
                        active: false,
                        x: 0,
                        y: 0,
                        targetX: 0,
                        targetY: 0,
                        startTime: 0,
                        duration: GAME_CONFIG.SKILL_SPIN_THROW.EFFECT_DURATION_MS,
                    };
                }
                spinThrowEffect.active = true;
                spinThrowEffect.x = playerPos.x;
                spinThrowEffect.y = playerPos.y;
                spinThrowEffect.targetX = target.x;
                spinThrowEffect.targetY = target.y;
                spinThrowEffect.startTime = Date.now();
            }
            break;
        }

        case 'squeak-squeak': {
            if (ratIllusionEffect && ratIllusionEffect.active) break;

            const ratSkill = skillManager.useSkill('q');
            if (ratSkill) {
                logger.debug(`Used skill: ${ratSkill.name} - rat illusion`);

                if (gameState.networkManager) {
                    gameState.networkManager.sendRatIllusion();
                }
            }
            break;
        }

        case 'alien':
        default: {
            if (laserBeamEffect && !laserBeamEffect.active) {
                const laserSkill = skillManager.useSkill('q');
                if (laserSkill) {
                    const target = findNearestEnemy(true) as EnemyTarget | null;
                    if (target) {
                        laserBeamEffect.start(playerPos.x, playerPos.y, target.x, target.y);
                        logger.debug(
                            `Used skill: ${laserSkill.name} - targeting ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`
                        );

                        if (gameState.networkManager) {
                            gameState.networkManager.sendLaserAiming(
                                playerPos.x,
                                playerPos.y,
                                laserBeamEffect.dirX,
                                laserBeamEffect.dirY
                            );
                        }
                    }
                }
            }
            break;
        }
    }
}

/**
 * Handle W skill based on selected character
 */
export function handleWSkill(): void {
    if (!gameState.player || !skillManager) return;

    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'crazy-eyes':
        case 'curry-bear':
        case 'big-sis-hulk':
            break;

        case 'squeak-squeak': {
            const sleepSkill = skillManager.useSkill('w');
            if (sleepSkill) {
                logger.debug(`Used skill: ${sleepSkill.name} - sleep powder`);
            }
            break;
        }

        case 'alien':
        default: {
            const skill = skillManager.useSkill('w');
            if (skill && teleportEffect) {
                const target = findRandomEnemy() as EnemyTarget | null;

                if (target) {
                    teleportEffect.start(
                        playerPos.x,
                        playerPos.y,
                        GAME_WIDTH,
                        GAME_HEIGHT,
                        target.x,
                        target.y
                    );
                    logger.debug(
                        `Used skill: ${skill.name} - teleporting to ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`
                    );
                } else {
                    teleportEffect.start(playerPos.x, playerPos.y, GAME_WIDTH, GAME_HEIGHT);
                    logger.debug(`Used skill: ${skill.name} - random teleport (no enemies)`);
                }

                if (gameState.networkManager) {
                    gameState.networkManager.sendTeleport(
                        teleportEffect.startX,
                        teleportEffect.startY,
                        teleportEffect.endX,
                        teleportEffect.endY
                    );
                }
            }
            break;
        }
    }
}

/**
 * Handle E skill based on selected character
 */
export function handleESkill(): void {
    if (!gameState.player || !skillManager) return;

    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'curry-bear': {
            if (gameState.storedDamage <= 0) {
                logger.debug('No stored damage to recover');
                return;
            }

            const curryRecoverySkill = skillManager.useSkill('e');
            if (curryRecoverySkill) {
                logger.debug(
                    `Used skill: ${curryRecoverySkill.name} - recovering ${gameState.storedDamage} HP`
                );

                gameState.curryRecoveryActive = true;
                gameState.curryRecoveryStartTime = Date.now();

                if (gameState.networkManager) {
                    gameState.networkManager.sendCurryRecovery();
                }
            }
            break;
        }

        case 'big-sis-hulk': {
            if (gameState.rageActive) return;

            const rageSkill = skillManager.useSkill('e');
            if (rageSkill) {
                logger.debug(`Used skill: ${rageSkill.name} - RAGE activated!`);

                gameState.rageActive = true;
                gameState.rageStartTime = Date.now();
                gameState.rageDuration = GAME_CONFIG.SKILL_RAGE.DURATION_MS;

                if (gameState.networkManager) {
                    gameState.networkManager.sendRageStart();
                }
            }
            break;
        }

        case 'crazy-eyes': {
            if (gameState.madnessActive) return;

            const madnessSkill = skillManager.useSkill('e');
            if (madnessSkill) {
                logger.debug(`Used skill: ${madnessSkill.name} - madness walk activated`);

                gameState.madnessActive = true;
                gameState.madnessStartTime = Date.now();
                gameState.madnessDuration = GAME_CONFIG.SKILL_MADNESS.DURATION_MS;
                gameState.madnessLastTickTime = Date.now();
                gameState.madnessTickInterval = GAME_CONFIG.SKILL_MADNESS.TICK_INTERVAL_MS;
                gameState.madnessRadius = GAME_CONFIG.SKILL_MADNESS.RADIUS;

                if (gameState.networkManager) {
                    gameState.networkManager.sendMadnessStart();
                }
            }
            break;
        }

        case 'squeak-squeak': {
            const bombSkill = skillManager.useSkill('e');
            if (bombSkill) {
                logger.debug(`Used skill: ${bombSkill.name} - rat bomb`);
            }
            break;
        }

        case 'alien':
        default: {
            if (telepathyEffect && !telepathyEffect.active) {
                const telepathySkill = skillManager.useSkill('e');
                if (telepathySkill) {
                    telepathyEffect.start(playerPos.x, playerPos.y);
                    logger.debug(`Used skill: ${telepathySkill.name}`);

                    if (gameState.networkManager) {
                        gameState.networkManager.sendTelepathy(
                            playerPos.x,
                            playerPos.y,
                            telepathyEffect.radius
                        );
                    }
                }
            }
            break;
        }
    }
}

/**
 * Handle R skill based on selected character (squeak-squeak: doll hug shield)
 */
export function handleRSkill(): void {
    if (!gameState.player || !skillManager) return;

    if (gameState.selectedCharacter !== 'squeak-squeak') return;

    const rSkill = skillManager.useSkill('r');
    if (rSkill) {
        logger.debug(`Used skill: ${rSkill.name} - doll hug shield`);
    }
}

/**
 * Handle T skill based on selected character (squeak-squeak: rat revive)
 */
export function handleTSkill(): void {
    if (!gameState.player || !skillManager) return;

    if (gameState.selectedCharacter !== 'squeak-squeak') return;

    const tSkill = skillManager.useSkill('t');
    if (tSkill) {
        logger.debug(`Used skill: ${tSkill.name} - rat revive!`);
    }
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Clear all module-level references (called during game cleanup)
 */
export function cleanupSkillSystem(): void {
    laserBeamEffect = null;
    teleportEffect = null;
    telepathyEffect = null;
    skillManager = null;
    waveEffect = null;
    potSmashEffect = null;
    spinThrowEffect = null;
    ratIllusionEffect = null;
}
