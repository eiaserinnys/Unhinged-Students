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
    }

    setShardManager(shardManager) {
        this.shardManager = shardManager;
    }

    setLocalPlayer(player) {
        this.localPlayer = player;
    }

    connect(serverUrl = null) {
        // Auto-detect server URL if not provided
        if (!serverUrl) {
            const hostname = window.location.hostname;
            const port = 3000;
            serverUrl = `http://${hostname}:${port}`;
        }

        console.log(`Connecting to server: ${serverUrl}`);

        this.socket = io(serverUrl);

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
                    console.log(`You took damage! HP: ${hit.currentHP}/${hit.maxHP}`);
                } else {
                    // Update remote player HP
                    const player = this.remotePlayers.get(hit.playerId);
                    if (player) {
                        player.currentHP = hit.currentHP;
                        player.maxHP = hit.maxHP;
                    }
                }
            });
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
            playerData.level || 1
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
    sendPlayerPosition(x, y, playerName, level) {
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
            level: level
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
    constructor(playerId, x, y, playerName, level) {
        this.playerId = playerId;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.playerName = playerName;
        this.level = level;

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
        // Smooth interpolation to target position
        this.x += (this.targetX - this.x) * this.interpolationSpeed;
        this.y += (this.targetY - this.y) * this.interpolationSpeed;

        // Update chat bubble - remove message after duration
        if (this.chatMessage && Date.now() - this.chatMessageTime > this.chatMessageDuration) {
            this.chatMessage = null;
        }
    }

    render(ctx) {
        if (this.imageLoaded && this.image) {
            // Draw remote player image
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
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
        }

        // Draw info above remote player
        this.renderInfoAbove(ctx);

        // Draw chat bubble if active
        this.renderChatBubble(ctx);
    }

    renderInfoAbove(ctx) {
        const infoY = this.y - this.height / 2 - 10;

        // HP Bar
        const hpBarWidth = this.width;
        const hpBarHeight = 6;
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

        // Position bubble above player info
        const bubbleY = this.y - this.height / 2 - 50; // Above HP bar and name

        // Measure text to determine bubble size
        ctx.font = '20px Inter, sans-serif';
        const textMetrics = ctx.measureText(this.chatMessage);
        const textWidth = textMetrics.width;

        const padding = 14;
        const bubbleWidth = textWidth + padding * 2;
        const bubbleHeight = 32;
        const bubbleX = this.x - bubbleWidth / 2;

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;

        // Rounded rectangle for bubble
        const radius = 5;
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
        const pointerSize = 5;
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
        ctx.font = '20px Inter, sans-serif';
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
}
