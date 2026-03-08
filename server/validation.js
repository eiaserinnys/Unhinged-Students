// ========================================
// INPUT VALIDATION UTILITIES
// ========================================
const {
    GAME_WIDTH,
    GAME_HEIGHT,
    ATTACK_RANGE,
    KNOCKBACK_MIN,
    KNOCKBACK_MAX,
    KNOCKBACK_MULTIPLIER_MIN,
    KNOCKBACK_MULTIPLIER_MAX,
    SERVER_CONFIG,
} = require('./config');

// Import geometry functions from shared module
const {
    calculateDistance,
    lineCircleIntersect,
} = require('../shared/geometry');

// Validate that a value is a finite number
function isValidNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

// Validate coordinates are within game bounds
function isValidCoordinate(x, y, margin = 0) {
    return isValidNumber(x) && isValidNumber(y) &&
           x >= margin && x <= GAME_WIDTH - margin &&
           y >= margin && y <= GAME_HEIGHT - margin;
}

// Clamp coordinates to game bounds
function clampCoordinates(x, y, margin = 50) {
    return {
        x: Math.max(margin, Math.min(GAME_WIDTH - margin, x)),
        y: Math.max(margin, Math.min(GAME_HEIGHT - margin, y))
    };
}

// Validate string input (for player names, etc.)
function isValidString(value, maxLength = 50) {
    return typeof value === 'string' && value.length <= maxLength;
}

// Validate positive integer
function isValidPositiveInt(value, max = 1000) {
    return Number.isInteger(value) && value >= 0 && value <= max;
}

// Calculate knockback distance based on distance from attacker (closer = more knockback)
// Applies random multiplier (1.25x ~ 2.5x) for impactful knockback
function calculateKnockbackDistance(attackRange, distance) {
    const ratio = Math.min(1, distance / attackRange);
    const baseKnockback = KNOCKBACK_MAX - ratio * (KNOCKBACK_MAX - KNOCKBACK_MIN);
    const multiplier = KNOCKBACK_MULTIPLIER_MIN + Math.random() * (KNOCKBACK_MULTIPLIER_MAX - KNOCKBACK_MULTIPLIER_MIN);
    return baseKnockback * multiplier;
}

// Calculate knockback end position
function calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance) {
    let dirX = targetX - attackerX;
    let dirY = targetY - attackerY;
    const distance = calculateDistance(attackerX, attackerY, targetX, targetY);

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

    // Clamp to game bounds (with margin for character size)
    const margin = SERVER_CONFIG.KNOCKBACK.BOUNDARY_MARGIN;
    endX = Math.max(margin, Math.min(GAME_WIDTH - margin, endX));
    endY = Math.max(margin, Math.min(GAME_HEIGHT - margin, endY));

    return { x: endX, y: endY };
}

module.exports = {
    isValidNumber,
    isValidCoordinate,
    clampCoordinates,
    calculateDistance,
    isValidString,
    isValidPositiveInt,
    calculateKnockbackDistance,
    lineCircleIntersect,
    calculateKnockbackEndPosition,
};
