/**
 * UI Renderer Module
 *
 * Handles rendering of UI overlays:
 * - Hit vignette effect (red screen edges when damaged)
 * - Death screen with respawn timer
 */

import { gameState, GAME_WIDTH, GAME_HEIGHT } from '../core/gameState.js';

/**
 * Render hit vignette effect (red screen edges when damaged)
 * @param ctx - Canvas 2D context
 */
export function renderHitVignette(ctx: CanvasRenderingContext2D): void {
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

    const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerRadius,
        centerX,
        centerY,
        outerRadius
    );
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(0.5, `rgba(255, 0, 0, ${opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, ${opacity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.restore();
}

/**
 * Render death screen with respawn timer
 * @param ctx - Canvas 2D context
 */
export function renderDeathScreen(ctx: CanvasRenderingContext2D): void {
    const player = gameState.player;
    if (!player) return;

    // Dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Calculate remaining respawn time
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
    ctx.fillText(
        `Respawning in ${remainingTime.toFixed(1)}s`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 30
    );

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
}

/**
 * Trigger hit vignette effect (called from network.js when local player takes damage)
 */
export function triggerHitVignette(): void {
    gameState.hitVignetteTime = Date.now();
}

// ========================================
// MATCH UI
// ========================================

/**
 * Format milliseconds as M:SS
 */
function formatTime(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Render match timer at top center
 */
export function renderMatchTimer(ctx: CanvasRenderingContext2D): void {
    const remaining = gameState.matchRemainingMs;
    if (remaining <= 0) return;

    const text = formatTime(remaining);
    const cx = GAME_WIDTH / 2;

    ctx.save();

    // Timer background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const pillW = 120;
    const pillH = 40;
    const pillX = cx - pillW / 2;
    const pillY = 8;
    const r = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.arc(pillX + pillW - r, pillY + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.arc(pillX + r, pillY + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Timer text — flash red in last 30 seconds
    ctx.fillStyle = remaining <= 30000 ? '#FF4444' : '#FFFFFF';
    ctx.font = '600 24px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, pillY + pillH / 2);

    ctx.restore();
}

/**
 * Render team kill scoreboard below the timer
 */
export function renderScoreboard(ctx: CanvasRenderingContext2D): void {
    const kills = gameState.matchTeamKills;
    const cx = GAME_WIDTH / 2;
    const y = 60;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const bgW = 220;
    const bgH = 32;
    ctx.beginPath();
    ctx.roundRect(cx - bgW / 2, y - bgH / 2, bgW, bgH, 8);
    ctx.fill();

    ctx.font = '600 20px Jua, sans-serif';
    ctx.textBaseline = 'middle';

    // Red team kills
    ctx.fillStyle = '#FF6B6B';
    ctx.textAlign = 'right';
    ctx.fillText(`RED  ${kills.red}`, cx - 16, y);

    // Separator
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'center';
    ctx.fillText(':', cx, y);

    // Blue team kills
    ctx.fillStyle = '#6B9FFF';
    ctx.textAlign = 'left';
    ctx.fillText(`${kills.blue}  BLUE`, cx + 16, y);

    ctx.restore();
}

/**
 * Render match result overlay (full screen)
 */
export function renderMatchResult(ctx: CanvasRenderingContext2D): void {
    const result = gameState.matchResult;
    if (!result) return;

    ctx.save();

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Winner text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    let titleText: string;
    let titleColor: string;

    if (result.winner === 'red') {
        titleText = 'RED TEAM WINS!';
        titleColor = '#FF6B6B';
    } else if (result.winner === 'blue') {
        titleText = 'BLUE TEAM WINS!';
        titleColor = '#6B9FFF';
    } else {
        titleText = 'DRAW!';
        titleColor = '#FFD700';
    }

    ctx.fillStyle = titleColor;
    ctx.font = '600 64px Jua, sans-serif';
    ctx.fillText(titleText, cx, cy - 80);

    // Score display
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.font = '600 36px Jua, sans-serif';
    ctx.fillStyle = '#FF6B6B';
    ctx.fillText(`${result.teamKills.red}`, cx - 60, cy + 10);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('—', cx, cy + 10);

    ctx.fillStyle = '#6B9FFF';
    ctx.fillText(`${result.teamKills.blue}`, cx + 60, cy + 10);

    // Duration
    const durationSec = Math.floor(result.durationMs / 1000);
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '20px Jua, sans-serif';
    ctx.fillText(`게임 시간: ${min}분 ${sec}초`, cx, cy + 70);

    // Return to lobby instruction
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '20px Jua, sans-serif';
    ctx.fillText('잠시 후 새 게임이 시작됩니다...', cx, cy + 120);

    ctx.restore();
}
