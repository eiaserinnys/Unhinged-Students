// Character system

class Character {
    constructor(x, y, imagePath, canvasHeight) {
        this.x = x;
        this.y = y;
        // Size relative to screen height (LOL-style: about 1/8 of screen height)
        this.displaySize = canvasHeight / 8;
        this.width = this.displaySize;
        this.height = this.displaySize;
        this.speed = 5;
        this.image = null;
        this.imageLoaded = false;

        // Level system
        this.level = 1;
        this.experience = 0;
        this.maxLevel = 30;

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

    update(canvas) {
        // Keyboard movement (WASD and Arrow keys)
        if (isKeyPressed('w') || isKeyPressed('arrowup')) {
            this.y -= this.speed;
        }
        if (isKeyPressed('s') || isKeyPressed('arrowdown')) {
            this.y += this.speed;
        }
        if (isKeyPressed('a') || isKeyPressed('arrowleft')) {
            this.x -= this.speed;
        }
        if (isKeyPressed('d') || isKeyPressed('arrowright')) {
            this.x += this.speed;
        }

        // Keep character in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(canvas.height - this.height / 2, this.y));
    }

    render(ctx) {
        if (this.imageLoaded && this.image) {
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
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.x, this.y);
        }
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
}
