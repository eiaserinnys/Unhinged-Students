/**
 * 미친 제자들 (Unhinged Students) - Main Game File
 *
 * This is the entry point and game loop.
 * Game state, UI rendering, and enemy finding are in separate modules:
 * - src/core/gameState.js
 * - src/rendering/uiRenderer.js
 * - src/combat/enemyFinder.js
 */

// Initialize canvas (uses globals from gameState.js)
(function initCanvas() {
    const canvasElement = document.getElementById('gameCanvas');
    setCanvas(canvasElement);
    setCtx(canvasElement.getContext('2d'));
})();

/**
 * Resize canvas to fill window while maintaining 16:9 aspect ratio
 */
function resizeCanvas() {
    const canvas = getCanvas();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;
    const gameAspectRatio = GAME_WIDTH / GAME_HEIGHT;

    if (windowAspectRatio > gameAspectRatio) {
        // Window is wider - fit to height
        canvas.height = windowHeight;
        canvas.width = windowHeight * gameAspectRatio;
        setOffsetX((windowWidth - canvas.width) / 2);
        setOffsetY(0);
    } else {
        // Window is taller - fit to width
        canvas.width = windowWidth;
        canvas.height = windowWidth / gameAspectRatio;
        setOffsetX(0);
        setOffsetY((windowHeight - canvas.height) / 2);
    }

    // Calculate scale factor for rendering
    setScale(canvas.width / GAME_WIDTH);

    // Position canvas in center of window
    canvas.style.position = 'absolute';
    canvas.style.left = getOffsetX() + 'px';
    canvas.style.top = getOffsetY() + 'px';

    logger.debug(`Canvas resized to ${canvas.width}x${canvas.height}, scale: ${getScale().toFixed(2)}`);
}

/**
 * Initialize game (called on page load)
 */
function init() {
    logger.info('Initializing...');

    // Setup canvas size
    resizeCanvas();
    setResizeHandler(resizeCanvas);
    window.addEventListener('resize', getResizeHandler());

    // Initialize input system
    initInput(getCanvas());

    // Initialize lobby manager
    gameState.lobbyManager = new LobbyManager();
    gameState.lobbyManager.setOnGameStart((selection) => {
        // Store player selection
        gameState.selectedCharacter = selection.character;
        gameState.playerName = selection.playerName;

        // Start the actual game
        startGame();
    });

    logger.info('Lobby initialized - waiting for player input');
}

/**
 * Start game after lobby selection
 */
function startGame() {
    logger.info(`Starting game with character: ${gameState.selectedCharacter}, name: ${gameState.playerName}`);

    // Update screen state
    gameState.screen = 'playing';

    // Get character image path
    const characterImage = LobbyManager.getCharacterImagePath(gameState.selectedCharacter);

    // Create player character with selected name
    // Position in center of game world (not canvas)
    gameState.player = new Character(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        characterImage,
        GAME_HEIGHT,
        gameState.playerName
    );

    // Create test dummies for combat practice
    // Position them around the map for testing
    const dummyConfig = GAME_CONFIG.DUMMY;
    const dummyPositions = dummyConfig.POSITIONS.map(pos => ({
        x: GAME_WIDTH / 2 + pos.offsetX,
        y: GAME_HEIGHT / 2 + pos.offsetY,
        name: pos.name
    }));

    dummyPositions.forEach(pos => {
        const dummy = new Character(
            pos.x,
            pos.y,
            'asset/image/alien.png',
            GAME_HEIGHT,
            pos.name,
            true // isDummy = true
        );
        // Make dummies stationary and distinguishable
        dummy.speed = 0; // Don't move
        dummy.maxHP = dummyConfig.MAX_HP;
        dummy.currentHP = dummyConfig.MAX_HP;
        gameState.dummies.push(dummy);
    });

    logger.debug(`Created ${gameState.dummies.length} test dummies`);

    // Initialize skill system
    gameState.skillManager = new SkillManager();

    // Add skills: Q = Laser Beam, W = Teleport, E = Telepathy
    gameState.skillManager.addSkill(new Skill('레이저', 'q', GAME_CONFIG.SKILL_LASER.COOLDOWN_MS, GAME_CONFIG.SKILL_LASER.COLOR));
    gameState.skillManager.addSkill(new Skill('순간이동', 'w', GAME_CONFIG.SKILL_TELEPORT.COOLDOWN_MS, GAME_CONFIG.SKILL_TELEPORT.COLOR));
    gameState.skillManager.addSkill(new Skill('텔레파시', 'e', GAME_CONFIG.SKILL_TELEPATHY.COOLDOWN_MS, GAME_CONFIG.SKILL_TELEPATHY.COLOR));

    // Initialize skill UI
    gameState.skillUI = new SkillUI(gameState.skillManager);

    // Initialize laser beam effect
    gameState.laserBeamEffect = new LaserBeamEffect();

    // Initialize teleport effect
    gameState.teleportEffect = new TeleportEffect();

    // Initialize telepathy effect
    gameState.telepathyEffect = new TelepathyEffect();

    logger.debug('Skill system initialized');

    // Create shard manager (will be populated by server)
    gameState.shardManager = new ShardManager();
    gameState.shardManager.enableServerMode();

    // Initialize chat manager
    gameState.chatManager = new ChatManager();
    gameState.chatManager.setPlayer(gameState.player);

    // Initialize network manager and connect to server
    // Auto-detects server address from window.location.hostname
    gameState.networkManager = new NetworkManager();
    gameState.networkManager.setShardManager(gameState.shardManager);
    gameState.networkManager.setLocalPlayer(gameState.player);
    gameState.networkManager.setDummies(gameState.dummies);
    gameState.networkManager.connect();

    // Connect chat to network after socket is ready
    setTimeout(() => {
        if (gameState.networkManager.socket) {
            gameState.chatManager.setSocket(gameState.networkManager.socket);
            gameState.chatManager.addSystemMessage('Connected to server. Press Enter to chat.');
        }
    }, 500);

    gameState.running = true;
    gameLoop();
}

