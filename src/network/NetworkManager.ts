// Network module for multiplayer

import { logger } from '../utils/logger.js';
import { triggerHitVignette } from '../rendering/uiRenderer.js';
import { setConfused } from '../input.js';
import { ReconnectUI } from './ReconnectUI.js';
import { RemotePlayer } from './RemotePlayer.js';
import type {
    CharacterType,
    TeamType,
    GameEventCallbacks,
    INetworkManager,
    IRemotePlayer,
    IShardManager,
    ICharacter,
    IReconnectUI,
    SocketIOClient,
    PlayerData,
    DamageHit,
    DummyHit,
    Shard,
} from '../types/index.js';

/**
 * Interface for server dummy data
 */
interface ServerDummy {
    id: number;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
}

/**
 * Interface for connection response
 */
interface ConnectedResponse {
    playerId: string;
    team?: TeamType;
}

/**
 * Interface for reconnection response (restored state from server)
 */
interface ReconnectedResponse {
    playerId: string;
    team: TeamType;
    x: number;
    y: number;
    currentHP: number;
    maxHP: number;
    level: number;
    experience: number;
    characterId: CharacterType;
    playerName: string;
    shardCollectCount: number;
    storedDamage: number;
    rageStacks: number;
}

/**
 * Interface for player movement data
 */
interface PlayerMoveData {
    playerId: string;
    x: number;
    y: number;
    level?: number;
    experience?: number;
    playerName?: string;
    characterId?: CharacterType;
}

/**
 * Interface for spin throw event data
 */
interface SpinThrowData {
    attackerId: string;
    targetId: string | number;
    targetType?: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    damage?: number;
    collisionDamage?: number;
    // Server-authoritative HP values for the thrown target
    targetCurrentHP: number;
    targetMaxHP: number;
}

/**
 * Interface for curry recovery event data
 */
interface CurryRecoveryData {
    playerId: string;
    currentHP: number;
    maxHP: number;
    healAmount: number;
}

/**
 * Interface for respawn data
 */
interface RespawnData {
    playerId: string;
    x: number;
    y: number;
    currentHP: number;
    maxHP?: number;
}

/**
 * Interface for death data
 */
interface DeathData {
    playerId: string;
    killedBy: string;
    respawnDelay: number;
}

/**
 * Get or create a persistent player ID stored in sessionStorage.
 * This UUID survives page reloads within the same tab but isolates
 * each tab to prevent two tabs from sharing the same persistentId
 * (which would cause one to hijack the other's session on reconnect).
 */
function getOrCreatePersistentId(): string {
    let id = sessionStorage.getItem('playerId');
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('playerId', id);
    }
    return id;
}

/**
 * Manages network communication for multiplayer functionality
 */
export class NetworkManager implements INetworkManager {
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
    private gameCallbacks: GameEventCallbacks | null;

    constructor() {
        this.socket = null;
        this.playerId = null;
        this.persistentId = getOrCreatePersistentId();
        this.team = null;
        this.connected = false;
        this.remotePlayers = new Map();
        this.updateRate = 1000 / 20; // 20 updates per second
        this.lastUpdateTime = 0;
        this.shardManager = null;
        this.localPlayer = null;
        this.dummies = null;
        this.reconnectUI = null;
        this.serverUrl = null;
        this.onTeamAssigned = null;
        this.onReconnected = null;
        // Confusion effect (from wave attack)
        this.isConfused = false;
        this.confusionEndTime = 0;
        this.gameCallbacks = null;
    }

    setShardManager(shardManager: IShardManager): void {
        this.shardManager = shardManager;
    }

    setLocalPlayer(player: ICharacter): void {
        this.localPlayer = player;
    }

    setDummies(dummies: ICharacter[]): void {
        this.dummies = dummies;
    }

    setGameCallbacks(callbacks: GameEventCallbacks): void {
        this.gameCallbacks = callbacks;
    }

