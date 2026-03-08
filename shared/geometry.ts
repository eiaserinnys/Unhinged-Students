/**
 * @fileoverview Shared geometry utility functions
 * Used by server (combatHandler, validation) for distance and collision calculations
 */

/**
 * Calculate Euclidean distance between two points
 * @param x1 - First point X coordinate
 * @param y1 - First point Y coordinate
 * @param x2 - Second point X coordinate
 * @param y2 - Second point Y coordinate
 * @returns Distance between the two points
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Line-circle collision detection for laser beam
 * Returns true if the line segment intersects the circle
 * @param x1 - Line start X
 * @param y1 - Line start Y
 * @param x2 - Line end X
 * @param y2 - Line end Y
 * @param cx - Circle center X
 * @param cy - Circle center Y
 * @param r - Circle radius
 * @returns True if line intersects circle
 */
export function lineCircleIntersect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    r: number
): boolean {
    // Vector from line start to circle center
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    // Handle zero-length line (point)
    if (a === 0) {
        // Check if the point is inside the circle
        return c <= 0;
    }

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    // Check if intersection is within the line segment
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);

    // Check if either intersection point is within the segment (0 <= t <= 1)
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}
