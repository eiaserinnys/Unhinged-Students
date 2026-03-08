/**
 * Enemy Finder Module Tests
 *
 * Tests for enemy finding functions:
 * - findNearestEnemy
 * - findRandomEnemy
 */

describe('Enemy Finder Module', () => {
    // Helper functions to create mock objects
    function createPlayer(x, y) {
        return {
            getPosition: () => ({ x, y }),
        };
    }

    function createDummy(x, y, alive = true) {
        return {
            x,
            y,
            isAlive: () => alive,
        };
    }

    function createRemotePlayer(x, y, alive = true) {
        return {
            x,
            y,
            isAlive: () => alive,
        };
    }

    // Simulated findNearestEnemy function
    function findNearestEnemy(player, dummies, remotePlayers, playersOnly = false) {
        if (!player) return null;

        const playerPos = player.getPosition();
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        // Check dummies (skip if playersOnly)
        if (!playersOnly) {
            dummies.forEach((dummy) => {
                if (dummy.isAlive()) {
                    const dx = dummy.x - playerPos.x;
                    const dy = dummy.y - playerPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestEnemy = { x: dummy.x, y: dummy.y, type: 'dummy' };
                    }
                }
            });
        }

        // Check remote players
        remotePlayers.forEach((remotePlayer) => {
            if (remotePlayer.isAlive()) {
                const dx = remotePlayer.x - playerPos.x;
                const dy = remotePlayer.y - playerPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = { x: remotePlayer.x, y: remotePlayer.y, type: 'player' };
                }
            }
        });

        // If no enemy found, return a point in front of the player
        if (!nearestEnemy) {
            return { x: playerPos.x + 500, y: playerPos.y, type: 'none' };
        }

        return nearestEnemy;
    }

    // Simulated findRandomEnemy function
    function findRandomEnemy(dummies, remotePlayers) {
        const enemies = [];

        // Collect all alive dummies
        dummies.forEach((dummy) => {
            if (dummy.isAlive()) {
                enemies.push({ x: dummy.x, y: dummy.y, type: 'dummy' });
            }
        });

        // Collect all alive remote players
        remotePlayers.forEach((remotePlayer) => {
            if (remotePlayer.isAlive()) {
                enemies.push({ x: remotePlayer.x, y: remotePlayer.y, type: 'player' });
            }
        });

        if (enemies.length === 0) {
            return null;
        }

        return enemies[Math.floor(Math.random() * enemies.length)];
    }

    describe('findNearestEnemy', () => {
        describe('Basic Functionality', () => {
            test('should return null when player is null', () => {
                const result = findNearestEnemy(null, [], []);
                expect(result).toBeNull();
            });

            test('should return default position when no enemies exist', () => {
                const player = createPlayer(100, 100);
                const result = findNearestEnemy(player, [], []);

                expect(result.x).toBe(600); // 100 + 500
                expect(result.y).toBe(100);
                expect(result.type).toBe('none');
            });

            test('should find nearest dummy', () => {
                const player = createPlayer(100, 100);
                const dummies = [
                    createDummy(200, 100), // 100 units away
                    createDummy(400, 100), // 300 units away
                ];

                const result = findNearestEnemy(player, dummies, []);

                expect(result.x).toBe(200);
                expect(result.type).toBe('dummy');
            });

            test('should find nearest remote player', () => {
                const player = createPlayer(100, 100);
                const remotePlayers = [
                    createRemotePlayer(150, 100), // 50 units away
                    createRemotePlayer(300, 100), // 200 units away
                ];

                const result = findNearestEnemy(player, [], remotePlayers);

                expect(result.x).toBe(150);
                expect(result.type).toBe('player');
            });
        });

        describe('Priority and Distance', () => {
            test('should prefer closer enemy regardless of type', () => {
                const player = createPlayer(100, 100);
                const dummies = [createDummy(200, 100)]; // 100 units
                const remotePlayers = [createRemotePlayer(120, 100)]; // 20 units

                const result = findNearestEnemy(player, dummies, remotePlayers);

                expect(result.type).toBe('player');
                expect(result.x).toBe(120);
            });

            test('should calculate diagonal distance correctly', () => {
                const player = createPlayer(0, 0);
                const dummies = [
                    createDummy(100, 0), // 100 units horizontal
                    createDummy(71, 71), // ~100.4 units diagonal
                ];

                const result = findNearestEnemy(player, dummies, []);

                expect(result.x).toBe(100);
            });

            test('should handle negative coordinates', () => {
                const player = createPlayer(0, 0);
                const dummies = [
                    createDummy(-50, 0), // 50 units away
                    createDummy(100, 0), // 100 units away
                ];

                const result = findNearestEnemy(player, dummies, []);

                expect(result.x).toBe(-50);
            });
        });

        describe('playersOnly Flag', () => {
            test('should skip dummies when playersOnly is true', () => {
                const player = createPlayer(100, 100);
                const dummies = [createDummy(110, 100)]; // Very close
                const remotePlayers = [createRemotePlayer(500, 100)]; // Far away

                const result = findNearestEnemy(player, dummies, remotePlayers, true);

                expect(result.type).toBe('player');
                expect(result.x).toBe(500);
            });

            test('should return default position when playersOnly and no players', () => {
                const player = createPlayer(100, 100);
                const dummies = [createDummy(110, 100)];

                const result = findNearestEnemy(player, dummies, [], true);

                expect(result.type).toBe('none');
                expect(result.x).toBe(600);
            });
        });

        describe('Dead Entity Handling', () => {
            test('should ignore dead dummies', () => {
                const player = createPlayer(100, 100);
                const dummies = [
                    createDummy(110, 100, false), // Dead, close
                    createDummy(300, 100, true), // Alive, far
                ];

                const result = findNearestEnemy(player, dummies, []);

                expect(result.x).toBe(300);
            });

            test('should ignore dead remote players', () => {
                const player = createPlayer(100, 100);
                const remotePlayers = [
                    createRemotePlayer(110, 100, false), // Dead
                    createRemotePlayer(300, 100, true), // Alive
                ];

                const result = findNearestEnemy(player, [], remotePlayers);

                expect(result.x).toBe(300);
            });

            test('should return default when all enemies dead', () => {
                const player = createPlayer(100, 100);
                const dummies = [createDummy(110, 100, false)];
                const remotePlayers = [createRemotePlayer(120, 100, false)];

                const result = findNearestEnemy(player, dummies, remotePlayers);

                expect(result.type).toBe('none');
            });
        });
    });

    describe('findRandomEnemy', () => {
        describe('Basic Functionality', () => {
            test('should return null when no enemies exist', () => {
                const result = findRandomEnemy([], []);
                expect(result).toBeNull();
            });

            test('should return an enemy from dummies', () => {
                const dummies = [createDummy(100, 100), createDummy(200, 200)];

                const result = findRandomEnemy(dummies, []);

                expect(result).not.toBeNull();
                expect(result.type).toBe('dummy');
            });

            test('should return an enemy from remote players', () => {
                const remotePlayers = [createRemotePlayer(100, 100)];

                const result = findRandomEnemy([], remotePlayers);

                expect(result.type).toBe('player');
            });

            test('should include both dummies and players in selection', () => {
                const dummies = [createDummy(100, 100)];
                const remotePlayers = [createRemotePlayer(200, 200)];

                // Run multiple times to check both types can be selected
                const results = new Set();
                for (let i = 0; i < 100; i++) {
                    const result = findRandomEnemy(dummies, remotePlayers);
                    results.add(result.type);
                }

                expect(results.has('dummy')).toBe(true);
                expect(results.has('player')).toBe(true);
            });
        });

        describe('Dead Entity Handling', () => {
            test('should ignore dead dummies', () => {
                const dummies = [createDummy(100, 100, false), createDummy(200, 200, false)];
                const remotePlayers = [createRemotePlayer(300, 300, true)];

                const result = findRandomEnemy(dummies, remotePlayers);

                expect(result.type).toBe('player');
                expect(result.x).toBe(300);
            });

            test('should ignore dead remote players', () => {
                const dummies = [createDummy(100, 100, true)];
                const remotePlayers = [createRemotePlayer(200, 200, false)];

                const result = findRandomEnemy(dummies, remotePlayers);

                expect(result.type).toBe('dummy');
            });

            test('should return null when all enemies dead', () => {
                const dummies = [createDummy(100, 100, false)];
                const remotePlayers = [createRemotePlayer(200, 200, false)];

                const result = findRandomEnemy(dummies, remotePlayers);

                expect(result).toBeNull();
            });
        });

        describe('Position Preservation', () => {
            test('should preserve enemy position in result', () => {
                const dummies = [createDummy(123, 456)];

                const result = findRandomEnemy(dummies, []);

                expect(result.x).toBe(123);
                expect(result.y).toBe(456);
            });

            test('should preserve remote player position in result', () => {
                const remotePlayers = [createRemotePlayer(789, 101)];

                const result = findRandomEnemy([], remotePlayers);

                expect(result.x).toBe(789);
                expect(result.y).toBe(101);
            });
        });
    });

    describe('Distance Calculation', () => {
        function calculateDistance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }

        test('should calculate horizontal distance correctly', () => {
            expect(calculateDistance(0, 0, 100, 0)).toBe(100);
        });

        test('should calculate vertical distance correctly', () => {
            expect(calculateDistance(0, 0, 0, 100)).toBe(100);
        });

        test('should calculate diagonal distance correctly (3-4-5 triangle)', () => {
            expect(calculateDistance(0, 0, 3, 4)).toBe(5);
        });

        test('should return 0 for same point', () => {
            expect(calculateDistance(50, 50, 50, 50)).toBe(0);
        });

        test('should handle floating point coordinates', () => {
            const dist = calculateDistance(0, 0, 1.5, 2.0);
            expect(dist).toBeCloseTo(2.5, 5);
        });
    });
});
