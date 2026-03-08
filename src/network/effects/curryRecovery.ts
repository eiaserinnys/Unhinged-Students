// Curry Recovery Effect Mixin for RemotePlayer (Curry-Bear E skill)
// This mixin adds curry recovery effect rendering capabilities to RemotePlayer

/**
 * Interface for objects that can have curry recovery effects applied
 */
export interface CurryRecoveryEffectState {
    x: number;
    y: number;
    curryRecoveryActive: boolean;
    curryRecoveryStartTime: number;
    curryRecoveryDuration: number;
    curryRecoveryHealAmount: number;
}

export const CurryRecoveryEffectMixin = {
    /**
     * Initialize curry recovery effect state
     */
    initCurryRecoveryEffect(this: CurryRecoveryEffectState): void {
        this.curryRecoveryActive = false;
        this.curryRecoveryStartTime = 0;
        this.curryRecoveryDuration = 500; // 500ms effect duration
        this.curryRecoveryHealAmount = 0;
    },

    /**
     * Start curry recovery effect
     */
    startCurryRecovery(this: CurryRecoveryEffectState, healAmount: number): void {
        this.curryRecoveryActive = true;
        this.curryRecoveryStartTime = Date.now();
        this.curryRecoveryHealAmount = healAmount;
    },

    /**
     * Update curry recovery effect
     */
    updateCurryRecovery(this: CurryRecoveryEffectState): void {
        if (!this.curryRecoveryActive) return;

        const elapsed = Date.now() - this.curryRecoveryStartTime;
        if (elapsed >= this.curryRecoveryDuration) {
            this.curryRecoveryActive = false;
        }
    },

    /**
     * Render curry recovery effect
     */
    renderCurryRecovery(this: CurryRecoveryEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.curryRecoveryActive) return;

        const elapsed = Date.now() - this.curryRecoveryStartTime;
        const progress = Math.min(1, elapsed / this.curryRecoveryDuration);

        ctx.save();

        // Rising curry particles
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const baseRadius = 50;
            const riseAmount = progress * 80;
            const spreadX = Math.cos(angle) * baseRadius * (1 - progress * 0.5);
            const x = this.x + spreadX;
            const y = this.y - riseAmount + Math.sin(angle * 3 + elapsed / 100) * 8;

            ctx.globalAlpha = (1 - progress) * 0.8;
            ctx.font = `${16 + progress * 8}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u{1F35B}', x, y);
        }

        // Healing glow
        const glowRadius = 60 + progress * 30;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        gradient.addColorStop(0, `rgba(255, 165, 0, ${(1 - progress) * 0.3})`);
        gradient.addColorStop(0.5, `rgba(255, 215, 0, ${(1 - progress) * 0.15})`);
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Heal amount text rising
        const textY = this.y - 60 - progress * 40;
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.fillStyle = '#32CD32';
        ctx.font = `bold ${18 + progress * 4}px Jua, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${this.curryRecoveryHealAmount}`, this.x, textY);

        ctx.restore();
    },
};

// Backward compatibility: expose to window
declare global {
    interface Window {
        CurryRecoveryEffectMixin: typeof CurryRecoveryEffectMixin;
    }
}
window.CurryRecoveryEffectMixin = CurryRecoveryEffectMixin;
