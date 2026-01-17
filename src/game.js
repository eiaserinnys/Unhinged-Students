// Unhinged Students - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const gameState = {
    running: false,
    testBox: {
        x: 400,
        y: 300,
        width: 50,
        height: 50,
        speed: 3
    }
};

// Initialize game
function init() {
    console.log('Game initialized');
    initInput(canvas);
    gameState.running = true;
    gameLoop();
}

// Update game logic
function update() {
    const box = gameState.testBox;

    // Keyboard movement (WASD and Arrow keys)
    if (isKeyPressed('w') || isKeyPressed('arrowup')) {
        box.y -= box.speed;
    }
    if (isKeyPressed('s') || isKeyPressed('arrowdown')) {
        box.y += box.speed;
    }
    if (isKeyPressed('a') || isKeyPressed('arrowleft')) {
        box.x -= box.speed;
    }
    if (isKeyPressed('d') || isKeyPressed('arrowright')) {
        box.x += box.speed;
    }

    // Keep box in bounds
    box.x = Math.max(box.width / 2, Math.min(canvas.width - box.width / 2, box.x));
    box.y = Math.max(box.height / 2, Math.min(canvas.height - box.height / 2, box.y));
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
    const box = gameState.testBox;

    // Draw title
    ctx.fillStyle = '#00ff00';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Unhinged Students - Input Test', canvas.width / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('Use WASD or Arrow Keys to move', canvas.width / 2, 70);
    ctx.fillText('Click or touch anywhere', canvas.width / 2, 90);

    // Draw test box (player placeholder)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(box.x - box.width / 2, box.y - box.height / 2, box.width, box.height);

    // Draw position info
    ctx.fillStyle = '#ffff00';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Box Position: (${Math.round(box.x)}, ${Math.round(box.y)})`, 10, 20);

    // Draw input status
    const keys = ['w', 'a', 's', 'd'];
    const pressedKeys = keys.filter(k => isKeyPressed(k));
    ctx.fillText(`Keys Pressed: ${pressedKeys.length > 0 ? pressedKeys.join(', ') : 'none'}`, 10, 40);

    // Draw mouse status
    const mouse = getMousePosition();
    ctx.fillText(`Mouse: (${Math.round(mouse.x)}, ${Math.round(mouse.y)}) ${isMousePressed() ? 'PRESSED' : ''}`, 10, 60);

    // Draw touch status
    if (isTouchActive()) {
        const touch = getTouchPosition();
        ctx.fillText(`Touch: (${Math.round(touch.x)}, ${Math.round(touch.y)})`, 10, 80);
    }

    // Draw mouse/touch indicator
    if (isMousePressed()) {
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    if (isTouchActive()) {
        const touch = getTouchPosition();
        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 15, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Start game when page loads
window.addEventListener('load', init);
