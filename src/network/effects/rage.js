// Rage Effect Mixin for RemotePlayer (Hulk Sister E skill)
// This mixin adds rage effect rendering capabilities to RemotePlayer

const RageEffectMixin = {
    // Initialize rage effect state
    initRageEffect() {
        this.rageActive = false;
        this.rageStartTime = 0;
        this.rageDuration = 5000; // 5 seconds default
    },

    // Start rage effect
    startRage(duration) {
        this.rageActive = true;
        this.rageStartTime = Date.now();
        this.rageDuration = duration || 5000;
    },

    // End rage effect
    endRage() {
        this.rageActive = false;
    },

    // Update rage effect
    updateRage() {
        if (!this.rageActive) return;

        const elapsed = Date.now() - this.rageStartTime;
        if (elapsed >= this.rageDuration) {
            this.rageActive = false;
        }
    },

    // Render rage effect
    renderRage(ctx) {
        if (!this.rageActive) return;

        const elapsed = Date.now() - this.rageStartTime;
        const pulsePhase = Math.sin(elapsed / 100) * 0.3 + 0.7;

        ctx.save();

        // Red glow around player
        const glowRadius = 80 + Math.sin(elapsed / 150) * 15;
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, glowRadius
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${0.3 * pulsePhase})`);
        gradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.2 * pulsePhase})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Flame particles rising
        const particleCount = 6;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + elapsed / 500;
            const particleRadius = 45 + Math.sin(elapsed / 200 + i) * 10;
            const riseAmount = (elapsed / 50 + i * 20) % 60;

            const px = this.x + Math.cos(angle) * particleRadius;
            const py = this.y - riseAmount;

            ctx.globalAlpha = 0.8 - (riseAmount / 60) * 0.6;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔥', px, py);
        }

        // Rage indicator above head
        ctx.globalAlpha = pulsePhase;
        ctx.font = 'bold 14px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF0000';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;

        const indicatorY = this.y - 70;
        ctx.strokeText('RAGE!', this.x, indicatorY);
        ctx.fillText('RAGE!', this.x, indicatorY);

        ctx.restore();
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.RageEffectMixin = RageEffectMixin;
}
