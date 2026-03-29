/**
 * @fileoverview Combat handlers entry point
 * Routes combat events to specialized handlers
 */
import { registerBasicAttackHandlers } from './basicAttack';
import { registerTeleportHandlers } from './teleportHandler';
import { registerLaserHandlers } from './laserHandler';
import { registerTelepathyHandlers } from './telepathyHandler';
import { registerWaveHandlers } from './waveHandler';
import { registerMadnessHandlers } from './madnessHandler';
import { registerPotSmashHandlers } from './potSmashHandler';
import { registerCurryHandlers } from './curryHandler';
import { registerSpinThrowHandlers } from './spinThrowHandler';
import { registerRageHandlers } from './rageHandler';
import { registerRatIllusionHandlers } from './ratIllusionHandler';
import { registerSleepPowderHandlers } from './sleepPowderHandler';
import { registerRatBombHandlers } from './ratBombHandler';
import { registerDollHugHandlers } from './dollHugHandler';
import { registerRatReviveHandlers } from './ratReviveHandler';
import type { TypedSocket, TypedServer } from '../../types';

/**
 * Register all combat event handlers
 */
export function registerCombatHandlers(socket: TypedSocket, io: TypedServer): void {
    registerBasicAttackHandlers(socket, io);
    registerTeleportHandlers(socket, io);
    registerLaserHandlers(socket, io);
    registerTelepathyHandlers(socket, io);
    registerWaveHandlers(socket, io);
    registerMadnessHandlers(socket, io);
    registerPotSmashHandlers(socket, io);
    registerCurryHandlers(socket, io);
    registerSpinThrowHandlers(socket, io);
    registerRageHandlers(socket, io);
    registerRatIllusionHandlers(socket, io);
    registerSleepPowderHandlers(socket, io);
    registerRatBombHandlers(socket, io);
    registerDollHugHandlers(socket, io);
    registerRatReviveHandlers(socket, io);
}
