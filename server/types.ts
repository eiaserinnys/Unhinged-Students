/**
 * @fileoverview Server-side type definitions for Unhinged Students
 * These types are server-authoritative and used for type safety
 */

import type { Socket, Server } from 'socket.io';

// ========================================
// TEAM TYPES
// ========================================

export type Team = 'red' | 'blue';

// ========================================
// CHARACTER TYPES
// ========================================

export type CharacterId = 'alien' | 'crazy-eyes' | 'curry-bear' | 'big-sis-hulk';

// ========================================
// PLAYER TYPES
// ========================================

export interface Player {
    playerId: string;
    socketId?: string;
    team: Team;
    x: number;
    y: number;
    playerName: string;
    level: number;
    experience: number;
    characterId: CharacterId;
    currentHP: number;
    maxHP: number;
    deathTime: number;
    isDead: boolean;
    lastMoveTime?: number;
    // Curry-bear specific
    storedDamage?: number;
    // Telepathy specific
    telepathyLastTickTime?: number;
    // Crazy-eyes specific
    confusedUntil?: number;
    madnessLastTickTime?: number;
    madnessStartTime?: number;
    // Hulk-sister specific
    rageActive?: boolean;
    rageStartTime?: number;
    rageStacks?: number;
    rageTimeout?: ReturnType<typeof setTimeout>;
    // Squeak-squeak specific (rat illusion = invincible)
    ratIllusionUntil?: number;
    // Shard collection tracking (server-authoritative leveling)
    shardCollectCount?: number;
}

// ========================================
// DUMMY TYPES
// ========================================

export interface Dummy {
    id: number;
    x: number;
    y: number;
    initialX: number;
    initialY: number;
    name: string;
    currentHP: number;
    maxHP: number;
    deathTime: number;
    respawnDelay: number;
}

// ========================================
// SHARD TYPES
// ========================================

export interface Shard {
    id: number;
    x: number;
    y: number;
    collected: boolean;
    collectedTime: number;
    respawnDelay: number;
}

// ========================================
// SOCKET EVENT TYPES
// ========================================

// Client to Server Events
export interface ClientToServerEvents {
    // Player events
    playerMove: (data: PlayerMoveData) => void;
    disconnect: () => void;

    // Combat events
    playerAttack: (data: AttackData) => void;
    teleport: (data: TeleportData) => void;
    teleportDamage: (data: TeleportDamageData) => void;
    laserAiming: (data: LaserAimingData) => void;
    laserAttack: (data: LaserAttackData) => void;
    telepathy: (data: TelepathyData) => void;
    telepathyDamage: (data: TelepathyDamageData) => void;
    waveAttack: (data: WaveAttackData) => void;
    madnessStart: () => void;
    madnessEnd: () => void;
    madnessDamage: () => void;
    potSmash: (data: PotSmashData) => void;
    curryRecovery: () => void;
    requestStoredDamage: () => void;
    spinThrow: (data: SpinThrowData) => void;
    rageStart: () => void;
    rageEnd: () => void;

    // Shard events
    collectShard: (data: CollectShardData) => void;

    // Chat events
    chatMessage: (data: ChatMessageData) => void;

    // Rat Illusion events
    ratIllusion: (data: RatIllusionData) => void;
    ratClick: (data: RatClickData) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
    // Connection events
    connected: (data: ConnectedData) => void;
    existingPlayers: (players: Player[]) => void;
    existingShards: (shards: Shard[]) => void;
    existingDummies: (dummies: Dummy[]) => void;

    // Player events
    playerJoined: (data: PlayerJoinedData) => void;
    playerMoved: (data: PlayerMovedData) => void;
    playerLeft: (data: PlayerLeftData) => void;
    playerRespawned: (data: PlayerRespawnedData) => void;

