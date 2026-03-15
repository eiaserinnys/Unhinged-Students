// Wave Effect Mixin for RemotePlayer (Crazy-Eyes basic attack)

/**
 * Interface for objects that can have wave effects applied
 */
export interface WaveEffectState {
    x: number;
    y: number;
    waveActive: boolean;
    waveStartTime: number;
    waveExpandDuration: number;
    waveMaxRadius: number;
}

export const WaveEffectMixin = {
    /**
     * Initialize wave effect properties
     */
    initWaveEffect(this: WaveEffectState): void {
        this.waveActive = false;
        this.waveStartTime = 0;
        this.waveExpandDuration = 500; // 0.5 second expanding
        this.waveMaxRadius = 250;
    },

    /**
     * Start wave attack effect
     */
    startWave(this: WaveEffectState): void {
        this.waveActive = true;
        this.waveStartTime = Date.now();
    },

    /**
     * Update wave effect state
     */
    updateWave(this: WaveEffectState): void {
        if (!this.waveActive) return;

        const elapsed = Date.now() - this.waveStartTime;

        if (elapsed >= this.waveExpandDuration) {
            this.waveActive = false;
        }
    },

    /**
     * Render wave effect
     */
    renderWave(this: WaveEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.waveActive) return;

        const elapsed = Date.now() - this.waveStartTime;
        const progress = Math.min(elapsed / this.waveExpandDuration, 1);

        // Current radius (expanding outward)
        const currentRadius = this.waveMaxRadius * progress;

        // Opacity fades as it expands
        const opacity = 1 - progress * 0.7;

        ctx.save();

        // Outer glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 105, 180, ${opacity * 0.5})`;
        ctx.lineWidth = 15;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
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
            ctx.moveTo(this.x + Math.cos(angle) * innerR, this.y + Math.sin(angle) * innerR);
            ctx.lineTo(this.x + Math.cos(angle) * outerR, this.y + Math.sin(angle) * outerR);
            ctx.strokeStyle = `rgba(255, 182, 193, ${opacity * 0.7})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    },
};
