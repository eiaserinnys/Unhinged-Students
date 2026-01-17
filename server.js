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

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Send player their ID
    socket.emit('connected', {
        playerId: socket.id
    });

    // Send existing players to new player
    const existingPlayers = Array.from(players.values());
    socket.emit('existingPlayers', existingPlayers);

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
