// Laser Effect Mixin for RemotePlayer
const LaserEffectMixin = {
    // Initialize laser effect properties
    initLaserEffect() {
        this.laserActive = false;
        this.laserPhase = 'none'; // 'aiming', 'firing', 'none'
        this.laserStartTime = 0;
        this.laserAimDuration = 1000; // 1 second aiming
        this.laserFireDuration = 200; // 0.2 second firing
        this.laserDirX = 0;
        this.laserDirY = 0;
    },

    // Start laser aiming effect
    startLaserAiming(x, y, dirX, dirY) {
        this.laserActive = true;
        this.laserPhase = 'aiming';
        this.laserStartTime = Date.now();
        this.laserDirX = dirX;
        this.laserDirY = dirY;
    },

    // Transition laser to firing phase
    fireLaser() {
        if (this.laserActive) {
            this.laserPhase = 'firing';
            this.laserStartTime = Date.now();
        }
    },

    // Update laser effect state
    updateLaser() {
        if (!this.laserActive) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.laserStartTime;

        if (this.laserPhase === 'aiming') {
            if (elapsed >= this.laserAimDuration) {
                this.laserPhase = 'firing';
                this.laserStartTime = currentTime;
            }
        } else if (this.laserPhase === 'firing') {
            if (elapsed >= this.laserFireDuration) {
                this.laserActive = false;
                this.laserPhase = 'none';
            }
        }
    },

    // Render laser effect
    renderLaser(ctx) {
        if (!this.laserActive) return;

        const elapsed = Date.now() - this.laserStartTime;

        // Calculate end point (2000 pixels in direction)
        const endX = this.x + this.laserDirX * 2000;
        const endY = this.y + this.laserDirY * 2000;

        ctx.save();

        if (this.laserPhase === 'aiming') {
            // Aiming line - gets more opaque over time
            const progress = elapsed / this.laserAimDuration;
            const opacity = 0.3 + progress * 0.5;

            ctx.strokeStyle = `rgba(255, 68, 68, ${opacity})`;
            ctx.lineWidth = 2 + progress * 2;
            ctx.setLineDash([10, 10]);

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

        } else if (this.laserPhase === 'firing') {
            // Firing flash
            const progress = elapsed / this.laserFireDuration;
            const opacity = 1 - progress * 0.5;

            // Glow effect (outer)
            ctx.strokeStyle = `rgba(255, 100, 100, ${opacity * 0.5})`;
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Core beam (inner)
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        ctx.restore();
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.LaserEffectMixin = LaserEffectMixin;
}
