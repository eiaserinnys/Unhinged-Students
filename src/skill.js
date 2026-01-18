// Skill System for Unhinged Students

// Base Skill class
class Skill {
    constructor(name, key, cooldown, iconColor = '#666666') {
        this.name = name;
        this.key = key;
        this.cooldown = cooldown; // in milliseconds
        this.lastUsedTime = 0;
        this.iconColor = iconColor;

        // Ready flash effect
        this.readyFlashTime = 0;
        this.readyFlashDuration = 300; // 300ms flash when ready
        this.wasOnCooldown = false;
    }

    isReady() {
        return Date.now() - this.lastUsedTime >= this.cooldown;
    }

    use() {
        if (!this.isReady()) return false;
        this.lastUsedTime = Date.now();
        this.wasOnCooldown = true;
        return true;
    }

    getRemainingCooldown() {
        const elapsed = Date.now() - this.lastUsedTime;
        return Math.max(0, this.cooldown - elapsed);
    }

    getCooldownProgress() {
        if (this.lastUsedTime === 0) return 1; // Never used, fully ready
        const elapsed = Date.now() - this.lastUsedTime;
        return Math.min(1, elapsed / this.cooldown);
    }

    // Check and trigger ready flash
    checkReadyFlash() {
        if (this.wasOnCooldown && this.isReady()) {
            this.readyFlashTime = Date.now();
            this.wasOnCooldown = false;
            return true;
        }
        return false;
    }

    isFlashing() {
        if (this.readyFlashTime === 0) return false;
        return Date.now() - this.readyFlashTime < this.readyFlashDuration;
    }

    getFlashIntensity() {
        if (!this.isFlashing()) return 0;
        const elapsed = Date.now() - this.readyFlashTime;
        const progress = elapsed / this.readyFlashDuration;
        // Flash in and out
        return Math.sin(progress * Math.PI);
    }
}

// Skill Manager - handles all skills for a character
class SkillManager {
    constructor() {
        this.skills = new Map(); // key -> Skill
        this.skillOrder = []; // For UI ordering
    }

    addSkill(skill) {
        this.skills.set(skill.key.toLowerCase(), skill);
        this.skillOrder.push(skill.key.toLowerCase());
    }

    getSkill(key) {
        return this.skills.get(key.toLowerCase());
    }

    useSkill(key) {
        const skill = this.getSkill(key);
        if (skill && skill.use()) {
            return skill;
        }
        return null;
    }

    update() {
        // Check for ready flashes
        this.skills.forEach(skill => {
            skill.checkReadyFlash();
        });
    }

    // Get all skills in order for UI
    getAllSkills() {
        return this.skillOrder.map(key => this.skills.get(key));
    }
}

// Laser Beam Effect - handles the Q skill visual and logic
class LaserBeamEffect {
    constructor() {
        this.active = false;
        this.phase = 'none'; // 'aiming', 'firing', 'none'
        this.startTime = 0;
        this.aimDuration = 1000; // 1 second aiming
        this.fireDuration = 200; // 0.2 second firing flash

        // Positions
        this.startX = 0;
        this.startY = 0;

        // Fixed direction (set once when skill starts)
        this.dirX = 0;
        this.dirY = 0;

        // Damage
        this.damage = 44; // 2x damage
        this.hasDealtDamage = false;
    }

    start(playerX, playerY, targetX, targetY) {
        this.active = true;
        this.phase = 'aiming';
        this.startTime = Date.now();
        this.startX = playerX;
        this.startY = playerY;

        // Calculate and LOCK the direction at start
        const dx = targetX - playerX;
        const dy = targetY - playerY;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            this.dirX = dx / length;
            this.dirY = dy / length;
        } else {
            // Default to right if no target
            this.dirX = 1;
            this.dirY = 0;
        }

