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

// Game world constants
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

// Shard system
const MAX_SHARDS = 40;
const shards = new Map(); // Map of shardId -> {id, x, y, collected, collectedTime, respawnDelay}
let shardIdCounter = 0;

// Dummy system (server-authoritative)
const dummies = new Map(); // Map of dummyId -> {id, x, y, name, currentHP, maxHP, deathTime, respawnDelay}
const DUMMY_RESPAWN_DELAY = 5000; // 5 seconds

// Player respawn settings
const PLAYER_RESPAWN_DELAY = 3000; // 3 seconds

// Knockback settings
const KNOCKBACK_MIN = 30; // Base minimum knockback distance (at max attack range)
const KNOCKBACK_MAX = 100; // Base maximum knockback distance (at 0 distance)
const KNOCKBACK_MULTIPLIER_MIN = 5; // Minimum random multiplier
const KNOCKBACK_MULTIPLIER_MAX = 10; // Maximum random multiplier

// Calculate knockback distance based on distance from attacker (closer = more knockback)
// Applies random multiplier (5x ~ 10x) for more impactful knockback
function calculateKnockbackDistance(attackRange, distance) {
    const ratio = Math.min(1, distance / attackRange);
    const baseKnockback = KNOCKBACK_MAX - ratio * (KNOCKBACK_MAX - KNOCKBACK_MIN);
    const multiplier = KNOCKBACK_MULTIPLIER_MIN + Math.random() * (KNOCKBACK_MULTIPLIER_MAX - KNOCKBACK_MULTIPLIER_MIN);
    return baseKnockback * multiplier;
}

// Calculate knockback end position
function calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance) {
    let dirX = targetX - attackerX;
    let dirY = targetY - attackerY;
    const distance = Math.sqrt(dirX * dirX + dirY * dirY);

    // If positions are identical, use random direction
    if (distance < 0.001) {
        const randomAngle = Math.random() * Math.PI * 2;
        dirX = Math.cos(randomAngle);
        dirY = Math.sin(randomAngle);
    } else {
        // Normalize direction
        dirX /= distance;
        dirY /= distance;
    }

    // Calculate end position
    let endX = targetX + dirX * knockbackDistance;
    let endY = targetY + dirY * knockbackDistance;

    // Clamp to game bounds (with margin for character size)
    const margin = 50;
    endX = Math.max(margin, Math.min(GAME_WIDTH - margin, endX));
    endY = Math.max(margin, Math.min(GAME_HEIGHT - margin, endY));

    return { x: endX, y: endY };
}

function initializeDummies() {
    const dummyPositions = [
        { x: GAME_WIDTH / 2 + 300, y: GAME_HEIGHT / 2, name: 'Dummy 1' },
        { x: GAME_WIDTH / 2 - 300, y: GAME_HEIGHT / 2, name: 'Dummy 2' },
        { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 300, name: 'Dummy 3' },
    ];

    dummyPositions.forEach((pos, index) => {
        dummies.set(index, {
            id: index,
            x: pos.x,
            y: pos.y,
            initialX: pos.x,
            initialY: pos.y,
            name: pos.name,
            currentHP: 30, // 3 hits to kill (10 damage x 3)
            maxHP: 30,
            deathTime: 0,
            respawnDelay: DUMMY_RESPAWN_DELAY
        });
    });

    console.log(`Initialized ${dummies.size} dummies`);
}

function checkDummyRespawn() {
    const currentTime = Date.now();

    dummies.forEach((dummy) => {
        if (dummy.currentHP <= 0 && dummy.deathTime > 0) {
            const elapsedTime = currentTime - dummy.deathTime;

            if (elapsedTime >= dummy.respawnDelay) {
                // Respawn dummy
                dummy.currentHP = dummy.maxHP;
                dummy.x = dummy.initialX;
                dummy.y = dummy.initialY;
                dummy.deathTime = 0;

                console.log(`${dummy.name} respawned`);

                // Broadcast respawn to all clients
                io.emit('dummyRespawned', {
                    dummyId: dummy.id,
                    x: dummy.x,
                    y: dummy.y,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP
                });
            }
        }
    });
}

