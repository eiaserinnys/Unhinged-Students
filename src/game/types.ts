/**
 * Shared types for game submodules
 */

// Local wave effect interface
export interface WaveEffectState {
    active: boolean;
    x: number;
    y: number;
    startTime: number;
    duration: number;
    maxRadius: number;
}

// Local pot smash effect interface
export interface PotSmashEffectState {
    active: boolean;
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    startTime: number;
    duration: number;
    range: number;
    angle: number;
}

// Local spin throw effect interface
export interface SpinThrowEffectState {
    active: boolean;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    startTime: number;
    duration: number;
}

// Local rat illusion effect interface
export interface RatState {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    isReal: boolean;
    angle: number;
    wigglePhase: number;
}

export interface RatIllusionEffectState {
    active: boolean;
    x: number;
    y: number;
    startTime: number;
    duration: number;
    radius: number;
    rats: RatState[];
}

// Enemy info from findNearestEnemy
export interface EnemyTarget {
    x: number;
    y: number;
    type: string;
    playerId?: string;
    dummyIndex?: number;
}

// Rat illusion data received from server
export interface RatIllusionOnMeData {
    casterId: string;
    casterX: number;
    casterY: number;
    ratCount: number;
    duration: number;
    radius: number;
}
