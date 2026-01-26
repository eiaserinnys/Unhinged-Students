// Network module for multiplayer
class NetworkManager {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.connected = false;
        this.remotePlayers = new Map(); // Map of playerId -> RemotePlayer
        this.updateRate = 1000 / 20; // 20 updates per second
        this.lastUpdateTime = 0;
        this.shardManager = null; // Reference to shard manager for sync
        this.localPlayer = null; // Reference to local player for HP sync
        this.dummies = null; // Reference to dummies array for sync
        this.reconnectUI = null; // Reconnect UI manager
        this.serverUrl = null; // Store server URL for reconnection
    }

    setShardManager(shardManager) {
        this.shardManager = shardManager;
    }

    setLocalPlayer(player) {
        this.localPlayer = player;
    }

    setDummies(dummies) {
        this.dummies = dummies;
    }

    connect(serverUrl = null) {
        // Use relative path for socket.io (works with nginx reverse proxy)
        // Socket.io will connect to /game/socket.io/ when served from /game/
        const options = {
            path: '/game/socket.io'
        };

        logger.info('Connecting to server via /game/socket.io');

        this.serverUrl = serverUrl;

        // Initialize ReconnectUI if not already done
        if (!this.reconnectUI) {
            this.reconnectUI = new ReconnectUI();
            this.reconnectUI.onReconnect = () => this.attemptReconnect();
        }

        this.socket = io(options);

        // Connection established
        this.socket.on('connected', (data) => {
            this.playerId = data.playerId;
            this.connected = true;
            logger.info(`Connected to server. Player ID: ${this.playerId}`);

            // Hide reconnect UI on successful connection
            if (this.reconnectUI && this.reconnectUI.isVisible) {
                this.reconnectUI.onReconnectSuccess();
            }
        });

        // Receive existing players
        this.socket.on('existingPlayers', (players) => {
            logger.debug(`Received ${players.length} existing players`);
            players.forEach(playerData => {
                if (playerData.playerId !== this.playerId) {
                    this.addRemotePlayer(playerData);
                }
            });
        });

        // New player joined
        this.socket.on('playerJoined', (data) => {
            logger.info(`Player joined: ${data.playerId}`);
            this.addRemotePlayer(data);
        });

        // Player moved
        this.socket.on('playerMoved', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.updatePosition(data.x, data.y);
                remotePlayer.level = data.level || 1;
                remotePlayer.experience = data.experience || 0;
                remotePlayer.playerName = data.playerName || 'Player';
            }
        });

        // Player left
        this.socket.on('playerLeft', (data) => {
            logger.info(`Player left: ${data.playerId}`);
            this.removeRemotePlayer(data.playerId);
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
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
        this.socket.on('chatMessage', (data) => {
            // Show chat bubble on the player who sent it
            if (data.playerId && data.playerId !== this.playerId) {
                const remotePlayer = this.remotePlayers.get(data.playerId);
                if (remotePlayer) {
                    remotePlayer.setChatMessage(data.message);
                }
            }
        });

        // Player attack event (for showing other players' attacks)
        this.socket.on('playerAttacked', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.startAttackEffect(data.x, data.y, data.range);
            }
        });

        // Laser aiming event (for showing other players' laser aim)
        this.socket.on('laserAiming', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.startLaserAiming(data.x, data.y, data.dirX, data.dirY);
            }
        });

        // Laser fired event (for showing other players' laser fire)
        this.socket.on('laserFired', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.fireLaser();
            }
        });

        // Teleport event (for showing other players' teleport)
        this.socket.on('playerTeleport', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.startTeleport(data.startX, data.startY, data.endX, data.endY);
            }
        });

        // Telepathy event (for showing other players' telepathy)
        this.socket.on('playerTelepathy', (data) => {
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
                remotePlayer.startTelepathy(data.x, data.y, data.radius);
            }
        });

        // Telepathy heal event (for local player HP recovery)
        this.socket.on('telepathyHeal', (data) => {
            if (data.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.currentHP = Math.min(this.localPlayer.maxHP, this.localPlayer.currentHP + data.healAmount);
                logger.debug(`Telepathy healed ${data.healAmount} HP! Current: ${this.localPlayer.currentHP}/${this.localPlayer.maxHP}`);
            }
        });

        // Telepathy tick damage (no knockback, but with hit flash and vignette)
        this.socket.on('telepathyTick', (data) => {
            data.hitPlayers.forEach(hit => {
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
        this.socket.on('telepathyTickDummy', (data) => {
            if (this.dummies) {
                data.hitDummies.forEach(hit => {
                    const dummy = this.dummies[hit.dummyId];
                    if (dummy) {
                        dummy.currentHP = hit.currentHP;
                        dummy.maxHP = hit.maxHP;
                        dummy.hitFlashTime = Date.now();
                        if (dummy.currentHP <= 0) {
                            dummy.deathTime = Date.now();
                        }
                    }
                });
            }
        });

        // Shard events
        this.socket.on('existingShards', (shards) => {
            logger.debug(`Received ${shards.length} existing shards`);
            if (this.shardManager) {
                this.shardManager.loadShardsFromServer(shards);
            }
        });

        this.socket.on('shardsSpawned', (shards) => {
            logger.debug(`${shards.length} new shards spawned`);
            if (this.shardManager) {
                this.shardManager.addShardsFromServer(shards);
            }
        });

        this.socket.on('shardCollected', (data) => {
            logger.debug(`Shard ${data.shardId} collected by ${data.playerId}`);
            if (this.shardManager) {
                this.shardManager.removeShard(data.shardId);
            }
        });

        // Player damage event
        this.socket.on('playerDamaged', (data) => {
            logger.debug(`Players damaged by ${data.attackerId}:`, data.hitPlayers);
            data.hitPlayers.forEach(hit => {
                // Check if it's the local player
                if (hit.playerId === this.playerId && this.localPlayer) {
                    this.localPlayer.currentHP = hit.currentHP;
                    this.localPlayer.hitFlashTime = Date.now(); // Trigger hit flash

                    // Trigger screen vignette effect
                    if (typeof triggerHitVignette === 'function') {
                        triggerHitVignette();
                    }

                    // Start knockback if knockback info is provided
                    if (hit.knockbackEndX !== undefined && hit.knockbackEndY !== undefined) {
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
                        if (hit.knockbackEndX !== undefined && hit.knockbackEndY !== undefined) {
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
        this.socket.on('existingDummies', (serverDummies) => {
            logger.debug(`Received ${serverDummies.length} existing dummies`);
            if (this.dummies) {
                // Sync dummies with server state
                serverDummies.forEach(serverDummy => {
                    const dummy = this.dummies[serverDummy.id];
                    if (dummy) {
                        dummy.x = serverDummy.x;
                        dummy.y = serverDummy.y;
                        dummy.currentHP = serverDummy.currentHP;
                        dummy.maxHP = serverDummy.maxHP;
                    }
                });
            }
        });

        this.socket.on('dummyDamaged', (data) => {
            logger.debug(`Dummies damaged by ${data.attackerId}:`, data.hitDummies);
            if (this.dummies) {
                data.hitDummies.forEach(hit => {
                    const dummy = this.dummies[hit.dummyId];
                    if (dummy) {
                        dummy.currentHP = hit.currentHP;
                        dummy.maxHP = hit.maxHP;
                        dummy.hitFlashTime = Date.now(); // Trigger hit flash

                        // Start knockback for dummy
                        if (hit.knockbackEndX !== undefined && hit.knockbackEndY !== undefined) {
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

        this.socket.on('dummyRespawned', (data) => {
            logger.debug(`Dummy ${data.dummyId} respawned`);
            if (this.dummies) {
                const dummy = this.dummies[data.dummyId];
                if (dummy) {
                    dummy.x = data.x;
                    dummy.y = data.y;
                    dummy.currentHP = data.currentHP;
                    dummy.maxHP = data.maxHP;
                    dummy.deathTime = 0;
                }
            }
        });

        // Player death event
        this.socket.on('playerDied', (data) => {
            logger.info(`Player ${data.playerId} died, killed by ${data.killedBy}`);

            // Check if it's the local player
            if (data.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = true;
                this.localPlayer.deathTime = Date.now();
                this.localPlayer.respawnDelay = data.respawnDelay;
                logger.info(`You died! Respawning in ${data.respawnDelay / 1000} seconds...`);
            } else {
                // Update remote player
                const remotePlayer = this.remotePlayers.get(data.playerId);
                if (remotePlayer) {
                    remotePlayer.isDead = true;
                }
            }
        });

        // Player respawn event
        this.socket.on('playerRespawned', (data) => {
            logger.debug(`Player ${data.playerId} respawned`);

            // Check if it's the local player
            if (data.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = false;
                this.localPlayer.deathTime = 0;
                this.localPlayer.x = data.x;
                this.localPlayer.y = data.y;
                this.localPlayer.currentHP = data.currentHP;
                logger.info('You respawned!');
            } else {
                // Update remote player
                const remotePlayer = this.remotePlayers.get(data.playerId);
                if (remotePlayer) {
                    remotePlayer.isDead = false;
                    remotePlayer.x = data.x;
                    remotePlayer.y = data.y;
                    remotePlayer.targetX = data.x;
                    remotePlayer.targetY = data.y;
                    remotePlayer.currentHP = data.currentHP;
                    remotePlayer.maxHP = data.maxHP;
                }
            }
        });
    }

    // Send attack to server
    sendAttack(x, y, range, power) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('playerAttack', {
            x: x,
            y: y,
            range: range,
            power: power
        });
    }

    // Send laser aiming start to server (for sync with other players)
    sendLaserAiming(x, y, dirX, dirY) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('laserAiming', {
            x: x,
            y: y,
            dirX: dirX,
            dirY: dirY
        });
    }

    // Send laser attack to server
    sendLaserAttack(x1, y1, x2, y2, damage) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('laserAttack', {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            damage: damage
        });
    }

    // Send teleport event to server (for sync with other players)
    sendTeleport(startX, startY, endX, endY) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('teleport', {
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        });
    }

    // Send teleport damage to server
    sendTeleportDamage(x, y, radius, damage) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('teleportDamage', {
            x: x,
            y: y,
            radius: radius,
            damage: damage
        });
    }

    // Send telepathy event to server (for sync with other players)
    sendTelepathy(x, y, radius) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('telepathy', {
            x: x,
            y: y,
            radius: radius
        });
    }

    // Send telepathy damage to server
    sendTelepathyDamage(x, y, radius, damagePerTarget, maxHeal) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('telepathyDamage', {
            x: x,
            y: y,
            radius: radius,
            damagePerTarget: damagePerTarget,
            maxHeal: maxHeal
        });
    }

    // Send shard collection to server
    sendShardCollection(shardId) {
        if (!this.connected || !this.socket) return;
        this.socket.emit('collectShard', { shardId });
    }

    addRemotePlayer(playerData) {
        const remotePlayer = new RemotePlayer(
            playerData.playerId,
            playerData.x || 0,
            playerData.y || 0,
            playerData.playerName || 'Player',
            playerData.level || 1,
            playerData.experience || 0
        );
        // Set HP if provided
        if (playerData.currentHP !== undefined) {
            remotePlayer.currentHP = playerData.currentHP;
        }
        if (playerData.maxHP !== undefined) {
            remotePlayer.maxHP = playerData.maxHP;
        }
        this.remotePlayers.set(playerData.playerId, remotePlayer);
    }

    removeRemotePlayer(playerId) {
        this.remotePlayers.delete(playerId);
    }

    // Send local player position to server
    sendPlayerPosition(x, y, playerName, level, experience) {
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
            experience: experience
        });
    }

    // Update all remote players
    update() {
        this.remotePlayers.forEach(remotePlayer => {
            remotePlayer.update();
        });
    }

    // Render all remote players
    render(ctx) {
        this.remotePlayers.forEach(remotePlayer => {
            remotePlayer.render(ctx);
        });
    }

    // Attempt to reconnect to the server
    attemptReconnect() {
        logger.info('Attempting to reconnect...');

        // If socket exists, try to reconnect
        if (this.socket) {
            this.socket.connect();
        } else {
            // Create new socket connection
            this.connect(this.serverUrl);
        }
    }

    disconnect() {
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

// Export for browser
if (typeof window !== 'undefined') {
    window.NetworkManager = NetworkManager;
}
