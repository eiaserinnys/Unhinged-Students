// Teleport Effect Mixin for RemotePlayer

/**
 * Teleport phase types
 */
export type TeleportPhase = 'disappear' | 'appear' | 'none';

/**
 * Interface for objects that can have teleport effects applied
 */
export interface TeleportEffectState {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    teleportActive: boolean;
    teleportPhase: TeleportPhase;
    teleportStartTime: number;
    teleportDisappearDuration: number;
    teleportAppearDuration: number;
    teleportStartX: number;
    teleportStartY: number;
    teleportEndX: number;
    teleportEndY: number;
    teleportDamageRadius: number;
}

export const TeleportEffectMixin = {
    /**
     * Initialize teleport effect properties
     */
    initTeleportEffect(this: TeleportEffectState): void {
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
    },

    /**
     * Start teleport effect
     */
    startTeleport(
        this: TeleportEffectState,
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): void {
        this.teleportActive = true;
        this.teleportPhase = 'disappear';
        this.teleportStartTime = Date.now();
        this.teleportStartX = startX;
        this.teleportStartY = startY;
        this.teleportEndX = endX;
        this.teleportEndY = endY;
    },

    /**
     * Update teleport effect state
     */
    updateTeleport(this: TeleportEffectState): void {
        if (!this.teleportActive) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.teleportStartTime;

        if (this.teleportPhase === 'disappear') {
            if (elapsed >= this.teleportDisappearDuration) {
                this.teleportPhase = 'appear';
                this.teleportStartTime = currentTime;
                // Move player to teleport destination
                this.x = this.teleportEndX;
                this.y = this.teleportEndY;
                this.targetX = this.teleportEndX;
                this.targetY = this.teleportEndY;
            }
        } else if (this.teleportPhase === 'appear') {
            if (elapsed >= this.teleportAppearDuration) {
                this.teleportActive = false;
                this.teleportPhase = 'none';
            }
        }
    },

    /**
     * Render teleport effect
     */
    renderTeleport(this: TeleportEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.teleportActive) return;

        const elapsed = Date.now() - this.teleportStartTime;

        ctx.save();

        if (this.teleportPhase === 'disappear') {
            const progress = elapsed / this.teleportDisappearDuration;
            const opacity = 1 - progress;
            const scale = 1 + progress * 0.5;

            // Green glow at start position
            ctx.globalAlpha = opacity * 0.6;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(this.teleportStartX, this.teleportStartY, 40 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Inner white flash
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.teleportStartX, this.teleportStartY, 20 * scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.teleportPhase === 'appear') {
            const progress = elapsed / this.teleportAppearDuration;
            const opacity = progress < 0.5 ? progress * 2 : 2 - progress * 2;
            const damageOpacity = (1 - progress) * 0.4;

            // Damage radius indicator
            ctx.globalAlpha = damageOpacity;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(
                this.teleportEndX,
                this.teleportEndY,
                this.teleportDamageRadius,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Damage radius border
            ctx.globalAlpha = damageOpacity * 2;
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(
                this.teleportEndX,
                this.teleportEndY,
                this.teleportDamageRadius,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            // Appear flash
            ctx.globalAlpha = opacity * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(
                this.teleportEndX,
                this.teleportEndY,
                30 * (1 - progress * 0.5),
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();
    },
};

/**
 * Interface for objects that can have telepathy effects applied
 */
export interface TelepathyEffectState {
    x: number;
    y: number;
    telepathyActive: boolean;
    telepathyStartTime: number;
    telepathyDuration: number;
    telepathyX: number;
    telepathyY: number;
    telepathyRadius: number;
}

// Telepathy Effect Mixin for RemotePlayer
export const TelepathyEffectMixin = {
    /**
     * Initialize telepathy effect properties
     */
    initTelepathyEffect(this: TelepathyEffectState): void {
        this.telepathyActive = false;
        this.telepathyStartTime = 0;
        this.telepathyDuration = 3000;
        this.telepathyX = 0;
        this.telepathyY = 0;
        this.telepathyRadius = 180;
    },

    /**
     * Start telepathy effect
     */
    startTelepathy(this: TelepathyEffectState, x: number, y: number, radius: number): void {
        this.telepathyActive = true;
        this.telepathyStartTime = Date.now();
        this.telepathyX = x;
        this.telepathyY = y;
        this.telepathyRadius = radius;
    },

    /**
     * Update telepathy effect state
     */
    updateTelepathy(this: TelepathyEffectState): void {
        if (!this.telepathyActive) return;

        const elapsed = Date.now() - this.telepathyStartTime;
        if (elapsed >= this.telepathyDuration) {
            this.telepathyActive = false;
        }

        // Follow player position
        this.telepathyX = this.x;
        this.telepathyY = this.y;
    },

    /**
     * Render telepathy effect
     */
    renderTelepathy(this: TelepathyEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.telepathyActive) return;

        const elapsed = Date.now() - this.telepathyStartTime;
        const progress = elapsed / this.telepathyDuration;

        ctx.save();

        // Pulsing effect
        const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
        const currentRadius = this.telepathyRadius * pulseScale;

        // Main purple area
        ctx.globalAlpha = (1 - progress) * 0.3;
        ctx.fillStyle = '#8B5CF6';
        ctx.beginPath();
        ctx.arc(this.telepathyX, this.telepathyY, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Border ring
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.telepathyX, this.telepathyY, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    },
};

// Backward compatibility: expose to window
declare global {
    interface Window {
        TeleportEffectMixin: typeof TeleportEffectMixin;
        TelepathyEffectMixin: typeof TelepathyEffectMixin;
    }
}
window.TeleportEffectMixin = TeleportEffectMixin;
window.TelepathyEffectMixin = TelepathyEffectMixin;
