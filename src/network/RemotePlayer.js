// Remote player class (represents other players)
class RemotePlayer {
    constructor(playerId, x, y, playerName, level, experience = 0) {
        this.playerId = playerId;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.playerName = playerName;
        this.level = level;
        this.experience = experience;
        this.maxLevel = 30;

        // Visual properties
        // Use same display size calculation as Character
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

        // Hit flash effect (micro reaction)
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

        // Load alien image
        this.loadImage('asset/image/alien.png');
    }

    loadImage(path) {
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;

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

    updatePosition(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    update() {
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
    }

    render(ctx) {
        // Skip rendering if player is dead (or render as ghost)
        if (this.isDead) {
            ctx.save();
            ctx.globalAlpha = 0.3;
        }

        // Calculate hit flash intensity using utility
        const hitFlashIntensity = CharacterUtils.calculateHitFlashIntensity(this.hitFlashTime, this.hitFlashDuration);

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
            CharacterUtils.renderHitFlash(ctx, this.x, this.y, this.width, this.height, hitFlashIntensity);
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
            CharacterUtils.renderHitFlash(ctx, this.x, this.y, this.width, this.height, hitFlashIntensity);
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

        // Draw info above remote player using utility
        CharacterUtils.renderInfoAbove(ctx, this);

        // Draw chat bubble using utility
        CharacterUtils.renderChatBubble(ctx, this);

        if (this.isDead) {
            ctx.restore();
        }
    }

    // Render attack effect for remote player
    renderAttackEffect(ctx) {
        if (!this.isAttacking) return;

        // Calculate animation progress (0 to 1)
        const currentTime = Date.now();
        const progress = Math.min(1, (currentTime - this.attackStartTime) / this.attackAnimationTime);

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

    // Set chat message to display in bubble
    setChatMessage(message) {
        CharacterUtils.setChatMessage(this, message);
    }

    // Take damage
    takeDamage(amount) {
        this.currentHP = Math.max(0, this.currentHP - amount);
        logger.debug(`${this.playerName} took ${amount} damage! HP: ${this.currentHP}/${this.maxHP}`);

        if (this.currentHP <= 0) {
            logger.info(`${this.playerName} has been defeated!`);
            return true; // Character died
        }
        return false;
    }

    // Check if character is alive
    isAlive() {
        return this.currentHP > 0;
    }

    // Get bounds for collision detection
    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    // Get position
    getPosition() {
        return { x: this.x, y: this.y };
    }

    // Start knockback from an attacker position
    startKnockback(attackerX, attackerY, endX, endY) {
        CharacterUtils.startKnockback(this, attackerX, attackerY, endX, endY);
    }

    // Start attack effect for visual display
    startAttackEffect(x, y, range) {
        this.isAttacking = true;
        this.attackStartTime = Date.now();
        this.attackX = x;
        this.attackY = y;
        this.attackRange = range;
    }

    // Effect methods delegated to mixins
    startLaserAiming(x, y, dirX, dirY) {
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.startLaserAiming.call(this, x, y, dirX, dirY);
        }
    }

    fireLaser() {
        if (window.LaserEffectMixin) {
            window.LaserEffectMixin.fireLaser.call(this);
        }
    }

    startTeleport(startX, startY, endX, endY) {
        if (window.TeleportEffectMixin) {
            window.TeleportEffectMixin.startTeleport.call(this, startX, startY, endX, endY);
        }
    }

    startTelepathy(x, y, radius) {
        if (window.TelepathyEffectMixin) {
            window.TelepathyEffectMixin.startTelepathy.call(this, x, y, radius);
        }
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.RemotePlayer = RemotePlayer;
}