/**
 * Update game logic
 * @param {number} deltaTime - Time since last frame in seconds
 */
function update(deltaTime) {
    // Don't update player movement if chat is focused or player is dead
    const isChatting = gameState.chatManager && gameState.chatManager.isChatInputFocused();
    const isPlayerDead = gameState.player && gameState.player.isDead;

    if (gameState.player && !isChatting && !isPlayerDead) {
        // Pass game world dimensions and delta time
        gameState.player.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);

        // Send player position to server
        if (gameState.networkManager) {
            const pos = gameState.player.getPosition();
            gameState.networkManager.sendPlayerPosition(
                pos.x,
                pos.y,
                gameState.player.playerName,
                gameState.player.level,
                gameState.player.experience
            );
        }
    }

    if (gameState.shardManager) {
        gameState.shardManager.update();

        // Check for shard collisions
        const collectedShards = gameState.shardManager.checkCollisions(gameState.player);
        if (collectedShards.length > 0) {
            gameState.stats.shardsCollected += collectedShards.length;
            logger.debug(`Collected ${collectedShards.length} shard(s)! Total: ${gameState.stats.shardsCollected}`);

            // Add experience for each shard collected (1 shard = 1 exp)
            gameState.player.addExperience(collectedShards.length);

            // Send shard collection to server
            if (gameState.networkManager) {
                collectedShards.forEach(shard => {
                    if (shard.id !== null) {
                        gameState.networkManager.sendShardCollection(shard.id);
                    }
                });
            }
        }
    }

    // Update dummies (respawn is handled by server)
    gameState.dummies.forEach(dummy => {
        dummy.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);
    });

    // Send attack to server (server handles all damage calculations)
    // Only allow attacks if player is alive
    if (gameState.player && gameState.player.isAttacking && !gameState.player.isDead) {
        const attackArea = gameState.player.getAttackArea();

        // Send attack to server once per attack (when attack just started)
        const currentTime = Date.now();
        if (!gameState.lastAttackSentTime || currentTime - gameState.lastAttackSentTime > gameState.player.attackCooldown) {
            if (gameState.networkManager) {
                gameState.networkManager.sendAttack(
                    attackArea.x,
                    attackArea.y,
                    attackArea.radius,
                    gameState.player.attackPower
                );
                gameState.lastAttackSentTime = currentTime;
            }
        }
        // Dummy damage is now handled by server via dummyDamaged event
    }

    // Update remote players
    if (gameState.networkManager) {
        gameState.networkManager.update();
    }

    // Update skill manager (check for ready flashes)
    if (gameState.skillManager) {
        gameState.skillManager.update();
    }

    // Handle skill input (Q, W, E) - only when not chatting and player is alive
    if (gameState.skillManager && !isChatting && !isPlayerDead) {
        handleSkillInput();
    }

    // Update skill effects
    updateSkillEffects();
}

/**
 * Handle skill input (Q, W, E keys)
 */
