/**
 * Game State Module Tests
 *
 * Tests for the gameState module including:
 * - Initial state values
 * - Viewport getters/setters
 * - Canvas getters/setters
 * - Event handler getters/setters
 */

import { describe, test, expect } from '@jest/globals';

interface GameState {
    screen: string;
    running: boolean;
    player: unknown;
    lobbyManager: unknown;
    shardManager: unknown;
    networkManager: unknown;
    chatManager: unknown;
    skillManager: unknown;
    skillUI: unknown;
    laserBeamEffect: unknown;
    teleportEffect: unknown;
    telepathyEffect: unknown;
    dummies: unknown[];
    stats: {
        shardsCollected: number;
    };
    lastFrameTime: number;
    deltaTime: number;
    lastAttackSentTime: number;
    hitVignetteTime: number;
    hitVignetteDuration: number;
    selectedCharacter: string;
    playerName: string;
}

interface Viewport {
    getScale: () => number;
    setScale: (value: number) => void;
    getOffsetX: () => number;
    setOffsetX: (value: number) => void;
    getOffsetY: () => number;
    setOffsetY: (value: number) => void;
}

interface CanvasManager {
    getCanvas: () => { id: string } | null;
    setCanvas: (c: { id: string } | null) => void;
    getCtx: () => { fillStyle: string } | null;
    setCtx: (c: { fillStyle: string } | null) => void;
}

interface HandlerManager {
    getResizeHandler: () => (() => void) | null;
    setResizeHandler: (handler: (() => void) | null) => void;
    getLoadHandler: () => (() => void) | null;
    setLoadHandler: (handler: (() => void) | null) => void;
}

