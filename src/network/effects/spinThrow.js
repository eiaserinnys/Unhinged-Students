// Spin Throw Effect Mixin for RemotePlayer (Hulk Sister Q skill)
// This mixin adds spin throw effect rendering capabilities to RemotePlayer

export const SpinThrowEffectMixin = {
    // Initialize spin throw effect state
    initSpinThrowEffect() {
        this.spinThrowActive = false;
        this.spinThrowStartTime = 0;
        this.spinThrowDuration = 500; // 500ms effect duration
        this.spinThrowStartX = 0;
        this.spinThrowStartY = 0;
        this.spinThrowEndX = 0;
        this.spinThrowEndY = 0;
    },

    // Start spin throw effect
    startSpinThrow(startX, startY, endX, endY) {
        this.spinThrowActive = true;
        this.spinThrowStartTime = Date.now();
        this.spinThrowStartX = startX;
        this.spinThrowStartY = startY;
        this.spinThrowEndX = endX;
        this.spinThrowEndY = endY;
    },

    // Update spin throw effect
    updateSpinThrow() {
        if (!this.spinThrowActive) return;

        const elapsed = Date.now() - this.spinThrowStartTime;
        if (elapsed >= this.spinThrowDuration) {
            this.spinThrowActive = false;
        }
    },

    // Render spin throw effect
    renderSpinThrow(ctx) {
        if (!this.spinThrowActive) return;

        const elapsed = Date.now() - this.spinThrowStartTime;
        const progress = Math.min(1, elapsed / this.spinThrowDuration);

        ctx.save();

        // Draw spinning circle around attacker
        const spinRadius = 60 + Math.sin(elapsed / 50) * 10;
        const rotationAngle = elapsed / 30; // Fast spin

        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#FF6347';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);

        ctx.beginPath();
        ctx.arc(this.x, this.y, spinRadius, rotationAngle, rotationAngle + Math.PI * 1.5);
        ctx.stroke();

        // Draw throw trajectory arc
        const midX = (this.spinThrowStartX + this.spinThrowEndX) / 2;
        const midY = Math.min(this.spinThrowStartY, this.spinThrowEndY) - 80; // Arc above

        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.strokeStyle = '#FF4500';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(this.spinThrowStartX, this.spinThrowStartY);
        ctx.quadraticCurveTo(midX, midY, this.spinThrowEndX, this.spinThrowEndY);
        ctx.stroke();

        // Draw impact effect at end position
        if (progress > 0.5) {
            const impactProgress = (progress - 0.5) * 2;
            const impactRadius = 40 * impactProgress;

            ctx.globalAlpha = (1 - impactProgress) * 0.7;
            ctx.fillStyle = '#FF6347';
            ctx.beginPath();
            ctx.arc(this.spinThrowEndX, this.spinThrowEndY, impactRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw spin emoji
        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', this.x, this.y - 50);

        ctx.restore();
    }
};

// Backward compatibility: expose to window
window.SpinThrowEffectMixin = SpinThrowEffectMixin;