function handleSkillInput() {
    // Q - Laser Beam (targets players only, not dummies)
    if (isKeyJustPressed('q') && !gameState.laserBeamEffect.active) {
        const skill = gameState.skillManager.useSkill('q');
        if (skill) {
            const playerPos = gameState.player.getPosition();
            const target = findNearestEnemy(true); // playersOnly = true
            if (target) {
                gameState.laserBeamEffect.start(playerPos.x, playerPos.y, target.x, target.y);
                logger.debug(`Used skill: ${skill.name} - targeting ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);

                // Send laser aiming to server for sync with other players
                if (gameState.networkManager) {
                    gameState.networkManager.sendLaserAiming(
                        playerPos.x,
                        playerPos.y,
                        gameState.laserBeamEffect.dirX,
                        gameState.laserBeamEffect.dirY
                    );
                }
            }
        }
    }

    // W - Teleport (to random enemy)
    if (isKeyJustPressed('w') && !gameState.teleportEffect.active) {
        const skill = gameState.skillManager.useSkill('w');
        if (skill) {
            const playerPos = gameState.player.getPosition();
            const target = findRandomEnemy();

            if (target) {
                // Teleport to near the target enemy
                gameState.teleportEffect.start(playerPos.x, playerPos.y, GAME_WIDTH, GAME_HEIGHT, target.x, target.y);
                logger.debug(`Used skill: ${skill.name} - teleporting to ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);
            } else {
                // No enemies, teleport randomly
                gameState.teleportEffect.start(playerPos.x, playerPos.y, GAME_WIDTH, GAME_HEIGHT);
                logger.debug(`Used skill: ${skill.name} - random teleport (no enemies)`);
            }

            // Send teleport event to server for sync
            if (gameState.networkManager) {
                gameState.networkManager.sendTeleport(
                    gameState.teleportEffect.startX,
                    gameState.teleportEffect.startY,
                    gameState.teleportEffect.endX,
                    gameState.teleportEffect.endY
                );
            }
        }
    }

    // E - Telepathy
    if (isKeyJustPressed('e') && !gameState.telepathyEffect.active) {
        const skill = gameState.skillManager.useSkill('e');
        if (skill) {
            const playerPos = gameState.player.getPosition();
            gameState.telepathyEffect.start(playerPos.x, playerPos.y);
            logger.debug(`Used skill: ${skill.name}`);

            // Send telepathy event to server for sync
            if (gameState.networkManager) {
                gameState.networkManager.sendTelepathy(
                    playerPos.x,
                    playerPos.y,
                    gameState.telepathyEffect.radius
                );
            }
        }
    }
}

/**
 * Update all skill effects
 */
function updateSkillEffects() {
    // Update laser beam effect
    if (gameState.laserBeamEffect && gameState.laserBeamEffect.active) {
        const playerPos = gameState.player.getPosition();
        gameState.laserBeamEffect.update(playerPos.x, playerPos.y);

        // Check if laser should deal damage (when firing phase starts)
        if (gameState.laserBeamEffect.shouldDealDamage()) {
            // Send laser attack to server
            const line = gameState.laserBeamEffect.getLaserLine();
            if (line && gameState.networkManager) {
                gameState.networkManager.sendLaserAttack(
                    line.x1, line.y1,
                    line.x2, line.y2,
                    gameState.laserBeamEffect.damage
                );
            }
        }
    }

    // Update teleport effect
    if (gameState.teleportEffect && gameState.teleportEffect.active) {
        const teleportResult = gameState.teleportEffect.update();

        // Move player when teleport completes
        if (teleportResult && teleportResult.teleported) {
            gameState.player.x = teleportResult.x;
            gameState.player.y = teleportResult.y;
        }

        // Check if teleport should deal damage
        if (gameState.teleportEffect.shouldDealDamage()) {
            const area = gameState.teleportEffect.getDamageArea();
            if (gameState.networkManager) {
                gameState.networkManager.sendTeleportDamage(
                    area.x,
                    area.y,
                    area.radius,
                    area.damage
                );
            }
        }
    }

    // Update telepathy effect
    if (gameState.telepathyEffect && gameState.telepathyEffect.active) {
        const playerPos = gameState.player.getPosition();
        gameState.telepathyEffect.update(playerPos.x, playerPos.y);

        // Check if telepathy should deal damage and heal
        if (gameState.telepathyEffect.shouldDealDamage()) {
            const area = gameState.telepathyEffect.getDamageArea();
            if (gameState.networkManager) {
                gameState.networkManager.sendTelepathyDamage(
                    area.x,
                    area.y,
                    area.radius,
                    area.damagePerTarget,
                    area.maxHeal
                );
            }
        }
    }
}

/**
 * Game loop
 * @param {number} currentTime - Current timestamp from requestAnimationFrame
 */
