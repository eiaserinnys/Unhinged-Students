/**
 * Type definitions for Unhinged Students game client
 */

// =====================================================
// Character Types
// =====================================================

export type CharacterType =
    | 'alien'
    | 'crazy-eyes'
    | 'curry-bear'
    | 'big-sis-hulk'
    | 'teacher'
    | 'squeak-squeak';

export type TeamType = 'red' | 'blue';

export type ScreenType = 'lobby' | 'waitingTeam' | 'teamAnnounce' | 'playing' | 'matchResult';

export type MatchWinner = 'red' | 'blue' | 'draw';

export interface MatchResultData {
    winner: MatchWinner;
    teamKills: { red: number; blue: number };
    durationMs: number;
}

export type SkillKey = 'q' | 'w' | 'e' | 'r' | 't';

// =====================================================
// Game State Types
// =====================================================

export interface GameStats {
    shardsCollected: number;
}

export interface GameState {
    screen: ScreenType;
    running: boolean;
    player: ICharacter | null;
    lobbyManager: ILobbyManager | null;
    shardManager: IShardManager | object | null;
    networkManager: INetworkManager | null;
    chatManager: IChatManager | object | null;
    skillManager: ISkillManager | null;
    skillUI: ISkillUI | null;
    laserBeamEffect: ILaserEffect | null;
    teleportEffect: ITeleportEffect | null;
    telepathyEffect: ITelepathyEffect | null;
    dummies: ICharacter[];
    stats: GameStats;
    lastFrameTime: number;
    deltaTime: number;
    lastAttackSentTime: number;
    hitVignetteTime: number;
    hitVignetteDuration: number;
    selectedCharacter: CharacterType;
    playerName: string;
    team: TeamType | null;
    teamAnnounceStartTime: number;
    teamAnnounceDuration: number;
    // Crazy-Eyes specific
    madnessActive: boolean;
    madnessStartTime: number;
    madnessDuration: number;
    madnessLastTickTime: number;
    madnessTickInterval: number;
    madnessRadius: number;
    // Curry-Bear specific
    storedDamage: number;
    maxStoredDamage: number;
    curryRecoveryActive: boolean;
    curryRecoveryStartTime: number;
    // Hulk Sister specific
    rageActive: boolean;
    rageStartTime: number;
    rageDuration: number;
    hulkRageStacks: number;
    hulkLastStackTime: number;
    // Effects
    waveEffect: IWaveEffect | null;
    potSmashEffect: IPotSmashEffect | null;
    spinThrowEffect: ISpinThrowEffect | null;
    // Match state (server-authoritative)
    matchRemainingMs: number;
    matchTeamKills: { red: number; blue: number };
    matchResult: MatchResultData | null;
}

// =====================================================
// Character Interfaces
// =====================================================

export interface Position {
    x: number;
    y: number;
}

export interface Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface AttackArea {
    x: number;
    y: number;
    radius: number;
}

export interface ICharacter {
    x: number;
    y: number;
    width: number;
    height: number;
    displaySize: number;
    speed: number;
    image: HTMLImageElement | null;
    imageLoaded: boolean;
    playerName: string;
    isDummy: boolean;
    isDead: boolean;
    level: number;
    experience: number;
    maxLevel: number;
    maxHP: number;
    currentHP: number;
    attackPower: number;
    attackRange: number;
    attackCooldown: number;
    lastAttackTime: number;
    isAttacking: boolean;
    attackAnimationTime: number;
    attackStartTime: number;
    lastDamagedTime: number;
    deathTime: number;
    respawnDelay: number;
    initialX: number;
    initialY: number;
    hitFlashTime: number;
    hitFlashDuration: number;
    isKnockedBack: boolean;
    knockbackStartTime: number;
    knockbackDuration: number;
    knockbackStartX: number;
    knockbackStartY: number;
    knockbackEndX: number;
    knockbackEndY: number;
    knockbackMinDistance: number;
    knockbackMaxDistance: number;
    chatMessage: string | null;
    chatMessageTime: number;
    chatMessageDuration: number;

