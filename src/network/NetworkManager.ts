// Network module for multiplayer

import { logger } from '../utils/logger.js';
import { triggerHitVignette } from '../rendering/uiRenderer.js';
import { setConfused } from '../input.js';
import { ReconnectUI } from './ReconnectUI.js';
import { RemotePlayer } from './RemotePlayer.js';
import type {
    CharacterType,
    TeamType,
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
 * Manages network communication for multiplayer functionality
 */
export class NetworkManager implements INetworkManager {
    socket: SocketIOClient | null;
    playerId: string | null;
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
    isConfused: boolean;
    confusionEndTime: number;

    constructor() {
        this.socket = null;
        this.playerId = null;
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
        // Confusion effect (from wave attack)
        this.isConfused = false;
        this.confusionEndTime = 0;
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

            // Hide reconnect UI on successful connection
            if (this.reconnectUI && this.reconnectUI.isVisible) {
                this.reconnectUI.onReconnectSuccess();
            }

            // Notify about team assignment
            if (this.onTeamAssigned && this.team) {
                this.onTeamAssigned(this.team);
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

        // Player left
        this.socket.on('playerLeft', (data: unknown) => {
            const { playerId } = data as { playerId: string };
            logger.info(`Player left: ${playerId}`);
            this.removeRemotePlayer(playerId);
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
            // Note: updateStoredDamage should be imported if used
            // Currently left as global check for compatibility
            if (
                typeof (window as { updateStoredDamage?: (s: number, m: number) => void })
                    .updateStoredDamage === 'function'
            ) {
                (
                    window as { updateStoredDamage: (s: number, m: number) => void }
                ).updateStoredDamage(storedDamage, maxStored);
            }
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
                if (
                    typeof (window as { updateStoredDamage?: (s: number, m: number) => void })
                        .updateStoredDamage === 'function'
                ) {
                    (
                        window as { updateStoredDamage: (s: number, m: number) => void }
                    ).updateStoredDamage(0, recoveryData.maxHP);
                }
                // Trigger recovery effect
                if (
                    typeof (window as { triggerCurryRecoveryEffect?: (h: number) => void })
                        .triggerCurryRecoveryEffect === 'function'
                ) {
                    (
                        window as { triggerCurryRecoveryEffect: (h: number) => void }
                    ).triggerCurryRecoveryEffect(recoveryData.healAmount);
                }
                logger.debug(`Curry recovery: healed ${recoveryData.healAmount} HP`);
            } else {
                // Remote player healed - visual effect
                const player = this.remotePlayers.get(recoveryData.playerId);
                if (player && player.startCurryRecovery) {
                    player.startCurryRecovery(recoveryData.healAmount);
                }
            }
        });

        // Spin throw from other player (Hulk Sister Q skill)
        this.socket.on('playerSpinThrow', (data: unknown) => {
            const throwData = data as SpinThrowData;
            // Handle visual effect for attacker
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
            if (throwData.targetType === 'dummy') {
                // Dummy got thrown - update local dummy position
                const dummyIndex = throwData.targetId as number;
                if (this.dummies && this.dummies[dummyIndex]) {
                    const dummy = this.dummies[dummyIndex];
                    dummy.x = throwData.endX;
                    dummy.y = throwData.endY;
                    dummy.hitFlashTime = Date.now();
                }
            } else if (throwData.targetId === this.playerId) {
                // Local player got thrown
                if (this.localPlayer) {
                    // Move to throw position
                    this.localPlayer.x = throwData.endX;
                    this.localPlayer.y = throwData.endY;
                    this.localPlayer.hitFlashTime = Date.now();

                    // Trigger vignette
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }
                }
            } else {
                // Remote player got thrown
                const target = this.remotePlayers.get(throwData.targetId as string);
                if (target) {
                    target.x = throwData.endX;
                    target.y = throwData.endY;
                    target.hitFlashTime = Date.now();
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
            if (
                collisionData.thrownTargetType === 'player' &&
                collisionData.thrownTargetId === this.playerId &&
                this.localPlayer
            ) {
                // HP update will come from the playerDamaged event
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
    sendSpinThrow(
        targetId: string | number | undefined,
        dirX: number,
        dirY: number,
        targetType: string = 'player'
    ): void {
        if (!this.connected || !this.socket) return;
        this.socket.emit('spinThrow', { targetId, dirX, dirY, targetType });
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

        this.socket.emit('playerMove', {
            x: x,
            y: y,
            playerName: playerName,
            level: level,
            experience: experience,
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

// Backward compatibility: expose to window
window.NetworkManager = NetworkManager;
