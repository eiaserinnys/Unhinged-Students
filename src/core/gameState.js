/**
 * Game State Module
 *
 * Central game state object exposed as window.gameState
 * This module should be loaded before other game modules
 */

// Canvas setup - will be initialized by game.js
let canvas = null;
let ctx = null;

// Game world constants (16:9 aspect ratio) - from config
const GAME_WIDTH = GAME_CONFIG.WORLD.WIDTH;
const GAME_HEIGHT = GAME_CONFIG.WORLD.HEIGHT;

// Viewport/scaling variables
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Store event handler references for cleanup
let resizeHandler = null;
let loadHandler = null;

// Game state
const gameState = {
    screen: 'lobby', // 'lobby' | 'playing'
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
        shardsCollected: 0
    },
    lastFrameTime: 0,
    deltaTime: 0,
    lastAttackSentTime: 0, // Track last attack sent to server
    // Hit vignette effect
    hitVignetteTime: 0,
    hitVignetteDuration: GAME_CONFIG.EFFECTS.HIT_VIGNETTE_DURATION_MS,
    // Player selection from lobby
    selectedCharacter: 'alien',
    playerName: 'Player'
};

// Expose to global scope for other modules
window.gameState = gameState;
window.GAME_WIDTH = GAME_WIDTH;
window.GAME_HEIGHT = GAME_HEIGHT;

// Getter/setter functions for viewport variables
function getScale() { return scale; }
function setScale(value) { scale = value; }
function getOffsetX() { return offsetX; }
function setOffsetX(value) { offsetX = value; }
function getOffsetY() { return offsetY; }
function setOffsetY(value) { offsetY = value; }

// Canvas getters/setters
function getCanvas() { return canvas; }
function setCanvas(c) { canvas = c; }
function getCtx() { return ctx; }
function setCtx(c) { ctx = c; }

// Event handler getters/setters
function getResizeHandler() { return resizeHandler; }
function setResizeHandler(handler) { resizeHandler = handler; }
function getLoadHandler() { return loadHandler; }
function setLoadHandler(handler) { loadHandler = handler; }

// Expose viewport functions to global scope
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
