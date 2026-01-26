// ========================================
// COMBAT EVENT HANDLERS
// ========================================
const logger = require('../../logger');
const {
    SERVER_CONFIG,
    ATTACK_POWER,
    ATTACK_RANGE,
    TELEPORT_MAX_DISTANCE,
    TELEPORT_DAMAGE_RADIUS,
    TELEPORT_DAMAGE,
    LASER_DAMAGE,
    LASER_MAX_LENGTH,
    TELEPATHY_RADIUS,
    TELEPATHY_DAMAGE_PER_TICK,
    TELEPATHY_MAX_HEAL_PER_TICK,
    RATE_LIMIT_ATTACK,
    PLAYER_RESPAWN_DELAY,
} = require('../config');
const {
    isValidNumber,
    clampCoordinates,
    calculateDistance,
    calculateKnockbackDistance,
    calculateKnockbackEndPosition,
    lineCircleIntersect,
} = require('../validation');
const {
    players,
    dummies,
    rateLimit,
} = require('../gameState');

function registerCombatHandlers(socket, io) {
    // Handle player attack
    socket.on('playerAttack', (data) => {
        // === RATE LIMITING ===
        if (!rateLimit(socket.id, 'attack', RATE_LIMIT_ATTACK)) {
            return; // Attack on cooldown, silently ignore
        }

        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot attack
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y to prevent remote attack hacks)
        const attackX = attacker.x;
        const attackY = attacker.y;

        // IGNORE client range/power values - use server constants (anti-cheat)
        const attackRange = ATTACK_RANGE;
        const attackPower = ATTACK_POWER;

        // Log if client sent suspicious values
        if (data.range && data.range > ATTACK_RANGE * 1.1) {
            logger.cheat(`Suspicious attack range from ${socket.id}: ${data.range} (server: ${ATTACK_RANGE})`);
        }
        if (data.power && data.power > ATTACK_POWER * 1.1) {
            logger.cheat(`Suspicious attack power from ${socket.id}: ${data.power} (server: ${ATTACK_POWER})`);
        }

        // Broadcast attack to all other players (for visual effect)
        socket.broadcast.emit('playerAttacked', {
            playerId: socket.id,
            x: attackX,
            y: attackY,
            range: attackRange
        });

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself
            if (player.isDead) return; // Skip dead players

            // Calculate distance from attacker position
            const dx = player.x - attackX;
            const dy = player.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range (server-authoritative range)
            if (distance <= attackRange) {
                // Apply damage (server-authoritative power)
                player.currentHP = Math.max(0, player.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, player.x, player.y, knockbackDist);

                // Update player position to knockback end (server-authoritative)
                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                logger.debug(`${socket.id} hit ${playerId} for ${attackPower} damage (HP: ${player.currentHP}/${player.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Check if player died
                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    logger.info(`${playerId} has been killed by ${socket.id}!`);
                }
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        // Broadcast deaths to all players
        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check all dummies in range
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return; // Skip dead dummies

            // Calculate distance
            const dx = dummy.x - attackX;
            const dy = dummy.y - attackY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if in range (consider dummy size ~135px, half = 67.5)
            if (distance <= attackRange + 67.5) {
                // Apply damage
                dummy.currentHP = Math.max(0, dummy.currentHP - attackPower);

                // Calculate knockback
                const knockbackDist = calculateKnockbackDistance(attackRange, distance);
                const knockbackEnd = calculateKnockbackEndPosition(attackX, attackY, dummy.x, dummy.y, knockbackDist);

                // Update dummy position to knockback end (server-authoritative)
                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: attackX,
                    attackerY: attackY
                });

                logger.debug(`${socket.id} hit ${dummy.name} for ${attackPower} damage (HP: ${dummy.currentHP}/${dummy.maxHP}), knockback to (${knockbackEnd.x.toFixed(1)}, ${knockbackEnd.y.toFixed(1)})`);

                // Mark death time if killed
                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated!`);
                }
            }
        });

        // Broadcast dummy damage to all players
        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle teleport (sync with other players)
    socket.on('teleport', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Dead players cannot teleport
        if (player.isDead) return;

        // === INPUT VALIDATION ===
        // Validate coordinate types
        if (!isValidNumber(data.startX) || !isValidNumber(data.startY) ||
            !isValidNumber(data.endX) || !isValidNumber(data.endY)) {
            logger.cheat(`Invalid teleport coordinates from ${socket.id}`);
            return;
        }

        // Use server-side start position (prevent start position spoofing)
        const startX = player.x;
        const startY = player.y;

        // Validate end position
        let endX = data.endX;
        let endY = data.endY;

        // Check teleport distance (anti-cheat: limit max teleport distance)
        const teleportDistance = calculateDistance(startX, startY, endX, endY);
        if (teleportDistance > TELEPORT_MAX_DISTANCE * 1.2) { // Allow 20% tolerance
            logger.cheat(`Teleport distance exceeded from ${socket.id}: ${teleportDistance.toFixed(1)}px (max: ${TELEPORT_MAX_DISTANCE}px)`);
            // Clamp to max distance
            const angle = Math.atan2(endY - startY, endX - startX);
            endX = startX + Math.cos(angle) * TELEPORT_MAX_DISTANCE;
            endY = startY + Math.sin(angle) * TELEPORT_MAX_DISTANCE;
        }

        // Clamp to game bounds
        const clamped = clampCoordinates(endX, endY);
        endX = clamped.x;
        endY = clamped.y;

        // Broadcast teleport to all other players
        socket.broadcast.emit('playerTeleport', {
            playerId: socket.id,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        });

        // Update player position on server
        player.x = endX;
        player.y = endY;
    });

    // Handle teleport damage
    socket.on('teleportDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot deal damage
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y)
        const x = attacker.x;
        const y = attacker.y;

        // IGNORE client radius/damage values - use server constants (anti-cheat)
        const radius = TELEPORT_DAMAGE_RADIUS;
        const damage = TELEPORT_DAMAGE;

        // Log if client sent suspicious values
        if (data.radius && data.radius > TELEPORT_DAMAGE_RADIUS * 1.1) {
            logger.cheat(`Suspicious teleport damage radius from ${socket.id}: ${data.radius} (server: ${TELEPORT_DAMAGE_RADIUS})`);
        }
        if (data.damage && data.damage > TELEPORT_DAMAGE * 1.1) {
            logger.cheat(`Suspicious teleport damage from ${socket.id}: ${data.damage} (server: ${TELEPORT_DAMAGE})`);
        }

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                player.currentHP = Math.max(0, player.currentHP - damage);

                const knockbackDist = calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(x, y, player.x, player.y, knockbackDist);

                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x,
                    attackerY: y
                });

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                }
            }
        });

        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check dummies
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                const knockbackDist = calculateKnockbackDistance(radius, distance);
                const knockbackEnd = calculateKnockbackEndPosition(x, y, dummy.x, dummy.y, knockbackDist);

                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x,
                    attackerY: y
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle laser aiming (sync with other players)
    socket.on('laserAiming', (data) => {
        // Broadcast laser aiming to all other players
        socket.broadcast.emit('laserAiming', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            dirX: data.dirX,
            dirY: data.dirY
        });
    });

    // Handle laser attack (Q skill)
    socket.on('laserAttack', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot attack
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Validate coordinate types
        if (!isValidNumber(data.x1) || !isValidNumber(data.y1) ||
            !isValidNumber(data.x2) || !isValidNumber(data.y2)) {
            logger.cheat(`Invalid laser coordinates from ${socket.id}`);
            return;
        }

        // Use attacker's server-side position as laser start (prevent remote laser hacks)
        const x1 = attacker.x;
        const y1 = attacker.y;

        // Validate laser direction and clamp length
        let x2 = data.x2;
        let y2 = data.y2;
        const laserLength = calculateDistance(x1, y1, x2, y2);

        if (laserLength > LASER_MAX_LENGTH) {
            // Clamp to max length
            const angle = Math.atan2(y2 - y1, x2 - x1);
            x2 = x1 + Math.cos(angle) * LASER_MAX_LENGTH;
            y2 = y1 + Math.sin(angle) * LASER_MAX_LENGTH;
        }

        // IGNORE client damage value - use server constant (anti-cheat)
        const damage = LASER_DAMAGE;
        const hitRadius = 67.5; // Half of character size for collision

        // Log if client sent suspicious values
        if (data.damage && data.damage > LASER_DAMAGE * 1.1) {
            logger.cheat(`Suspicious laser damage from ${socket.id}: ${data.damage} (server: ${LASER_DAMAGE})`);
        }

        logger.debug(`Laser attack from ${socket.id}: (${x1.toFixed(0)}, ${y1.toFixed(0)}) -> (${x2.toFixed(0)}, ${y2.toFixed(0)})`);

        // Broadcast laser effect to all other players (use validated coordinates)
        socket.broadcast.emit('laserFired', {
            playerId: socket.id,
            x1, y1, x2, y2
        });

        // Check all players in laser path
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return; // Don't hit yourself
            if (player.isDead) return; // Skip dead players

            // Check line-circle collision
            if (lineCircleIntersect(x1, y1, x2, y2, player.x, player.y, hitRadius)) {
                // Apply damage (server-authoritative)
                player.currentHP = Math.max(0, player.currentHP - damage);

                // Calculate knockback direction from laser origin
                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(x1, y1, player.x, player.y, knockbackDist);

                player.x = knockbackEnd.x;
                player.y = knockbackEnd.y;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x1,
                    attackerY: y1
                });

                logger.debug(`Laser hit ${playerId} for ${damage} damage (HP: ${player.currentHP}/${player.maxHP})`);

                // Check if player died
                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    logger.info(`${playerId} has been killed by laser from ${socket.id}!`);
                }
            }
        });

        // Broadcast damage to all players
        if (hitPlayers.length > 0) {
            io.emit('playerDamaged', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        // Broadcast deaths
        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        // Check all dummies in laser path
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return; // Skip dead dummies

            // Check line-circle collision
            if (lineCircleIntersect(x1, y1, x2, y2, dummy.x, dummy.y, hitRadius)) {
                // Apply damage
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

                // Calculate knockback
                const knockbackDist = SERVER_CONFIG.KNOCKBACK.LASER_DISTANCE;
                const knockbackEnd = calculateKnockbackEndPosition(x1, y1, dummy.x, dummy.y, knockbackDist);

                dummy.x = knockbackEnd.x;
                dummy.y = knockbackEnd.y;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: knockbackEnd.x,
                    knockbackEndY: knockbackEnd.y,
                    attackerX: x1,
                    attackerY: y1
                });

                logger.debug(`Laser hit ${dummy.name} for ${damage} damage (HP: ${dummy.currentHP}/${dummy.maxHP})`);

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                    logger.debug(`${dummy.name} has been defeated by laser!`);
                }
            }
        });

        // Broadcast dummy damage
        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle telepathy (sync with other players)
    socket.on('telepathy', (data) => {
        // Broadcast telepathy effect to all other players
        socket.broadcast.emit('playerTelepathy', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            radius: data.radius
        });
    });

    // Handle telepathy damage
    socket.on('telepathyDamage', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot deal damage
        if (attacker.isDead) return;

        // === INPUT VALIDATION ===
        // Use attacker's server-side position (ignore client x,y)
        const x = attacker.x;
        const y = attacker.y;

        // IGNORE client values - use server constants (anti-cheat)
        const radius = TELEPATHY_RADIUS;
        const damagePerTarget = TELEPATHY_DAMAGE_PER_TICK;
        const maxHeal = TELEPATHY_MAX_HEAL_PER_TICK;

        // Log if client sent suspicious values
        if (data.radius && data.radius > TELEPATHY_RADIUS * 1.1) {
            logger.cheat(`Suspicious telepathy radius from ${socket.id}: ${data.radius} (server: ${TELEPATHY_RADIUS})`);
        }
        if (data.damagePerTarget && data.damagePerTarget > TELEPATHY_DAMAGE_PER_TICK * 1.1) {
            logger.cheat(`Suspicious telepathy damage from ${socket.id}: ${data.damagePerTarget} (server: ${TELEPATHY_DAMAGE_PER_TICK})`);
        }

        let totalDamageDealt = 0;

        // Check all players in range
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            const dx = player.x - x;
            const dy = player.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                player.currentHP = Math.max(0, player.currentHP - damagePerTarget);
                totalDamageDealt += damagePerTarget;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x, // No knockback for telepathy
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y
                });

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                }
            }
        });

        // Check dummies
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damagePerTarget);
                totalDamageDealt += damagePerTarget;

                hitDummies.push({
                    dummyId: dummy.id,
                    currentHP: dummy.currentHP,
                    maxHP: dummy.maxHP,
                    knockbackEndX: dummy.x,
                    knockbackEndY: dummy.y,
                    attackerX: x,
                    attackerY: y
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        // Broadcast telepathy tick damage (no knockback, no vignette)
        if (hitPlayers.length > 0) {
            io.emit('telepathyTick', {
                attackerId: socket.id,
                hitPlayers: hitPlayers
            });
        }

        if (killedPlayers.length > 0) {
            killedPlayers.forEach(killed => {
                io.emit('playerDied', {
                    playerId: killed.playerId,
                    killedBy: killed.killedBy,
                    respawnDelay: killed.respawnDelay
                });
            });
        }

        if (hitDummies.length > 0) {
            io.emit('telepathyTickDummy', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }

        // Calculate heal amount and send to attacker
        const healAmount = Math.min(totalDamageDealt, maxHeal);
        if (healAmount > 0) {
            // Update attacker HP on server
            attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healAmount);

            // Send heal event to attacker
            io.to(socket.id).emit('telepathyHeal', {
                playerId: socket.id,
                healAmount: healAmount,
                newHP: attacker.currentHP
            });
        }
    });
}

module.exports = { registerCombatHandlers };
