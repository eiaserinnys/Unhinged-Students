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

        console.log('Connecting to server via /game/socket.io');

        this.socket = io(options);

        // Connection established
        this.socket.on('connected', (data) => {
            this.playerId = data.playerId;
            this.connected = true;
            console.log(`Connected to server. Player ID: ${this.playerId}`);
        });

        // Receive existing players
        this.socket.on('existingPlayers', (players) => {
            console.log(`Received ${players.length} existing players`);
            players.forEach(playerData => {
                if (playerData.playerId !== this.playerId) {
                    this.addRemotePlayer(playerData);
                }
            });
        });

        // New player joined
        this.socket.on('playerJoined', (data) => {
            console.log(`Player joined: ${data.playerId}`);
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
            console.log(`Player left: ${data.playerId}`);
            this.removeRemotePlayer(data.playerId);
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });

        // Disconnection
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;

            // Auto-reload after server disconnect (useful for development)
            console.log('Server disconnected. Reloading page in 2 seconds...');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
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

        // Shard events
        this.socket.on('existingShards', (shards) => {
            console.log(`Received ${shards.length} existing shards`);
            if (this.shardManager) {
                this.shardManager.loadShardsFromServer(shards);
            }
        });

        this.socket.on('shardsSpawned', (shards) => {
            console.log(`${shards.length} new shards spawned`);
            if (this.shardManager) {
                this.shardManager.addShardsFromServer(shards);
            }
        });

        this.socket.on('shardCollected', (data) => {
            console.log(`Shard ${data.shardId} collected by ${data.playerId}`);
            if (this.shardManager) {
                this.shardManager.removeShard(data.shardId);
            }
        });

        // Player damage event
        this.socket.on('playerDamaged', (data) => {
            console.log(`Players damaged by ${data.attackerId}:`, data.hitPlayers);
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

                    console.log(`You took damage! HP: ${hit.currentHP}/${hit.maxHP}`);
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
            console.log(`Received ${serverDummies.length} existing dummies`);
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
            console.log(`Dummies damaged by ${data.attackerId}:`, data.hitDummies);
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
            console.log(`Dummy ${data.dummyId} respawned`);
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
            console.log(`Player ${data.playerId} died, killed by ${data.killedBy}`);

            // Check if it's the local player
            if (data.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = true;
                this.localPlayer.deathTime = Date.now();
                this.localPlayer.respawnDelay = data.respawnDelay;
                console.log(`You died! Respawning in ${data.respawnDelay / 1000} seconds...`);
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
            console.log(`Player ${data.playerId} respawned`);

            // Check if it's the local player
            if (data.playerId === this.playerId && this.localPlayer) {
                this.localPlayer.isDead = false;
                this.localPlayer.deathTime = 0;
                this.localPlayer.x = data.x;
                this.localPlayer.y = data.y;
                this.localPlayer.currentHP = data.currentHP;
                console.log('You respawned!');
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

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Remote player class (represents other players)
class RemotePlayer {
    constructor(playerId, x, y, playerName, level, experience = 0) {
        this.playerId = playerId;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.playerName = playerName;
        this.level = level;
        this.experience = experience;
        this.maxLevel = 30;

        // Visual properties
        // Use same display size calculation as Character
        const canvasHeight = 1080; // Game world height
        this.displaySize = canvasHeight / 8;
        this.width = this.displaySize;
        this.height = this.displaySize;

        // Image properties
        this.image = null;
        this.imageLoaded = false;

        // Interpolation
        this.interpolationSpeed = 0.2;

        // Chat bubble system
        this.chatMessage = null;
        this.chatMessageTime = 0;
        this.chatMessageDuration = 3000; // 3 seconds

        // HP system
        this.maxHP = 100;
        this.currentHP = 100;

        // Death state
        this.isDead = false;

        // Hit flash effect (micro reaction)
        this.hitFlashTime = 0;
        this.hitFlashDuration = 100; // 100ms flash duration

        // Knockback system
        this.isKnockedBack = false;
        this.knockbackStartTime = 0;
        this.knockbackDuration = 200; // 200ms knockback animation
        this.knockbackStartX = 0;
        this.knockbackStartY = 0;
        this.knockbackEndX = 0;
        this.knockbackEndY = 0;

        // Attack effect system
        this.isAttacking = false;
        this.attackStartTime = 0;
        this.attackAnimationTime = 200; // 200ms attack animation
        this.attackX = 0;
        this.attackY = 0;
        this.attackRange = 150;

        // Laser effect system
        this.laserActive = false;
        this.laserPhase = 'none'; // 'aiming', 'firing', 'none'
        this.laserStartTime = 0;
        this.laserAimDuration = 1000; // 1 second aiming
        this.laserFireDuration = 200; // 0.2 second firing
        this.laserDirX = 0;
        this.laserDirY = 0;

        // Teleport effect system
        this.teleportActive = false;
        this.teleportPhase = 'none'; // 'disappear', 'appear', 'none'
        this.teleportStartTime = 0;
        this.teleportDisappearDuration = 150;
        this.teleportAppearDuration = 200;
        this.teleportStartX = 0;
        this.teleportStartY = 0;
        this.teleportEndX = 0;
        this.teleportEndY = 0;
        this.teleportDamageRadius = 100;

        // Load alien image
        this.loadImage('asset/image/alien.png');
    }

    loadImage(path) {
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;

            // Calculate dimensions maintaining aspect ratio
            const aspectRatio = this.image.width / this.image.height;

            if (aspectRatio > 1) {
                // Wider than tall
                this.width = this.displaySize;
                this.height = this.displaySize / aspectRatio;
            } else {
                // Taller than wide
                this.height = this.displaySize;
                this.width = this.displaySize * aspectRatio;
            }

            console.log(`Remote player image loaded: ${path}`);
        };
        this.image.onerror = () => {
            console.error(`Failed to load remote player image: ${path}`);
        };
        this.image.src = path;
    }

    updatePosition(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    update() {
        const currentTime = Date.now();

        // Handle knockback animation
        if (this.isKnockedBack) {
            const elapsed = currentTime - this.knockbackStartTime;
            if (elapsed >= this.knockbackDuration) {
                // Knockback finished - snap to end position
                this.x = this.knockbackEndX;
                this.y = this.knockbackEndY;
                this.targetX = this.knockbackEndX;
                this.targetY = this.knockbackEndY;
                this.isKnockedBack = false;
            } else {
                // Interpolate position during knockback (easeOut for smooth deceleration)
                const progress = elapsed / this.knockbackDuration;
                const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
                this.x = this.knockbackStartX + (this.knockbackEndX - this.knockbackStartX) * easeOut;
                this.y = this.knockbackStartY + (this.knockbackEndY - this.knockbackStartY) * easeOut;
            }
        } else {
            // Smooth interpolation to target position
            this.x += (this.targetX - this.x) * this.interpolationSpeed;
            this.y += (this.targetY - this.y) * this.interpolationSpeed;
        }

        // Update chat bubble - remove message after duration
        if (this.chatMessage && Date.now() - this.chatMessageTime > this.chatMessageDuration) {
            this.chatMessage = null;
        }

        // Update attack animation
        if (this.isAttacking && currentTime - this.attackStartTime >= this.attackAnimationTime) {
            this.isAttacking = false;
        }

        // Update laser effect
        this.updateLaser();

        // Update teleport effect
        this.updateTeleport();
    }

    render(ctx) {
        // Skip rendering if player is dead (or render as ghost)
        if (this.isDead) {
            ctx.save();
            ctx.globalAlpha = 0.3;
        }

        // Calculate hit flash intensity (1.0 at hit, fades to 0 over hitFlashDuration)
        let hitFlashIntensity = 0;
        if (this.hitFlashTime > 0) {
            const elapsed = Date.now() - this.hitFlashTime;
            if (elapsed < this.hitFlashDuration) {
                hitFlashIntensity = 1 - (elapsed / this.hitFlashDuration);
            }
        }

        if (this.imageLoaded && this.image) {
            // Draw remote player image
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Apply hit flash overlay
            if (hitFlashIntensity > 0) {
                ctx.save();
                ctx.globalAlpha = hitFlashIntensity * 0.6;
                ctx.fillStyle = '#ff0000'; // Red flash
                ctx.fillRect(
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                ctx.restore();
            }
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = '#ff6b6b'; // Red color for remote players
            ctx.fillRect(
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Loading text
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.x, this.y);

            // Apply hit flash overlay for fallback
            if (hitFlashIntensity > 0) {
                ctx.save();
                ctx.globalAlpha = hitFlashIntensity * 0.6;
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                ctx.restore();
            }
        }

        // Draw attack effect if attacking
        this.renderAttackEffect(ctx);

        // Draw laser effect
        this.renderLaser(ctx);

        // Draw teleport effect
        this.renderTeleport(ctx);

        // Draw info above remote player
        this.renderInfoAbove(ctx);

        // Draw chat bubble if active
        this.renderChatBubble(ctx);

        if (this.isDead) {
            ctx.restore();
        }
    }

    // Render attack effect for remote player
    renderAttackEffect(ctx) {
        if (!this.isAttacking) return;

        // Calculate animation progress (0 to 1)
        const currentTime = Date.now();
        const progress = Math.min(1, (currentTime - this.attackStartTime) / this.attackAnimationTime);

        // Draw full attack range circle that fades out
        const opacity = (1 - progress) * 0.4; // Start at 40% opacity, fade to 0

        ctx.save();
        ctx.globalAlpha = opacity;

        // Fill with semi-transparent red
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(this.attackX, this.attackY, this.attackRange, 0, Math.PI * 2);
        ctx.fill();

        // Border for clarity
        ctx.globalAlpha = opacity * 1.5;
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // Calculate required experience for next level (same formula as Character)
    getRequiredExperience() {
        if (this.level >= this.maxLevel) return 0;
        return 10 + (this.level - 1) * 2;
    }

    renderInfoAbove(ctx) {
        const infoY = this.y - this.height / 2 - 15;

        // HP Bar (1.5x size)
        const hpBarWidth = this.width * 1.5;
        const hpBarHeight = 9;
        const hpBarX = this.x - hpBarWidth / 2;
        const hpBarY = infoY - hpBarHeight;

        // HP Bar background
        ctx.fillStyle = '#333333';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // HP Bar fill
        const hpPercentage = this.currentHP / this.maxHP;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercentage, hpBarHeight);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // Experience Bar (below HP bar)
        const expBarHeight = 4;
        const expBarY = hpBarY + hpBarHeight + 2;

        // EXP Bar background
        ctx.fillStyle = '#333333';
        ctx.fillRect(hpBarX, expBarY, hpBarWidth, expBarHeight);

        // EXP Bar fill
        const requiredExp = this.getRequiredExperience();
        const expPercentage = this.level >= this.maxLevel ? 1 : (requiredExp > 0 ? this.experience / requiredExp : 0);
        ctx.fillStyle = '#00D9FF'; // Cyan for experience
        ctx.fillRect(hpBarX, expBarY, hpBarWidth * expPercentage, expBarHeight);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX, expBarY, hpBarWidth, expBarHeight);

        // Player name and level
        const nameY = hpBarY - 5;
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillText(`${this.playerName} Lv.${this.level}`, this.x, nameY);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.textBaseline = 'alphabetic';
    }

    renderChatBubble(ctx) {
        if (!this.chatMessage) return;

        // Calculate where the name text ends (above HP bar)
        const nameY = this.y - this.height / 2 - 15 - 9 - 5; // infoY - hpBarHeight - 5

        // Position bubble above player name with padding (1.5x size)
        const bubbleHeight = 48; // 32 * 1.5
        const pointerSize = 8; // 5 * 1.5 (rounded)
        const bubbleBottomY = nameY - 10; // 10px gap above name
        const bubbleY = bubbleBottomY - bubbleHeight - pointerSize;

        // Measure text to determine bubble size (1.5x font)
        ctx.font = '30px Inter, sans-serif';
        const textMetrics = ctx.measureText(this.chatMessage);
        const textWidth = textMetrics.width;

        const padding = 21; // 14 * 1.5
        const bubbleWidth = textWidth + padding * 2;
        const bubbleX = this.x - bubbleWidth / 2;

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;

        // Rounded rectangle for bubble
        const radius = 8; // 5 * 1.5 (rounded)
        ctx.beginPath();
        ctx.moveTo(bubbleX + radius, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
        ctx.lineTo(bubbleX, bubbleY + radius);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw small triangle pointer
        ctx.beginPath();
        ctx.moveTo(this.x - pointerSize, bubbleY + bubbleHeight);
        ctx.lineTo(this.x, bubbleY + bubbleHeight + pointerSize);
        ctx.lineTo(this.x + pointerSize, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.font = '30px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.chatMessage, this.x, bubbleY + bubbleHeight / 2);

        // Reset text baseline
        ctx.textBaseline = 'alphabetic';
    }

    // Set chat message to display in bubble
    setChatMessage(message) {
        this.chatMessage = message;
        this.chatMessageTime = Date.now();
    }

    // Take damage
    takeDamage(amount) {
        this.currentHP = Math.max(0, this.currentHP - amount);
        console.log(`${this.playerName} took ${amount} damage! HP: ${this.currentHP}/${this.maxHP}`);

        if (this.currentHP <= 0) {
            console.log(`${this.playerName} has been defeated!`);
            return true; // Character died
        }
        return false;
    }

    // Check if character is alive
    isAlive() {
        return this.currentHP > 0;
    }

    // Get bounds for collision detection
    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    // Get position
    getPosition() {
        return { x: this.x, y: this.y };
    }

    // Start knockback from an attacker position
    startKnockback(attackerX, attackerY, endX, endY) {
        // Start knockback animation
        this.isKnockedBack = true;
        this.knockbackStartTime = Date.now();
        this.knockbackStartX = this.x; // Start from current local position
        this.knockbackStartY = this.y;
        this.knockbackEndX = endX; // End at server-specified position
        this.knockbackEndY = endY;

        console.log(`${this.playerName} knocked back from (${this.x.toFixed(1)}, ${this.y.toFixed(1)}) to (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
    }

    // Start attack effect for visual display
    startAttackEffect(x, y, range) {
        this.isAttacking = true;
        this.attackStartTime = Date.now();
        this.attackX = x;
        this.attackY = y;
        this.attackRange = range;
    }

    // Start laser aiming effect
    startLaserAiming(x, y, dirX, dirY) {
        this.laserActive = true;
        this.laserPhase = 'aiming';
        this.laserStartTime = Date.now();
        this.laserDirX = dirX;
        this.laserDirY = dirY;
    }

    // Transition laser to firing phase
    fireLaser() {
        if (this.laserActive) {
            this.laserPhase = 'firing';
            this.laserStartTime = Date.now();
        }
    }

    // Update laser effect state
    updateLaser() {
        if (!this.laserActive) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.laserStartTime;

        if (this.laserPhase === 'aiming') {
            if (elapsed >= this.laserAimDuration) {
                this.laserPhase = 'firing';
                this.laserStartTime = currentTime;
            }
        } else if (this.laserPhase === 'firing') {
            if (elapsed >= this.laserFireDuration) {
                this.laserActive = false;
                this.laserPhase = 'none';
            }
        }
    }

    // Render laser effect
    renderLaser(ctx) {
        if (!this.laserActive) return;

        const elapsed = Date.now() - this.laserStartTime;

        // Calculate end point (2000 pixels in direction)
        const endX = this.x + this.laserDirX * 2000;
        const endY = this.y + this.laserDirY * 2000;

        ctx.save();

        if (this.laserPhase === 'aiming') {
            // Aiming line - gets more opaque over time
            const progress = elapsed / this.laserAimDuration;
            const opacity = 0.3 + progress * 0.5;

            ctx.strokeStyle = `rgba(255, 68, 68, ${opacity})`;
            ctx.lineWidth = 2 + progress * 2;
            ctx.setLineDash([10, 10]);

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

        } else if (this.laserPhase === 'firing') {
            // Firing flash
            const progress = elapsed / this.laserFireDuration;
            const opacity = 1 - progress * 0.5;

            // Glow effect (outer)
            ctx.strokeStyle = `rgba(255, 100, 100, ${opacity * 0.5})`;
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Core beam (inner)
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Start teleport effect
    startTeleport(startX, startY, endX, endY) {
        this.teleportActive = true;
        this.teleportPhase = 'disappear';
        this.teleportStartTime = Date.now();
        this.teleportStartX = startX;
        this.teleportStartY = startY;
        this.teleportEndX = endX;
        this.teleportEndY = endY;
    }

    // Update teleport effect state
    updateTeleport() {
        if (!this.teleportActive) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.teleportStartTime;

        if (this.teleportPhase === 'disappear') {
            if (elapsed >= this.teleportDisappearDuration) {
                this.teleportPhase = 'appear';
                this.teleportStartTime = currentTime;
                // Move player to teleport destination
                this.x = this.teleportEndX;
                this.y = this.teleportEndY;
                this.targetX = this.teleportEndX;
                this.targetY = this.teleportEndY;
            }
        } else if (this.teleportPhase === 'appear') {
            if (elapsed >= this.teleportAppearDuration) {
                this.teleportActive = false;
                this.teleportPhase = 'none';
            }
        }
    }

    // Render teleport effect
    renderTeleport(ctx) {
        if (!this.teleportActive) return;

        const elapsed = Date.now() - this.teleportStartTime;

        ctx.save();

        if (this.teleportPhase === 'disappear') {
            const progress = elapsed / this.teleportDisappearDuration;
            const opacity = 1 - progress;
            const scale = 1 + progress * 0.5;

            // Green glow at start position
            ctx.globalAlpha = opacity * 0.6;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(this.teleportStartX, this.teleportStartY, 40 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Inner white flash
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.teleportStartX, this.teleportStartY, 20 * scale, 0, Math.PI * 2);
            ctx.fill();

        } else if (this.teleportPhase === 'appear') {
            const progress = elapsed / this.teleportAppearDuration;
            const opacity = progress < 0.5 ? progress * 2 : 2 - progress * 2;
            const damageOpacity = (1 - progress) * 0.4;

            // Damage radius indicator
            ctx.globalAlpha = damageOpacity;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(this.teleportEndX, this.teleportEndY, this.teleportDamageRadius, 0, Math.PI * 2);
            ctx.fill();

            // Damage radius border
            ctx.globalAlpha = damageOpacity * 2;
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.teleportEndX, this.teleportEndY, this.teleportDamageRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Appear flash
            ctx.globalAlpha = opacity * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.teleportEndX, this.teleportEndY, 30 * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
