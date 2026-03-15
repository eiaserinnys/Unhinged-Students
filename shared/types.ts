/**
 * @fileoverview Shared type definitions
 * Types used by both server and client code via shared/ modules
 */

export interface KilledPlayerInfo {
    playerId: string;
    killedBy: string;
    respawnDelay: number;
}
