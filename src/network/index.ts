// Network Module - Entry Point
// This file re-exports all network components for easy importing

// Effects
export { LaserEffectMixin } from './effects/laser.js';
export type { LaserEffectState, LaserPhase } from './effects/laser.js';

export { TeleportEffectMixin, TelepathyEffectMixin } from './effects/teleport.js';
export type {
    TeleportEffectState,
    TelepathyEffectState,
    TeleportPhase,
} from './effects/teleport.js';

export { WaveEffectMixin } from './effects/wave.js';
export type { WaveEffectState } from './effects/wave.js';

export { PotSmashEffectMixin } from './effects/potSmash.js';
export type { PotSmashEffectState } from './effects/potSmash.js';

export { CurryRecoveryEffectMixin } from './effects/curryRecovery.js';
export type { CurryRecoveryEffectState } from './effects/curryRecovery.js';

export { SpinThrowEffectMixin } from './effects/spinThrow.js';
export type { SpinThrowEffectState } from './effects/spinThrow.js';

export { RageEffectMixin } from './effects/rage.js';
export type { RageEffectState } from './effects/rage.js';

// UI
export { ReconnectUI } from './ReconnectUI.js';

// Core
export { RemotePlayer } from './RemotePlayer.js';
export { NetworkManager } from './NetworkManager.js';

console.log('[Network] All components loaded successfully');
