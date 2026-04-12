/**
 * Game State Module
 *
 * Central game state object exposed as window.gameState
 * This module should be loaded before other game modules
 */

import { GAME_CONFIG } from '../config.js';
import type { GameState, CharacterType } from '../types/index.js';

// Canvas setup - will be initialized by game.js
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

// Game world constants (16:9 aspect ratio) - from config
export const GAME_WIDTH: number = GAME_CONFIG.WORLD.WIDTH;
export const GAME_HEIGHT: number = GAME_CONFIG.WORLD.HEIGHT;

// Viewport/scaling variables
let scale: number = 1;
let offsetX: number = 0;
let offsetY: number = 0;

// Store event handler references for cleanup
let resizeHandler: (() => void) | null = null;
let loadHandler: (() => void) | null = null;

// Game state
export const gameState: GameState = {
    screen: 'lobby', // 'lobby' | 'waitingTeam' | 'teamAnnounce' | 'playing'
    running: false,
    player: null,
    lobbyManager: null, // Lobby UI manager
    shardManager: null,
    networkManager: null,
    chatManager: null,
    skillManager: null, // Skill system
    skillUI: null, // Skill UI renderer
    laserBeamEffect: null, // Laser beam (Q skill) effect
    teleportEffect: null, // Teleport (W skill) effect
    telepathyEffect: null, // Telepathy (E skill) effect
    dummies: [], // Test dummies for combat practice
    stats: {
        shardsCollected: 0,
    },
    lastFrameTime: 0,
    deltaTime: 0,
    lastAttackSentTime: 0, // Track last attack sent to server
    // Hit vignette effect
    hitVignetteTime: 0,
    hitVignetteDuration: GAME_CONFIG.EFFECTS.HIT_VIGNETTE_DURATION_MS,
    // Player selection from lobby
    selectedCharacter: 'alien' as CharacterType,
    playerName: 'Player',
    // Team info
    team: null, // 'red' or 'blue'
    teamAnnounceStartTime: 0,
    teamAnnounceDuration: 2500, // 2.5 seconds to show team
    // Madness walk (Crazy-Eyes E skill)
    madnessActive: false,
    madnessStartTime: 0,
    madnessDuration: 0,
    madnessLastTickTime: 0,
    madnessTickInterval: 0,
    madnessRadius: 0,
    // Curry Recovery (Curry-Bear E skill)
    storedDamage: 0,
    maxStoredDamage: GAME_CONFIG.SKILL_CURRY_RECOVERY.MAX_STORED_DAMAGE,
    curryRecoveryActive: false,
    curryRecoveryStartTime: 0,
    // Hulk Sister - Rage (폭주)
    rageActive: false,
    rageStartTime: 0,
    rageDuration: 0,
    // Hulk Sister - Passive (분노 스택)
    hulkRageStacks: 0,
    hulkLastStackTime: 0,
    // Wave effect (Crazy-Eyes Q skill)
    waveEffect: null,
    // Pot smash effect (Curry-Bear Q skill)
    potSmashEffect: null,
    // Spin throw effect (Hulk Sister Q skill)
    spinThrowEffect: null,
    // Match state (server-authoritative)
    matchRemainingMs: 0,
    matchTeamKills: { red: 0, blue: 0 },
    matchResult: null,
};

// Getter/setter functions for viewport variables
export function getScale(): number {
    return scale;
}
export function setScale(value: number): void {
    scale = value;
}
export function getOffsetX(): number {
    return offsetX;
}
export function setOffsetX(value: number): void {
    offsetX = value;
}
export function getOffsetY(): number {
    return offsetY;
}
export function setOffsetY(value: number): void {
    offsetY = value;
}

// Canvas getters/setters
export function getCanvas(): HTMLCanvasElement | null {
    return canvas;
}
export function setCanvas(c: HTMLCanvasElement): void {
    canvas = c;
}
export function getCtx(): CanvasRenderingContext2D | null {
    return ctx;
}
export function setCtx(c: CanvasRenderingContext2D): void {
    ctx = c;
}

// Event handler getters/setters
export function getResizeHandler(): (() => void) | null {
    return resizeHandler;
}
export function setResizeHandler(handler: () => void): void {
    resizeHandler = handler;
}
export function getLoadHandler(): (() => void) | null {
    return loadHandler;
}
export function setLoadHandler(handler: () => void): void {
    loadHandler = handler;
}

// Backward compatibility: expose to window
window.gameState = gameState;
window.GAME_WIDTH = GAME_WIDTH;
window.GAME_HEIGHT = GAME_HEIGHT;
window.getScale = getScale;
window.setScale = setScale;
window.getOffsetX = getOffsetX;
window.setOffsetX = setOffsetX;
window.getOffsetY = getOffsetY;
window.setOffsetY = setOffsetY;
window.getCanvas = getCanvas;
window.setCanvas = setCanvas;
window.getCtx = getCtx;
window.setCtx = setCtx;
window.getResizeHandler = getResizeHandler;
window.setResizeHandler = setResizeHandler;
window.getLoadHandler = getLoadHandler;
window.setLoadHandler = setLoadHandler;
