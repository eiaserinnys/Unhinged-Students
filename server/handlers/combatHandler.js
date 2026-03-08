/**
 * @fileoverview Combat handlers wrapper
 * Re-exports from modular combat handlers for backward compatibility
 */
const { registerCombatHandlers } = require('./combat');

module.exports = { registerCombatHandlers };