    // Combat events
    playerAttacked: (data: PlayerAttackedData) => void;
    playerDamaged: (data: PlayerDamagedData) => void;
    playerDied: (data: PlayerDiedData) => void;
    playerTeleport: (data: PlayerTeleportData) => void;
    laserAiming: (data: LaserAimingBroadcastData) => void;
    laserFired: (data: LaserFiredData) => void;
    playerTelepathy: (data: PlayerTelepathyData) => void;
    telepathyTick: (data: TelepathyTickData) => void;
    telepathyTickDummy: (data: TelepathyTickDummyData) => void;
    telepathyHeal: (data: TelepathyHealData) => void;
    playerWave: (data: PlayerWaveData) => void;
    waveDamage: (data: WaveDamageData) => void;
    playerMadnessStart: (data: PlayerMadnessStartData) => void;
    playerMadnessEnd: (data: PlayerMadnessEndData) => void;
    madnessTick: (data: MadnessTickData) => void;
    playerPotSmash: (data: PlayerPotSmashData) => void;
    potSmashDamage: (data: PotSmashDamageData) => void;
    playerCurryRecovery: (data: PlayerCurryRecoveryData) => void;
    storedDamageUpdate: (data: StoredDamageUpdateData) => void;
    playerSpinThrow: (data: PlayerSpinThrowData) => void;
    spinThrowCollision: (data: SpinThrowCollisionData) => void;
    playerRageStart: (data: PlayerRageStartData) => void;
    playerRageEnd: (data: PlayerRageEndData) => void;
    rageStacksUpdate: (data: RageStacksUpdateData) => void;

    // Dummy events
    dummyDamaged: (data: DummyDamagedData) => void;
    dummyRespawned: (data: DummyRespawnedData) => void;

    // Shard events
    shardCollected: (data: ShardCollectedData) => void;
    shardsSpawned: (shards: Shard[]) => void;

    // Chat events
    chatMessage: (data: ChatMessageBroadcastData) => void;

    // Rat Illusion events
    ratIllusionStart: (data: RatIllusionStartData) => void;
    ratIllusionCast: (data: RatIllusionCastData) => void;
    ratIllusionDrain: (data: RatIllusionDrainData) => void;
    ratIllusionEnd: (data: RatIllusionEndData) => void;
    ratIllusionSuccess: (data: RatIllusionSuccessData) => void;
    ratIllusionFail: (data: RatIllusionFailData) => void;
    ratIllusionEffect: (data: RatIllusionEffectData) => void;
}

// ========================================
// EVENT DATA TYPES
// ========================================

// Player events
export interface PlayerMoveData {
    x: number;
    y: number;
    playerName?: string;
    characterId?: string;
}

export interface ConnectedData {
    playerId: string;
    team: Team;
}

export interface PlayerJoinedData {
    playerId: string;
    team: Team;
    x: number;
    y: number;
    playerName: string;
    level: number;
    experience: number;
    currentHP: number;
    maxHP: number;
    isDead: boolean;
    characterId: string;
}

export interface PlayerMovedData {
    playerId: string;
    x: number;
    y: number;
    playerName: string;
    level: number;
    experience: number;
    characterId: string;
}

export interface PlayerLeftData {
    playerId: string;
}

export interface PlayerRespawnedData {
    playerId: string;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
}

// Attack events
export interface AttackData {
    x?: number;
    y?: number;
    range?: number;
    power?: number;
}

export interface PlayerAttackedData {
    playerId: string;
    x: number;
    y: number;
    range: number;
}

export interface HitPlayerInfo {
    playerId: string;
    currentHP: number;
    maxHP: number;
    knockbackEndX: number;
    knockbackEndY: number;
    attackerX: number;
    attackerY: number;
    isMainHit?: boolean;
    confused?: boolean;
    confusionDuration?: number;
}

export interface PlayerDamagedData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
}

// Re-exported from shared/types.ts — shared/combat.ts uses this type
export type { KilledPlayerInfo } from '../shared/types';

export interface PlayerDiedData {
    playerId: string;
    killedBy: string;
    respawnDelay: number;
}

// Teleport events
export interface TeleportData {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export interface TeleportDamageData {
    x?: number;
    y?: number;
    radius?: number;
    damage?: number;
}

export interface PlayerTeleportData {
    playerId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

// Laser events
export interface LaserAimingData {
    x?: number;
    y?: number;
    dirX: number;
    dirY: number;
}

export interface LaserAimingBroadcastData {
    playerId: string;
    x: number;
    y: number;
    dirX: number;
    dirY: number;
}

export interface LaserAttackData {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    damage?: number;
}

export interface LaserFiredData {
    playerId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

// Telepathy events
export interface TelepathyData {
    x: number;
    y: number;
    radius: number;
}

export interface TelepathyDamageData {
    x?: number;
    y?: number;
    radius?: number;
    damagePerTarget?: number;
}

export interface PlayerTelepathyData {
    playerId: string;
    x: number;
    y: number;
    radius: number;
}

export interface TelepathyTickData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
}

export interface TelepathyTickDummyData {
    attackerId: string;
    hitDummies: HitDummyInfo[];
}

export interface TelepathyHealData {
    playerId: string;
    healAmount: number;
    newHP: number;
}

// Wave events
export interface WaveAttackData {
    x?: number;
    y?: number;
}

export interface PlayerWaveData {
    playerId: string;
    x: number;
    y: number;
    radius: number;
}

export interface WaveDamageData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
}

// Madness events
export interface PlayerMadnessStartData {
    playerId: string;
}

export interface PlayerMadnessEndData {
    playerId: string;
}

export interface MadnessTickData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
}