    loadImage(path: string, retries?: number): Promise<void>;
    loadFallbackImage(): Promise<void>;
    update(canvas: { width: number; height: number }, deltaTime?: number): void;
    render(ctx: CanvasRenderingContext2D): void;
    renderAttackEffect(ctx: CanvasRenderingContext2D): void;
    getPosition(): Position;
    getBounds(): Bounds;
    getLevel(): number;
    getExperience(): number;
    getRequiredExperience(): number;
    addExperience(amount: number): boolean;
    levelUp(): void;
    attack(): AttackArea;
    getAttackArea(): AttackArea;
    takeDamage(amount: number): boolean;
    isAlive(): boolean;
    respawn(): void;
    canRespawn(): boolean;
    setChatMessage(message: string): void;
    startKnockback(attackerX: number, attackerY: number, endX: number, endY: number): void;
}

// =====================================================
// Network Types
// =====================================================

export interface PlayerData {
    playerId: string;
    x: number;
    y: number;
    playerName: string;
    level: number;
    experience: number;
    characterId: CharacterType;
    currentHP?: number;
    maxHP?: number;
    team?: TeamType;
}

export interface DamageHit {
    playerId: string;
    currentHP: number;
    maxHP: number;
    attackerX?: number;
    attackerY?: number;
    knockbackEndX?: number;
    knockbackEndY?: number;
    isMainHit?: boolean;
    confused?: boolean;
    confusionDuration?: number;
}

export interface DummyHit {
    dummyId: number;
    currentHP: number;
    maxHP: number;
    attackerX?: number;
    attackerY?: number;
    knockbackEndX?: number;
    knockbackEndY?: number;
}

export interface GameEventCallbacks {
    onStoredDamageUpdate(storedDamage: number, maxStored: number): void;
    onCurryRecoveryEffect(healAmount: number): void;
    onRatIllusionStart(data: {
        casterId: string;
        casterX: number;
        casterY: number;
        ratCount: number;
        duration: number;
        radius: number;
    }): void;
    onRatIllusionEnd(reason: string): void;
}

export interface INetworkManager {
    socket: SocketIOClient | null;
    playerId: string | null;
    persistentId: string;
    team: TeamType | null;
    connected: boolean;
    remotePlayers: Map<string, IRemotePlayer>;
    updateRate: number;
    lastUpdateTime: number;
    shardManager: IShardManager | null;
    localPlayer: ICharacter | null;
    dummies: ICharacter[] | null;
    reconnectUI: IReconnectUI | null;
    serverUrl: string | null;
    onTeamAssigned: ((team: TeamType) => void) | null;
    onReconnected: ((data: unknown) => void) | null;
    isConfused: boolean;
    confusionEndTime: number;

    setShardManager(shardManager: IShardManager): void;
    setLocalPlayer(player: ICharacter): void;
    setDummies(dummies: ICharacter[]): void;
    setGameCallbacks(callbacks: GameEventCallbacks): void;
    connect(serverUrl?: string | null): void;
    sendAttack(x: number, y: number, range: number, power: number): void;
    sendLaserAiming(x: number, y: number, dirX: number, dirY: number): void;
    sendLaserAttack(x1: number, y1: number, x2: number, y2: number, damage: number): void;
    sendTeleport(startX: number, startY: number, endX: number, endY: number): void;
    sendTeleportDamage(x: number, y: number, radius: number, damage: number): void;
    sendTelepathy(x: number, y: number, radius: number): void;
    sendTelepathyDamage(
        x: number,
        y: number,
        radius: number,
        damagePerTarget: number,
        maxHeal: number
    ): void;
    sendWaveAttack(): void;
    checkConfusion(): boolean;
    sendShardCollection(shardId: string): void;
    sendMadnessStart(): void;
    sendMadnessEnd(): void;
    sendMadnessDamage(): void;
    sendPotSmash(dirX: number, dirY: number): void;
    sendCurryRecovery(): void;
    sendSpinThrow(
        targetId: string | number | undefined,
        dirX: number,
        dirY: number,
        targetType?: string
    ): void;
    sendRageStart(): void;
    sendRageEnd(): void;
    sendRatIllusion(targetId?: string): void;
    sendRatClick(ratIndex: number): void;
    addRemotePlayer(playerData: PlayerData): void;
    removeRemotePlayer(playerId: string): void;
    sendPlayerPosition(
        x: number,
        y: number,
        playerName: string,
        level: number,
        experience: number,
        characterId: CharacterType
    ): void;
    update(): void;
    render(ctx: CanvasRenderingContext2D): void;
    attemptReconnect(): void;
    disconnect(): void;
}

