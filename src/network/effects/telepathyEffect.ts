// Telepathy Effect Mixin for RemotePlayer

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