function gameLoop(currentTime) {
    if (!gameState.running) return;

    const canvas = getCanvas();
    const ctx = getCtx();
    const scale = getScale();

    // Calculate delta time (in seconds)
    if (gameState.lastFrameTime === 0) {
        gameState.lastFrameTime = currentTime;
    }
    gameState.deltaTime = (currentTime - gameState.lastFrameTime) / 1000; // Convert to seconds
    gameState.lastFrameTime = currentTime;

    // Cap delta time to prevent huge jumps (e.g., when tab is inactive)
    if (gameState.deltaTime > 0.1) {
        gameState.deltaTime = 0.1;
    }

    // Update input state (must be called before checking inputs)
    updateInput();

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scaling for game world rendering
    ctx.save();
    ctx.scale(scale, scale);

    // Update and render
    update(gameState.deltaTime);
    render();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

/**
 * Render function
 */
function render() {
    const ctx = getCtx();

    // Draw title (in game world coordinates)
    ctx.fillStyle = '#00D9FF';
    ctx.font = '600 28px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('미친 제자들', GAME_WIDTH / 2, 40);

    // Draw instructions
    ctx.fillStyle = '#E0E0E0';
    ctx.font = '16px Jua, sans-serif';
    const connectionStatus = gameState.networkManager && gameState.networkManager.connected ? 'Connected' : 'Connecting...';
    const playerCount = gameState.networkManager ? gameState.networkManager.remotePlayers.size + 1 : 1;
    ctx.fillText(`${connectionStatus} | Players: ${playerCount}`, GAME_WIDTH / 2, 70);

    // Draw shards
    if (gameState.shardManager) {
        gameState.shardManager.render(ctx);
    }

    // Draw remote players
    if (gameState.networkManager) {
        gameState.networkManager.render(ctx);
    }

    // Draw test dummies
    gameState.dummies.forEach(dummy => {
        if (dummy.isAlive()) {
            dummy.render(ctx);
        }
    });

    // Draw local player (on top of remote players and dummies)
    if (gameState.player) {
        if (gameState.player.isDead) {
            // Render dead player as ghost (semi-transparent)
            ctx.save();
            ctx.globalAlpha = 0.3;
            gameState.player.render(ctx);
            ctx.restore();
        } else {
            gameState.player.render(ctx);
        }
    }

    // Draw death screen overlay if player is dead
    if (gameState.player && gameState.player.isDead) {
        renderDeathScreen(ctx);
    }

    // Draw UI
    ctx.fillStyle = '#A78BFA';
    ctx.font = '14px Jua, sans-serif';
    ctx.textAlign = 'left';

    if (gameState.player) {
        const pos = gameState.player.getPosition();
        const level = gameState.player.getLevel();
        const exp = gameState.player.getExperience();
        const requiredExp = gameState.player.getRequiredExperience();

        ctx.fillText(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 10, 20);

        // Level display with max level indicator
        if (level >= gameState.player.maxLevel) {
            ctx.fillText(`Level: ${level} (MAX)`, 10, 40);
        } else {
            ctx.fillText(`Level: ${level} (${exp}/${requiredExp} exp)`, 10, 40);
        }
    }

    if (gameState.shardManager) {
        ctx.fillText(`Shards Collected: ${gameState.stats.shardsCollected}`, 10, 60);
        ctx.fillText(`Active Shards: ${gameState.shardManager.getActiveShardCount()}/${gameState.shardManager.maxActiveShards}`, 10, 80);
    }

    // Draw laser beam effect (above players)
    if (gameState.laserBeamEffect) {
        gameState.laserBeamEffect.render(ctx);
    }

    // Draw teleport effect
    if (gameState.teleportEffect) {
        gameState.teleportEffect.render(ctx);
    }

    // Draw telepathy effect
    if (gameState.telepathyEffect) {
        gameState.telepathyEffect.render(ctx);
    }

    // Draw skill UI (above game elements, below vignette)
    if (gameState.skillUI) {
        gameState.skillUI.render(ctx, GAME_WIDTH, GAME_HEIGHT);
    }

    // Draw hit vignette effect (on top of everything)
    renderHitVignette(ctx);
}

/**
 * Cleanup game resources to prevent memory leaks
 */
function cleanupGame() {
    // Stop game loop
    gameState.running = false;

    // Cleanup input system
    if (typeof cleanupInput === 'function') {
        cleanupInput();
    }

    // Cleanup network
    if (gameState.networkManager) {
        gameState.networkManager.disconnect();
        gameState.networkManager = null;
    }

    // Remove resize handler
    const resizeHandler = getResizeHandler();
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        setResizeHandler(null);
    }

    // Clear game state objects
    gameState.player = null;
    gameState.lobbyManager = null;
    gameState.shardManager = null;
    gameState.chatManager = null;
    gameState.skillManager = null;
    gameState.skillUI = null;
    gameState.laserBeamEffect = null;
    gameState.teleportEffect = null;
    gameState.telepathyEffect = null;
    gameState.dummies = [];

    logger.info('Game cleaned up');
}

// Start game when page loads
setLoadHandler(init);
window.addEventListener('load', getLoadHandler());

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanupGame);