export interface IRemotePlayer {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    playerName: string;
    level: number;
    experience: number;
    characterId: CharacterType;
    currentHP: number;
    maxHP: number;
    team: TeamType | null;
    isDead: boolean;
    hitFlashTime: number;
    madnessActive: boolean;

    updatePosition(x: number, y: number): void;
    setCharacter(characterId: CharacterType): void;
    setChatMessage(message: string): void;
    startAttackEffect(x: number, y: number, range: number): void;
    startLaserAiming(x: number, y: number, dirX: number, dirY: number): void;
    fireLaser(): void;
    startTeleport(startX: number, startY: number, endX: number, endY: number): void;
    startTelepathy(x: number, y: number, radius: number): void;
    startWave(): void;
    startPotSmash(dirX: number, dirY: number): void;
    startCurryRecovery(healAmount: number): void;
    startSpinThrow(startX: number, startY: number, endX: number, endY: number): void;
    startRage(duration: number): void;
    endRage(): void;
    startKnockback(attackerX: number, attackerY: number, endX: number, endY: number): void;
    update(): void;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface IReconnectUI {
    isVisible: boolean;
    onReconnect: (() => void) | null;
    show(): void;
    hide(): void;
    onReconnectSuccess(): void;
    onReconnectFailed(): void;
}

// Socket.IO client interface (simplified)
export interface SocketIOClient {
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string): void;
    emit(event: string, data?: unknown): void;
    connect(): void;
    disconnect(): void;
}

// =====================================================
// Skill Types
// =====================================================

export interface ISkill {
    name: string;
    key: string;
    cooldown: number;
    lastUsedTime: number;
    iconColor: string;
    emoji: string;
    readyFlashTime: number;
    readyFlashDuration: number;
    wasOnCooldown: boolean;

    isReady(): boolean;
    use(): boolean;
    getRemainingCooldown(): number;
    getCooldownProgress(): number;
    checkReadyFlash(): boolean;
    isFlashing(): boolean;
    getFlashIntensity(): number;
}

export interface ISkillManager {
    skills: Map<string, ISkill>;
    skillOrder: string[];

    addSkill(skill: ISkill): void;
    getSkill(key: string): ISkill | undefined;
    useSkill(key: string): ISkill | null;
    update(): void;
    getAllSkills(): (ISkill | undefined)[];
}

export interface ISkillUI {
    render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void;
}

// =====================================================
// Effect Interfaces
// =====================================================

export interface LaserLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface TeleportPosition {
    x: number;
    y: number;
    teleported: boolean;
}

export interface DamageArea {
    x: number;
    y: number;
    radius: number;
    damage?: number;
    damagePerTarget?: number;
    maxHeal?: number;
}

