/**
 * @fileoverview Combat handlers entry point
 * Routes combat events to specialized handlers
 */
const { registerBasicAttackHandlers } = require('./basicAttack');
const { registerTeleportHandlers } = require('./teleportHandler');
const { registerLaserHandlers } = require('./laserHandler');
const { registerTelepathyHandlers } = require('./telepathyHandler');

/**
 * Register all combat event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function registerCombatHandlers(socket, io) {
    registerBasicAttackHandlers(socket, io);
    registerTeleportHandlers(socket, io);
    registerLaserHandlers(socket, io);
    registerTelepathyHandlers(socket, io);
}

module.exports = { registerCombatHandlers };
