// Unhinged Students - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const gameState = {
    running: false,
    player: null,
    shardManager: null,
    networkManager: null,
    chatManager: null,
    stats: {
        shardsCollected: 0
    }
};

// Resize canvas to fill window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
}

// Initialize game
function init() {
    console.log('Game initialized');

    // Setup canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initInput(canvas);

    // Create player character (Alien) with player name
    gameState.player = new Character(
        canvas.width / 2,
        canvas.height / 2,
        'asset/image/alien.png',
        canvas.height,
        '마나리' // Player name
    );

    // Create shard manager and spawn initial shards
    gameState.shardManager = new ShardManager();
    gameState.shardManager.spawnShards(20, canvas.width, canvas.height);

    // Initialize chat manager
    gameState.chatManager = new ChatManager();

    // Initialize network manager and connect to server
    // Auto-detects server address from window.location.hostname
    gameState.networkManager = new NetworkManager();
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
function update() {
    // Don't update player movement if chat is focused
    const isChatting = gameState.chatManager && gameState.chatManager.isChatInputFocused();

    if (gameState.player && !isChatting) {
        gameState.player.update(canvas);

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
        }
    }

    // Update remote players
    if (gameState.networkManager) {
        gameState.networkManager.update();
    }
}

// Game loop
function gameLoop() {
    if (!gameState.running) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and render
    update();
    render();

    requestAnimationFrame(gameLoop);
}

// Render function
function render() {
    // Draw title
    ctx.fillStyle = '#00ff00';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Unhinged Students - Multiplayer Test', canvas.width / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    const connectionStatus = gameState.networkManager && gameState.networkManager.connected ? 'Connected' : 'Connecting...';
    const playerCount = gameState.networkManager ? gameState.networkManager.remotePlayers.size + 1 : 1;
    ctx.fillText(`${connectionStatus} | Players: ${playerCount}`, canvas.width / 2, 70);

    // Draw shards
    if (gameState.shardManager) {
        gameState.shardManager.render(ctx);
    }

    // Draw remote players
    if (gameState.networkManager) {
        gameState.networkManager.render(ctx);
    }

    // Draw local player (on top of remote players)
    if (gameState.player) {
        gameState.player.render(ctx);
    }

    // Draw UI
    ctx.fillStyle = '#ffff00';
    ctx.font = '12px Arial';
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
