// Pot Smash Effect Mixin for RemotePlayer (Curry-Bear basic attack)
// This mixin adds pot smash effect rendering capabilities to RemotePlayer

/**
 * Interface for objects that can have pot smash effects applied
 */
export interface PotSmashEffectState {
    x: number;
    y: number;
    potSmashActive: boolean;
    potSmashStartTime: number;
    potSmashDuration: number;
    potSmashDirX: number;
    potSmashDirY: number;
    potSmashRange: number;
    potSmashAngle: number;
}

export const PotSmashEffectMixin = {
    /**
     * Initialize pot smash effect state
     */
    initPotSmashEffect(this: PotSmashEffectState): void {
        this.potSmashActive = false;
        this.potSmashStartTime = 0;
        this.potSmashDuration = 300; // 300ms effect duration
        this.potSmashDirX = 0;
        this.potSmashDirY = 0;
        this.potSmashRange = 120;
        this.potSmashAngle = 90; // degrees
    },

    /**
     * Start pot smash effect
     */
    startPotSmash(this: PotSmashEffectState, dirX: number, dirY: number): void {
        this.potSmashActive = true;
        this.potSmashStartTime = Date.now();
        this.potSmashDirX = dirX;
        this.potSmashDirY = dirY;
    },

    /**
     * Update pot smash effect
     */
    updatePotSmash(this: PotSmashEffectState): void {
        if (!this.potSmashActive) return;

        const elapsed = Date.now() - this.potSmashStartTime;
        if (elapsed >= this.potSmashDuration) {
            this.potSmashActive = false;
        }
    },

    /**
     * Render pot smash effect
     */
    renderPotSmash(this: PotSmashEffectState, ctx: CanvasRenderingContext2D): void {
        if (!this.potSmashActive) return;

        const elapsed = Date.now() - this.potSmashStartTime;
        const progress = Math.min(1, elapsed / this.potSmashDuration);

        ctx.save();

        // Calculate cone parameters
        const halfAngleRad = ((this.potSmashAngle / 2) * Math.PI) / 180;
        const baseAngle = Math.atan2(this.potSmashDirY, this.potSmashDirX);
        const startAngle = baseAngle - halfAngleRad;
        const endAngle = baseAngle + halfAngleRad;

        // Draw cone (curry splash)
        const opacity = (1 - progress) * 0.6;
        ctx.globalAlpha = opacity;

        // Fill cone
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.potSmashRange, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = '#FFD700'; // Gold (curry color)
        ctx.fill();

        // Draw cone outline
        ctx.globalAlpha = opacity * 1.5;
        ctx.strokeStyle = '#FFA500'; // Orange
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw pot emoji at the edge
        const emojiAngle = baseAngle;
        const emojiDist = this.potSmashRange * 0.6 * (1 - progress * 0.3);
        const emojiX = this.x + Math.cos(emojiAngle) * emojiDist;
        const emojiY = this.y + Math.sin(emojiAngle) * emojiDist;

        ctx.globalAlpha = opacity * 1.5;
        ctx.font = '30px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F372}', emojiX, emojiY);

        // Draw splash particles
        const particleCount = 5;
        for (let i = 0; i < particleCount; i++) {
            const particleAngle = startAngle + (endAngle - startAngle) * (i / (particleCount - 1));
            const particleDist = this.potSmashRange * (0.3 + progress * 0.7);
            const px = this.x + Math.cos(particleAngle) * particleDist;
            const py = this.y + Math.sin(particleAngle) * particleDist;

            ctx.beginPath();
            ctx.arc(px, py, 8 * (1 - progress), 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
        }

        ctx.restore();
    },
};

// Backward compatibility: expose to window
declare global {
    interface Window {
        PotSmashEffectMixin: typeof PotSmashEffectMixin;
    }
}
window.PotSmashEffectMixin = PotSmashEffectMixin;
