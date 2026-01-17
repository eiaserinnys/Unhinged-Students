// Unhinged Students - Multiplayer Server
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files (game client)
app.use(express.static(path.join(__dirname)));

// Store connected players
const players = new Map();

// Shard system
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const MAX_SHARDS = 40;
const shards = new Map(); // Map of shardId -> {id, x, y, collected, collectedTime, respawnDelay}
let shardIdCounter = 0;

// Initialize shards
function initializeShards() {
    const margin = 100;
    for (let i = 0; i < 20; i++) {
        const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
        const y = margin + Math.random() * (GAME_HEIGHT - margin * 2);
        const shardId = shardIdCounter++;
        shards.set(shardId, {
            id: shardId,
            x,
            y,
            collected: false,
            collectedTime: 0,
            respawnDelay: 0
        });
    }
    console.log(`Initialized ${shards.size} shards`);
}

// Respawn shards (individual shard respawn)
function checkShardRespawn() {
    const currentTime = Date.now();
    let respawnedCount = 0;

    // Check each collected shard for individual respawn
    shards.forEach((shard) => {
        if (shard.collected && shard.collectedTime > 0) {
            const elapsedTime = currentTime - shard.collectedTime;

            // Check if it's time to respawn this shard
            if (elapsedTime >= shard.respawnDelay) {
                // Respawn at same location
                shard.collected = false;
                shard.collectedTime = 0;
                shard.respawnDelay = 0;
                respawnedCount++;

                // Broadcast respawned shard to all clients
                io.emit('shardsSpawned', [{ id: shard.id, x: shard.x, y: shard.y }]);
            }
        }
    });

    if (respawnedCount > 0) {
        const activeCount = Array.from(shards.values()).filter(s => !s.collected).length;
        console.log(`Respawned ${respawnedCount} shard(s) (Active: ${activeCount}/${MAX_SHARDS})`);
    }
}

// Start shard system
initializeShards();
setInterval(checkShardRespawn, 1000); // Check every second

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Send player their ID
    socket.emit('connected', {
        playerId: socket.id
    });

    // Send existing players to new player
    const existingPlayers = Array.from(players.values());
    socket.emit('existingPlayers', existingPlayers);

    // Send existing shards to new player
    const activeShards = Array.from(shards.values()).filter(s => !s.collected);
    socket.emit('existingShards', activeShards);

    // Initialize player data
    players.set(socket.id, {
        playerId: socket.id,
        x: 960, // Center of game world
        y: 540,
        playerName: 'Player',
        level: 1,
        currentHP: 100,
        maxHP: 100
    });

    // Notify others about new player
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        x: 960,
        y: 540,
        playerName: 'Player',
        level: 1,
        currentHP: 100,
        maxHP: 100
    });

    // Handle player position updates
    socket.on('playerMove', (data) => {
        const existingPlayer = players.get(socket.id);

        // Update player data, preserving HP
        players.set(socket.id, {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            playerName: data.playerName || 'Player',
            level: data.level || 1,
            currentHP: existingPlayer ? existingPlayer.currentHP : 100,
            maxHP: existingPlayer ? existingPlayer.maxHP : 100
        });

        // Broadcast to other players
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            playerName: data.playerName,
            level: data.level
        });
    });

    // Handle chat messages
    socket.on('chatMessage', (data) => {
        const playerData = players.get(socket.id);
        const message = {
            playerId: socket.id,
            playerName: playerData ? playerData.playerName : 'Unknown',
            message: data.message,
            timestamp: Date.now()
        };

        console.log(`Chat from ${message.playerName}: ${message.message}`);

        // Broadcast to all players (including sender)
        io.emit('chatMessage', message);
    });

    // Handle shard collection
    socket.on('collectShard', (data) => {
        const shard = shards.get(data.shardId);

        if (shard && !shard.collected) {
            shard.collected = true;
            shard.collectedTime = Date.now();
            // Random respawn delay between 3-5 seconds (3000-5000ms)
            shard.respawnDelay = 3000 + Math.random() * 2000;
            console.log(`Player ${socket.id} collected shard ${data.shardId} (will respawn in ${Math.round(shard.respawnDelay/1000)}s)`);

            // Broadcast to all players
            io.emit('shardCollected', {
                shardId: data.shardId,
                playerId: socket.id
            });
        }
    });

    // Handle player attack
    socket.on('playerAttack', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        const attackX = data.x;
        const attackY = data.y;
        const attackRange = data.range;
        const attackPower = data.power;

        // Check all players in range
        const hitPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself

            // Calculate distance
            const dx = player.x - attackX;
            const dy = player.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range
            if (distance <= attackRange) {
                // Apply damage
                player.currentHP = Math.max(0, player.currentHP - attackPower);
                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP
                });

                console.log(`${socket.id} hit ${playerId} for ${attackPower} damage (HP: ${player.currentHP}/${player.maxHP})`);
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        players.delete(socket.id);

        // Notify others
        socket.broadcast.emit('playerLeft', {
            playerId: socket.id
        });
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Game client available at http://localhost:${PORT}/index.html`);
});