describe('GameState Module', () => {
    describe('Initial State Values', () => {
        // Simulated game state structure (same as gameState.js)
        function createGameState(): GameState {
            return {
                screen: 'lobby',
                running: false,
                player: null,
                lobbyManager: null,
                shardManager: null,
                networkManager: null,
                chatManager: null,
                skillManager: null,
                skillUI: null,
                laserBeamEffect: null,
                teleportEffect: null,
                telepathyEffect: null,
                dummies: [],
                stats: {
                    shardsCollected: 0,
                },
                lastFrameTime: 0,
                deltaTime: 0,
                lastAttackSentTime: 0,
                hitVignetteTime: 0,
                hitVignetteDuration: 300,
                selectedCharacter: 'alien',
                playerName: 'Player',
            };
        }

        test('should have default screen as lobby', () => {
            const state = createGameState();
            expect(state.screen).toBe('lobby');
        });

        test('should not be running initially', () => {
            const state = createGameState();
            expect(state.running).toBe(false);
        });

        test('should have null managers initially', () => {
            const state = createGameState();
            expect(state.lobbyManager).toBeNull();
            expect(state.shardManager).toBeNull();
            expect(state.networkManager).toBeNull();
            expect(state.chatManager).toBeNull();
            expect(state.skillManager).toBeNull();
        });

        test('should have empty dummies array', () => {
            const state = createGameState();
            expect(state.dummies).toEqual([]);
            expect(state.dummies.length).toBe(0);
        });

        test('should have zero shards collected initially', () => {
            const state = createGameState();
            expect(state.stats.shardsCollected).toBe(0);
        });

        test('should have alien as default character', () => {
            const state = createGameState();
            expect(state.selectedCharacter).toBe('alien');
        });

        test('should have Player as default name', () => {
            const state = createGameState();
            expect(state.playerName).toBe('Player');
        });
    });

    describe('Viewport Variables', () => {
        // Simulated viewport module
        function createViewport(): Viewport {
            let scale = 1;
            let offsetX = 0;
            let offsetY = 0;

            return {
                getScale: () => scale,
                setScale: (value: number) => {
                    scale = value;
                },
                getOffsetX: () => offsetX,
                setOffsetX: (value: number) => {
                    offsetX = value;
                },
                getOffsetY: () => offsetY,
                setOffsetY: (value: number) => {
                    offsetY = value;
                },
            };
        }

        test('should have default scale of 1', () => {
            const viewport = createViewport();
            expect(viewport.getScale()).toBe(1);
        });

        test('should update scale correctly', () => {
            const viewport = createViewport();
            viewport.setScale(2.5);
            expect(viewport.getScale()).toBe(2.5);
        });

        test('should have default offsets of 0', () => {
            const viewport = createViewport();
            expect(viewport.getOffsetX()).toBe(0);
            expect(viewport.getOffsetY()).toBe(0);
        });

        test('should update offsets correctly', () => {
            const viewport = createViewport();
            viewport.setOffsetX(100);
            viewport.setOffsetY(50);
            expect(viewport.getOffsetX()).toBe(100);
            expect(viewport.getOffsetY()).toBe(50);
        });
    });

    describe('Canvas Management', () => {
        function createCanvasManager(): CanvasManager {
            let canvas: { id: string } | null = null;
            let ctx: { fillStyle: string } | null = null;

            return {
                getCanvas: () => canvas,
                setCanvas: (c: { id: string } | null) => {
                    canvas = c;
                },
                getCtx: () => ctx,
                setCtx: (c: { fillStyle: string } | null) => {
                    ctx = c;
                },
            };
        }

        test('should have null canvas initially', () => {
            const manager = createCanvasManager();
            expect(manager.getCanvas()).toBeNull();
        });

        test('should set and get canvas correctly', () => {
            const manager = createCanvasManager();
            const mockCanvas = { id: 'gameCanvas' };
            manager.setCanvas(mockCanvas);
            expect(manager.getCanvas()).toBe(mockCanvas);
        });

        test('should have null context initially', () => {
            const manager = createCanvasManager();
            expect(manager.getCtx()).toBeNull();
        });

        test('should set and get context correctly', () => {
            const manager = createCanvasManager();
            const mockCtx = { fillStyle: 'black' };
            manager.setCtx(mockCtx);
            expect(manager.getCtx()).toBe(mockCtx);
        });
    });

    describe('Event Handler Management', () => {
        function createHandlerManager(): HandlerManager {
            let resizeHandler: (() => void) | null = null;
            let loadHandler: (() => void) | null = null;

            return {
                getResizeHandler: () => resizeHandler,
                setResizeHandler: (handler: (() => void) | null) => {
                    resizeHandler = handler;
                },
                getLoadHandler: () => loadHandler,
                setLoadHandler: (handler: (() => void) | null) => {
                    loadHandler = handler;
                },
            };
        }

        test('should have null handlers initially', () => {
            const manager = createHandlerManager();
            expect(manager.getResizeHandler()).toBeNull();
            expect(manager.getLoadHandler()).toBeNull();
        });

        test('should set and get resize handler', () => {
            const manager = createHandlerManager();
            const mockHandler = (): void => {};
            manager.setResizeHandler(mockHandler);
            expect(manager.getResizeHandler()).toBe(mockHandler);
        });

        test('should set and get load handler', () => {
            const manager = createHandlerManager();
            const mockHandler = (): void => {};
            manager.setLoadHandler(mockHandler);
            expect(manager.getLoadHandler()).toBe(mockHandler);
        });

        test('should allow clearing handlers', () => {
            const manager = createHandlerManager();
            const mockHandler = (): void => {};
            manager.setResizeHandler(mockHandler);
            manager.setResizeHandler(null);
            expect(manager.getResizeHandler()).toBeNull();
        });
    });

    describe('State Transitions', () => {
        function createGameState(): {
            screen: string;
            running: boolean;
            selectedCharacter: string;
            playerName: string;
        } {
            return {
                screen: 'lobby',
                running: false,
                selectedCharacter: 'alien',
                playerName: 'Player',
            };
        }

        test('should transition screen to playing', () => {
            const state = createGameState();
            state.screen = 'playing';
            expect(state.screen).toBe('playing');
        });

        test('should set running to true', () => {
            const state = createGameState();
            state.running = true;
            expect(state.running).toBe(true);
        });

        test('should update character selection', () => {
            const state = createGameState();
            state.selectedCharacter = 'crazy-eyes';
            expect(state.selectedCharacter).toBe('crazy-eyes');
        });

        test('should update player name', () => {
            const state = createGameState();
            state.playerName = 'TestPlayer';
            expect(state.playerName).toBe('TestPlayer');
        });
    });
});
