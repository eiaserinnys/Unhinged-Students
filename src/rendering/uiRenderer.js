/**
 * UI Renderer Module
 *
 * Handles rendering of UI overlays:
 * - Hit vignette effect (red screen edges when damaged)
 * - Death screen with respawn timer
 */

/**
 * Render hit vignette effect (red screen edges when damaged)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
function renderHitVignette(ctx) {
    if (gameState.hitVignetteTime === 0) return;

    const elapsed = Date.now() - gameState.hitVignetteTime;
    if (elapsed >= gameState.hitVignetteDuration) {
        gameState.hitVignetteTime = 0;
        return;
    }

    // Calculate opacity (starts strong, fades out)
    const progress = elapsed / gameState.hitVignetteDuration;
    const opacity = (1 - progress) * 0.6;

    ctx.save();

    // Create radial gradient from center (transparent) to edges (red)
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const innerRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.3;
    const outerRadius = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.8;

    const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(0.5, `rgba(255, 0, 0, ${opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, ${opacity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.restore();
}

/**
 * Render death screen with respawn timer
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
function renderDeathScreen(ctx) {
    // Dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Calculate remaining respawn time
    const player = gameState.player;
    const elapsedTime = Date.now() - player.deathTime;
    const remainingTime = Math.max(0, (player.respawnDelay - elapsedTime) / 1000);

    // Death message
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '600 72px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText('YOU DIED', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);

    // Respawn timer
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 36px Jua, sans-serif';
    ctx.fillText(`Respawning in ${remainingTime.toFixed(1)}s`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
}

/**
 * Trigger hit vignette effect (called from network.js when local player takes damage)
 */
function triggerHitVignette() {
    gameState.hitVignetteTime = Date.now();
}

// Expose to global scope
window.renderHitVignette = renderHitVignette;
window.renderDeathScreen = renderDeathScreen;
window.triggerHitVignette = triggerHitVignette;
