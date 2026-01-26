// Character Utilities - Shared rendering and logic between Character and RemotePlayer

const CharacterUtils = {
    /**
     * Calculate hit flash intensity based on elapsed time
     * @param {number} hitFlashTime - Timestamp when hit occurred
     * @param {number} hitFlashDuration - Duration of flash effect in ms
     * @returns {number} Flash intensity from 0 to 1
     */
    calculateHitFlashIntensity(hitFlashTime, hitFlashDuration) {
        if (hitFlashTime <= 0) return 0;
        const elapsed = Date.now() - hitFlashTime;
        if (elapsed < hitFlashDuration) {
            return 1 - (elapsed / hitFlashDuration);
        }
        return 0;
    },

    /**
     * Render hit flash overlay
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Entity center X
     * @param {number} y - Entity center Y
     * @param {number} width - Entity width
     * @param {number} height - Entity height
     * @param {number} hitFlashIntensity - Flash intensity from 0 to 1
     * @param {string} color - Flash color (default: red)
     * @param {number} maxAlpha - Maximum alpha value (default: 0.6)
     */
    renderHitFlash(ctx, x, y, width, height, hitFlashIntensity, color = '#ff0000', maxAlpha = 0.6) {
        if (hitFlashIntensity <= 0) return;

        ctx.save();
        ctx.globalAlpha = hitFlashIntensity * maxAlpha;
        ctx.fillStyle = color;
        ctx.fillRect(
            x - width / 2,
            y - height / 2,
            width,
            height
        );
        ctx.restore();
    },

    /**
     * Render character info above (HP bar, EXP bar, name)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} entity - Entity with x, y, width, height, playerName, level, etc.
     * @param {Object} options - Rendering options
     */
    renderInfoAbove(ctx, entity, options = {}) {
        const {
            showExpBar = true,
            isDummy = false
        } = options;

        const infoY = entity.y - entity.height / 2 - 15;

        // HP Bar (1.5x size)
        const hpBarWidth = entity.width * 1.5;
        const hpBarHeight = 9;
        const hpBarX = entity.x - hpBarWidth / 2;
        const hpBarY = infoY - hpBarHeight;

        // HP Bar background (dark gray)
        ctx.fillStyle = '#333333';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // HP Bar fill (green)
        const hpPercentage = entity.currentHP / entity.maxHP;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercentage, hpBarHeight);

        // HP Bar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        // Experience Bar (below HP bar) - only for non-dummies
        if (showExpBar && !isDummy) {
            const expBarHeight = 4;
            const expBarY = hpBarY + hpBarHeight + 2;

            // EXP Bar background
            ctx.fillStyle = '#333333';
            ctx.fillRect(hpBarX, expBarY, hpBarWidth, expBarHeight);

            // EXP Bar fill
            const requiredExp = CharacterUtils.getRequiredExperience(entity.level, entity.maxLevel);
            const expPercentage = entity.level >= entity.maxLevel ? 1 : (requiredExp > 0 ? entity.experience / requiredExp : 0);
            ctx.fillStyle = '#00D9FF'; // Cyan for experience
            ctx.fillRect(hpBarX, expBarY, hpBarWidth * expPercentage, expBarHeight);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(hpBarX, expBarY, hpBarWidth, expBarHeight);
        }

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

        ctx.fillText(`${entity.playerName} Lv.${entity.level}`, entity.x, nameY);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Reset text baseline
        ctx.textBaseline = 'alphabetic';
    },

    /**
     * Render chat bubble above character
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} entity - Entity with x, y, width, height, chatMessage
     */
    renderChatBubble(ctx, entity) {
        if (!entity.chatMessage) return;

        // Calculate where the name text ends (above HP bar)
        const nameY = entity.y - entity.height / 2 - 15 - 9 - 5; // infoY - hpBarHeight - 5

        // Position bubble above player name with padding (1.5x size)
        const bubbleHeight = 48; // 32 * 1.5
        const pointerSize = 8; // 5 * 1.5 (rounded)
        const bubbleBottomY = nameY - 10; // 10px gap above name
        const bubbleY = bubbleBottomY - bubbleHeight - pointerSize;

        // Measure text to determine bubble size (1.5x font)
        ctx.font = '30px Inter, sans-serif';
        const textMetrics = ctx.measureText(entity.chatMessage);
        const textWidth = textMetrics.width;

        const padding = 21; // 14 * 1.5
        const bubbleWidth = textWidth + padding * 2;
        const bubbleX = entity.x - bubbleWidth / 2;

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;

        // Rounded rectangle for bubble
        const radius = 8; // 5 * 1.5 (rounded)
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
        ctx.beginPath();
        ctx.moveTo(entity.x - pointerSize, bubbleY + bubbleHeight);
        ctx.lineTo(entity.x, bubbleY + bubbleHeight + pointerSize);
        ctx.lineTo(entity.x + pointerSize, bubbleY + bubbleHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.font = '30px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entity.chatMessage, entity.x, bubbleY + bubbleHeight / 2);

        // Reset text baseline
        ctx.textBaseline = 'alphabetic';
    },

    /**
     * Calculate required experience for next level
     * @param {number} level - Current level
     * @param {number} maxLevel - Maximum level
     * @returns {number} Required experience
     */
    getRequiredExperience(level, maxLevel = 30) {
        if (level >= maxLevel) return 0;
        return 10 + (level - 1) * 2;
    },

    /**
     * Update knockback animation
     * @param {Object} entity - Entity with knockback properties
     * @returns {boolean} True if knockback is active
     */
    updateKnockback(entity) {
        if (!entity.isKnockedBack) return false;

        const currentTime = Date.now();
        const elapsed = currentTime - entity.knockbackStartTime;

        if (elapsed >= entity.knockbackDuration) {
            // Knockback finished - snap to end position
            entity.x = entity.knockbackEndX;
            entity.y = entity.knockbackEndY;
            entity.isKnockedBack = false;
            return false;
        } else {
            // Interpolate position during knockback (easeOut for smooth deceleration)
            const progress = elapsed / entity.knockbackDuration;
            const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            entity.x = entity.knockbackStartX + (entity.knockbackEndX - entity.knockbackStartX) * easeOut;
            entity.y = entity.knockbackStartY + (entity.knockbackEndY - entity.knockbackStartY) * easeOut;
            return true;
        }
    },

    /**
     * Start knockback animation
     * @param {Object} entity - Entity to knockback
     * @param {number} attackerX - Attacker X position
     * @param {number} attackerY - Attacker Y position
     * @param {number} endX - End X position (from server)
     * @param {number} endY - End Y position (from server)
     */
    startKnockback(entity, attackerX, attackerY, endX, endY) {
        entity.isKnockedBack = true;
        entity.knockbackStartTime = Date.now();
        entity.knockbackStartX = entity.x;
        entity.knockbackStartY = entity.y;
        entity.knockbackEndX = endX;
        entity.knockbackEndY = endY;

        console.log(`${entity.playerName} knocked back from (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}) to (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
    },

    /**
     * Update chat bubble - remove message after duration
     * @param {Object} entity - Entity with chatMessage, chatMessageTime, chatMessageDuration
     */
    updateChatBubble(entity) {
        if (entity.chatMessage && Date.now() - entity.chatMessageTime > entity.chatMessageDuration) {
            entity.chatMessage = null;
        }
    },

    /**
     * Set chat message to display in bubble
     * @param {Object} entity - Entity to set message on
     * @param {string} message - Message to display
     */
    setChatMessage(entity, message) {
        entity.chatMessage = message;
        entity.chatMessageTime = Date.now();
    }
};
