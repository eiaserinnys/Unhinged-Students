// Unhinged Students - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game world constants (16:9 aspect ratio)
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

// Viewport/scaling variables
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Game state
const gameState = {
    running: false,
    player: null,
    shardManager: null,
    networkManager: null,
    chatManager: null,
    dummies: [], // Test dummies for combat practice
    stats: {
        shardsCollected: 0
    },
    lastFrameTime: 0,
    deltaTime: 0,
    lastAttackSentTime: 0 // Track last attack sent to server
};

// Resize canvas to fill window while maintaining 16:9 aspect ratio
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;
    const gameAspectRatio = GAME_WIDTH / GAME_HEIGHT;

    if (windowAspectRatio > gameAspectRatio) {
        // Window is wider - fit to height
        canvas.height = windowHeight;
        canvas.width = windowHeight * gameAspectRatio;
        offsetX = (windowWidth - canvas.width) / 2;
        offsetY = 0;
    } else {
        // Window is taller - fit to width
        canvas.width = windowWidth;
        canvas.height = windowWidth / gameAspectRatio;
        offsetX = 0;
        offsetY = (windowHeight - canvas.height) / 2;
    }

    // Calculate scale factor for rendering
    scale = canvas.width / GAME_WIDTH;

    // Position canvas in center of window
    canvas.style.position = 'absolute';
    canvas.style.left = offsetX + 'px';
    canvas.style.top = offsetY + 'px';

    console.log(`Canvas resized to ${canvas.width}x${canvas.height}, scale: ${scale.toFixed(2)}`);
}

// Initialize game
function init() {
    console.log('Game initialized');

    // Setup canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initInput(canvas);

    // Create player character (Alien) with player name
    // Position in center of game world (not canvas)
    gameState.player = new Character(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        'asset/image/alien.png',
        GAME_HEIGHT,
        '마나리' // Player name
    );

    // Create test dummies for combat practice
    // Position them around the map for testing
    const dummyPositions = [
        { x: GAME_WIDTH / 2 + 300, y: GAME_HEIGHT / 2, name: 'Dummy 1' },
        { x: GAME_WIDTH / 2 - 300, y: GAME_HEIGHT / 2, name: 'Dummy 2' },
        { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 300, name: 'Dummy 3' },
    ];

    dummyPositions.forEach(pos => {
        const dummy = new Character(
            pos.x,
            pos.y,
            'asset/image/alien.png',
            GAME_HEIGHT,
            pos.name,
            true // isDummy = true
        );
        // Make dummies stationary and distinguishable
        dummy.speed = 0; // Don't move
        dummy.maxHP = 30; // 3 hits to kill (10 damage x 3 = 30)
        dummy.currentHP = 30;
        gameState.dummies.push(dummy);
    });

    console.log(`Created ${gameState.dummies.length} test dummies`);

    // Create shard manager (will be populated by server)
    gameState.shardManager = new ShardManager();
    gameState.shardManager.enableServerMode();

    // Initialize chat manager
    gameState.chatManager = new ChatManager();
    gameState.chatManager.setPlayer(gameState.player);

    // Initialize network manager and connect to server
    // Auto-detects server address from window.location.hostname
    gameState.networkManager = new NetworkManager();
    gameState.networkManager.setShardManager(gameState.shardManager);
    gameState.networkManager.setLocalPlayer(gameState.player);
    gameState.networkManager.connect();

    // Connect chat to network after socket is ready
    setTimeout(() => {
        if (gameState.networkManager.socket) {
            gameState.chatManager.setSocket(gameState.networkManager.socket);
            gameState.chatManager.addSystemMessage('Connected to server. Press Enter to chat.');
        }
    }, 500);

    gameState.running = true;
    gameLoop();
}

