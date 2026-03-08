/**
 * @fileoverview Tests for shared/combat.ts
 * Contains combat utility functions for damage and death handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { checkAndHandleDeath, KilledPlayerInfo } from '../../shared/combat';

interface MockPlayer {
    currentHP: number;
    maxHP: number;
    isDead: boolean;
    deathTime: number | null;
}

describe('shared/combat', () => {
    describe('checkAndHandleDeath', () => {
        let mockPlayer: MockPlayer;
        let killedPlayers: KilledPlayerInfo[];
        let attackerId: string;
        let respawnDelay: number;

        beforeEach(() => {
            mockPlayer = {
                currentHP: 100,
                maxHP: 100,
                isDead: false,
                deathTime: null,
            };
            killedPlayers = [];
            attackerId = 'attacker-socket-id';
            respawnDelay = 3000;
        });

        it('should not mark player as dead if HP > 0', () => {
            mockPlayer.currentHP = 50;

            checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(mockPlayer.isDead).toBe(false);
            expect(mockPlayer.deathTime).toBeNull();
            expect(killedPlayers).toHaveLength(0);
        });

        it('should mark player as dead if HP <= 0', () => {
            mockPlayer.currentHP = 0;

            checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(mockPlayer.isDead).toBe(true);
            expect(mockPlayer.deathTime).not.toBeNull();
            expect(killedPlayers).toHaveLength(1);
        });

        it('should add correct death info to killedPlayers array', () => {
            mockPlayer.currentHP = 0;
            const playerId = 'victim-socket-id';

            checkAndHandleDeath(mockPlayer, playerId, attackerId, killedPlayers, respawnDelay);

            expect(killedPlayers[0]).toEqual({
                playerId: playerId,
                killedBy: attackerId,
                respawnDelay: respawnDelay,
            });
        });

        it('should not double-kill already dead player', () => {
            mockPlayer.currentHP = 0;
            mockPlayer.isDead = true;
            mockPlayer.deathTime = Date.now() - 1000; // Already dead for 1 second

            checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            // Should not add to killedPlayers again
            expect(killedPlayers).toHaveLength(0);
        });

        it('should handle negative HP (overkill)', () => {
            mockPlayer.currentHP = -50;

            checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(mockPlayer.isDead).toBe(true);
            expect(killedPlayers).toHaveLength(1);
        });

        it('should set deathTime to current timestamp', () => {
            mockPlayer.currentHP = 0;
            const beforeTime = Date.now();

            checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            const afterTime = Date.now();
            expect(mockPlayer.deathTime).toBeGreaterThanOrEqual(beforeTime);
            expect(mockPlayer.deathTime).toBeLessThanOrEqual(afterTime);
        });

        it('should return true if death occurred', () => {
            mockPlayer.currentHP = 0;

            const result = checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(result).toBe(true);
        });

        it('should return false if no death occurred (HP > 0)', () => {
            mockPlayer.currentHP = 10;

            const result = checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(result).toBe(false);
        });

        it('should return false if player was already dead', () => {
            mockPlayer.currentHP = 0;
            mockPlayer.isDead = true;

            const result = checkAndHandleDeath(mockPlayer, 'player-1', attackerId, killedPlayers, respawnDelay);

            expect(result).toBe(false);
        });
    });
});
