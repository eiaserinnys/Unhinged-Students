/**
 * @fileoverview Shared geometry utility functions
 * Used by server (combatHandler, validation) for distance and collision calculations
 */

/**
 * Calculate Euclidean distance between two points
 * @param {number} x1 - First point X coordinate
 * @param {number} y1 - First point Y coordinate
 * @param {number} x2 - Second point X coordinate
 * @param {number} y2 - Second point Y coordinate
 * @returns {number} Distance between the two points
 */
function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Line-circle collision detection for laser beam
 * Returns true if the line segment intersects the circle
 * @param {number} x1 - Line start X
 * @param {number} y1 - Line start Y
 * @param {number} x2 - Line end X
 * @param {number} y2 - Line end Y
 * @param {number} cx - Circle center X
 * @param {number} cy - Circle center Y
 * @param {number} r - Circle radius
 * @returns {boolean} True if line intersects circle
 */
function lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
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

module.exports = {
    calculateDistance,
    lineCircleIntersect,
};
