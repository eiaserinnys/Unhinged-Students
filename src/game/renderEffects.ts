/**
 * Render Effects Module
 *
 * All visual effect rendering functions extracted from game.ts:
 * - renderHitVignette, renderWaitingTeam, renderTeamAnnounce, renderDeathScreen
 * - renderWaveEffect, renderPotSmashEffect, renderMadnessEffect
 * - renderRageEffect, renderRatIllusionEffect, renderConfusionEffect
 * - renderCurryRecoveryEffect, renderStoredDamageUI, drawCuteRat
 */

import { GAME_CONFIG } from '../config.js';
import { gameState, GAME_WIDTH, GAME_HEIGHT } from '../core/gameState.js';
import { isConfused } from '../input.js';
import type { WaveEffectState, PotSmashEffectState, RatIllusionEffectState } from './types.js';

/**
 * Render hit vignette effect (red screen edges when damaged)
 */
export function renderHitVignette(ctx: CanvasRenderingContext2D): void {
    if (gameState.hitVignetteTime === 0) return;

    const elapsed = Date.now() - gameState.hitVignetteTime;
    if (elapsed >= gameState.hitVignetteDuration) {
        gameState.hitVignetteTime = 0;
        return;
    }

    const progress = elapsed / gameState.hitVignetteDuration;
    const opacity = (1 - progress) * 0.6;

    ctx.save();

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
 * Render waiting for team assignment screen
 */
export function renderWaitingTeam(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 48px Jua, sans-serif';
    ctx.fillText('팀 배정 중...', GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const dots = '.'.repeat(Math.floor(Date.now() / 500) % 4);
    ctx.font = '600 48px Jua, sans-serif';
    ctx.fillText(dots, GAME_WIDTH / 2 + 150, GAME_HEIGHT / 2);

    ctx.restore();
}

/**
 * Render team announcement screen
 */
export function renderTeamAnnounce(ctx: CanvasRenderingContext2D): void {
    const team = gameState.team;
    const elapsed = Date.now() - gameState.teamAnnounceStartTime;
    const duration = gameState.teamAnnounceDuration;

    if (elapsed >= duration) {
        gameState.screen = 'playing';
        return;
    }

    const progress = elapsed / duration;

    const isRed = team === 'red';
    const bgColor = isRed ? 'rgba(220, 38, 38, 0.9)' : 'rgba(37, 99, 235, 0.9)';

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const teamText = isRed ? '레드팀!' : '블루팀!';
    const teamEmoji = isRed ? '🔴' : '🔵';

    const scale = 1 + Math.max(0, 1 - progress * 2) * 0.3;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(120 * scale)}px Jua, sans-serif`;
    ctx.fillText(teamText, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

    ctx.font = `${Math.round(80 * scale)}px sans-serif`;
    ctx.fillText(teamEmoji, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100);

    if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        ctx.fillStyle = `rgba(26, 26, 26, ${fadeProgress})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    ctx.restore();
}

/**
 * Render death screen with respawn timer
 */
export function renderDeathScreen(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const player = gameState.player;
    if (!player) {
        ctx.restore();
        return;
    }

    const elapsedTime = Date.now() - player.deathTime;
    const remainingTime = Math.max(0, (player.respawnDelay - elapsedTime) / 1000);

    ctx.fillStyle = '#FF6B6B';
    ctx.font = '600 72px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText('YOU DIED', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);

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
 * Render wave effect for local player (Crazy-Eyes Q skill)
 */
export function renderWaveEffect(
    ctx: CanvasRenderingContext2D,
    waveEffect: WaveEffectState | null
): void {
    if (!waveEffect || !waveEffect.active) return;

    const elapsed = Date.now() - waveEffect.startTime;
    const progress = Math.min(elapsed / waveEffect.duration, 1);

    const currentRadius = waveEffect.maxRadius * progress;
    const opacity = 1 - progress * 0.7;

    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.arc(waveEffect.x, waveEffect.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 105, 180, ${opacity * 0.5})`;
    ctx.lineWidth = 15;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(waveEffect.x, waveEffect.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Spiral effect (rotating lines)
    const spiralCount = 6;
    for (let i = 0; i < spiralCount; i++) {
        const angle = (i / spiralCount) * Math.PI * 2 + progress * Math.PI * 2;
        const innerR = currentRadius * 0.3;
        const outerR = currentRadius * 0.9;

        ctx.beginPath();
        ctx.moveTo(
            waveEffect.x + Math.cos(angle) * innerR,
            waveEffect.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
            waveEffect.x + Math.cos(angle) * outerR,
            waveEffect.y + Math.sin(angle) * outerR
        );
        ctx.strokeStyle = `rgba(255, 182, 193, ${opacity * 0.7})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Render pot smash effect for local player (Curry-Bear Q skill)
 */
export function renderPotSmashEffect(
    ctx: CanvasRenderingContext2D,
    potSmashEffect: PotSmashEffectState | null
): void {
    if (!potSmashEffect || !potSmashEffect.active) return;

    const elapsed = Date.now() - potSmashEffect.startTime;
    const progress = Math.min(elapsed / potSmashEffect.duration, 1);

    if (progress >= 1) {
        potSmashEffect.active = false;
        return;
    }

    const halfAngleRad = ((potSmashEffect.angle / 2) * Math.PI) / 180;
    const baseAngle = Math.atan2(potSmashEffect.dirY, potSmashEffect.dirX);
    const startAngle = baseAngle - halfAngleRad;
    const endAngle = baseAngle + halfAngleRad;

    ctx.save();

    const opacity = (1 - progress) * 0.6;
    ctx.globalAlpha = opacity;

    // Fill cone
    ctx.beginPath();
    ctx.moveTo(potSmashEffect.x, potSmashEffect.y);
    ctx.arc(potSmashEffect.x, potSmashEffect.y, potSmashEffect.range, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Draw cone outline
    ctx.globalAlpha = opacity * 1.5;
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pot emoji at the edge
    const emojiDist = potSmashEffect.range * 0.6 * (1 - progress * 0.3);
    const emojiX = potSmashEffect.x + Math.cos(baseAngle) * emojiDist;
    const emojiY = potSmashEffect.y + Math.sin(baseAngle) * emojiDist;

    ctx.globalAlpha = opacity * 1.5;
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍲', emojiX, emojiY);

    // Draw splash particles
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
        const particleAngle = startAngle + (endAngle - startAngle) * (i / (particleCount - 1));
        const particleDist = potSmashEffect.range * (0.3 + progress * 0.7);
        const px = potSmashEffect.x + Math.cos(particleAngle) * particleDist;
        const py = potSmashEffect.y + Math.sin(particleAngle) * particleDist;

        ctx.beginPath();
        ctx.arc(px, py, 10 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Render madness walk effect (Crazy-Eyes E skill)
 */
export function renderMadnessEffect(ctx: CanvasRenderingContext2D): void {
    if (!gameState.madnessActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.madnessStartTime;
    const progress = elapsed / gameState.madnessDuration;
    const time = Date.now() / 1000;

    ctx.save();

    const pulseScale = 1 + Math.sin(time * 5) * 0.1;
    const radius = gameState.madnessRadius * pulseScale;

    const gradient = ctx.createRadialGradient(
        playerPos.x,
        playerPos.y,
        0,
        playerPos.x,
        playerPos.y,
        radius
    );
    gradient.addColorStop(0, 'rgba(148, 0, 211, 0.3)');
    gradient.addColorStop(0.5, 'rgba(148, 0, 211, 0.15)');
    gradient.addColorStop(1, 'rgba(148, 0, 211, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time * 3;
        const particleRadius = radius * 0.7;
        const x = playerPos.x + Math.cos(angle) * particleRadius;
        const y = playerPos.y + Math.sin(angle) * particleRadius;

        ctx.fillStyle = `rgba(186, 85, 211, ${0.5 + Math.sin(time * 8 + i) * 0.3})`;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👀', x, y);
    }

    const remainingRatio = 1 - progress;
    ctx.beginPath();
    ctx.arc(
        playerPos.x,
        playerPos.y,
        radius + 10,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * remainingRatio
    );
    ctx.strokeStyle = 'rgba(148, 0, 211, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

/**
 * Render rage effect (Hulk Sister E skill)
 */
export function renderRageEffect(ctx: CanvasRenderingContext2D): void {
    if (!gameState.rageActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.rageStartTime;
    const progress = elapsed / gameState.rageDuration;
    const pulsePhase = Math.sin(elapsed / 100) * 0.3 + 0.7;

    ctx.save();

    const glowRadius = 80 + Math.sin(elapsed / 150) * 15;
    const gradient = ctx.createRadialGradient(
        playerPos.x,
        playerPos.y,
        0,
        playerPos.x,
        playerPos.y,
        glowRadius
    );
    gradient.addColorStop(0, `rgba(255, 0, 0, ${0.3 * pulsePhase})`);
    gradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.2 * pulsePhase})`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + elapsed / 500;
        const particleRadius = 45 + Math.sin(elapsed / 200 + i) * 10;
        const riseAmount = (elapsed / 50 + i * 20) % 60;

        const px = playerPos.x + Math.cos(angle) * particleRadius;
        const py = playerPos.y - riseAmount;

        ctx.globalAlpha = 0.8 - (riseAmount / 60) * 0.6;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\uD83D\uDD25', px, py);
    }

    ctx.globalAlpha = pulsePhase;
    ctx.font = 'bold 14px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF0000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const indicatorY = playerPos.y - 70;
    ctx.strokeText('RAGE!', playerPos.x, indicatorY);
    ctx.fillText('RAGE!', playerPos.x, indicatorY);

    const remainingRatio = 1 - progress;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(
        playerPos.x,
        playerPos.y,
        glowRadius + 10,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * remainingRatio
    );
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw a cute rat face
 */
export function drawCuteRat(
    ctx: CanvasRenderingContext2D,
    size: number,
    seed: number,
    time: number,
    isClickable: boolean = false
): void {
    const scale = size / 60;

    const hue = 200 + Math.sin(seed * 0.7) * 20;
    const lightness = 85 + Math.sin(seed * 1.1) * 10;
    const faceColor = `hsl(${hue}, 30%, ${lightness}%)`;
    const earColor = `hsl(${hue}, 35%, ${lightness - 5}%)`;

    const actualFaceColor = isClickable ? '#FFD1DC' : faceColor;
    const actualEarColor = isClickable ? '#FFC0CB' : earColor;

    ctx.save();
    ctx.scale(scale, scale);

    // Ears
    ctx.beginPath();
    ctx.arc(-20, -20, 18, 0, Math.PI * 2);
    ctx.fillStyle = actualEarColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(20, -20, 18, 0, Math.PI * 2);
    ctx.fillStyle = actualEarColor;
    ctx.fill();

    // Face
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fillStyle = actualFaceColor;
    ctx.fill();

    // Eyes
    ctx.beginPath();
    ctx.arc(-10, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(10, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Eye sparkle
    ctx.beginPath();
    ctx.arc(-9, -6, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(11, -6, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();

    // Nose
    ctx.beginPath();
    ctx.ellipse(0, 5, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = isClickable ? '#FF69B4' : '#AAA';
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(0, 10, 8, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Whiskers
    ctx.strokeStyle = '#AAA';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const angle = -0.3 + i * 0.3;
        ctx.beginPath();
        ctx.moveTo(-15, 5 + i * 3);
        ctx.lineTo(-30, 5 + i * 3 + Math.sin(angle) * 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(15, 5 + i * 3);
        ctx.lineTo(30, 5 + i * 3 + Math.sin(-angle) * 5);
        ctx.stroke();
    }

    // Clickable rat sparkle effect
    if (isClickable) {
        const sparklePhase = time * 3 + seed;
        for (let i = 0; i < 4; i++) {
            const sparkleAngle = sparklePhase + (i * Math.PI) / 2;
            const sparkleX = Math.cos(sparkleAngle) * 35;
            const sparkleY = Math.sin(sparkleAngle) * 35;
            ctx.fillStyle = `rgba(255, 255, 100, ${0.5 + Math.sin(sparklePhase * 2 + i) * 0.3})`;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✨', sparkleX, sparkleY);
        }
    }

    ctx.restore();
}

/**
 * Render rat illusion effect (Squeak-Squeak Q skill)
 */
export function renderRatIllusionEffect(
    ctx: CanvasRenderingContext2D,
    ratIllusionEffect: RatIllusionEffectState | null
): void {
    if (!ratIllusionEffect || !ratIllusionEffect.active) return;

    const elapsed = Date.now() - ratIllusionEffect.startTime;
    const progress = Math.min(elapsed / ratIllusionEffect.duration, 1);

    let opacity = 1;
    if (progress < 0.1) {
        opacity = progress / 0.1;
    } else if (progress > 0.8) {
        opacity = 1 - (progress - 0.8) / 0.2;
    }

    ctx.save();

    ctx.fillStyle = `rgba(180, 210, 230, ${opacity * 0.85})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const time = Date.now() / 1000;
    const ratSize = 60;
    const cols = Math.ceil(GAME_WIDTH / ratSize) + 2;
    const rows = Math.ceil(GAME_HEIGHT / ratSize) + 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const seed = row * cols + col;
            const offsetX = Math.sin(seed * 1.7) * 15;
            const offsetY = Math.cos(seed * 2.3) * 15;
            const sizeVariation = 0.7 + Math.sin(seed * 0.9) * 0.3;
            const alphaVariation = 0.5 + Math.sin(seed * 1.3) * 0.3;

            const moveX = Math.sin(time * 0.5 + seed * 0.3) * 5;
            const moveY = Math.cos(time * 0.7 + seed * 0.5) * 5;

            const x = col * ratSize + offsetX + moveX - ratSize;
            const y = row * ratSize + offsetY + moveY - ratSize;
            const size = ratSize * sizeVariation;

            ctx.save();
            ctx.translate(x, y);
            ctx.globalAlpha = opacity * alphaVariation;

            drawCuteRat(ctx, size, seed, time);

            ctx.restore();
        }
    }

    // Clickable rats
    ctx.globalAlpha = opacity;
    for (let i = 0; i < ratIllusionEffect.rats.length; i++) {
        const rat = ratIllusionEffect.rats[i];
        ctx.save();
        ctx.translate(rat.x, rat.y);

        const pulseScale = 1 + Math.sin(time * 4 + i) * 0.1;
        ctx.scale(pulseScale, pulseScale);

        drawCuteRat(ctx, 80, i * 100, time, true);

        ctx.restore();
    }

    // Guide message
    const remainingTime = Math.max(0, (ratIllusionEffect.duration - elapsed) / 1000);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(`🐭 진짜 쥐를 찾아라! ${remainingTime.toFixed(1)}초`, GAME_WIDTH / 2, 50);

    ctx.restore();
}

/**
 * Render confusion effect when player is confused (reversed controls)
 */
export function renderConfusionEffect(ctx: CanvasRenderingContext2D): void {
    if (typeof isConfused !== 'function' || !isConfused()) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 105, 180, 0.15)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const time = Date.now() / 1000;
    const spiralCount = 8;

    for (let i = 0; i < spiralCount; i++) {
        const angle = (i / spiralCount) * Math.PI * 2 + time * 2;
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;
        const radius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.4;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        ctx.fillStyle = `rgba(255, 182, 193, ${0.3 + Math.sin(time * 5 + i) * 0.2})`;
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', x, y);
    }

    ctx.fillStyle = '#FF69B4';
    ctx.font = 'bold 48px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('혼란!', GAME_WIDTH / 2, 80);

    ctx.restore();
}

/**
 * Render curry recovery effect (Curry-Bear E skill)
 */
export function renderCurryRecoveryEffect(ctx: CanvasRenderingContext2D): void {
    if (!gameState.curryRecoveryActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.curryRecoveryStartTime;
    const duration = GAME_CONFIG.SKILL_CURRY_RECOVERY.EFFECT_DURATION_MS;
    const progress = elapsed / duration;

    if (progress >= 1) {
        gameState.curryRecoveryActive = false;
        return;
    }

    ctx.save();

    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const baseRadius = 60;
        const riseAmount = progress * 100;
        const spreadX = Math.cos(angle) * baseRadius * (1 - progress * 0.5);
        const x = playerPos.x + spreadX;
        const y = playerPos.y - riseAmount + Math.sin(angle * 3 + elapsed / 100) * 10;

        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.font = `${20 + progress * 10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍛', x, y);
    }

    const glowRadius = 80 + progress * 40;
    const gradient = ctx.createRadialGradient(
        playerPos.x,
        playerPos.y,
        0,
        playerPos.x,
        playerPos.y,
        glowRadius
    );
    gradient.addColorStop(0, `rgba(255, 165, 0, ${(1 - progress) * 0.4})`);
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${(1 - progress) * 0.2})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#32CD32';
    ctx.font = `bold ${24 + progress * 12}px sans-serif`;
    const plusCount = 5;
    for (let i = 0; i < plusCount; i++) {
        const plusAngle = (i / plusCount) * Math.PI * 2 + elapsed / 200;
        const plusRadius = 40 + progress * 60;
        const plusX = playerPos.x + Math.cos(plusAngle) * plusRadius;
        const plusY = playerPos.y - progress * 80 + Math.sin(elapsed / 150 + i) * 15;

        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', plusX, plusY);
    }

    ctx.restore();
}

/**
 * Render stored damage UI for curry-bear
 */
export function renderStoredDamageUI(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 120;

    const barWidth = 150;
    const barHeight = 16;
    const fillRatio = gameState.storedDamage / gameState.maxStoredDamage;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);

    const gradient = ctx.createLinearGradient(x - barWidth / 2, y, x + barWidth / 2, y);
    gradient.addColorStop(0, '#FFA500');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - barWidth / 2, y, barWidth * fillRatio, barHeight);

    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - barWidth / 2, y, barWidth, barHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`🍛 저장: ${gameState.storedDamage}/${gameState.maxStoredDamage}`, x, y - 2);

    ctx.restore();
}