    connect(serverUrl: string | null = null): void {
        // Use relative path for socket.io (works with nginx reverse proxy)
        const options = {
            path: '/game/socket.io',
        };

        logger.info('Connecting to server via /game/socket.io');

        this.serverUrl = serverUrl;

        // Initialize ReconnectUI if not already done
        if (!this.reconnectUI) {
            this.reconnectUI = new ReconnectUI();
            this.reconnectUI.onReconnect = () => this.attemptReconnect();
        }

        this.socket = window.io(options);

        // Connection established
        this.socket.on('connected', (data: unknown) => {
            const connData = data as ConnectedResponse;
            this.playerId = connData.playerId;
            this.team = connData.team || 'red';
            this.connected = true;
            logger.info(`Connected to server. Player ID: ${this.playerId}, Team: ${this.team}`);

            // Send identify event with persistent UUID for reconnection support
            this.socket!.emit('identify', {
                playerId: this.persistentId,
                playerName: this.localPlayer?.playerName || 'Player',
                characterId: 'alien', // Default; actual characterId sent via playerMove
            });

            // Hide reconnect UI on successful connection
            if (this.reconnectUI && this.reconnectUI.isVisible) {
                this.reconnectUI.onReconnectSuccess();
            }

            // Notify about team assignment
            if (this.onTeamAssigned && this.team) {
                this.onTeamAssigned(this.team);
            }
        });

        // Reconnection: server restored our previous state
        this.socket.on('reconnected', (data: unknown) => {
            const reconnectData = data as ReconnectedResponse;
            this.playerId = reconnectData.playerId;
            this.team = reconnectData.team;
            this.connected = true;
            logger.info(`Reconnected to server. Player ID: ${this.playerId}, Team: ${this.team}, HP: ${reconnectData.currentHP}/${reconnectData.maxHP}`);

            // Hide reconnect UI
            if (this.reconnectUI && this.reconnectUI.isVisible) {
                this.reconnectUI.onReconnectSuccess();
            }

            // Notify about team reassignment
            if (this.onTeamAssigned && this.team) {
                this.onTeamAssigned(this.team);
            }

            // Notify game about restored state
            if (this.onReconnected) {
                this.onReconnected(reconnectData);
            }
        });

        // Receive existing players
        this.socket.on('existingPlayers', (data: unknown) => {
            const players = data as PlayerData[];
            logger.debug(`Received ${players.length} existing players`);
            players.forEach((playerData) => {
                if (playerData.playerId !== this.playerId) {
                    this.addRemotePlayer(playerData);
                }
            });
        });

        // New player joined
        this.socket.on('playerJoined', (data: unknown) => {
            const playerData = data as PlayerData;
            logger.info(`Player joined: ${playerData.playerId}`);
            this.addRemotePlayer(playerData);
        });

        // Player moved
        this.socket.on('playerMoved', (data: unknown) => {
            const moveData = data as PlayerMoveData;
            const remotePlayer = this.remotePlayers.get(moveData.playerId);
            if (remotePlayer) {
                remotePlayer.updatePosition(moveData.x, moveData.y);
                remotePlayer.level = moveData.level || 1;
                remotePlayer.experience = moveData.experience || 0;
                remotePlayer.playerName = moveData.playerName || 'Player';
                // Update character if changed
                if (moveData.characterId) {
                    remotePlayer.setCharacter(moveData.characterId);
                }
            }
        });

        // Player left (permanently)
        this.socket.on('playerLeft', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            logger.info(`Player left: ${playerId}`);
            this.removeRemotePlayer(playerId);
        });

