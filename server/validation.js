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

// Calculate distance between two points
function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
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

// Line-circle collision detection for laser beam
// Returns true if the line segment intersects the circle
function lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
    // Vector from line start to circle center
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    // Check if intersection is within the line segment
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);

    // Check if either intersection point is within the segment (0 <= t <= 1)
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// Calculate knockback end position
function calculateKnockbackEndPosition(attackerX, attackerY, targetX, targetY, knockbackDistance) {
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