        this.hasDealtDamage = false;
    }

    update(playerX, playerY) {
        if (!this.active) return;

        // Update start position to follow player (direction stays fixed)
        this.startX = playerX;
        this.startY = playerY;

        const elapsed = Date.now() - this.startTime;

        if (this.phase === 'aiming') {
            if (elapsed >= this.aimDuration) {
                this.phase = 'firing';
                this.startTime = Date.now();
            }
        } else if (this.phase === 'firing') {
            if (elapsed >= this.fireDuration) {
                this.active = false;
                this.phase = 'none';
            }
        }
    }

    // Check if laser should deal damage this frame
    shouldDealDamage() {
        if (this.phase === 'firing' && !this.hasDealtDamage) {
            this.hasDealtDamage = true;
            return true;
        }
        return false;
    }

    // Get laser line for collision detection
    getLaserLine() {
        // Use fixed direction (set at skill start)
        if (this.dirX === 0 && this.dirY === 0) return null;

        // Extend to 2000 pixels (beyond screen)
        const endX = this.startX + this.dirX * 2000;
        const endY = this.startY + this.dirY * 2000;

        return {
            x1: this.startX,
            y1: this.startY,
            x2: endX,
            y2: endY
        };
    }

    render(ctx) {
        if (!this.active) return;

        const elapsed = Date.now() - this.startTime;

        ctx.save();

        if (this.phase === 'aiming') {
            // Aiming line - gets more opaque over time
            const progress = elapsed / this.aimDuration;
            const opacity = 0.3 + progress * 0.5; // 0.3 to 0.8

            ctx.strokeStyle = `rgba(255, 68, 68, ${opacity})`;
            ctx.lineWidth = 2 + progress * 2; // 2 to 4 pixels

            // Draw dashed line during aiming
            ctx.setLineDash([10, 10]);

            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY);

            // Extend to edge of screen
            const line = this.getLaserLine();
            if (line) {
                ctx.lineTo(line.x2, line.y2);
            }
            ctx.stroke();

        } else if (this.phase === 'firing') {
            // Firing flash - bright white/red beam
            const progress = elapsed / this.fireDuration;
            const opacity = 1 - progress * 0.5; // Fade slightly

            // Glow effect (outer)
            ctx.strokeStyle = `rgba(255, 100, 100, ${opacity * 0.5})`;
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY);
            const line = this.getLaserLine();
            if (line) {
                ctx.lineTo(line.x2, line.y2);
            }
            ctx.stroke();

            // Core beam (inner)
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.startX, this.startY);
            if (line) {
                ctx.lineTo(line.x2, line.y2);
            }
            ctx.stroke();
        }

        ctx.restore();
    }
}

// Teleport Effect - handles the W skill visual and logic
class TeleportEffect {
    constructor() {
        this.active = false;
        this.phase = 'none'; // 'disappear', 'appear', 'none'
        this.startTime = 0;
        this.disappearDuration = 150; // 0.15 second disappear
        this.appearDuration = 200; // 0.2 second appear + damage

        // Positions
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;

        // Teleport settings
        this.minDistance = 200;
        this.maxDistance = 400;
        this.damageRadius = 100;
        this.damage = 12;

        // Flags
        this.hasDealtDamage = false;
        this.hasTeleported = false;
    }

    start(playerX, playerY, gameWidth, gameHeight, targetX = null, targetY = null) {
        this.active = true;
        this.phase = 'disappear';
        this.startTime = Date.now();
        this.startX = playerX;
        this.startY = playerY;
        this.hasDealtDamage = false;
        this.hasTeleported = false;

        let newX, newY;

        // If target position is provided, teleport near the target
        if (targetX !== null && targetY !== null) {
            // Random angle around the target
            const angle = Math.random() * Math.PI * 2;
            // Distance within damage radius (so we can hit them)
            const distance = Math.random() * (this.damageRadius * 0.8);

            newX = targetX + Math.cos(angle) * distance;
            newY = targetY + Math.sin(angle) * distance;
        } else {
            // Fallback: random teleport if no target
            const angle = Math.random() * Math.PI * 2;
            const distance = this.minDistance + Math.random() * (this.maxDistance - this.minDistance);

            newX = playerX + Math.cos(angle) * distance;
            newY = playerY + Math.sin(angle) * distance;
        }

        // Clamp to game bounds
        const margin = 50;
        newX = Math.max(margin, Math.min(gameWidth - margin, newX));
        newY = Math.max(margin, Math.min(gameHeight - margin, newY));

        this.endX = newX;
        this.endY = newY;
    }

