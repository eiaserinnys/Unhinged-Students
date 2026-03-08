// Main Entry Point - Unhinged Students
// This file imports all modules and initializes the game

// Core modules
import './config.js';
import './utils/logger.js';
import './core/gameState.js';

// Input and UI
import './input.js';
import './rendering/uiRenderer.js';

// Character system
import './characterUtils.js';
import './character.js';
import './lobby.js';

// Game systems
import './shard.js';
import './skill.js';
import './chat.js';

// Combat
import './combat/enemyFinder.js';

// Network (imports effects and all network components)
import './network/index.js';

// Main game logic (must be last - depends on all other modules)
import './game.js';

console.log('[main.js] All modules loaded');
