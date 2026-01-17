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

        // Respawn system (for dummies)
        this.deathTime = 0;
        this.respawnDelay = 5000; // 5 seconds
        this.initialX = x; // Store initial position for respawn
        this.initialY = y;

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

        // Keyboard movement (WASD and Arrow keys)
        // Movement is now frame-rate independent: distance = speed * deltaTime
        const moveDistance = this.speed * deltaTime;

        if (isKeyPressed('w') || isKeyPressed('arrowup')) {
            this.y -= moveDistance;
        }
        if (isKeyPressed('s') || isKeyPressed('arrowdown')) {
            this.y += moveDistance;
        }
        if (isKeyPressed('a') || isKeyPressed('arrowleft')) {
            this.x -= moveDistance;
        }
        if (isKeyPressed('d') || isKeyPressed('arrowright')) {
            this.x += moveDistance;
        }

        // Keep character in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));

        // Attack input (Space key) - only for non-dummies
        const currentTime = Date.now();
        if (!this.isDummy && isKeyPressed(' ') && currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.attack();
        }

        // Update attack animation
        if (this.isAttacking && currentTime - this.attackStartTime >= this.attackAnimationTime) {
            this.isAttacking = false;
        }

        // Update chat bubble - remove message after duration
        if (this.chatMessage && Date.now() - this.chatMessageTime > this.chatMessageDuration) {
            this.chatMessage = null;
        }
    }

    render(ctx) {
        if (this.isDummy) {
            // Draw dummy as red rectangle
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
        } else if (this.imageLoaded && this.image) {
            // Draw character image
            ctx.drawImage(
                this.image,
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
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
        }

        // Draw attack effect if attacking
        this.renderAttackEffect(ctx);

        // Draw info above character
        this.renderInfoAbove(ctx);

        // Draw chat bubble if active
        this.renderChatBubble(ctx);
    }

    renderInfoAbove(ctx) {
        const infoY = this.y - this.height / 2 - 10; // Start 10px above character

        // HP Bar
        const hpBarWidth = this.width;
        const hpBarHeight = 6;
        const hpBarX = this.x - hpBarWidth / 2;
        const hpBarY = infoY - hpBarHeight;

        // HP Bar background (dark gray)
        ctx.fillStyle = '#333333';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // HP Bar fill (green)
        const hpPercentage = this.currentHP / this.maxHP;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercentage, hpBarHeight);

        // HP Bar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // Player name and level
        const nameY = hpBarY - 5;
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Add text shadow for better visibility
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillText(`${this.playerName} Lv.${this.level}`, this.x, nameY);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Reset text baseline
        ctx.textBaseline = 'alphabetic';
    }

    renderAttackEffect(ctx) {
        if (!this.isAttacking) return;

        // Calculate animation progress (0 to 1)
        const currentTime = Date.now();
        const progress = Math.min(1, (currentTime - this.attackStartTime) / this.attackAnimationTime);

        // Draw expanding circle with fading opacity
        const currentRadius = this.attackRange * progress;
        const opacity = 1 - progress; // Fade out as it expands

        ctx.save();
        ctx.globalAlpha = opacity * 0.6; // Increased opacity for better visibility
        ctx.strokeStyle = '#FF6B6B'; // Red attack effect
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderChatBubble(ctx) {
        if (!this.chatMessage) return;

        // Position bubble above player info
        const bubbleY = this.y - this.height / 2 - 50; // Above HP bar and name

        // Measure text to determine bubble size
        ctx.font = '20px Inter, sans-serif';
        const textMetrics = ctx.measureText(this.chatMessage);
        const textWidth = textMetrics.width;

        const padding = 14;
        const bubbleWidth = textWidth + padding * 2;
        const bubbleHeight = 32;
        const bubbleX = this.x - bubbleWidth / 2;

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;

        // Rounded rectangle for bubble
        const radius = 5;
        ctx.beginPath();
        ctx.moveTo(bubbleX + radius, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
        ctx.lineTo(bubbleX, bubbleY + radius);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw small triangle pointer
        const pointerSize = 5;
        ctx.beginPath();
        ctx.moveTo(this.x - pointerSize, bubbleY + bubbleHeight);
        ctx.lineTo(this.x, bubbleY + bubbleHeight + pointerSize);
        ctx.lineTo(this.x + pointerSize, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.font = '20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.chatMessage, this.x, bubbleY + bubbleHeight / 2);

        // Reset text baseline
        ctx.textBaseline = 'alphabetic';
    }

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

    // Take damage
    takeDamage(amount) {
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
        this.chatMessage = message;
        this.chatMessageTime = Date.now();
    }
}
