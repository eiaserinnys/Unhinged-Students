// Unhinged Students - Multiplayer Server
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const logger = require('../logger');

// Import game state and handlers
const {
    initializeDummies,
    initializeShards,
    startRespawnTimers,
} = require('./gameState');
const { registerPlayerHandlers } = require('./handlers/playerHandler');
const { registerCombatHandlers } = require('./handlers/combatHandler');
const { registerShardHandlers } = require('./handlers/shardHandler');
const { registerChatHandlers } = require('./handlers/chatHandler');

const app = express();
const httpServer = createServer(app);

// CORS origin configuration - Security hardening (CRITICAL-3)
function getAllowedOrigins() {
    if (process.env.NODE_ENV === 'production') {
        return [
            'https://eiaserinnys.me',
            'http://eiaserinnys.me'  // HTTP to HTTPS redirect 중 요청 허용
        ];
    }
    // Development/local environment
    return [
        'http://localhost:3000',
        'http://localhost:8000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8000'
    ];
}

const io = new Server(httpServer, {
    cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true
    },
    // Connection health settings to detect and clean up stale connections
    pingTimeout: 10000,      // 10 seconds to respond to ping
    pingInterval: 5000,      // Ping every 5 seconds
    connectTimeout: 10000    // 10 seconds to complete connection
});

// Serve static files (game client)
// In production (dist/ exists), serve from dist/, otherwise serve from project root
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');
const rootPath = path.join(__dirname, '..');

if (fs.existsSync(distPath)) {
    // Production: serve built files from dist/
    app.use(express.static(distPath));
    logger.info('Serving static files from dist/ (production build)');
} else {
    // Development: serve from project root
    app.use(express.static(rootPath));
    logger.info('Serving static files from project root (development mode)');
}

// Initialize game state
initializeShards();
initializeDummies();

// Start respawn timers
startRespawnTimers(io);

// Handle socket connections
io.on('connection', (socket) => {
    logger.info(`Player connected: ${socket.id}`);

    // Register all handlers
    registerPlayerHandlers(socket, io);
    registerCombatHandlers(socket, io);
    registerShardHandlers(socket, io);
    registerChatHandlers(socket, io);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Game client available at http://localhost:${PORT}/index.html`);
    logger.info(`Log level: ${logger.getLevel()}`);
});
