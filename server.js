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
const RESPAWN_INTERVAL = 5000; // 5 seconds
const shards = new Map(); // Map of shardId -> {id, x, y, collected}
let shardIdCounter = 0;
let lastRespawnTime = Date.now();

// Initialize shards
function initializeShards() {
    const margin = 100;
    for (let i = 0; i < 20; i++) {
        const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
        const y = margin + Math.random() * (GAME_HEIGHT - margin * 2);
        const shardId = shardIdCounter++;
        shards.set(shardId, { id: shardId, x, y, collected: false });
    }
    console.log(`Initialized ${shards.size} shards`);
}

// Respawn shards
function checkShardRespawn() {
    const currentTime = Date.now();
    if (currentTime - lastRespawnTime < RESPAWN_INTERVAL) return;

    const activeCount = Array.from(shards.values()).filter(s => !s.collected).length;
    if (activeCount < MAX_SHARDS) {
        const spawnCount = Math.min(Math.floor(Math.random() * 6) + 5, MAX_SHARDS - activeCount);
        const margin = 100;

        for (let i = 0; i < spawnCount; i++) {
            const x = margin + Math.random() * (GAME_WIDTH - margin * 2);
            const y = margin + Math.random() * (GAME_HEIGHT - margin * 2);
            const shardId = shardIdCounter++;
            shards.set(shardId, { id: shardId, x, y, collected: false });
        }

        if (spawnCount > 0) {
            console.log(`Respawned ${spawnCount} shards (Active: ${activeCount + spawnCount}/${MAX_SHARDS})`);
            // Broadcast new shards to all clients
            io.emit('shardsSpawned', Array.from(shards.values()).filter(s => !s.collected));
        }
    }

    lastRespawnTime = currentTime;
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

    // Notify others about new player
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        x: 0,
        y: 0,
        playerName: 'Player',
        level: 1
    });

    // Handle player position updates
    socket.on('playerMove', (data) => {
        // Update player data
        players.set(socket.id, {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            playerName: data.playerName || 'Player',
            level: data.level || 1
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
            console.log(`Player ${socket.id} collected shard ${data.shardId}`);

            // Broadcast to all players
            io.emit('shardCollected', {
                shardId: data.shardId,
                playerId: socket.id
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
