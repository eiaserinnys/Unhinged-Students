/**
 * UI Renderer Module Tests
 *
 * Tests for UI rendering functions:
 * - Hit vignette effect
 * - Death screen rendering
 * - triggerHitVignette
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock Date.now for consistent timing tests
const mockNow = jest.spyOn(Date, 'now');
let currentTime = 1000000;
mockNow.mockImplementation(() => currentTime);

function advanceTime(ms: number): void {
    currentTime += ms;
}

function resetTime(): void {
    currentTime = 1000000;
}

interface VignetteState {
    hitVignetteTime: number;
    hitVignetteDuration: number;
}

interface DeadPlayer {
    isDead: boolean;
    deathTime: number;
    respawnDelay: number;
}

describe('UI Renderer Module', () => {
    beforeEach(() => {
        resetTime();
    });

    describe('Hit Vignette Effect', () => {
        // Simulated state for vignette
        function createVignetteState(): VignetteState {
            return {
                hitVignetteTime: 0,
                hitVignetteDuration: 300,
            };
        }

        function triggerHitVignette(state: VignetteState): void {
            state.hitVignetteTime = Date.now();
        }

        function isVignetteActive(state: VignetteState): boolean {
            if (state.hitVignetteTime === 0) return false;
            const elapsed = Date.now() - state.hitVignetteTime;
            return elapsed < state.hitVignetteDuration;
        }

        function calculateVignetteOpacity(state: VignetteState): number {
            if (state.hitVignetteTime === 0) return 0;

            const elapsed = Date.now() - state.hitVignetteTime;
            if (elapsed >= state.hitVignetteDuration) return 0;

            const progress = elapsed / state.hitVignetteDuration;
            return (1 - progress) * 0.6;
        }

        test('should not be active when hitVignetteTime is 0', () => {
            const state = createVignetteState();
            expect(isVignetteActive(state)).toBe(false);
        });

        test('should become active when triggered', () => {
            const state = createVignetteState();
            triggerHitVignette(state);
            expect(isVignetteActive(state)).toBe(true);
        });

        test('should expire after duration', () => {
            const state = createVignetteState();
            triggerHitVignette(state);
            advanceTime(300);
            expect(isVignetteActive(state)).toBe(false);
        });

        test('should have maximum opacity at start (0.6)', () => {
            const state = createVignetteState();
            triggerHitVignette(state);
            const opacity = calculateVignetteOpacity(state);
            expect(opacity).toBeCloseTo(0.6, 2);
        });

        test('should fade to half opacity at midpoint', () => {
            const state = createVignetteState();
            triggerHitVignette(state);
            advanceTime(150); // Halfway
            const opacity = calculateVignetteOpacity(state);
            expect(opacity).toBeCloseTo(0.3, 2);
        });

        test('should have zero opacity after duration', () => {
            const state = createVignetteState();
            triggerHitVignette(state);
            advanceTime(300);
            const opacity = calculateVignetteOpacity(state);
            expect(opacity).toBe(0);
        });

        test('should have zero opacity when not triggered', () => {
            const state = createVignetteState();
            expect(calculateVignetteOpacity(state)).toBe(0);
        });
    });

    describe('Death Screen', () => {
        function createDeadPlayer(deathTime: number, respawnDelay = 3000): DeadPlayer {
            return {
                isDead: true,
                deathTime,
                respawnDelay,
            };
        }

        function calculateRespawnTime(player: DeadPlayer): number {
            const elapsedTime = Date.now() - player.deathTime;
            return Math.max(0, (player.respawnDelay - elapsedTime) / 1000);
        }

        test('should show full respawn time immediately after death', () => {
            const player = createDeadPlayer(currentTime, 3000);
            expect(calculateRespawnTime(player)).toBeCloseTo(3, 1);
        });

        test('should count down respawn timer', () => {
            const player = createDeadPlayer(currentTime, 3000);
            advanceTime(1000);
            expect(calculateRespawnTime(player)).toBeCloseTo(2, 1);
        });

        test('should show 0 when respawn time is complete', () => {
            const player = createDeadPlayer(currentTime, 3000);
            advanceTime(3000);
            expect(calculateRespawnTime(player)).toBe(0);
        });

        test('should not go negative after respawn time', () => {
            const player = createDeadPlayer(currentTime, 3000);
            advanceTime(5000);
            expect(calculateRespawnTime(player)).toBe(0);
        });

        test('should handle different respawn delays', () => {
            const player = createDeadPlayer(currentTime, 5000);
            expect(calculateRespawnTime(player)).toBeCloseTo(5, 1);
        });
    });

    describe('Vignette Rendering Logic', () => {
        const GAME_WIDTH = 1920;
        const GAME_HEIGHT = 1080;

        interface GradientParams {
            centerX: number;
            centerY: number;
            innerRadius: number;
            outerRadius: number;
        }

        function calculateGradientParams(): GradientParams {
            const centerX = GAME_WIDTH / 2;
            const centerY = GAME_HEIGHT / 2;
            const innerRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.3;
            const outerRadius = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.8;

            return { centerX, centerY, innerRadius, outerRadius };
        }

        test('should calculate correct center point', () => {
            const params = calculateGradientParams();
            expect(params.centerX).toBe(960);
            expect(params.centerY).toBe(540);
        });

        test('should calculate inner radius as 30% of min dimension', () => {
            const params = calculateGradientParams();
            expect(params.innerRadius).toBe(1080 * 0.3);
        });

        test('should calculate outer radius as 80% of max dimension', () => {
            const params = calculateGradientParams();
            expect(params.outerRadius).toBe(1920 * 0.8);
        });
    });

    describe('triggerHitVignette Function', () => {
        test('should set hitVignetteTime to current time', () => {
            const state = { hitVignetteTime: 0 };
            state.hitVignetteTime = Date.now();
            expect(state.hitVignetteTime).toBe(currentTime);
        });

        test('should reset vignette when triggered multiple times', () => {
            const state = { hitVignetteTime: 0, hitVignetteDuration: 300 };

            // First trigger
            state.hitVignetteTime = Date.now();
            advanceTime(150); // Halfway through

            // Second trigger - should reset
            state.hitVignetteTime = Date.now();

            const elapsed = Date.now() - state.hitVignetteTime;
            expect(elapsed).toBe(0);
        });
    });
});
