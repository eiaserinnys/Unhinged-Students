// Remote player class (represents other players)

import { logger } from '../utils/logger.js';
import { CharacterUtils } from '../characterUtils.js';
import { ASSET_BASE } from '../config.js';
import type { CharacterType, TeamType, IRemotePlayer, Position, Bounds } from '../types/index.js';

// Import effect types only (mixins are used dynamically)
import type { LaserEffectState } from './effects/laser.js';
import type { TeleportEffectState, TelepathyEffectState } from './effects/teleport.js';
import type { WaveEffectState } from './effects/wave.js';
import type { PotSmashEffectState } from './effects/potSmash.js';
import type { CurryRecoveryEffectState } from './effects/curryRecovery.js';
import type { SpinThrowEffectState } from './effects/spinThrow.js';
import type { RageEffectState } from './effects/rage.js';

/**
 * Character image paths mapping
 */
const CHARACTER_IMAGES: Record<CharacterType, string> = {
    alien: `${ASSET_BASE}/image/alien.png`,
    'crazy-eyes': `${ASSET_BASE}/image/crazy-eyes.png`,
    'curry-bear': `${ASSET_BASE}/image/curry-bear.png`,
    'big-sis-hulk': `${ASSET_BASE}/image/big-sis-hulk.png`,
    teacher: `${ASSET_BASE}/image/teacher.png`,
    'squeak-squeak': `${ASSET_BASE}/image/squeak-squeak.png`,
};

/**
 * Represents a remote player (other players in the game)
 */