export interface ILaserEffect {
    active: boolean;
    phase: 'aiming' | 'firing' | 'none';
    dirX: number;
    dirY: number;
    damage: number;
    start(playerX: number, playerY: number, targetX: number, targetY: number): void;
    update(playerX: number, playerY: number): void;
    shouldDealDamage(): boolean;
    getLaserLine(): LaserLine | null;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface ITeleportEffect {
    active: boolean;
    phase: 'disappear' | 'appear' | 'none';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    start(
        playerX: number,
        playerY: number,
        gameWidth: number,
        gameHeight: number,
        targetX?: number | null,
        targetY?: number | null
    ): void;
    update(): TeleportPosition | null;
    shouldDealDamage(): boolean;
    getDamageArea(): DamageArea;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface ITelepathyEffect {
    active: boolean;
    radius: number;
    start(playerX: number, playerY: number): void;
    update(playerX: number, playerY: number): void;
    shouldDealDamage(): boolean;
    getDamageArea(): DamageArea;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface IWaveEffect {
    isActive: boolean;
    render(ctx: CanvasRenderingContext2D): void;
    start(x: number, y: number): void;
}

export interface IPotSmashEffect {
    isActive: boolean;
    render(ctx: CanvasRenderingContext2D): void;
    start(x: number, y: number, dirX: number, dirY: number): void;
}

export interface ISpinThrowEffect {
    isActive: boolean;
    render(ctx: CanvasRenderingContext2D): void;
    start(startX: number, startY: number, endX: number, endY: number): void;
}

// =====================================================
// Manager Interfaces
// =====================================================

export interface ILobbyManager {
    container: HTMLElement | null;
    nameInput: HTMLInputElement | null;
    startButton: HTMLButtonElement | null;
    characterOptions: NodeListOf<Element>;
    characterStats: HTMLElement | null;
    characterSkills: HTMLElement | null;
    selectedCharacter: CharacterType | null;
    playerName: string;
    isActive: boolean;
    onGameStart: ((data: { character: CharacterType; playerName: string }) => void) | null;

    getInitialSelectedCharacter(): CharacterType | null;
    setupEventListeners(): void;
    selectCharacter(option: Element): void;
    updateCharacterInfo(): void;
    validateInput(): void;
    canStartGame(): boolean;
    startGame(): void;
    hide(): void;
    show(): void;
    setOnGameStart(
        callback: (data: { character: CharacterType; playerName: string }) => void
    ): void;
}

export interface Shard {
    id: string;
    x: number;
    y: number;
}

export interface IShardManager {
    shards: Map<string, Shard>;

    loadShardsFromServer(shards: Shard[]): void;
    addShardsFromServer(shards: Shard[]): void;
    removeShard(shardId: string): void;
    checkCollection(playerX: number, playerY: number, collectRadius: number): Shard | null;
    update(): void;
    render(ctx: CanvasRenderingContext2D): void;
}

export interface IChatManager {
    input: HTMLInputElement | null;
    isInputActive: boolean;

    sendMessage(message: string): void;
    showInput(): void;
    hideInput(): void;
    toggle(): void;
}

// =====================================================
// Input Types
// =====================================================

export interface MouseState {
    x: number;
    y: number;
    pressed: boolean;
    button: number;
}

export interface TouchState {
    x: number;
    y: number;
    active: boolean;
}

export interface InputState {
    keys: Record<string, boolean>;
    keysJustPressed: Record<string, boolean>;
    keysPrevious: Record<string, boolean>;
    mouse: MouseState;
    touch: TouchState;
    isConfused: boolean;
    confusionEndTime: number;
}

// =====================================================
// Config Types
// =====================================================

export interface WorldConfig {
    WIDTH: number;
    HEIGHT: number;
    ASPECT_RATIO: number;
}

export interface PlayerConfig {
    SPEED: number;
    MAX_HP: number;
    MAX_LEVEL: number;
    DISPLAY_SIZE_RATIO: number;
    RESPAWN_DELAY_MS: number;
    INVINCIBILITY_MS: number;
}

export interface CombatConfig {
    ATTACK_POWER: number;
    ATTACK_RANGE: number;
    ATTACK_COOLDOWN_MS: number;
    ATTACK_ANIMATION_MS: number;
}

export interface KnockbackConfig {
    MIN_DISTANCE: number;
    MAX_DISTANCE: number;
    DURATION_MS: number;
    BOUNDARY_MARGIN: number;
}

export interface EffectsConfig {
    HIT_FLASH_DURATION_MS: number;
    HIT_VIGNETTE_DURATION_MS: number;
    CHAT_BUBBLE_DURATION_MS: number;
}

export interface SkillLaserConfig {
    COOLDOWN_MS: number;
    AIM_DURATION_MS: number;
    FIRE_DURATION_MS: number;
    DAMAGE: number;
    MAX_LENGTH: number;
    READY_FLASH_DURATION_MS: number;
    COLOR: string;
}

export interface SkillTeleportConfig {
    COOLDOWN_MS: number;
    DISAPPEAR_DURATION_MS: number;
    APPEAR_DURATION_MS: number;
    MIN_DISTANCE: number;
    MAX_DISTANCE: number;
    DAMAGE_RADIUS: number;
    DAMAGE: number;
    COLOR: string;
}

export interface SkillTelepathyConfig {
    COOLDOWN_MS: number;
    DURATION_MS: number;
    TICK_INTERVAL_MS: number;
    RADIUS: number;
    DAMAGE_PER_TICK: number;
    MAX_HEAL_PER_TICK: number;
    COLOR: string;
}

export interface SkillWaveConfig {
    COOLDOWN_MS: number;
    EXPAND_DURATION_MS: number;
    RADIUS: number;
    DAMAGE: number;
    CONFUSION_DURATION_MS: number;
    COLOR: string;
}

export interface SkillMadnessConfig {
    COOLDOWN_MS: number;
    DURATION_MS: number;
    RADIUS: number;
    DAMAGE_PER_SECOND: number;
    TICK_INTERVAL_MS: number;
    COLOR: string;
}

export interface SkillPotSmashConfig {
    COOLDOWN_MS: number;
    DAMAGE: number;
    SPLASH_DAMAGE: number;
    RANGE: number;
    ANGLE: number;
    SPLASH_RADIUS: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillCurryRecoveryConfig {
    COOLDOWN_MS: number;
    MAX_STORED_DAMAGE: number;
    STORE_RATIO: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillSpinThrowConfig {
    COOLDOWN_MS: number;
    GRAB_RANGE: number;
    THROW_DISTANCE: number;
    DAMAGE: number;
    COLLISION_DAMAGE: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillRageConfig {
    COOLDOWN_MS: number;
    DURATION_MS: number;
    DAMAGE_MULTIPLIER: number;
    THROW_MULTIPLIER: number;
    COLOR: string;
}

export interface HulkPassiveConfig {
    MAX_STACKS: number;
    DAMAGE_PER_STACK: number;
    THROW_PER_STACK: number;
    STACK_DURATION_MS: number;
}

export interface HulkStatsConfig {
    MAX_HP: number;
}

export interface SkillRatIllusionConfig {
    COOLDOWN_MS: number;
    RAT_COUNT: number;
    DURATION_MS: number;
    HP_DRAIN_PER_SECOND: number;
    RAT_SPEED: number;
    EFFECT_RADIUS: number;
    COLOR: string;
}

export interface SkillSleepPowderConfig {
    COOLDOWN_MS: number;
    RADIUS: number;
    SLEEP_DURATION_MS: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillRatBombConfig {
    COOLDOWN_MS: number;
    EXPLOSION_DAMAGE: number;
    EXPLOSION_RADIUS: number;
    RAT_COUNT: number;
    RAT_DAMAGE: number;
    RAT_DURATION_MS: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillDollHugConfig {
    COOLDOWN_MS: number;
    SHIELD_HP: number;
    REFLECT_RATIO: number;
    DURATION_MS: number;
    WEAK_POINTS: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SkillRatReviveConfig {
    COOLDOWN_MS: number;
    REVIVE_HP_RATIO: number;
    EFFECT_DURATION_MS: number;
    COLOR: string;
}

export interface SqueakStatsConfig {
    MAX_HP: number;
    SPEED: number;
}

export interface ShardConfig {
    SIZE: number;
    SPAWN_MARGIN: number;
    MAX_COUNT: number;
    RESPAWN_INTERVAL_MS: number;
    MAX_EFFECTS: number;
    COLOR: string;
}

export interface DummyPosition {
    offsetX: number;
    offsetY: number;
    name: string;
}

export interface DummyConfig {
    MAX_HP: number;
    RESPAWN_DELAY_MS: number;
    POSITIONS: DummyPosition[];
}

export interface UIConfig {
    SKILL_BOX_SIZE: number;
    SKILL_BOX_GAP: number;
    SKILL_BOX_BOTTOM_MARGIN: number;
    SKILL_BOX_BORDER_RADIUS: number;
}

export interface ParticleConfig {
    COLLECT_COUNT: number;
    MIN_SIZE: number;
    SIZE_VARIANCE: number;
    MIN_SPEED: number;
    SPEED_VARIANCE: number;
    MIN_DECAY: number;
    DECAY_VARIANCE: number;
    FRICTION: number;
}

export interface GameConfig {
    WORLD: WorldConfig;
    PLAYER: PlayerConfig;
    COMBAT: CombatConfig;
    KNOCKBACK: KnockbackConfig;
    EFFECTS: EffectsConfig;
    SKILL_LASER: SkillLaserConfig;
    SKILL_TELEPORT: SkillTeleportConfig;
    SKILL_TELEPATHY: SkillTelepathyConfig;
    SKILL_WAVE: SkillWaveConfig;
    SKILL_MADNESS: SkillMadnessConfig;
    SKILL_POT_SMASH: SkillPotSmashConfig;
    SKILL_CURRY_RECOVERY: SkillCurryRecoveryConfig;
    SKILL_SPIN_THROW: SkillSpinThrowConfig;
    SKILL_RAGE: SkillRageConfig;
    HULK_PASSIVE: HulkPassiveConfig;
    HULK_STATS: HulkStatsConfig;
    SKILL_RAT_ILLUSION: SkillRatIllusionConfig;
    SKILL_SLEEP_POWDER: SkillSleepPowderConfig;
    SKILL_RAT_BOMB: SkillRatBombConfig;
    SKILL_DOLL_HUG: SkillDollHugConfig;
    SKILL_RAT_REVIVE: SkillRatReviveConfig;
    SQUEAK_STATS: SqueakStatsConfig;
    SHARD: ShardConfig;
    DUMMY: DummyConfig;
    UI: UIConfig;
    PARTICLE: ParticleConfig;
}

// =====================================================
// Logger Types
// =====================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    getLevel(): LogLevel;
    setLevel(level: LogLevel): void;
    isLevelEnabled(level: LogLevel): boolean;
}

// =====================================================
// Global Window Extensions
// =====================================================

declare global {
    interface Window {
        gameState: GameState;
        GAME_WIDTH: number;
        GAME_HEIGHT: number;
        getScale(): number;
        setScale(value: number): void;
        getOffsetX(): number;
        setOffsetX(value: number): void;
        getOffsetY(): number;
        setOffsetY(value: number): void;
        getCanvas(): HTMLCanvasElement | null;
        setCanvas(c: HTMLCanvasElement): void;
        getCtx(): CanvasRenderingContext2D | null;
        setCtx(c: CanvasRenderingContext2D): void;
        getResizeHandler(): (() => void) | null;
        setResizeHandler(handler: () => void): void;
        getLoadHandler(): (() => void) | null;
        setLoadHandler(handler: () => void): void;
        logger: Logger;
        io: (options?: { path?: string }) => SocketIOClient;
    }
}

export {};
