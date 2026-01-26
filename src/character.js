// Character system

class Character {
    constructor(x, y, imagePath, canvasHeight, playerName = 'Player', isDummy = false) {
        this.x = x;
        this.y = y;
        // Size relative to screen height (LOL-style: about 1/8 of screen height)
        this.displaySize = canvasHeight / GAME_CONFIG.PLAYER.DISPLAY_SIZE_RATIO;
        this.width = this.displaySize;
        this.height = this.displaySize;
        this.speed = GAME_CONFIG.PLAYER.SPEED;
        this.image = null;
        this.imageLoaded = false;

        // Player info
        this.playerName = playerName;
        this.isDummy = isDummy; // Enemy/dummy flag
        this.isDead = false; // Death state for players

        // Level system
        this.level = 1;
        this.experience = 0;
        this.maxLevel = GAME_CONFIG.PLAYER.MAX_LEVEL;

        // HP system
        this.maxHP = GAME_CONFIG.PLAYER.MAX_HP;
        this.currentHP = GAME_CONFIG.PLAYER.MAX_HP;

        // Combat system
        this.attackPower = GAME_CONFIG.COMBAT.ATTACK_POWER;
        this.attackRange = GAME_CONFIG.COMBAT.ATTACK_RANGE;
        this.attackCooldown = GAME_CONFIG.COMBAT.ATTACK_COOLDOWN_MS;
        this.lastAttackTime = 0;
        this.isAttacking = false;
        this.attackAnimationTime = GAME_CONFIG.COMBAT.ATTACK_ANIMATION_MS;
        this.attackStartTime = 0;
        this.lastDamagedTime = 0; // Track when last damaged (for invincibility frame)

        // Respawn system (for dummies)
        this.deathTime = 0;
        this.respawnDelay = GAME_CONFIG.PLAYER.RESPAWN_DELAY_MS;
        this.initialX = x; // Store initial position for respawn
        this.initialY = y;

        // Hit flash effect (micro reaction)
        this.hitFlashTime = 0;
        this.hitFlashDuration = GAME_CONFIG.EFFECTS.HIT_FLASH_DURATION_MS;

        // Knockback system
        this.isKnockedBack = false;
        this.knockbackStartTime = 0;
        this.knockbackDuration = GAME_CONFIG.KNOCKBACK.DURATION_MS;
        this.knockbackStartX = 0;
        this.knockbackStartY = 0;
        this.knockbackEndX = 0;
        this.knockbackEndY = 0;
        this.knockbackMinDistance = GAME_CONFIG.KNOCKBACK.MIN_DISTANCE;
        this.knockbackMaxDistance = GAME_CONFIG.KNOCKBACK.MAX_DISTANCE;

        // Chat bubble system
        this.chatMessage = null;
        this.chatMessageTime = 0;
        this.chatMessageDuration = GAME_CONFIG.EFFECTS.CHAT_BUBBLE_DURATION_MS;

        // Load character image
        this.loadImage(imagePath);
    }

    /**
     * Load character image with retry logic and fallback support
     * @param {string} path - Image path to load
     * @param {number} retries - Number of retry attempts remaining (default: 3)
     * @returns {Promise<void>} - Resolves when image is loaded successfully
     */
    loadImage(path, retries = 3) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.image = img;
                this.imageLoaded = true;

                // Calculate dimensions maintaining aspect ratio
                const aspectRatio = img.width / img.height;

                if (aspectRatio > 1) {
                    // Wider than tall
                    this.width = this.displaySize;
                    this.height = this.displaySize / aspectRatio;
                } else {
                    // Taller than wide
                    this.height = this.displaySize;
                    this.width = this.displaySize * aspectRatio;
                }

                logger.debug(`Character image loaded: ${path} (${img.width}x${img.height}) -> Display: (${Math.round(this.width)}x${Math.round(this.height)})`);
                resolve();
            };

            img.onerror = () => {
                logger.warn(`Failed to load character image: ${path} (retries left: ${retries})`);

                if (retries > 0) {
                    // Retry after 1 second
                    setTimeout(() => {
                        this.loadImage(path, retries - 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000);
                } else {
                    // All retries exhausted, load fallback
                    logger.warn(`All retries exhausted for: ${path}. Loading fallback image.`);
                    this.loadFallbackImage()
                        .then(resolve)
                        .catch(() => {
                            // Even fallback failed, reject with error
                            reject(new Error(`Failed to load image: ${path}`));
                        });
                }
            };

            img.src = path;
        });
    }

    /**
     * Load a fallback placeholder image (inline SVG as data URL)
     * This ensures the character is always visible even if the main image fails
     * @returns {Promise<void>}
     */
    loadFallbackImage() {
        return new Promise((resolve, reject) => {
            // Simple placeholder SVG: gray circle with question mark
            const fallbackSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="#6b7280" stroke="#374151" stroke-width="4"/>
                    <text x="50" y="62" font-size="48" font-family="Arial, sans-serif" fill="#f3f4f6" text-anchor="middle">?</text>
                </svg>
            `.trim();

            const dataUrl = 'data:image/svg+xml;base64,' + btoa(fallbackSvg);
            const img = new Image();

            img.onload = () => {
                this.image = img;
                this.imageLoaded = true;
                // Keep square dimensions for fallback
                this.width = this.displaySize;
                this.height = this.displaySize;
                logger.debug('Fallback image loaded successfully');
                resolve();
            };

            img.onerror = () => {
                logger.error('Failed to load fallback image');
                reject(new Error('Failed to load fallback image'));
            };

            img.src = dataUrl;
        });
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
            logger.debug('Max level reached!');
            return false;
        }

        this.experience += amount;

        // Check for level up
        let leveledUp = false;
        while (this.level < this.maxLevel && this.experience >= this.getRequiredExperience()) {
            this.experience -= this.getRequiredExperience();
            this.level++;
            leveledUp = true;
            logger.info(`Level up! Now level ${this.level}`);
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
        logger.debug(`${this.playerName} attacks!`);
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
        const invincibilityDuration = GAME_CONFIG.PLAYER.INVINCIBILITY_MS;

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
        logger.debug(`${this.playerName} took ${amount} damage! HP: ${this.currentHP}/${this.maxHP}`);

        if (this.currentHP <= 0) {
            this.deathTime = Date.now();
            logger.info(`${this.playerName} has been defeated!`);
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
        logger.debug(`${this.playerName} respawned!`);
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
        const margin = GAME_CONFIG.KNOCKBACK.BOUNDARY_MARGIN;
        endX = Math.max(margin, Math.min(canvasWidth - margin, endX));
        endY = Math.max(margin, Math.min(canvasHeight - margin, endY));

        return { x: endX, y: endY };
    }
}