export class RemotePlayer
    implements
        IRemotePlayer,
        LaserEffectState,
        TeleportEffectState,
        TelepathyEffectState,
        WaveEffectState,
        PotSmashEffectState,
        CurryRecoveryEffectState,
        SpinThrowEffectState,
        RageEffectState
{
    // Core properties
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    playerName: string;
    level: number;
    experience: number;
    maxLevel: number;
    characterId: CharacterType;

    // Visual properties
    displaySize: number;
    width: number;
    height: number;
    image: HTMLImageElement | null;
    imageLoaded: boolean;

    // Interpolation
    private interpolationSpeed: number;

    // Chat bubble system
    chatMessage: string | null;
    chatMessageTime: number;
    chatMessageDuration: number;

    // HP system
    maxHP: number;
    currentHP: number;

    // Death state
    isDead: boolean;

    // Team
    team: TeamType | null;

    // Hit flash effect
    hitFlashTime: number;
    hitFlashDuration: number;

    // Knockback system
    isKnockedBack: boolean;
    knockbackStartTime: number;
    knockbackDuration: number;
    knockbackStartX: number;
    knockbackStartY: number;
    knockbackEndX: number;
    knockbackEndY: number;

    // Attack effect system
    private isAttacking: boolean;
    private attackStartTime: number;
    private attackAnimationTime: number;
    private attackX: number;
    private attackY: number;
    private attackRange: number;

    // Madness state (Crazy-Eyes E skill)
    madnessActive: boolean;

    // Laser effect state
    laserActive: boolean;
    laserPhase: 'aiming' | 'firing' | 'none';
    laserStartTime: number;
    laserAimDuration: number;
    laserFireDuration: number;
    laserDirX: number;
    laserDirY: number;

    // Teleport effect state
    teleportActive: boolean;
    teleportPhase: 'disappear' | 'appear' | 'none';
    teleportStartTime: number;
    teleportDisappearDuration: number;
    teleportAppearDuration: number;
    teleportStartX: number;
    teleportStartY: number;
    teleportEndX: number;
    teleportEndY: number;
    teleportDamageRadius: number;

    // Telepathy effect state
    telepathyActive: boolean;
    telepathyStartTime: number;
    telepathyDuration: number;
    telepathyX: number;
    telepathyY: number;
    telepathyRadius: number;

    // Wave effect state
    waveActive: boolean;
    waveStartTime: number;
    waveExpandDuration: number;
    waveMaxRadius: number;

    // Pot smash effect state
    potSmashActive: boolean;
    potSmashStartTime: number;
    potSmashDuration: number;
    potSmashDirX: number;
    potSmashDirY: number;
    potSmashRange: number;
    potSmashAngle: number;

    // Curry recovery effect state
    curryRecoveryActive: boolean;
    curryRecoveryStartTime: number;
    curryRecoveryDuration: number;
    curryRecoveryHealAmount: number;

    // Spin throw effect state
    spinThrowActive: boolean;
    spinThrowStartTime: number;
    spinThrowDuration: number;
    spinThrowStartX: number;
    spinThrowStartY: number;
    spinThrowEndX: number;
    spinThrowEndY: number;

    // Rage effect state
    rageActive: boolean;
    rageStartTime: number;
    rageDuration: number;

    constructor(
        playerId: string,
        x: number,
        y: number,
        playerName: string,
        level: number,
        experience: number = 0,
        characterId: CharacterType = 'alien'
    ) {
        this.id = playerId;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.playerName = playerName;
        this.level = level;
        this.experience = experience;
        this.maxLevel = 30;

        // Character identity
        this.characterId = characterId;

        // Visual properties
        const canvasHeight = 1080; // Game world height
        this.displaySize = canvasHeight / 8;
        this.width = this.displaySize;
        this.height = this.displaySize;

        // Image properties
        this.image = null;
        this.imageLoaded = false;

        // Interpolation
        this.interpolationSpeed = 0.2;

        // Chat bubble system
        this.chatMessage = null;
        this.chatMessageTime = 0;
        this.chatMessageDuration = 3000; // 3 seconds

        // HP system
        this.maxHP = 100;
        this.currentHP = 100;

        // Death state
        this.isDead = false;

        // Team
        this.team = null;

        // Hit flash effect
        this.hitFlashTime = 0;
        this.hitFlashDuration = 100; // 100ms flash duration

        // Knockback system
        this.isKnockedBack = false;
        this.knockbackStartTime = 0;
        this.knockbackDuration = 200; // 200ms knockback animation
        this.knockbackStartX = 0;
        this.knockbackStartY = 0;
        this.knockbackEndX = 0;
        this.knockbackEndY = 0;

        // Attack effect system
        this.isAttacking = false;
        this.attackStartTime = 0;
        this.attackAnimationTime = 200; // 200ms attack animation
        this.attackX = 0;
        this.attackY = 0;
        this.attackRange = 150;

        // Madness state
        this.madnessActive = false;

        // Initialize effect states with defaults
        this.laserActive = false;
        this.laserPhase = 'none';
        this.laserStartTime = 0;
        this.laserAimDuration = 1000;
        this.laserFireDuration = 200;
        this.laserDirX = 0;
        this.laserDirY = 0;

        this.teleportActive = false;
        this.teleportPhase = 'none';
        this.teleportStartTime = 0;
        this.teleportDisappearDuration = 150;
        this.teleportAppearDuration = 200;
        this.teleportStartX = 0;
        this.teleportStartY = 0;
        this.teleportEndX = 0;
        this.teleportEndY = 0;
        this.teleportDamageRadius = 100;

        this.telepathyActive = false;
        this.telepathyStartTime = 0;
        this.telepathyDuration = 3000;
        this.telepathyX = 0;
        this.telepathyY = 0;
        this.telepathyRadius = 180;

        this.waveActive = false;
        this.waveStartTime = 0;
        this.waveExpandDuration = 500;
        this.waveMaxRadius = 250;

        this.potSmashActive = false;
        this.potSmashStartTime = 0;
        this.potSmashDuration = 300;
        this.potSmashDirX = 0;
        this.potSmashDirY = 0;
        this.potSmashRange = 120;
        this.potSmashAngle = 90;

        this.curryRecoveryActive = false;
        this.curryRecoveryStartTime = 0;
        this.curryRecoveryDuration = 500;
        this.curryRecoveryHealAmount = 0;

        this.spinThrowActive = false;
        this.spinThrowStartTime = 0;
        this.spinThrowDuration = 500;
        this.spinThrowStartX = 0;
        this.spinThrowStartY = 0;
        this.spinThrowEndX = 0;
        this.spinThrowEndY = 0;

        this.rageActive = false;
        this.rageStartTime = 0;
        this.rageDuration = 5000;

        // Initialize effect systems from mixins
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.initLaserEffect.call(this);
        }
        if (window.TeleportEffectMixin) {
            window.TeleportEffectMixin.initTeleportEffect.call(this);
        }
        if (window.TelepathyEffectMixin) {
            window.TelepathyEffectMixin.initTelepathyEffect.call(this);
        }
        if (window.WaveEffectMixin) {
            window.WaveEffectMixin.initWaveEffect.call(this);
        }
        if (window.PotSmashEffectMixin) {
            window.PotSmashEffectMixin.initPotSmashEffect.call(this);
        }
        if (window.CurryRecoveryEffectMixin) {
            window.CurryRecoveryEffectMixin.initCurryRecoveryEffect.call(this);
        }
        if (window.SpinThrowEffectMixin) {
            window.SpinThrowEffectMixin.initSpinThrowEffect.call(this);
        }
        if (window.RageEffectMixin) {
            window.RageEffectMixin.initRageEffect.call(this);
        }

        // Load character image based on characterId
        this.loadCharacterImage(characterId);
    }

    /**
     * Get character image path (same logic as LobbyManager)
     */
    static getCharacterImagePath(characterId: CharacterType): string {
        return CHARACTER_IMAGES[characterId] || CHARACTER_IMAGES['alien'];
    }

    /**
     * Load character image by characterId
     */
    private loadCharacterImage(characterId: CharacterType): void {
        const imagePath = RemotePlayer.getCharacterImagePath(characterId);
        this.characterId = characterId;
        this.loadImage(imagePath);
    }

    /**
     * Change character (reload image if different)
     */
    setCharacter(characterId: CharacterType): void {
        if (this.characterId !== characterId) {
            logger.debug(
                `RemotePlayer ${this.id} changed character: ${this.characterId} -> ${characterId}`
            );
            this.loadCharacterImage(characterId);
        }
    }

    /**
     * Load an image from the given path
     */
    private loadImage(path: string): void {
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;

            if (!this.image) return;

            // Calculate dimensions maintaining aspect ratio
            const aspectRatio = this.image.width / this.image.height;

            if (aspectRatio > 1) {
                // Wider than tall
                this.width = this.displaySize;
                this.height = this.displaySize / aspectRatio;
            } else {
                // Taller than wide
                this.height = this.displaySize;
                this.width = this.displaySize * aspectRatio;
            }

            logger.debug(`Remote player image loaded: ${path}`);
        };
        this.image.onerror = () => {
            logger.warn(`Failed to load remote player image: ${path}`);
        };
        this.image.src = path;
    }

    /**
     * Update target position for interpolation
     */
    updatePosition(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
    }

    /**
     * Update the remote player state
     */
    update(): void {
        const currentTime = Date.now();

        // Handle knockback animation using utility
        const isInKnockback = CharacterUtils.updateKnockback(this);

        if (isInKnockback) {
            // Also update target position during knockback for smooth transition after
            this.targetX = this.knockbackEndX;
            this.targetY = this.knockbackEndY;
        } else {
            // Smooth interpolation to target position
            this.x += (this.targetX - this.x) * this.interpolationSpeed;
            this.y += (this.targetY - this.y) * this.interpolationSpeed;
        }

        // Update chat bubble using utility
        CharacterUtils.updateChatBubble(this);

        // Update attack animation
        if (this.isAttacking && currentTime - this.attackStartTime >= this.attackAnimationTime) {
            this.isAttacking = false;
        }

        // Update effects from mixins
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.updateLaser.call(this);
        }
        if (window.TeleportEffectMixin) {
            window.TeleportEffectMixin.updateTeleport.call(this);
        }
        if (window.TelepathyEffectMixin) {
            window.TelepathyEffectMixin.updateTelepathy.call(this);
        }
        if (window.WaveEffectMixin) {
            window.WaveEffectMixin.updateWave.call(this);
        }
        if (window.PotSmashEffectMixin) {
            window.PotSmashEffectMixin.updatePotSmash.call(this);
        }
        if (window.CurryRecoveryEffectMixin) {
            window.CurryRecoveryEffectMixin.updateCurryRecovery.call(this);
        }
        if (window.SpinThrowEffectMixin) {
            window.SpinThrowEffectMixin.updateSpinThrow.call(this);
        }
        if (window.RageEffectMixin) {
            window.RageEffectMixin.updateRage.call(this);
        }
    }

    /**
     * Render the remote player
     */
    render(ctx: CanvasRenderingContext2D): void {
        // Skip rendering if player is dead (or render as ghost)
        if (this.isDead) {
            ctx.save();
            ctx.globalAlpha = 0.3;
        }

        // Calculate hit flash intensity using utility
        const hitFlashIntensity = CharacterUtils.calculateHitFlashIntensity(
            this.hitFlashTime,
            this.hitFlashDuration
        );

        if (this.imageLoaded && this.image) {
            // Draw remote player image
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Apply hit flash overlay using utility
            CharacterUtils.renderHitFlash(
                ctx,
                this.x,
                this.y,
                this.width,
                this.height,
                hitFlashIntensity
            );
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = '#ff6b6b'; // Red color for remote players
            ctx.fillRect(
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Loading text
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.x, this.y);

            // Apply hit flash overlay for fallback using utility
            CharacterUtils.renderHitFlash(
                ctx,
                this.x,
                this.y,
                this.width,
                this.height,
                hitFlashIntensity
            );
        }

        // Draw attack effect if attacking
        this.renderAttackEffect(ctx);

        // Draw effects from mixins
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.renderLaser.call(this, ctx);
        }
        if (window.TeleportEffectMixin) {
            window.TeleportEffectMixin.renderTeleport.call(this, ctx);
        }
        if (window.TelepathyEffectMixin) {
            window.TelepathyEffectMixin.renderTelepathy.call(this, ctx);
        }
        if (window.WaveEffectMixin) {
            window.WaveEffectMixin.renderWave.call(this, ctx);
        }
        if (window.PotSmashEffectMixin) {
            window.PotSmashEffectMixin.renderPotSmash.call(this, ctx);
        }
        if (window.CurryRecoveryEffectMixin) {
            window.CurryRecoveryEffectMixin.renderCurryRecovery.call(this, ctx);
        }
        if (window.SpinThrowEffectMixin) {
            window.SpinThrowEffectMixin.renderSpinThrow.call(this, ctx);
        }
        if (window.RageEffectMixin) {
            window.RageEffectMixin.renderRage.call(this, ctx);
        }

        // Draw info above remote player using utility
        CharacterUtils.renderInfoAbove(ctx, this);

        // Draw chat bubble using utility
        CharacterUtils.renderChatBubble(ctx, this);

        if (this.isDead) {
            ctx.restore();
        }
    }

    /**
     * Render attack effect for remote player
     */
    private renderAttackEffect(ctx: CanvasRenderingContext2D): void {
        if (!this.isAttacking) return;

        // Calculate animation progress (0 to 1)
        const currentTime = Date.now();
        const progress = Math.min(
            1,
            (currentTime - this.attackStartTime) / this.attackAnimationTime
        );

        // Draw full attack range circle that fades out
        const opacity = (1 - progress) * 0.4; // Start at 40% opacity, fade to 0

        ctx.save();
        ctx.globalAlpha = opacity;

        // Fill with semi-transparent red
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(this.attackX, this.attackY, this.attackRange, 0, Math.PI * 2);
        ctx.fill();

        // Border for clarity
        ctx.globalAlpha = opacity * 1.5;
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Set chat message to display in bubble
     */
    setChatMessage(message: string): void {
        CharacterUtils.setChatMessage(this, message);
    }

    /**
     * Take damage
     */
    private takeDamage(amount: number): boolean {
        this.currentHP = Math.max(0, this.currentHP - amount);
        logger.debug(
            `${this.playerName} took ${amount} damage! HP: ${this.currentHP}/${this.maxHP}`
        );

        if (this.currentHP <= 0) {
            logger.info(`${this.playerName} has been defeated!`);
            return true; // Character died
        }
        return false;
    }

    /**
     * Check if character is alive
     */
    private isAlive(): boolean {
        return this.currentHP > 0;
    }

    /**
     * Get bounds for collision detection
     */
    private getBounds(): Bounds {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2,
        };
    }

    /**
     * Get position
     */
    private getPosition(): Position {
        return { x: this.x, y: this.y };
    }

    /**
     * Start knockback from an attacker position
     */
    startKnockback(attackerX: number, attackerY: number, endX: number, endY: number): void {
        CharacterUtils.startKnockback(this, attackerX, attackerY, endX, endY);
    }

    /**
     * Start attack effect for visual display
     */
    startAttackEffect(x: number, y: number, range: number): void {
        this.isAttacking = true;
        this.attackStartTime = Date.now();
        this.attackX = x;
        this.attackY = y;
        this.attackRange = range;
    }

    // Effect methods delegated to mixins
    startLaserAiming(x: number, y: number, dirX: number, dirY: number): void {
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.startLaserAiming.call(this, x, y, dirX, dirY);
        }
    }

    fireLaser(): void {
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.fireLaser.call(this);
        }
    }

    startTeleport(startX: number, startY: number, endX: number, endY: number): void {
        if (window.TeleportEffectMixin) {
            window.TeleportEffectMixin.startTeleport.call(this, startX, startY, endX, endY);
        }
    }

    startTelepathy(x: number, y: number, radius: number): void {
        if (window.TelepathyEffectMixin) {
            window.TelepathyEffectMixin.startTelepathy.call(this, x, y, radius);
        }
    }

    startWave(): void {
        if (window.WaveEffectMixin) {
            window.WaveEffectMixin.startWave.call(this);
        }
    }

    startPotSmash(dirX: number, dirY: number): void {
        if (window.PotSmashEffectMixin) {
            window.PotSmashEffectMixin.startPotSmash.call(this, dirX, dirY);
        }
    }

    startCurryRecovery(healAmount: number): void {
        if (window.CurryRecoveryEffectMixin) {
            window.CurryRecoveryEffectMixin.startCurryRecovery.call(this, healAmount);
        }
    }

    startSpinThrow(startX: number, startY: number, endX: number, endY: number): void {
        if (window.SpinThrowEffectMixin) {
            window.SpinThrowEffectMixin.startSpinThrow.call(this, startX, startY, endX, endY);
        }
    }

    startRage(duration: number): void {
        if (window.RageEffectMixin) {
            window.RageEffectMixin.startRage.call(this, duration);
        }
    }

    endRage(): void {
        if (window.RageEffectMixin) {
            window.RageEffectMixin.endRage.call(this);
        }
    }
}

// Backward compatibility: expose to window
declare global {
    interface Window {
        RemotePlayer: typeof RemotePlayer;
    }
}
window.RemotePlayer = RemotePlayer;