    update() {
        if (!this.active) return null;

        const elapsed = Date.now() - this.startTime;

        if (this.phase === 'disappear') {
            if (elapsed >= this.disappearDuration) {
                this.phase = 'appear';
                this.startTime = Date.now();
                this.hasTeleported = true;
                // Return new position to move player
                return { x: this.endX, y: this.endY, teleported: true };
            }
        } else if (this.phase === 'appear') {
            if (elapsed >= this.appearDuration) {
                this.active = false;
                this.phase = 'none';
            }
        }

        return null;
    }

    // Check if should deal damage
    shouldDealDamage() {
        if (this.phase === 'appear' && !this.hasDealtDamage) {
            this.hasDealtDamage = true;
            return true;
        }
        return false;
    }

    // Get damage area
    getDamageArea() {
        return {
            x: this.endX,
            y: this.endY,
            radius: this.damageRadius,
            damage: this.damage
        };
    }

    render(ctx) {
        if (!this.active) return;

        const elapsed = Date.now() - this.startTime;

        ctx.save();

        if (this.phase === 'disappear') {
            // Disappearing effect at start position
            const progress = elapsed / this.disappearDuration;
            const opacity = 1 - progress;
            const scale = 1 + progress * 0.5; // Expand slightly

            // Green particles/glow effect
            ctx.globalAlpha = opacity * 0.6;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(this.startX, this.startY, 40 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Inner white flash
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.startX, this.startY, 20 * scale, 0, Math.PI * 2);
            ctx.fill();

        } else if (this.phase === 'appear') {
            // Appearing effect at end position
            const progress = elapsed / this.appearDuration;
            const opacity = progress < 0.5 ? progress * 2 : 2 - progress * 2;
            const damageOpacity = (1 - progress) * 0.4;

            // Damage radius indicator
            ctx.globalAlpha = damageOpacity;
            ctx.fillStyle = '#44FF44';
            ctx.beginPath();
            ctx.arc(this.endX, this.endY, this.damageRadius, 0, Math.PI * 2);
            ctx.fill();

            // Damage radius border
            ctx.globalAlpha = damageOpacity * 2;
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.endX, this.endY, this.damageRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Appear flash
            ctx.globalAlpha = opacity * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.endX, this.endY, 30 * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// Telepathy Effect - handles the E skill visual and logic (3 second channeling)
class TelepathyEffect {
    constructor() {
        this.active = false;
        this.startTime = 0;
        this.duration = 3000; // 3 second channeling
        this.tickInterval = 100; // 0.1 second tick interval

        // Position
        this.x = 0;
        this.y = 0;

        // Settings
        this.radius = 180; // Larger than attack range
        this.damagePerTick = 2; // Damage per tick per enemy (total ~60 over 3 sec with 30 ticks)
        this.maxHealPerTick = 4; // Max heal per tick

        // Tick tracking
        this.lastTickTime = 0;
        this.tickCount = 0;
    }

    start(playerX, playerY) {
        this.active = true;
        this.startTime = Date.now();
        this.lastTickTime = 0;
        this.tickCount = 0;
        this.x = playerX;
        this.y = playerY;
    }

    update(playerX, playerY) {
        if (!this.active) return;

        // Follow player position
        this.x = playerX;
        this.y = playerY;

        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.active = false;
        }
    }

    // Check if should deal damage (every 0.1 seconds during channel)
    shouldDealDamage() {
        if (!this.active) return false;

        const elapsed = Date.now() - this.startTime;
        const expectedTicks = Math.floor(elapsed / this.tickInterval);

        if (expectedTicks > this.tickCount) {
            this.tickCount = expectedTicks;
            return true;
        }
        return false;
    }

    // Get damage area
    getDamageArea() {
        return {
            x: this.x,
            y: this.y,
            radius: this.radius,
            damagePerTarget: this.damagePerTick,
            maxHeal: this.maxHealPerTick
        };
    }

    render(ctx) {
        if (!this.active) return;

        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.duration;

        ctx.save();

        // Pulsing effect
        const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
        const currentRadius = this.radius * pulseScale;

        // Expanding ring effect
        const ringProgress = Math.min(1, progress * 2);
        const ringRadius = this.radius * ringProgress;

        // Main purple area (fades out)
        const mainOpacity = (1 - progress) * 0.3;
        ctx.globalAlpha = mainOpacity;
        ctx.fillStyle = '#8B5CF6';
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Border ring
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = '#A78BFA';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Expanding ring (life drain visual)
        if (ringProgress < 1) {
            ctx.globalAlpha = (1 - ringProgress) * 0.6;
            ctx.strokeStyle = '#C4B5FD';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Inner glow
        const innerGradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, currentRadius * 0.5
        );
        innerGradient.addColorStop(0, `rgba(139, 92, 246, ${(1 - progress) * 0.5})`);
        innerGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Skill UI Renderer
class SkillUI {
    constructor(skillManager) {
        this.skillManager = skillManager;

        // UI Settings
        this.boxSize = 60; // Size of each skill box
        this.boxGap = 10; // Gap between boxes
        this.bottomMargin = 30; // Distance from bottom of screen
        this.borderRadius = 8;
    }

    render(ctx, canvasWidth, canvasHeight) {
        const skills = this.skillManager.getAllSkills();
        if (skills.length === 0) return;

        // Calculate total width and starting position (centered)
        const totalWidth = skills.length * this.boxSize + (skills.length - 1) * this.boxGap;
        const startX = (canvasWidth - totalWidth) / 2;
        const startY = canvasHeight - this.bottomMargin - this.boxSize;

        skills.forEach((skill, index) => {
            const x = startX + index * (this.boxSize + this.boxGap);
            const y = startY;
            this.renderSkillBox(ctx, skill, x, y);
        });
    }

    renderSkillBox(ctx, skill, x, y) {
        const isReady = skill.isReady();
        const cooldownProgress = skill.getCooldownProgress();
        const isFlashing = skill.isFlashing();
        const flashIntensity = skill.getFlashIntensity();

        ctx.save();

        // Background box
        ctx.fillStyle = isReady ? '#333333' : '#1a1a1a';
        this.roundRect(ctx, x, y, this.boxSize, this.boxSize, this.borderRadius);
        ctx.fill();

        // Cooldown overlay (fills from bottom to top)
        if (!isReady) {
            const cooldownHeight = this.boxSize * (1 - cooldownProgress);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            // Clip to rounded rect area
            ctx.save();
            this.roundRect(ctx, x, y, this.boxSize, this.boxSize, this.borderRadius);
            ctx.clip();
            ctx.fillRect(x, y, this.boxSize, cooldownHeight);
            ctx.restore();
        }

        // Ready flash effect
        if (isFlashing) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity * 0.5})`;
            this.roundRect(ctx, x, y, this.boxSize, this.boxSize, this.borderRadius);
            ctx.fill();
        }

        // Border
        ctx.strokeStyle = isReady ? '#4ECDC4' : '#555555';
        ctx.lineWidth = isReady ? 2 : 1;
        this.roundRect(ctx, x, y, this.boxSize, this.boxSize, this.borderRadius);
        ctx.stroke();

        // Skill icon color indicator (small square)
        const iconSize = 20;
        const iconX = x + (this.boxSize - iconSize) / 2;
        const iconY = y + 8;
        ctx.fillStyle = isReady ? skill.iconColor : this.darkenColor(skill.iconColor);
        ctx.fillRect(iconX, iconY, iconSize, iconSize);

        // Key label (Q, W, E)
        ctx.fillStyle = isReady ? '#ffffff' : '#666666';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(skill.key.toUpperCase(), x + this.boxSize / 2, y + this.boxSize / 2 + 5);

        // Skill name (below key)
        ctx.fillStyle = isReady ? '#cccccc' : '#555555';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(skill.name, x + this.boxSize / 2, y + this.boxSize - 8);

        // Cooldown text (remaining seconds)
        if (!isReady) {
            const remaining = Math.ceil(skill.getRemainingCooldown() / 1000);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.fillText(remaining.toString(), x + this.boxSize / 2, y + this.boxSize / 2 - 8);
        }

        ctx.restore();
    }

    // Helper: draw rounded rectangle
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // Helper: darken a hex color
    darkenColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const factor = 0.4;
        return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }
}
