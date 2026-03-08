/**
 * @fileoverview Combat handlers entry point
 * Routes combat events to specialized handlers
 */
import { registerBasicAttackHandlers } from './basicAttack';
import { registerTeleportHandlers } from './teleportHandler';
import { registerLaserHandlers } from './laserHandler';
import { registerTelepathyHandlers } from './telepathyHandler';
import type { TypedSocket, TypedServer } from '../../types';

/**
 * Register all combat event handlers
 */
export function registerCombatHandlers(socket: TypedSocket, io: TypedServer): void {
    registerBasicAttackHandlers(socket, io);
    registerTeleportHandlers(socket, io);
    registerLaserHandlers(socket, io);
    registerTelepathyHandlers(socket, io);
}
