// Unhinged Students - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const gameState = {
    running: false,
    player: null,
    shardManager: null,
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

    // Create player character (Alien)
    gameState.player = new Character(
        canvas.width / 2,
        canvas.height / 2,
        'asset/image/alien.png',
        canvas.height
    );

    // Create shard manager and spawn shards
    gameState.shardManager = new ShardManager();
    gameState.shardManager.spawnShards(10, canvas.width, canvas.height);

    gameState.running = true;
    gameLoop();
}

// Update game logic
function update() {
    if (gameState.player) {
        gameState.player.update(canvas);
    }

    if (gameState.shardManager) {
        gameState.shardManager.update();

        // Check for shard collisions
        const collectedShards = gameState.shardManager.checkCollisions(gameState.player);
        if (collectedShards.length > 0) {
            gameState.stats.shardsCollected += collectedShards.length;
            console.log(`Collected ${collectedShards.length} shard(s)! Total: ${gameState.stats.shardsCollected}`);

            // Level up for each shard collected
            for (let i = 0; i < collectedShards.length; i++) {
                gameState.player.levelUp();
            }
        }
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
    ctx.fillText('Unhinged Students - Phase 3: Level System', canvas.width / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('Move around to collect shards and level up!', canvas.width / 2, 70);

    // Draw shards
    if (gameState.shardManager) {
        gameState.shardManager.render(ctx);
    }

    // Draw player character
    if (gameState.player) {
        gameState.player.render(ctx);
    }

    // Draw UI
    ctx.fillStyle = '#ffff00';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';

    if (gameState.player) {
        const pos = gameState.player.getPosition();
        ctx.fillText(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 10, 20);
        ctx.fillText(`Level: ${gameState.player.getLevel()}`, 10, 40);
    }

    if (gameState.shardManager) {
        ctx.fillText(`Shards: ${gameState.stats.shardsCollected} / ${gameState.shardManager.getTotalShardCount()}`, 10, 60);
        ctx.fillText(`Remaining: ${gameState.shardManager.getActiveShardCount()}`, 10, 80);
    }
}

// Start game when page loads
window.addEventListener('load', init);
