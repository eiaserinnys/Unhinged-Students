// ========================================
// INPUT VALIDATION UTILITIES
// ========================================
import { SERVER_CONFIG } from './config';

// Import geometry functions from shared module
import { calculateDistance, lineCircleIntersect } from '../shared/geometry';

// Re-export geometry functions for backward compatibility
export { calculateDistance, lineCircleIntersect };

/**
 * Validate that a value is a finite number
 */
export function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate coordinates are within game bounds
 */
export function isValidCoordinate(x: number, y: number, margin = 0): boolean {
    return (
        isValidNumber(x) &&
        isValidNumber(y) &&
        x >= margin &&
        x <= SERVER_CONFIG.WORLD.WIDTH - margin &&
        y >= margin &&
        y <= SERVER_CONFIG.WORLD.HEIGHT - margin
    );
}

/**
 * Clamp coordinates to game bounds
 */
export function clampCoordinates(x: number, y: number, margin = 50): { x: number; y: number } {
    return {
        x: Math.max(margin, Math.min(SERVER_CONFIG.WORLD.WIDTH - margin, x)),
        y: Math.max(margin, Math.min(SERVER_CONFIG.WORLD.HEIGHT - margin, y)),
    };
}

/**
 * Validate string input (for player names, etc.)
 */
export function isValidString(value: unknown, maxLength = 50): value is string {
    return typeof value === 'string' && value.length <= maxLength;
}

/**
 * Validate positive integer
 */
export function isValidPositiveInt(value: unknown, max = 1000): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

/**
 * Calculate knockback distance based on distance from attacker (closer = more knockback)
 * Applies random multiplier (1.25x ~ 2.5x) for impactful knockback
 */
export function calculateKnockbackDistance(attackRange: number, distance: number): number {
    const ratio = Math.min(1, distance / attackRange);
    const baseKnockback = SERVER_CONFIG.KNOCKBACK.MAX_DISTANCE - ratio * (SERVER_CONFIG.KNOCKBACK.MAX_DISTANCE - SERVER_CONFIG.KNOCKBACK.MIN_DISTANCE);
    const multiplier =
        SERVER_CONFIG.KNOCKBACK.MULTIPLIER_MIN +
        Math.random() * (SERVER_CONFIG.KNOCKBACK.MULTIPLIER_MAX - SERVER_CONFIG.KNOCKBACK.MULTIPLIER_MIN);
    return baseKnockback * multiplier;
}

/**
 * Calculate knockback end position
 */
export function calculateKnockbackEndPosition(
    attackerX: number,
    attackerY: number,
    targetX: number,
    targetY: number,
    knockbackDistance: number
): { x: number; y: number } {
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
    endX = Math.max(margin, Math.min(SERVER_CONFIG.WORLD.WIDTH - margin, endX));
    endY = Math.max(margin, Math.min(SERVER_CONFIG.WORLD.HEIGHT - margin, endY));

    return { x: endX, y: endY };
}