        // Player temporarily disconnected (may reconnect)
        this.socket.on('playerTemporarilyDisconnected', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            logger.info(`Player temporarily disconnected: ${playerId}`);
            // For now, remove from view — they will reappear via playerReconnected
            this.removeRemotePlayer(playerId);
        });

        // Player reconnected (restored state)
        this.socket.on('playerReconnected', (data: unknown) => {
            const playerData = data as PlayerData;
            logger.info(`Player reconnected: ${playerData.playerId}`);
            this.addRemotePlayer(playerData);
        });

        // Connection error
        this.socket.on('connect_error', (error: unknown) => {
            logger.error('Connection error:', error);

            // Show reconnect UI on connection error
            if (this.reconnectUI) {
                this.reconnectUI.show();
                this.reconnectUI.onReconnectFailed();
            }
        });

        // Disconnection
        this.socket.on('disconnect', () => {
            logger.warn('Disconnected from server');
            this.connected = false;

            // Show reconnect UI instead of auto-reload
            if (this.reconnectUI) {
                this.reconnectUI.show();
            }
        });

        // Chat message (for showing bubbles on remote players)
        this.socket.on('chatMessage', (data: unknown) => {
            const { playerId, message } = data as { playerId: string; message: string };
            // Show chat bubble on the player who sent it
            if (playerId && playerId !== this.playerId) {
                const remotePlayer = this.remotePlayers.get(playerId);
                if (remotePlayer) {
                    remotePlayer.setChatMessage(message);
                }
            }
        });

        // Player attack event (for showing other players' attacks)
        this.socket.on('playerAttacked', (data: unknown) => {
            const { playerId, x, y, range } = data as {
                playerId: string;
                x: number;
                y: number;
                range: number;
            };
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.startAttackEffect(x, y, range);
            }
        });

        // Laser aiming event (for showing other players' laser aim)
        this.socket.on('laserAiming', (data: unknown) => {
            const { playerId, x, y, dirX, dirY } = data as {
                playerId: string;
                x: number;
                y: number;
                dirX: number;
                dirY: number;
            };
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.startLaserAiming(x, y, dirX, dirY);
            }
        });

        // Laser fired event (for showing other players' laser fire)
        this.socket.on('laserFired', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.fireLaser();
            }
        });

        // Teleport event (for showing other players' teleport)
        this.socket.on('playerTeleport', (data: unknown) => {
            const { playerId, startX, startY, endX, endY } = data as {
                playerId: string;
                startX: number;
                startY: number;
                endX: number;
                endY: number;
            };
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.startTeleport(startX, startY, endX, endY);
            }
        });

        // Telepathy event (for showing other players' telepathy)
        this.socket.on('playerTelepathy', (data: unknown) => {
            const { playerId, x, y, radius } = data as {
                playerId: string;
                x: number;
                y: number;
                radius: number;
            };
            const remotePlayer = this.remotePlayers.get(playerId);
            if (remotePlayer) {
                remotePlayer.startTelepathy(x, y, radius);
            }
        });

        // Telepathy heal event (for local player HP recovery)
        this.socket.on('telepathyHeal', (data: unknown) => {
            const { playerId, healAmount } = data as { playerId: string; healAmount: number };
            if (playerId === this.playerId && this.localPlayer) {
                this.localPlayer.currentHP = Math.min(
                    this.localPlayer.maxHP,
                    this.localPlayer.currentHP + healAmount
                );
                logger.debug(
                    `Telepathy healed ${healAmount} HP! Current: ${this.localPlayer.currentHP}/${this.localPlayer.maxHP}`
                );
            }
        });

        // Telepathy tick damage (no knockback, but with hit flash and vignette)
        this.socket.on('telepathyTick', (data: unknown) => {
            const { hitPlayers } = data as { hitPlayers: DamageHit[] };
            hitPlayers.forEach((hit) => {
                if (hit.playerId === this.playerId && this.localPlayer) {
                    // Update local player HP with hit flash and vignette (no knockback)
                    this.localPlayer.currentHP = hit.currentHP;
                    this.localPlayer.hitFlashTime = Date.now();

                    // Trigger screen vignette effect
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }
                } else {
                    // Update remote player HP with hit flash
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                        player.hitFlashTime = Date.now();
                    }
                }
            });
        });

        // Telepathy tick damage for dummies (no knockback, with hit flash)
        this.socket.on('telepathyTickDummy', (data: unknown) => {
            const { hitDummies } = data as { hitDummies: DummyHit[] };
            if (this.dummies) {
                hitDummies.forEach((hit) => {
                    const dummy = this.dummies![hit.dummyId];
                    if (dummy) {
                        dummy.currentHP = hit.currentHP;
                        dummy.hitFlashTime = Date.now();
                        if (dummy.currentHP <= 0) {
                            dummy.deathTime = Date.now();
                        }
                    }
                });
            }
        });

        // Wave attack from other player (Crazy-Eyes)
        this.socket.on('playerWave', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            const player = this.remotePlayers.get(playerId);
            if (player) {
                player.startWave();
            }
        });

        // Wave damage received (with confusion effect)
        this.socket.on('waveDamage', (data: unknown) => {
            const { attackerId, hitPlayers } = data as {
                attackerId: string;
                hitPlayers: DamageHit[];
            };
            logger.debug(`Wave damage from ${attackerId}:`, hitPlayers);
            hitPlayers.forEach((hit) => {
                // Check if it's the local player
                if (hit.playerId === this.playerId) {
                    if (this.localPlayer) {
                        this.localPlayer.currentHP = hit.currentHP;
                        this.localPlayer.hitFlashTime = Date.now();
                    }
                    // Apply confusion effect (reversed controls)
                    if (
                        hit.confused &&
                        typeof setConfused === 'function' &&
                        hit.confusionDuration
                    ) {
                        setConfused(hit.confusionDuration);
                        logger.info(`Confused for ${hit.confusionDuration}ms! Controls reversed!`);
                    }
                } else {
                    // Remote player
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                        player.hitFlashTime = Date.now();
                    }
                }
            });
        });

        // Madness walk from other player (Crazy-Eyes E skill)
        this.socket.on('playerMadnessStart', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            const player = this.remotePlayers.get(playerId);
            if (player) {
                player.madnessActive = true;
                logger.debug(`Player ${playerId} started madness walk`);
            }
        });

        this.socket.on('playerMadnessEnd', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            const player = this.remotePlayers.get(playerId);
            if (player) {
                player.madnessActive = false;
                logger.debug(`Player ${playerId} ended madness walk`);
            }
        });

        // Madness tick damage (small damage, no vignette)
        this.socket.on('madnessTick', (data: unknown) => {
            const { hitPlayers } = data as { hitPlayers: DamageHit[] };
            hitPlayers.forEach((hit) => {
                if (hit.playerId === this.playerId) {
                    if (this.localPlayer) {
                        this.localPlayer.currentHP = hit.currentHP;
                        // Small damage, no hit flash
                    }
                } else {
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                    }
                }
            });
        });

        // Pot smash from other player (Curry-Bear)
        this.socket.on('playerPotSmash', (data: unknown) => {
            const { playerId, dirX, dirY } = data as {
                playerId: string;
                dirX: number;
                dirY: number;
            };
            const player = this.remotePlayers.get(playerId);
            if (player) {
                player.startPotSmash(dirX, dirY);
            }
        });

        // Pot smash damage received
        this.socket.on('potSmashDamage', (data: unknown) => {
            const { hitPlayers } = data as { hitPlayers: DamageHit[] };
            hitPlayers.forEach((hit) => {
                if (hit.playerId === this.playerId) {
                    if (this.localPlayer) {
                        this.localPlayer.currentHP = hit.currentHP;
                        this.localPlayer.hitFlashTime = Date.now();

                        // Trigger vignette for main hit
                        if (hit.isMainHit && typeof triggerHitVignette === 'function') {
                            triggerHitVignette();
                        }

                        // Apply knockback
                        if (
                            hit.knockbackEndX !== undefined &&
                            hit.knockbackEndY !== undefined &&
                            hit.attackerX !== undefined &&
                            hit.attackerY !== undefined
                        ) {
                            this.localPlayer.startKnockback(
                                hit.attackerX,
                                hit.attackerY,
                                hit.knockbackEndX,
                                hit.knockbackEndY
                            );
                        }
                    }
                } else {
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                        player.hitFlashTime = Date.now();

                        if (
                            hit.knockbackEndX !== undefined &&
                            hit.knockbackEndY !== undefined &&
                            hit.attackerX !== undefined &&
                            hit.attackerY !== undefined
                        ) {
                            player.startKnockback(
                                hit.attackerX,
                                hit.attackerY,
                                hit.knockbackEndX,
                                hit.knockbackEndY
                            );
                        }
                    }
                }
            });
        });

        // Stored damage update (for curry-bear passive)
        this.socket.on('storedDamageUpdate', (data: unknown) => {
            const { storedDamage, maxStored } = data as {
                storedDamage: number;
                maxStored: number;
            };
            this.gameCallbacks?.onStoredDamageUpdate(storedDamage, maxStored);
        });

        // Curry recovery (Curry-Bear E skill)
        this.socket.on('playerCurryRecovery', (data: unknown) => {
            const recoveryData = data as CurryRecoveryData;
            if (recoveryData.playerId === this.playerId) {
                // Local player healed
                if (this.localPlayer) {
                    this.localPlayer.currentHP = recoveryData.currentHP;
                }
                // Update stored damage to 0
                this.gameCallbacks?.onStoredDamageUpdate(0, recoveryData.maxHP);
                // Trigger recovery effect
                this.gameCallbacks?.onCurryRecoveryEffect(recoveryData.healAmount);
                logger.debug(`Curry recovery: healed ${recoveryData.healAmount} HP`);
            } else {
                // Remote player healed - visual effect
                const player = this.remotePlayers.get(recoveryData.playerId);
                if (player && player.startCurryRecovery) {
                    player.startCurryRecovery(recoveryData.healAmount);
                }
            }
        });

        // Spin throw (Hulk Sister Q skill)
        this.socket.on('playerSpinThrow', (data: unknown) => {
            const throwData = data as SpinThrowData;
            logger.debug(
                `[SpinThrow] Received: target=${throwData.targetType}:${throwData.targetId}, HP=${throwData.targetCurrentHP}/${throwData.targetMaxHP}`
            );

            // Handle visual effect for attacker (if remote player)
            const attacker = this.remotePlayers.get(throwData.attackerId);
            if (attacker && attacker.startSpinThrow) {
                attacker.startSpinThrow(
                    throwData.startX,
                    throwData.startY,
                    throwData.endX,
                    throwData.endY
                );
            }

            // Handle target being thrown based on type
            // Use SERVER-AUTHORITATIVE HP values (targetCurrentHP, targetMaxHP)
            if (throwData.targetType === 'dummy') {
                // Dummy got thrown - update position and HP from server
                const dummyIndex = throwData.targetId as number;
                if (this.dummies && this.dummies[dummyIndex]) {
                    const dummy = this.dummies[dummyIndex];
                    const oldHP = dummy.currentHP;

                    // Update position from server
                    dummy.x = throwData.endX;
                    dummy.y = throwData.endY;
                    dummy.hitFlashTime = Date.now();

                    // Use server-authoritative HP (NOT damage calculation)
                    dummy.currentHP = throwData.targetCurrentHP;
                    dummy.maxHP = throwData.targetMaxHP;

                    logger.debug(
                        `[SpinThrow] Dummy ${dummyIndex}: HP ${oldHP} -> ${dummy.currentHP}/${dummy.maxHP}`
                    );

                    // Mark as dead if HP is 0
                    if (dummy.currentHP <= 0) {
                        dummy.deathTime = Date.now();
                    }
                }
            } else if (throwData.targetId === this.playerId) {
                // Local player got thrown
                if (this.localPlayer) {
                    const oldHP = this.localPlayer.currentHP;

                    // Move to throw position from server
                    this.localPlayer.x = throwData.endX;
                    this.localPlayer.y = throwData.endY;
                    this.localPlayer.hitFlashTime = Date.now();

                    // Use server-authoritative HP (NOT damage calculation)
                    this.localPlayer.currentHP = throwData.targetCurrentHP;

                    logger.debug(
                        `[SpinThrow] Local player: HP ${oldHP} -> ${this.localPlayer.currentHP}/${throwData.targetMaxHP}`
                    );

                    // Trigger vignette
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }
                }
            } else {
                // Remote player got thrown
                const target = this.remotePlayers.get(throwData.targetId as string);
                if (target) {
                    const oldHP = target.currentHP;

                    // Update position from server
                    target.x = throwData.endX;
                    target.y = throwData.endY;
                    target.hitFlashTime = Date.now();

                    // Use server-authoritative HP (NOT damage calculation)
                    target.currentHP = throwData.targetCurrentHP;
                    target.maxHP = throwData.targetMaxHP;

                    logger.debug(
                        `[SpinThrow] Remote player ${throwData.targetId}: HP ${oldHP} -> ${target.currentHP}/${target.maxHP}`
                    );
                }
            }
        });

        // Spin throw collision damage (when thrown target hits other enemies)
        this.socket.on('spinThrowCollision', (data: unknown) => {
            const collisionData = data as {
                attackerId: string;
                hitPlayers: DamageHit[];
                thrownTargetId: string | number;
                thrownTargetType: string;
            };

            logger.debug(
                `Spin throw collision: ${collisionData.hitPlayers.length} players hit by thrown target`
            );

            // Apply damage to local player if hit
            for (const hitInfo of collisionData.hitPlayers) {
                if (hitInfo.playerId === this.playerId && this.localPlayer) {
                    this.localPlayer.currentHP = hitInfo.currentHP;
                    this.localPlayer.hitFlashTime = Date.now();

                    // Trigger vignette for collision damage
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }
                    break;
                }
            }

            // If local player was the thrown target, they also take collision damage
            // Note: HP update comes from playerSpinThrow event (targetCurrentHP) which is sent AFTER this event
            // Server emits: spinThrowCollision first, then playerSpinThrow with final HP
            if (
                collisionData.thrownTargetType === 'player' &&
                collisionData.thrownTargetId === this.playerId &&
                this.localPlayer
            ) {
                // Just trigger visual effect - HP update comes from playerSpinThrow event
                this.localPlayer.hitFlashTime = Date.now();
            }
        });

        // Rage state updates (Hulk Sister E skill)
        this.socket.on('playerRageStart', (data: unknown) => {
            const { playerId, duration } = data as { playerId: string; duration: number };
            const player = this.remotePlayers.get(playerId);
            if (player && player.startRage) {
                player.startRage(duration);
            }
        });

        this.socket.on('playerRageEnd', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            const player = this.remotePlayers.get(playerId);
            if (player && player.endRage) {
                player.endRage();
            }
        });

        // Rat Illusion events (Squeak-Squeak Q skill)
        // 내가 쥐 환상에 걸렸을 때 (상대방이 나한테 시전)
        this.socket.on('ratIllusionStart', (data: unknown) => {
            const { casterId, casterX, casterY, ratCount, duration, radius } = data as {
                casterId: string;
                casterX: number;
                casterY: number;
                ratCount: number;
                duration: number;
                radius: number;
            };
            logger.info(`Rat illusion started on you by ${casterId}!`);

            // 쥐 환상 효과 시작
            this.gameCallbacks?.onRatIllusionStart({
                casterId,
                casterX,
                casterY,
                ratCount,
                duration,
                radius,
            });
        });

        // 내가 시전한 쥐 환상이 적용됨
        this.socket.on('ratIllusionCast', (data: unknown) => {
            const { targetId, duration } = data as { targetId: string; duration: number };
            logger.info(`Rat illusion cast on ${targetId} for ${duration}ms`);
        });

        // 쥐 환상 체력 감소
        this.socket.on('ratIllusionDrain', (data: unknown) => {
            const { targetId, damage, currentHP, maxHP } = data as {
                targetId: string;
                damage: number;
                currentHP: number;
                maxHP: number;
            };

            if (targetId === this.playerId && this.localPlayer) {
                this.localPlayer.currentHP = currentHP;
                this.localPlayer.hitFlashTime = Date.now();
                logger.debug(`Rat illusion drain: -${damage} HP (${currentHP}/${maxHP})`);
            }
        });

        // 쥐 환상 종료
        this.socket.on('ratIllusionEnd', (data: unknown) => {
            const { targetId, reason } = data as { targetId: string; reason: string };

            if (targetId === this.playerId) {
                logger.info(`Rat illusion ended: ${reason}`);
                // 쥐 환상 효과 종료
                this.gameCallbacks?.onRatIllusionEnd(reason);
            }
        });

        // 진짜 쥐를 찾았을 때
        this.socket.on('ratIllusionSuccess', (data: unknown) => {
            const { message } = data as { message: string };
            logger.info(`Rat illusion success: ${message}`);
        });

        // 가짜 쥐를 클릭했을 때
        this.socket.on('ratIllusionFail', (data: unknown) => {
            const { clickedIndex, message } = data as { clickedIndex: number; message: string };
            logger.debug(`Rat illusion fail: clicked ${clickedIndex}, ${message}`);
        });

        // 다른 플레이어의 쥐 환상 시각 효과 (구경꾼용)
        this.socket.on('ratIllusionEffect', (data: unknown) => {
            const { casterId, targetId } = data as {
                casterId: string;
                targetId: string;
                casterX: number;
                casterY: number;
            };
            logger.debug(`Rat illusion effect: ${casterId} -> ${targetId}`);
            // 시전자 피드백: 나한테 성공적으로 걸었다는 표시
            if (casterId === this.playerId) {
                this.gameCallbacks?.onRatIllusionCastSuccess?.(targetId);
            }
        });

        // Sleep Powder effect (Squeak-Squeak W skill)
        this.socket.on('sleepPowderEffect', (data: unknown) => {
            const { casterId, casterX, casterY, affectedPlayers } = data as {
                casterId: string;
                casterX: number;
                casterY: number;
                affectedPlayers: Array<{ playerId: string; duration: number }>;
            };
            logger.debug(`Sleep powder by ${casterId}: ${affectedPlayers.length} targets`);
            this.gameCallbacks?.onSleepPowderEffect?.({ casterId, casterX, casterY, affectedPlayers });
            // 내가 잠들었을 때 처리
            const myEntry = affectedPlayers.find(p => p.playerId === this.playerId);
            if (myEntry && this.localPlayer) {
                logger.info(`You fell asleep for ${myEntry.duration}ms!`);
                this.gameCallbacks?.onSleepStart?.(myEntry.duration);
            }
        });

        // Rat Bomb effect (Squeak-Squeak E skill)
        this.socket.on('ratBombEffect', (data: unknown) => {
            const { casterId, casterX, casterY, explosionDamage, rats, hitPlayers } = data as {
                casterId: string;
                casterX: number;
                casterY: number;
                explosionDamage: number;
                rats: Array<{ x: number; y: number; damage: number }>;
                hitPlayers: Array<{ playerId: string; currentHP: number; maxHP: number }>;
            };
            logger.debug(`Rat bomb by ${casterId}, hit ${hitPlayers.length} players`);
            this.gameCallbacks?.onRatBombEffect?.({ casterId, casterX, casterY, explosionDamage, rats, hitPlayers });
            // 내가 맞았을 때 HP 업데이트
            const myEntry = hitPlayers.find(p => p.playerId === this.playerId);
            if (myEntry && this.localPlayer) {
                this.localPlayer.currentHP = myEntry.currentHP;
                this.localPlayer.hitFlashTime = Date.now();
            }
        });

        // Doll Hug Shield events (Squeak-Squeak R skill)
        this.socket.on('dollHugShieldStart', (data: unknown) => {
            const { playerId, shieldHP, maxShieldHP, duration } = data as {
                playerId: string;
                shieldHP: number;
                maxShieldHP: number;
                duration: number;
            };
            logger.debug(`Doll hug shield start: ${playerId} (${shieldHP}HP, ${duration}ms)`);
            this.gameCallbacks?.onDollHugShieldStart?.({ playerId, shieldHP, maxShieldHP, duration });
        });

        this.socket.on('dollHugShieldHit', (data: unknown) => {
            const { playerId, absorbed, shieldHP, maxShieldHP } = data as {
                playerId: string;
                absorbed: number;
                shieldHP: number;
                maxShieldHP: number;
            };
            logger.debug(`Doll hug shield hit: ${playerId} absorbed ${absorbed}`);
            this.gameCallbacks?.onDollHugShieldHit?.({ playerId, absorbed, shieldHP, maxShieldHP });
        });

        this.socket.on('dollHugShieldEnd', (data: unknown) => {
            const { playerId, reason } = data as { playerId: string; reason: string };
            logger.debug(`Doll hug shield ended: ${playerId} (${reason})`);
            this.gameCallbacks?.onDollHugShieldEnd?.({ playerId, reason });
        });

        // Rat Revive effect (Squeak-Squeak T skill)
        this.socket.on('ratReviveEffect', (data: unknown) => {
            const { casterId, revivedPlayers } = data as {
                casterId: string;
                revivedPlayers: Array<{ playerId: string; x: number; y: number; currentHP: number; maxHP: number }>;
            };
            logger.info(`Rat revive by ${casterId}: ${revivedPlayers.length} revived`);
            this.gameCallbacks?.onRatReviveEffect?.({ casterId, revivedPlayers });
            // 내가 부활했을 때 처리
            const myRevive = revivedPlayers.find(p => p.playerId === this.playerId);
            if (myRevive && this.localPlayer) {
                this.localPlayer.currentHP = myRevive.currentHP;
                logger.info(`You were revived with ${myRevive.currentHP}/${myRevive.maxHP} HP!`);
            }
        });

        // Shard events
        this.socket.on('existingShards', (data: unknown) => {
            const shards = data as Shard[];
            logger.debug(`Received ${shards.length} existing shards`);
            if (this.shardManager) {
                this.shardManager.loadShardsFromServer(shards);
            }
        });

        this.socket.on('shardsSpawned', (data: unknown) => {
            const shards = data as Shard[];
            logger.debug(`${shards.length} new shards spawned`);
            if (this.shardManager) {
                this.shardManager.addShardsFromServer(shards);
            }
        });

        this.socket.on('shardCollected', (data: unknown) => {
            const { shardId, playerId } = data as { shardId: string; playerId: string };
            logger.debug(`Shard ${shardId} collected by ${playerId}`);
            if (this.shardManager) {
                this.shardManager.removeShard(shardId);
            }
        });

        // Player damage event
        this.socket.on('playerDamaged', (data: unknown) => {
            const { attackerId, hitPlayers } = data as {
                attackerId: string;
                hitPlayers: DamageHit[];
            };
            logger.debug(`Players damaged by ${attackerId}:`, hitPlayers);
            hitPlayers.forEach((hit) => {
                // Check if it's the local player
                if (hit.playerId === this.playerId && this.localPlayer) {
                    this.localPlayer.currentHP = hit.currentHP;
                    this.localPlayer.hitFlashTime = Date.now(); // Trigger hit flash

                    // Trigger screen vignette effect
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }

                    // Start knockback if knockback info is provided
                    if (
                        hit.knockbackEndX !== undefined &&
                        hit.knockbackEndY !== undefined &&
                        hit.attackerX !== undefined &&
                        hit.attackerY !== undefined
                    ) {
                        this.localPlayer.startKnockback(
                            hit.attackerX,
                            hit.attackerY,
                            hit.knockbackEndX,
                            hit.knockbackEndY
                        );
                    }

                    logger.debug(`You took damage! HP: ${hit.currentHP}/${hit.maxHP}`);
                } else {
                    // Update remote player HP
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                        player.hitFlashTime = Date.now(); // Trigger hit flash

                        // Start knockback for remote player
                        if (
                            hit.knockbackEndX !== undefined &&
                            hit.knockbackEndY !== undefined &&
                            hit.attackerX !== undefined &&
                            hit.attackerY !== undefined
                        ) {
                            player.startKnockback(
                                hit.attackerX,
                                hit.attackerY,
                                hit.knockbackEndX,
                                hit.knockbackEndY
                            );
                        }
                    }
                }
            });
        });

        // Dummy events
        this.socket.on('existingDummies', (data: unknown) => {
            const serverDummies = data as ServerDummy[];
            logger.debug(`Received ${serverDummies.length} existing dummies`);
            if (this.dummies) {
                // Sync dummies with server state
                serverDummies.forEach((serverDummy) => {
                    const dummy = this.dummies![serverDummy.id];
                    if (dummy) {
                        dummy.x = serverDummy.x;
                        dummy.y = serverDummy.y;
                        dummy.currentHP = serverDummy.currentHP;
                        dummy.maxHP = serverDummy.maxHP;
                    }
                });
            }
        });

        this.socket.on('dummyDamaged', (data: unknown) => {
            const { attackerId, hitDummies } = data as {
                attackerId: string;
                hitDummies: DummyHit[];
            };
            logger.debug(`Dummies damaged by ${attackerId}:`, hitDummies);
            if (this.dummies) {
                hitDummies.forEach((hit) => {
                    const dummy = this.dummies![hit.dummyId];
                    if (dummy) {
                        dummy.currentHP = hit.currentHP;
                        dummy.hitFlashTime = Date.now(); // Trigger hit flash

                        // Start knockback for dummy
                        if (
                            hit.knockbackEndX !== undefined &&
                            hit.knockbackEndY !== undefined &&
                            hit.attackerX !== undefined &&
                            hit.attackerY !== undefined
                        ) {
                            dummy.startKnockback(
                                hit.attackerX,
                                hit.attackerY,
                                hit.knockbackEndX,
                                hit.knockbackEndY
                            );
                        }

                        if (dummy.currentHP <= 0) {
                            dummy.deathTime = Date.now();
                        }
                    }
                });
            }
        });

        this.socket.on('dummyRespawned', (data: unknown) => {
            const respawnData = data as {
                dummyId: number;
                x: number;
                y: number;
                currentHP: number;
                maxHP: number;
            };
            logger.debug(`Dummy ${respawnData.dummyId} respawned`);
            if (this.dummies) {
                const dummy = this.dummies[respawnData.dummyId];
                if (dummy) {
                    dummy.x = respawnData.x;
                    dummy.y = respawnData.y;
                    dummy.currentHP = respawnData.currentHP;
                    dummy.maxHP = respawnData.maxHP;
                    dummy.deathTime = 0;
                }
            }
        });

        // Player death event
        this.socket.on('playerDied', (data: unknown) => {
            const deathData = data as DeathData;
            logger.info(`Player ${deathData.playerId} died, killed by ${deathData.killedBy}`);

            // Check if it's the local player
            if (deathData.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = true;
                this.localPlayer.deathTime = Date.now();
                this.localPlayer.respawnDelay = deathData.respawnDelay;
                logger.info(`You died! Respawning in ${deathData.respawnDelay / 1000} seconds...`);
            } else {
                // Update remote player
                const remotePlayer = this.remotePlayers.get(deathData.playerId);
                if (remotePlayer) {
                    remotePlayer.isDead = true;
                }
            }
        });

        // Player respawn event
        this.socket.on('playerRespawned', (data: unknown) => {
            const respawnData = data as RespawnData;
            logger.debug(`Player ${respawnData.playerId} respawned`);

            // Check if it's the local player
            if (respawnData.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = false;
                this.localPlayer.deathTime = 0;
                this.localPlayer.x = respawnData.x;
                this.localPlayer.y = respawnData.y;
                this.localPlayer.currentHP = respawnData.currentHP;
                logger.info('You respawned!');
            } else {
                // Update remote player
                const remotePlayer = this.remotePlayers.get(respawnData.playerId);
                if (remotePlayer) {
                    remotePlayer.isDead = false;
                    remotePlayer.x = respawnData.x;
                    remotePlayer.y = respawnData.y;
                    remotePlayer.targetX = respawnData.x;
                    remotePlayer.targetY = respawnData.y;
                    remotePlayer.currentHP = respawnData.currentHP;
                    remotePlayer.maxHP = respawnData.maxHP || remotePlayer.maxHP;
                }
            }
        });
    }

    // Send attack to server
    sendAttack(x: number, y: number, range: number, power: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('playerAttack', {
            x: x,
            y: y,
            range: range,
            power: power,
        });
    }

    // Send laser aiming start to server (for sync with other players)
    sendLaserAiming(x: number, y: number, dirX: number, dirY: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('laserAiming', {
            x: x,
            y: y,
            dirX: dirX,
            dirY: dirY,
        });
    }

    // Send laser attack to server
    sendLaserAttack(x1: number, y1: number, x2: number, y2: number, damage: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('laserAttack', {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            damage: damage,
        });
    }

    // Send teleport event to server (for sync with other players)
    sendTeleport(startX: number, startY: number, endX: number, endY: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('teleport', {
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
        });
    }

    // Send teleport damage to server
    sendTeleportDamage(x: number, y: number, radius: number, damage: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('teleportDamage', {
            x: x,
            y: y,
            radius: radius,
            damage: damage,
        });
    }

    // Send telepathy event to server (for sync with other players)
    sendTelepathy(x: number, y: number, radius: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('telepathy', {
            x: x,
            y: y,
            radius: radius,
        });
    }

    // Send telepathy damage to server
    sendTelepathyDamage(
        x: number,
        y: number,
        radius: number,
        damagePerTarget: number,
        maxHeal: number
    ): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('telepathyDamage', {
            x: x,
            y: y,
            radius: radius,
            damagePerTarget: damagePerTarget,
            maxHeal: maxHeal,
        });
    }

    // Send wave attack to server (Crazy-Eyes basic attack)
    sendWaveAttack(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('waveAttack', {});
    }

    // Check if player is confused (controls reversed)
    checkConfusion(): boolean {
        if (this.isConfused && Date.now() >= this.confusionEndTime) {
            this.isConfused = false;
            logger.info('Confusion ended!');
        }
        return this.isConfused;
    }

    // Send shard collection to server
    sendShardCollection(shardId: string): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('collectShard', { shardId });
    }

    // Send madness walk start to server
    sendMadnessStart(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('madnessStart', {});
    }

    // Send madness walk end to server
    sendMadnessEnd(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('madnessEnd', {});
    }

    // Send madness tick damage to server
    sendMadnessDamage(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('madnessDamage', {});
    }

    // Send pot smash attack to server (Curry-Bear basic attack)
    sendPotSmash(dirX: number, dirY: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('potSmash', { dirX, dirY });
    }

    // Send curry recovery to server (Curry-Bear E skill)
    sendCurryRecovery(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('curryRecovery', {});
    }

    // Send spin throw to server (Hulk Sister Q skill)
    // Server calculates direction from its own authoritative positions
    // dirX/dirY are sent for compatibility but currently ignored by server
    sendSpinThrow(
        targetId: string | number | undefined,
        dirX: number,
        dirY: number,
        targetType: string = 'player'
    ): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('spinThrow', {
            targetId,
            dirX,
            dirY,
            targetType,
        });
    }

    // Send rage start to server (Hulk Sister E skill)
    sendRageStart(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('rageStart', {});
    }

    // Send rage end to server
    sendRageEnd(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('rageEnd', {});
    }

    // Send rat illusion to server (Squeak-Squeak Q skill)
    sendRatIllusion(targetId?: string): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('ratIllusion', { targetId });
    }

    // Send rat click to server (player clicking on a rat)
    sendRatClick(ratIndex: number): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('ratClick', { ratIndex });
    }

    // Send sleep powder to server (Squeak-Squeak W skill)
    sendSleepPowder(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('sleepPowder');
    }

    // Send rat bomb to server (Squeak-Squeak E skill)
    sendRatBomb(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('ratBomb');
    }

    // Send doll hug shield to server (Squeak-Squeak R skill)
    sendDollHug(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('dollHug');
    }

    // Send rat revive to server (Squeak-Squeak T skill)
    sendRatRevive(): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('ratRevive');
    }

    addRemotePlayer(playerData: PlayerData): void {
        const remotePlayer = new RemotePlayer(
            playerData.playerId,
            playerData.x || 0,
            playerData.y || 0,
            playerData.playerName || 'Player',
            playerData.level || 1,
            playerData.experience || 0,
            playerData.characterId || 'alien'
        );
        // Set HP if provided
        if (playerData.currentHP !== undefined) {
            remotePlayer.currentHP = playerData.currentHP;
        }
        if (playerData.maxHP !== undefined) {
            remotePlayer.maxHP = playerData.maxHP;
        }
        // Set team if provided
        if (playerData.team !== undefined) {
            remotePlayer.team = playerData.team;
        }
        this.remotePlayers.set(playerData.playerId, remotePlayer);
    }

    removeRemotePlayer(playerId: string): void {
        this.remotePlayers.delete(playerId);
    }

    // Send local player position to server
    sendPlayerPosition(
        x: number,
        y: number,
        playerName: string,
        level: number,
        experience: number,
        characterId: CharacterType
    ): void {
        if (!this.connected || !this.socket) return;

        const currentTime = Date.now();
        if (currentTime - this.lastUpdateTime < this.updateRate) {
            return; // Rate limit
        }

        this.lastUpdateTime = currentTime;

        // level/experience are server-authoritative (shard-based leveling)
        // Only send position, name, and character
        this.socket.emit('playerMove', {
            x: x,
            y: y,
            playerName: playerName,
            characterId: characterId,
        });
    }

    // Update all remote players
    update(): void {
        this.remotePlayers.forEach((remotePlayer) => {
            remotePlayer.update();
        });
    }

    // Render all remote players
    render(ctx: CanvasRenderingContext2D): void {
        this.remotePlayers.forEach((remotePlayer) => {
            remotePlayer.render(ctx);
        });
    }

    // Attempt to reconnect to the server
    attemptReconnect(): void {
        logger.info('Attempting to reconnect...');

        // If socket exists, try to reconnect
        if (this.socket) {
            this.socket.connect();
        } else {
            // Create new socket connection
            this.connect(this.serverUrl);
        }
    }

    disconnect(): void {
        if (this.socket) {
            // Remove all socket event listeners before disconnecting
            this.socket.off('connected');
            this.socket.off('existingPlayers');
            this.socket.off('playerJoined');
            this.socket.off('playerMoved');
            this.socket.off('playerLeft');
            this.socket.off('playerTemporarilyDisconnected');
            this.socket.off('playerReconnected');
            this.socket.off('reconnected');
            this.socket.off('connect_error');
            this.socket.off('disconnect');
            this.socket.off('chatMessage');
            this.socket.off('playerAttacked');
            this.socket.off('laserAiming');
            this.socket.off('laserFired');
            this.socket.off('playerTeleport');
            this.socket.off('playerTelepathy');
            this.socket.off('telepathyHeal');
            this.socket.off('telepathyTick');
            this.socket.off('telepathyTickDummy');
            this.socket.off('existingShards');
            this.socket.off('shardsSpawned');
            this.socket.off('shardCollected');
            this.socket.off('playerDamaged');
            this.socket.off('existingDummies');
            this.socket.off('dummyDamaged');
            this.socket.off('dummyRespawned');
            this.socket.off('playerDied');
            this.socket.off('playerRespawned');
            // Wave, Madness, PotSmash, CurryRecovery related events
            this.socket.off('playerWave');
            this.socket.off('waveDamage');
            this.socket.off('playerMadnessStart');
            this.socket.off('playerMadnessEnd');
            this.socket.off('madnessTick');
            this.socket.off('playerPotSmash');
            this.socket.off('potSmashDamage');
            this.socket.off('storedDamageUpdate');
            this.socket.off('playerCurryRecovery');
            // SpinThrow, Rage related events
            this.socket.off('playerSpinThrow');
            this.socket.off('spinThrowCollision');
            this.socket.off('playerRageStart');
            this.socket.off('playerRageEnd');

            this.socket.disconnect();
            this.socket = null;
        }

        // Clear references
        this.connected = false;
        this.playerId = null;
        this.remotePlayers.clear();
        this.shardManager = null;
        this.localPlayer = null;
        this.dummies = null;

        logger.info('Network manager cleaned up');
    }
}
