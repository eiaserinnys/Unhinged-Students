/**
 * @fileoverview Tests for shared/geometry.js
 * Contains geometry utility functions used by both server and potentially client
 */

const { calculateDistance, lineCircleIntersect } = require('../../shared/geometry');

describe('shared/geometry', () => {
    describe('calculateDistance', () => {
        it('should return 0 for same point', () => {
            expect(calculateDistance(100, 100, 100, 100)).toBe(0);
        });

        it('should calculate horizontal distance correctly', () => {
            expect(calculateDistance(0, 0, 100, 0)).toBe(100);
        });

        it('should calculate vertical distance correctly', () => {
            expect(calculateDistance(0, 0, 0, 100)).toBe(100);
        });

        it('should calculate diagonal distance correctly (3-4-5 triangle)', () => {
            expect(calculateDistance(0, 0, 3, 4)).toBe(5);
        });

        it('should handle negative coordinates', () => {
            expect(calculateDistance(-10, -10, 10, 10)).toBeCloseTo(28.284, 2);
        });

        it('should be commutative (order of points does not matter)', () => {
            const d1 = calculateDistance(10, 20, 50, 80);
            const d2 = calculateDistance(50, 80, 10, 20);
            expect(d1).toBe(d2);
        });

        it('should handle large coordinates', () => {
            expect(calculateDistance(0, 0, 3000, 4000)).toBe(5000);
        });

        it('should handle floating point coordinates', () => {
            const distance = calculateDistance(1.5, 2.5, 4.5, 6.5);
            expect(distance).toBe(5);
        });
    });

    describe('lineCircleIntersect', () => {
        it('should return true when line passes through circle center', () => {
            // Line from (0,0) to (100,0), circle at (50,0) with radius 10
            expect(lineCircleIntersect(0, 0, 100, 0, 50, 0, 10)).toBe(true);
        });

        it('should return true when line is tangent to circle', () => {
            // Line from (0,10) to (100,10), circle at (50,0) with radius 10
            // Line passes at y=10, circle center at y=0, radius=10 -> tangent
            expect(lineCircleIntersect(0, 10, 100, 10, 50, 0, 10)).toBe(true);
        });

        it('should return false when line misses circle completely', () => {
            // Line from (0,0) to (100,0), circle at (50,50) with radius 10
            expect(lineCircleIntersect(0, 0, 100, 0, 50, 50, 10)).toBe(false);
        });

        it('should return true when line starts inside circle', () => {
            // Line from (50,5) to (100,5), circle at (50,0) with radius 10
            expect(lineCircleIntersect(50, 5, 100, 5, 50, 0, 10)).toBe(true);
        });

        it('should return true when line ends inside circle', () => {
            // Line from (0,0) to (50,5), circle at (50,0) with radius 10
            expect(lineCircleIntersect(0, 0, 50, 5, 50, 0, 10)).toBe(true);
        });

        it('should return false when circle is beyond line segment', () => {
            // Line from (0,0) to (30,0), circle at (50,0) with radius 10
            // Line ends before reaching circle
            expect(lineCircleIntersect(0, 0, 30, 0, 50, 0, 10)).toBe(false);
        });

        it('should return false when circle is before line segment start', () => {
            // Line from (60,0) to (100,0), circle at (50,0) with radius 5
            // Line starts after circle
            expect(lineCircleIntersect(60, 0, 100, 0, 50, 0, 5)).toBe(false);
        });

        it('should handle diagonal lines', () => {
            // Diagonal line from (0,0) to (100,100), circle at (50,50) with radius 10
            expect(lineCircleIntersect(0, 0, 100, 100, 50, 50, 10)).toBe(true);
        });

        it('should handle vertical lines', () => {
            // Vertical line from (50,0) to (50,100), circle at (50,50) with radius 10
            expect(lineCircleIntersect(50, 0, 50, 100, 50, 50, 10)).toBe(true);
        });

        it('should handle zero-length line (point)', () => {
            // Point at (50,50), circle at (50,50) with radius 10
            expect(lineCircleIntersect(50, 50, 50, 50, 50, 50, 10)).toBe(true);
        });

        it('should return false for zero-length line outside circle', () => {
            // Point at (0,0), circle at (50,50) with radius 10
            expect(lineCircleIntersect(0, 0, 0, 0, 50, 50, 10)).toBe(false);
        });
    });
});