function checkPlayerRespawn() {
    const currentTime = Date.now();

    players.forEach((player, playerId) => {
        if (player.isDead && player.deathTime > 0) {
            const elapsedTime = currentTime - player.deathTime;

            if (elapsedTime >= PLAYER_RESPAWN_DELAY) {
                // Respawn player
                player.currentHP = player.maxHP;
                player.x = 960; // Center of game world
                player.y = 540;
                player.deathTime = 0;
                player.isDead = false;

                console.log(`Player ${playerId} respawned`);

                // Broadcast respawn to all clients
                io.emit('playerRespawned', {
                    playerId: playerId,
                    x: player.x,
                    y: player.y,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP
                });
            }
        }
    });
}

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

// Start shard, dummy, and player respawn systems
initializeShards();
initializeDummies();
setInterval(checkShardRespawn, 1000); // Check every second
setInterval(checkDummyRespawn, 1000); // Check dummy respawn every second
setInterval(checkPlayerRespawn, 500); // Check player respawn more frequently

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

    // Send existing dummies to new player
    const aliveDummies = Array.from(dummies.values()).filter(d => d.currentHP > 0);
    socket.emit('existingDummies', aliveDummies);

    // Initialize player data
    players.set(socket.id, {
        playerId: socket.id,
        x: 960, // Center of game world
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        deathTime: 0,
        isDead: false
    });

    // Notify others about new player
    socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        x: 960,
        y: 540,
        playerName: 'Player',
        level: 1,
        experience: 0,
        currentHP: 100,
        maxHP: 100,
        isDead: false
    });

    // Handle player position updates
    socket.on('playerMove', (data) => {
        const existingPlayer = players.get(socket.id);

        // Update player data, preserving HP and death state
        players.set(socket.id, {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            playerName: data.playerName || 'Player',
            level: data.level || 1,
            experience: data.experience || 0,
            currentHP: existingPlayer ? existingPlayer.currentHP : 100,
            maxHP: existingPlayer ? existingPlayer.maxHP : 100,
            deathTime: existingPlayer ? existingPlayer.deathTime : 0,
            isDead: existingPlayer ? existingPlayer.isDead : false
        });

        // Broadcast to other players
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            playerName: data.playerName,
            level: data.level,
            experience: data.experience
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

        // Broadcast attack to all other players (for visual effect)
        socket.broadcast.emit('playerAttacked', {
            playerId: socket.id,
            x: attackX,
            y: attackY,
            range: attackRange
        });

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself
            if (player.isDead) return; // Skip dead players

            // Calculate distance
            const dx = player.x - attackX;
            const dy = player.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range
            if (distance <= attackRange) {
                // Apply damage
                player.currentHP = Math.max(0, player.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, player.x, player.y, knockbackDist);

                // Update player position to knockback end (server-authoritative)
                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                console.log(`${socket.id} hit ${playerId} for ${attackPower} damage (HP: ${player.currentHP}/${player.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Check if player died
                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    console.log(`${playerId} has been killed by ${socket.id}!`);
                }
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        // Broadcast deaths to all players
        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check all dummies in range
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return; // Skip dead dummies

            // Calculate distance
            const dx = dummy.x - attackX;
            const dy = dummy.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range (consider dummy size ~135px, half = 67.5)
            if (distance <= attackRange + 67.5) {
                // Apply damage
                dummy.currentHP = Math.max(0, dummy.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, dummy.x, dummy.y, knockbackDist);

                // Update dummy position to knockback end (server-authoritative)
                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                console.log(`${socket.id} hit ${dummy.name} for ${attackPower} damage (HP: ${dummy.currentHP}/${dummy.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Mark death time if killed
                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    console.log(`${dummy.name} has been defeated!`);
                }
            }
        });

        // Broadcast dummy damage to all players
        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
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