// Pot Smash events
export interface PotSmashData {
    dirX: number;
    dirY: number;
}

export interface PlayerPotSmashData {
    playerId: string;
    x: number;
    y: number;
    dirX: number;
    dirY: number;
}

export interface PotSmashDamageData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
}

// Curry Recovery events
export interface PlayerCurryRecoveryData {
    playerId: string;
    healAmount: number;
    currentHP: number;
    maxHP: number;
}

export interface StoredDamageUpdateData {
    storedDamage: number;
    maxStored: number;
}

// Spin Throw events
export interface SpinThrowData {
    targetId: string | number;
    targetType?: string;
    // dirX/dirY are sent by client but currently ignored by server
    // Server calculates direction from its own authoritative positions
    dirX: number;
    dirY: number;
}

export interface PlayerSpinThrowData {
    attackerId: string;
    targetId: string | number;
    targetType?: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    damage: number;
    collisionDamage?: number;
    // Server-authoritative HP values for the thrown target
    targetCurrentHP: number;
    targetMaxHP: number;
}

// Spin Throw Collision events
export interface SpinThrowCollisionData {
    attackerId: string;
    hitPlayers: HitPlayerInfo[];
    thrownTargetId: string | number;
    thrownTargetType: string;
}

// Rage events
export interface PlayerRageStartData {
    playerId: string;
    duration: number;
}

export interface RageStacksUpdateData {
    playerId: string;
    stacks: number;
}

export interface PlayerRageEndData {
    playerId: string;
}

// Dummy events
export interface HitDummyInfo {
    dummyId: number;
    currentHP: number;
    maxHP: number;
    knockbackEndX: number;
    knockbackEndY: number;
    attackerX: number;
    attackerY: number;
    isMainHit?: boolean;
}

export interface DummyDamagedData {
    attackerId: string;
    hitDummies?: HitDummyInfo[];
    // For single dummy damage (e.g., spin throw)
    dummyIndex?: number;
    damage?: number;
    currentHP?: number;
}

export interface DummyRespawnedData {
    dummyId: number;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
}

// Shard events
export interface CollectShardData {
    shardId: number;
}

export interface ShardCollectedData {
    level: number;
    experience: number;
    shardId: number;
    playerId: string;
}

// Chat events
export interface ChatMessageData {
    message: string;
}

export interface ChatMessageBroadcastData {
    playerId: string;
    playerName: string;
    message: string;
    timestamp: number;
}

// Rat Illusion events
export interface RatIllusionData {
    targetId?: string;
}

export interface RatClickData {
    ratIndex: number;
}

export interface RatIllusionStartData {
    casterId: string;
    casterX: number;
    casterY: number;
    ratCount: number;
    duration: number;
    radius: number;
}

export interface RatIllusionCastData {
    targetId: string;
    duration: number;
}

export interface RatIllusionDrainData {
    targetId: string;
    damage: number;
    currentHP: number;
    maxHP: number;
}

export interface RatIllusionEndData {
    targetId: string;
    reason: string;
}

export interface RatIllusionSuccessData {
    message: string;
}

export interface RatIllusionFailData {
    clickedIndex: number;
    message: string;
}

export interface RatIllusionEffectData {
    casterId: string;
    targetId: string;
    casterX: number;
    casterY: number;
}

// ========================================
// TYPED SOCKET AND SERVER
// ========================================

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// ========================================
// DAMAGE PROCESSOR TYPES
// ========================================

export interface AreaDamageOptions {
    attackerId: string;
    x: number;
    y: number;
    radius: number;
    damage: number;
    respawnDelay: number;
    applyKnockback?: boolean;
    knockbackDistance?: number;
    dummyRadiusBonus?: number;
}

export interface AreaDamageResult {
    hitPlayers: HitPlayerInfo[];
    killedPlayers: KilledPlayerInfo[];
}

export interface DummyDamageResult {
    hitDummies: HitDummyInfo[];
}

export interface BroadcastOptions {
    playerDamageEvent?: string;
    dummyDamageEvent?: string;
}
