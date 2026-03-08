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
    WAVE_RADIUS,
    WAVE_DAMAGE,
    WAVE_CONFUSION_DURATION,
    MADNESS_RADIUS,
    MADNESS_DAMAGE_PER_TICK,
    POT_SMASH_DAMAGE,
    POT_SMASH_SPLASH_DAMAGE,
    POT_SMASH_RANGE,
    POT_SMASH_ANGLE,
    POT_SMASH_SPLASH_RADIUS,
    CURRY_RECOVERY_MAX_STORED,
    CURRY_RECOVERY_STORE_RATIO,
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

// Helper function to apply damage and store for curry-bear passive
// Returns { currentHP, storedDamageChanged: boolean }
function applyDamageWithStorage(player, damage, io) {
    const actualDamage = Math.min(damage, player.currentHP);
    player.currentHP = Math.max(0, player.currentHP - damage);

    let storedDamageChanged = false;

    // If player is curry-bear, store half the damage taken
    if (player.characterId === 'curry-bear' && actualDamage > 0) {
        const storageAmount = Math.floor(actualDamage * CURRY_RECOVERY_STORE_RATIO);
        player.storedDamage = player.storedDamage || 0;
        player.storedDamage = Math.min(
            player.storedDamage + storageAmount,
            CURRY_RECOVERY_MAX_STORED
        );
        storedDamageChanged = true;
        logger.debug(`Curry-bear stored ${storageAmount} damage (total: ${player.storedDamage}/${CURRY_RECOVERY_MAX_STORED})`);

        // Notify the curry-bear player of their stored damage
        if (io && player.socketId) {
            io.to(player.socketId).emit('storedDamageUpdate', {
                storedDamage: player.storedDamage,
                maxStored: CURRY_RECOVERY_MAX_STORED
            });
        }
    }

    return { currentHP: player.currentHP, storedDamageChanged };
}

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
                // Apply damage with curry-bear storage (server-authoritative power)
                applyDamageWithStorage(player, attackPower, io);

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
                applyDamageWithStorage(player, damage, io);

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
                applyDamageWithStorage(player, damage, io);

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
                applyDamageWithStorage(player, damagePerTarget, io);
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

    // Handle wave attack (Crazy-Eyes basic attack)
    socket.on('waveAttack', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;

        // Dead players cannot attack
        if (attacker.isDead) return;

        // Use attacker's server-side position
        const x = attacker.x;
        const y = attacker.y;

        // Use server constants (anti-cheat)
        const radius = WAVE_RADIUS;
        const damage = WAVE_DAMAGE;
        const confusionDuration = WAVE_CONFUSION_DURATION;

        logger.debug(`Wave attack from ${socket.id} at (${x.toFixed(0)}, ${y.toFixed(0)})`);

        // Broadcast wave effect to all other players
        socket.broadcast.emit('playerWave', {
            playerId: socket.id,
            x: x,
            y: y,
            radius: radius
        });

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
                applyDamageWithStorage(player, damage, io);

                // Apply confusion effect
                player.confusedUntil = Date.now() + confusionDuration;

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x, // No knockback for wave
                    knockbackEndY: player.y,
                    attackerX: x,
                    attackerY: y,
                    confused: true,
                    confusionDuration: confusionDuration
                });

                logger.debug(`Wave hit ${playerId} for ${damage} damage, confused for ${confusionDuration}ms`);

                if (player.currentHP <= 0 && !player.isDead) {
                    player.isDead = true;
                    player.deathTime = Date.now();
                    killedPlayers.push({
                        playerId: playerId,
                        killedBy: socket.id,
                        respawnDelay: PLAYER_RESPAWN_DELAY
                    });
                    logger.info(`${playerId} has been killed by wave from ${socket.id}!`);
                }
            }
        });

        // Broadcast wave damage and confusion to all players
        if (hitPlayers.length > 0) {
            io.emit('waveDamage', {
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

        // Check dummies (no confusion for dummies)
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            const dx = dummy.x - x;
            const dy = dummy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 67.5) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);

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

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle madness walk start (Crazy-Eyes E skill)
    socket.on('madnessStart', () => {
        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        logger.debug(`Madness walk started by ${socket.id}`);

        // Broadcast madness start to all other players
        socket.broadcast.emit('playerMadnessStart', {
            playerId: socket.id
        });
    });

    // Handle madness walk end
    socket.on('madnessEnd', () => {
        const player = players.get(socket.id);
        if (!player) return;

        logger.debug(`Madness walk ended by ${socket.id}`);

        // Broadcast madness end to all other players
        socket.broadcast.emit('playerMadnessEnd', {
            playerId: socket.id
        });
    });

    // Handle madness tick damage (called periodically by client while moving)
    socket.on('madnessDamage', () => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        const x = attacker.x;
        const y = attacker.y;
        const radius = MADNESS_RADIUS;
        const damage = MADNESS_DAMAGE_PER_TICK;

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
                applyDamageWithStorage(player, damage, io);

                hitPlayers.push({
                    playerId: playerId,
                    currentHP: player.currentHP,
                    maxHP: player.maxHP,
                    knockbackEndX: player.x,
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
                    logger.info(`${playerId} has been killed by madness walk from ${socket.id}!`);
                }
            }
        });

        // Broadcast madness tick damage (small, no vignette)
        if (hitPlayers.length > 0) {
            io.emit('madnessTick', {
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

        if (hitDummies.length > 0) {
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle pot smash attack (Curry-Bear basic attack)
    socket.on('potSmash', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Validate direction
        if (!isValidNumber(data.dirX) || !isValidNumber(data.dirY)) {
            logger.cheat(`Invalid pot smash direction from ${socket.id}`);
            return;
        }

        const x = attacker.x;
        const y = attacker.y;
        const dirX = data.dirX;
        const dirY = data.dirY;

        // Normalize direction
        const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
        const normDirX = dirLength > 0 ? dirX / dirLength : 1;
        const normDirY = dirLength > 0 ? dirY / dirLength : 0;

        // Use server constants
        const range = POT_SMASH_RANGE;
        const angle = POT_SMASH_ANGLE;
        const damage = POT_SMASH_DAMAGE;
        const splashDamage = POT_SMASH_SPLASH_DAMAGE;
        const splashRadius = POT_SMASH_SPLASH_RADIUS;
        const halfAngleRad = (angle / 2) * Math.PI / 180;

        logger.debug(`Pot smash from ${socket.id} at (${x.toFixed(0)}, ${y.toFixed(0)}) dir (${normDirX.toFixed(2)}, ${normDirY.toFixed(2)})`);

        // Broadcast pot smash effect to all other players
        socket.broadcast.emit('playerPotSmash', {
            playerId: socket.id,
            x: x,
            y: y,
            dirX: normDirX,
            dirY: normDirY
        });

        // Helper to check if target is in cone
        function isInCone(targetX, targetY) {
            const dx = targetX - x;
            const dy = targetY - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > range) return false;
            if (distance === 0) return true;

            // Calculate angle between direction and target
            const targetAngle = Math.atan2(dy, dx);
            const attackAngle = Math.atan2(normDirY, normDirX);
            let angleDiff = Math.abs(targetAngle - attackAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            return angleDiff <= halfAngleRad;
        }

        // Track main hits for splash damage
        const mainHitPositions = [];

        // Check all players in cone
        const hitPlayers = [];
        const killedPlayers = [];
        players.forEach((player, playerId) => {
            if (playerId === socket.id) return;
            if (player.isDead) return;

            if (isInCone(player.x, player.y)) {
                applyDamageWithStorage(player, damage, io);
                mainHitPositions.push({ x: player.x, y: player.y });

                // Calculate knockback
                const knockbackDist = 60; // Fixed knockback for pot smash
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
                    attackerY: y,
                    isMainHit: true
                });

                logger.debug(`Pot smash hit ${playerId} for ${damage} damage`);

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

        // Check dummies in cone
        const hitDummies = [];
        dummies.forEach((dummy) => {
            if (dummy.currentHP <= 0) return;

            if (isInCone(dummy.x, dummy.y)) {
                dummy.currentHP = Math.max(0, dummy.currentHP - damage);
                mainHitPositions.push({ x: dummy.x, y: dummy.y });

                const knockbackDist = 60;
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
                    attackerY: y,
                    isMainHit: true
                });

                if (dummy.currentHP <= 0) {
                    dummy.deathTime = Date.now();
                }
            }
        });

        // Apply splash damage around main hit positions
        mainHitPositions.forEach(hitPos => {
            // Check players for splash
            players.forEach((player, playerId) => {
                if (playerId === socket.id) return;
                if (player.isDead) return;
                // Skip if already hit by main attack
                if (hitPlayers.some(h => h.playerId === playerId && h.isMainHit)) return;

                const dx = player.x - hitPos.x;
                const dy = player.y - hitPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= splashRadius) {
                    applyDamageWithStorage(player, splashDamage, io);

                    hitPlayers.push({
                        playerId: playerId,
                        currentHP: player.currentHP,
                        maxHP: player.maxHP,
                        knockbackEndX: player.x,
                        knockbackEndY: player.y,
                        attackerX: hitPos.x,
                        attackerY: hitPos.y,
                        isMainHit: false
                    });

                    logger.debug(`Pot smash splash hit ${playerId} for ${splashDamage} damage`);

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

            // Check dummies for splash
            dummies.forEach((dummy) => {
                if (dummy.currentHP <= 0) return;
                if (hitDummies.some(h => h.dummyId === dummy.id && h.isMainHit)) return;

                const dx = dummy.x - hitPos.x;
                const dy = dummy.y - hitPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= splashRadius + 67.5) {
                    dummy.currentHP = Math.max(0, dummy.currentHP - splashDamage);

                    hitDummies.push({
                        dummyId: dummy.id,
                        currentHP: dummy.currentHP,
                        maxHP: dummy.maxHP,
                        knockbackEndX: dummy.x,
                        knockbackEndY: dummy.y,
                        attackerX: hitPos.x,
                        attackerY: hitPos.y,
                        isMainHit: false
                    });

                    if (dummy.currentHP <= 0) {
                        dummy.deathTime = Date.now();
                    }
                }
            });
        });

        // Broadcast pot smash damage
        if (hitPlayers.length > 0) {
            io.emit('potSmashDamage', {
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
            io.emit('dummyDamaged', {
                attackerId: socket.id,
                hitDummies: hitDummies
            });
        }
    });

    // Handle curry recovery (Curry-Bear E skill)
    socket.on('curryRecovery', () => {
        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        logger.info(`Curry recovery attempt by ${socket.id}, characterId: ${player.characterId}, storedDamage: ${player.storedDamage}`);

        // Only curry-bear can use this skill
        if (player.characterId !== 'curry-bear') {
            logger.info(`Non curry-bear ${socket.id} (${player.characterId}) tried to use curry recovery`);
            return;
        }

        const storedDamage = player.storedDamage || 0;
        if (storedDamage <= 0) {
            logger.debug(`${socket.id} tried to use curry recovery with no stored damage`);
            return;
        }

        // Heal by stored damage amount
        const healAmount = storedDamage;
        const oldHP = player.currentHP;
        player.currentHP = Math.min(player.maxHP, player.currentHP + healAmount);
        const actualHeal = player.currentHP - oldHP;

        // Reset stored damage
        player.storedDamage = 0;

        logger.debug(`Curry recovery: ${socket.id} healed ${actualHeal} (stored: ${storedDamage})`);

        // Broadcast recovery effect to all players
        io.emit('playerCurryRecovery', {
            playerId: socket.id,
            healAmount: actualHeal,
            currentHP: player.currentHP,
            maxHP: player.maxHP
        });
    });

    // Handle stored damage sync request (for UI display)
    socket.on('requestStoredDamage', () => {
        const player = players.get(socket.id);
        if (!player) return;

        socket.emit('storedDamageUpdate', {
            storedDamage: player.storedDamage || 0,
            maxStored: CURRY_RECOVERY_MAX_STORED
        });
    });

    // Handle spin throw (Hulk Sister Q skill)
    socket.on('spinThrow', (data) => {
        const attacker = players.get(socket.id);
        if (!attacker) return;
        if (attacker.isDead) return;

        // Only hulk sister can use this skill
        if (attacker.characterId !== 'big-sis-hulk') {
            logger.cheat(`Non hulk-sister ${socket.id} tried to use spin throw`);
            return;
        }

        const targetId = data.targetId;
        const target = players.get(targetId);
        if (!target || target.isDead) return;

        // Validate target is in range
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > SERVER_CONFIG.SKILL_SPIN_THROW.GRAB_RANGE * 1.2) {
            logger.cheat(`Spin throw target too far: ${distance}px`);
            return;
        }

        // Calculate throw direction
        const dirLength = Math.sqrt(data.dirX * data.dirX + data.dirY * data.dirY);
        const dirX = dirLength > 0 ? data.dirX / dirLength : 1;
        const dirY = dirLength > 0 ? data.dirY / dirLength : 0;

        // Calculate throw damage (with rage multiplier if active)
        let throwDamage = SERVER_CONFIG.SKILL_SPIN_THROW.DAMAGE;
        let throwDistance = SERVER_CONFIG.SKILL_SPIN_THROW.THROW_DISTANCE;

        if (attacker.rageActive) {
            throwDamage *= SERVER_CONFIG.SKILL_RAGE.DAMAGE_MULTIPLIER;
            throwDistance *= SERVER_CONFIG.SKILL_RAGE.THROW_MULTIPLIER;
        }

        // Apply rage stacks bonus
        const rageStacks = attacker.rageStacks || 0;
        throwDamage *= (1 + rageStacks * SERVER_CONFIG.HULK_PASSIVE.DAMAGE_PER_STACK);
        throwDistance *= (1 + rageStacks * SERVER_CONFIG.HULK_PASSIVE.THROW_PER_STACK);

        // Apply damage to target
        applyDamageWithStorage(target, Math.floor(throwDamage), io);

        // Calculate throw end position
        let endX = target.x + dirX * throwDistance;
        let endY = target.y + dirY * throwDistance;

        // Clamp to bounds
        const clamped = clampCoordinates(endX, endY);
        endX = clamped.x;
        endY = clamped.y;

        // Move target to throw position
        target.x = endX;
        target.y = endY;

        logger.debug(`Spin throw: ${socket.id} threw ${targetId} for ${Math.floor(throwDamage)} damage`);

        // Broadcast spin throw effect
        io.emit('playerSpinThrow', {
            attackerId: socket.id,
            targetId: targetId,
            startX: attacker.x,
            startY: attacker.y,
            endX: endX,
            endY: endY,
            damage: Math.floor(throwDamage)
        });

        // Check if target died
        if (target.currentHP <= 0 && !target.isDead) {
            target.isDead = true;
            target.deathTime = Date.now();
            io.emit('playerDied', {
                playerId: targetId,
                killedBy: socket.id,
                respawnDelay: PLAYER_RESPAWN_DELAY
            });
            logger.info(`${targetId} has been killed by spin throw from ${socket.id}!`);
        }
    });

    // Handle rage start (Hulk Sister E skill)
    socket.on('rageStart', () => {
        const player = players.get(socket.id);
        if (!player) return;
        if (player.isDead) return;

        // Only hulk sister can use this skill
        if (player.characterId !== 'big-sis-hulk') {
            logger.cheat(`Non hulk-sister ${socket.id} tried to use rage`);
            return;
        }

        player.rageActive = true;
        player.rageStartTime = Date.now();

        logger.debug(`Rage started by ${socket.id}`);

        // Broadcast rage start
        socket.broadcast.emit('playerRageStart', {
            playerId: socket.id,
            duration: SERVER_CONFIG.SKILL_RAGE.DURATION_MS
        });
    });

    // Handle rage end
    socket.on('rageEnd', () => {
        const player = players.get(socket.id);
        if (!player) return;

        player.rageActive = false;

        logger.debug(`Rage ended by ${socket.id}`);

        // Broadcast rage end
        socket.broadcast.emit('playerRageEnd', {
            playerId: socket.id
        });
    });
}

module.exports = { registerCombatHandlers };