// Update game logic
function update(deltaTime) {
    // Don't update player movement if chat is focused
    const isChatting = gameState.chatManager && gameState.chatManager.isChatInputFocused();

    if (gameState.player && !isChatting) {
        // Pass game world dimensions and delta time
        gameState.player.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);

        // Send player position to server
        if (gameState.networkManager) {
            const pos = gameState.player.getPosition();
            gameState.networkManager.sendPlayerPosition(
                pos.x,
                pos.y,
                gameState.player.playerName,
                gameState.player.level
            );
        }
    }

    if (gameState.shardManager) {
        gameState.shardManager.update();

        // Check for shard collisions
        const collectedShards = gameState.shardManager.checkCollisions(gameState.player);
        if (collectedShards.length > 0) {
            gameState.stats.shardsCollected += collectedShards.length;
            console.log(`Collected ${collectedShards.length} shard(s)! Total: ${gameState.stats.shardsCollected}`);

            // Add experience for each shard collected (1 shard = 1 exp)
            gameState.player.addExperience(collectedShards.length);

            // Send shard collection to server
            if (gameState.networkManager) {
                collectedShards.forEach(shard => {
                    if (shard.id !== null) {
                        gameState.networkManager.sendShardCollection(shard.id);
                    }
                });
            }
        }
    }

    // Update dummies
    gameState.dummies.forEach(dummy => {
        dummy.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);

        // Check for respawn
        if (!dummy.isAlive() && dummy.canRespawn()) {
            dummy.respawn();
        }
    });

    // Check for attack collisions with dummies (local only) and send attack to server
    if (gameState.player && gameState.player.isAttacking) {
        const attackArea = gameState.player.getAttackArea();

        // Send attack to server once per attack (when attack just started)
        const currentTime = Date.now();
        if (!gameState.lastAttackSentTime || currentTime - gameState.lastAttackSentTime > gameState.player.attackCooldown) {
            if (gameState.networkManager) {
                gameState.networkManager.sendAttack(
                    attackArea.x,
                    attackArea.y,
                    attackArea.radius,
                    gameState.player.attackPower
                );
                gameState.lastAttackSentTime = currentTime;
            }
        }

        // Check dummies (local only)
        gameState.dummies.forEach(dummy => {
            if (!dummy.isAlive()) return;

            // Calculate distance between player and dummy
            const dx = dummy.x - attackArea.x;
            const dy = dummy.y - attackArea.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if dummy is within attack range
            if (distance <= attackArea.radius) {
                dummy.takeDamage(gameState.player.attackPower);
            }
        });
    }

    // Update remote players
    if (gameState.networkManager) {
        gameState.networkManager.update();
    }
}

// Game loop
function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate delta time (in seconds)
    if (gameState.lastFrameTime === 0) {
        gameState.lastFrameTime = currentTime;
    }
    gameState.deltaTime = (currentTime - gameState.lastFrameTime) / 1000; // Convert to seconds
    gameState.lastFrameTime = currentTime;

    // Cap delta time to prevent huge jumps (e.g., when tab is inactive)
    if (gameState.deltaTime > 0.1) {
        gameState.deltaTime = 0.1;
    }

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scaling for game world rendering
    ctx.save();
    ctx.scale(scale, scale);

    // Update and render
    update(gameState.deltaTime);
    render();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// Render function
function render() {
    // Draw title (in game world coordinates)
    ctx.fillStyle = '#00D9FF';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Unhinged Students - Multiplayer Test', GAME_WIDTH / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#E0E0E0';
    ctx.font = '16px Inter, sans-serif';
    const connectionStatus = gameState.networkManager && gameState.networkManager.connected ? 'Connected' : 'Connecting...';
    const playerCount = gameState.networkManager ? gameState.networkManager.remotePlayers.size + 1 : 1;
    ctx.fillText(`${connectionStatus} | Players: ${playerCount}`, GAME_WIDTH / 2, 70);

    // Draw shards
    if (gameState.shardManager) {
        gameState.shardManager.render(ctx);
    }

    // Draw remote players
    if (gameState.networkManager) {
        gameState.networkManager.render(ctx);
    }

    // Draw test dummies
    gameState.dummies.forEach(dummy => {
        if (dummy.isAlive()) {
            dummy.render(ctx);
        }
    });

    // Draw local player (on top of remote players and dummies)
    if (gameState.player) {
        gameState.player.render(ctx);
    }

    // Draw UI
    ctx.fillStyle = '#A78BFA';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'left';

    if (gameState.player) {
        const pos = gameState.player.getPosition();
        const level = gameState.player.getLevel();
        const exp = gameState.player.getExperience();
        const requiredExp = gameState.player.getRequiredExperience();

        ctx.fillText(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 10, 20);

        // Level display with max level indicator
        if (level >= gameState.player.maxLevel) {
            ctx.fillText(`Level: ${level} (MAX)`, 10, 40);
        } else {
            ctx.fillText(`Level: ${level} (${exp}/${requiredExp} exp)`, 10, 40);
        }
    }

    if (gameState.shardManager) {
        ctx.fillText(`Shards Collected: ${gameState.stats.shardsCollected}`, 10, 60);
        ctx.fillText(`Active Shards: ${gameState.shardManager.getActiveShardCount()}/${gameState.shardManager.maxActiveShards}`, 10, 80);
    }
}

// Start game when page loads
window.addEventListener('load', init);
