// Character system

class Character {
    constructor(x, y, imagePath, canvasHeight, playerName = 'Player', isDummy = false) {
        this.x = x;
        this.y = y;
        // Size relative to screen height (LOL-style: about 1/8 of screen height)
        this.displaySize = canvasHeight / 8;
        this.width = this.displaySize;
        this.height = this.displaySize;
        this.speed = 300; // pixels per second (was 5 pixels per frame)
        this.image = null;
        this.imageLoaded = false;

        // Player info
        this.playerName = playerName;
        this.isDummy = isDummy; // Enemy/dummy flag
        this.isDead = false; // Death state for players

        // Level system
        this.level = 1;
        this.experience = 0;
        this.maxLevel = 30;

        // HP system
        this.maxHP = 100;
        this.currentHP = 100;

        // Combat system
        this.attackPower = 10; // Damage per attack
        this.attackRange = 150; // Attack range in pixels
        this.attackCooldown = 500; // Cooldown in milliseconds (0.5 seconds)
        this.lastAttackTime = 0;
        this.isAttacking = false;
        this.attackAnimationTime = 200; // Attack animation duration in ms
        this.attackStartTime = 0;
        this.lastDamagedTime = 0; // Track when last damaged (for invincibility frame)

        // Respawn system (for dummies)
        this.deathTime = 0;
        this.respawnDelay = 5000; // 5 seconds
        this.initialX = x; // Store initial position for respawn
        this.initialY = y;

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
        this.knockbackMinDistance = 30; // Minimum knockback distance
        this.knockbackMaxDistance = 100; // Maximum knockback distance

        // Chat bubble system
        this.chatMessage = null;
        this.chatMessageTime = 0;
        this.chatMessageDuration = 3000; // 3 seconds

        // Load character image
        this.loadImage(imagePath);
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

            console.log(`Character image loaded: ${path} (${this.image.width}x${this.image.height}) -> Display: (${Math.round(this.width)}x${Math.round(this.height)})`);
        };
        this.image.onerror = () => {
            console.error(`Failed to load character image: ${path}`);
        };
        this.image.src = path;
    }

    update(canvas, deltaTime = 0.016) {
        // Default deltaTime is ~60fps if not provided (for backward compatibility)
        const currentTime = Date.now();

        // Handle knockback animation using utility
        const isInKnockback = CharacterUtils.updateKnockback(this);

        if (!isInKnockback) {
            // Keyboard movement (Arrow keys only - WASD reserved for skills)
            // Movement is now frame-rate independent: distance = speed * deltaTime
            const moveDistance = this.speed * deltaTime;

            if (isKeyPressed('arrowup')) {
                this.y -= moveDistance;
            }
            if (isKeyPressed('arrowdown')) {
                this.y += moveDistance;
            }
            if (isKeyPressed('arrowleft')) {
                this.x -= moveDistance;
            }
            if (isKeyPressed('arrowright')) {
                this.x += moveDistance;
            }
        }

        // Keep character in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));

        // Attack input (Space key) - only for non-dummies and not during knockback
        if (!this.isDummy && !this.isKnockedBack && isKeyPressed(' ') && currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.attack();
        }

        // Update attack animation
        if (this.isAttacking && currentTime - this.attackStartTime >= this.attackAnimationTime) {
            this.isAttacking = false;
        }

        // Update chat bubble using utility
        CharacterUtils.updateChatBubble(this);
    }

    render(ctx) {
        // Calculate hit flash intensity using utility
        const hitFlashIntensity = CharacterUtils.calculateHitFlashIntensity(this.hitFlashTime, this.hitFlashDuration);

        if (this.isDummy) {
            // Draw dummy as red rectangle
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Apply hit flash overlay for dummy (white flash for red dummy)
            CharacterUtils.renderHitFlash(ctx, this.x, this.y, this.width, this.height, hitFlashIntensity, '#ffffff', 0.7);
        } else if (this.imageLoaded && this.image) {
            // Draw character image
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );

            // Apply hit flash overlay for player
            CharacterUtils.renderHitFlash(ctx, this.x, this.y, this.width, this.height, hitFlashIntensity);
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = '#00ff00';
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

            // Apply hit flash overlay even for fallback
            CharacterUtils.renderHitFlash(ctx, this.x, this.y, this.width, this.height, hitFlashIntensity);
        }

        // Draw attack effect if attacking
        this.renderAttackEffect(ctx);

        // Draw info above character using utility
        CharacterUtils.renderInfoAbove(ctx, this, { showExpBar: !this.isDummy, isDummy: this.isDummy });

        // Draw chat bubble using utility
        CharacterUtils.renderChatBubble(ctx, this);
    }

    // renderInfoAbove is now handled by CharacterUtils.renderInfoAbove

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
        ctx.arc(this.x, this.y, this.attackRange, 0, Math.PI * 2);
        ctx.fill();

        // Border for clarity
        ctx.globalAlpha = opacity * 1.5; // Slightly more visible border
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // renderChatBubble is now handled by CharacterUtils.renderChatBubble

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    getLevel() {
        return this.level;
    }

    getExperience() {
        return this.experience;
    }

    // Calculate shards required for next level
    // Level n->n+1 requires: 10 + (n-1) * 2 shards
    getRequiredExperience() {
        if (this.level >= this.maxLevel) return 0;
        return 10 + (this.level - 1) * 2;
    }

    // Add experience and check for level up
    addExperience(amount) {
        if (this.level >= this.maxLevel) {
            console.log('Max level reached!');
            return false;
        }

        this.experience += amount;

        // Check for level up
        let leveledUp = false;
        while (this.level < this.maxLevel && this.experience >= this.getRequiredExperience()) {
            this.experience -= this.getRequiredExperience();
            this.level++;
            leveledUp = true;
            console.log(`Level up! Now level ${this.level}`);
        }

        return leveledUp;
    }

    // Legacy method for compatibility
    levelUp() {
        this.addExperience(this.getRequiredExperience());
    }

    // Attack method
    attack() {
        const currentTime = Date.now();
        this.lastAttackTime = currentTime;
        this.isAttacking = true;
        this.attackStartTime = currentTime;
        console.log(`${this.playerName} attacks!`);
        return this.getAttackArea();
    }

    // Get attack area (circle around character)
    getAttackArea() {
        return {
            x: this.x,
            y: this.y,
            radius: this.attackRange
        };
    }

    // Take damage (with invincibility frame to prevent multi-hit)
    // Also immune during knockback
    takeDamage(amount) {
        const currentTime = Date.now();
        const invincibilityDuration = 300; // 300ms invincibility after being hit

        // Immune during knockback
        if (this.isKnockedBack) {
            return false; // Can't take damage during knockback
        }

        // Check if still in invincibility period
        if (currentTime - this.lastDamagedTime < invincibilityDuration) {
            return false; // Still invincible, no damage taken
        }

        this.lastDamagedTime = currentTime;
        this.hitFlashTime = currentTime; // Trigger hit flash effect
        this.currentHP = Math.max(0, this.currentHP - amount);
        console.log(`${this.playerName} took ${amount} damage! HP: ${this.currentHP}/${this.maxHP}`);

        if (this.currentHP <= 0) {
            this.deathTime = Date.now();
            console.log(`${this.playerName} has been defeated!`);
            return true; // Character died
        }
        return false;
    }

    // Check if character is alive
    isAlive() {
        return this.currentHP > 0;
    }

    // Respawn character (for dummies)
    respawn() {
        this.currentHP = this.maxHP;
        this.x = this.initialX;
        this.y = this.initialY;
        this.deathTime = 0;
        console.log(`${this.playerName} respawned!`);
    }

    // Check if ready to respawn
    canRespawn() {
        if (this.deathTime === 0) return false;
        return Date.now() - this.deathTime >= this.respawnDelay;
    }

    // Set chat message to display in bubble
    setChatMessage(message) {
        CharacterUtils.setChatMessage(this, message);
    }

    // Start knockback from an attacker position
    // attackerX, attackerY: position of the attacker
    // endX, endY: final position after knockback (from server)
    startKnockback(attackerX, attackerY, endX, endY) {
        CharacterUtils.startKnockback(this, attackerX, attackerY, endX, endY);
    }

    // Calculate knockback distance based on distance from attacker
    // Closer = more knockback
    static calculateKnockbackDistance(attackerX, attackerY, targetX, targetY, attackRange, minKnockback = 30, maxKnockback = 100) {
        const dx = targetX - attackerX;
        const dy = targetY - attackerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Inverse relationship: closer = more knockback
        // At distance 0: maxKnockback, at attackRange: minKnockback
        const ratio = Math.min(1, distance / attackRange);
        return maxKnockback - ratio * (maxKnockback - minKnockback);
    }

    // Calculate knockback end position
    static calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance, canvasWidth, canvasHeight) {
        let dirX = targetX - attackerX;
        let dirY = targetY - attackerY;
        const distance = Math.sqrt(dirX * dirX + dirY * dirY);

        // If positions are identical, use random direction
        if (distance < 0.001) {
            const randomAngle = Math.random() * Math.PI * 2;
            dirX = Math.cos(randomAngle);
            dirY = Math.sin(randomAngle);
        } else {
            // Normalize direction
            dirX /= distance;
            dirY /= distance;
        }

        // Calculate end position
        let endX = targetX + dirX * knockbackDistance;
        let endY = targetY + dirY * knockbackDistance;

        // Clamp to canvas bounds (with some margin for character size)
        const margin = 50;
        endX = Math.max(margin, Math.min(canvasWidth - margin, endX));
        endY = Math.max(margin, Math.min(canvasHeight - margin, endY));

        return { x: endX, y: endY };
    }
}
