// Unhinged Students - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const gameState = {
    running: false,
    player: null
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

    gameState.running = true;
    gameLoop();
}

// Update game logic
function update() {
    if (gameState.player) {
        gameState.player.update(canvas);
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
    ctx.fillText('Unhinged Students - Phase 1', canvas.width / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('Use WASD or Arrow Keys to move the Alien', canvas.width / 2, 70);

    // Draw player character
    if (gameState.player) {
        gameState.player.render(ctx);

        // Draw position info
        const pos = gameState.player.getPosition();
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 10, 20);
    }
}

// Start game when page loads
window.addEventListener('load', init);
