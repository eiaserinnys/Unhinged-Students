// 미친 제자들 (Unhinged Students) - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game world constants (16:9 aspect ratio) - from config
const GAME_WIDTH = GAME_CONFIG.WORLD.WIDTH;
const GAME_HEIGHT = GAME_CONFIG.WORLD.HEIGHT;

// Viewport/scaling variables
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Store event handler references for cleanup
let resizeHandler = null;
let loadHandler = null;

// Game state
const gameState = {
    screen: 'lobby', // 'lobby' | 'waitingTeam' | 'teamAnnounce' | 'playing'
    running: false,
    player: null,
    lobbyManager: null, // Lobby UI manager
    shardManager: null,
    networkManager: null,
    chatManager: null,
    skillManager: null, // Skill system
    skillUI: null, // Skill UI renderer
    laserBeamEffect: null, // Laser beam (Q skill) effect
    teleportEffect: null, // Teleport (W skill) effect
    telepathyEffect: null, // Telepathy (E skill) effect
    dummies: [], // Test dummies for combat practice
    stats: {
        shardsCollected: 0
    },
    lastFrameTime: 0,
    deltaTime: 0,
    lastAttackSentTime: 0, // Track last attack sent to server
    // Hit vignette effect
    hitVignetteTime: 0,
    hitVignetteDuration: GAME_CONFIG.EFFECTS.HIT_VIGNETTE_DURATION_MS,
    // Player selection from lobby
    selectedCharacter: 'alien',
    playerName: 'Player',
    // Team info
    team: null, // 'red' or 'blue'
    teamAnnounceStartTime: 0,
    teamAnnounceDuration: 2500, // 2.5 seconds to show team
    // Madness walk (Crazy-Eyes E skill)
    madnessActive: false,
    madnessStartTime: 0,
    madnessDuration: 0,
    madnessLastTickTime: 0,
    madnessTickInterval: 0,
    madnessRadius: 0,
    // Curry Recovery (Curry-Bear E skill)
    storedDamage: 0,
    maxStoredDamage: GAME_CONFIG.SKILL_CURRY_RECOVERY.MAX_STORED_DAMAGE,
    curryRecoveryActive: false,
    curryRecoveryStartTime: 0,
    // Hulk Sister - Rage (폭주)
    rageActive: false,
    rageStartTime: 0,
    rageDuration: 0,
    // Hulk Sister - Passive (분노 스택)
    hulkRageStacks: 0,
    hulkLastStackTime: 0
};

// Resize canvas to fill window while maintaining 16:9 aspect ratio
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;
    const gameAspectRatio = GAME_WIDTH / GAME_HEIGHT;

    if (windowAspectRatio > gameAspectRatio) {
        // Window is wider - fit to height
        canvas.height = windowHeight;
        canvas.width = windowHeight * gameAspectRatio;
        offsetX = (windowWidth - canvas.width) / 2;
        offsetY = 0;
    } else {
        // Window is taller - fit to width
        canvas.width = windowWidth;
        canvas.height = windowWidth / gameAspectRatio;
        offsetX = 0;
        offsetY = (windowHeight - canvas.height) / 2;
    }

    // Calculate scale factor for rendering
    scale = canvas.width / GAME_WIDTH;

    // Position canvas in center of window
    canvas.style.position = 'absolute';
    canvas.style.left = offsetX + 'px';
    canvas.style.top = offsetY + 'px';

    logger.debug(`Canvas resized to ${canvas.width}x${canvas.height}, scale: ${scale.toFixed(2)}`);
}

// Initialize game (called on page load)
function init() {
    logger.info('Initializing...');

    // Setup canvas size
    resizeCanvas();
    resizeHandler = resizeCanvas;
    window.addEventListener('resize', resizeHandler);

    // Initialize input system
    initInput(canvas);

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

// Start game after lobby selection
function startGame() {
    logger.info(`Starting game with character: ${gameState.selectedCharacter}, name: ${gameState.playerName}`);

    // Show "waiting for team" state until server assigns team
    gameState.screen = 'waitingTeam';

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

    // Apply character-specific stats
    if (gameState.selectedCharacter === 'big-sis-hulk') {
        gameState.player.maxHP = GAME_CONFIG.HULK_STATS.MAX_HP;
        gameState.player.currentHP = GAME_CONFIG.HULK_STATS.MAX_HP;
        logger.debug(`Hulk Sister: HP set to ${GAME_CONFIG.HULK_STATS.MAX_HP}`);
    }

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

    // Add skills based on selected character
    initializeCharacterSkills(gameState.selectedCharacter);

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

    // Set team assignment callback
    gameState.networkManager.onTeamAssigned = (team) => {
        gameState.team = team;
        gameState.screen = 'teamAnnounce';
        gameState.teamAnnounceStartTime = Date.now();
        logger.info(`Team assigned: ${team}`);
    };

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

// Update game logic
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
                gameState.player.experience,
                gameState.selectedCharacter
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

    // Update confusion effect
    if (typeof updateConfusion === 'function') {
        updateConfusion();
    }

    // Update skill manager (check for ready flashes)
    if (gameState.skillManager) {
        gameState.skillManager.update();
    }

    // Update wave effect (for local player)
    if (gameState.waveEffect && gameState.waveEffect.active) {
        const elapsed = Date.now() - gameState.waveEffect.startTime;
        if (elapsed >= gameState.waveEffect.duration) {
            gameState.waveEffect.active = false;
        }
    }

    // Update madness walk (Crazy-Eyes E skill)
    if (gameState.madnessActive) {
        const currentTime = Date.now();
        const elapsed = currentTime - gameState.madnessStartTime;

        // Check if madness duration is over
        if (elapsed >= gameState.madnessDuration) {
            gameState.madnessActive = false;
            logger.debug('Madness walk ended');
            if (gameState.networkManager) {
                gameState.networkManager.sendMadnessEnd();
            }
        } else {
            // Check if player is moving (any arrow key pressed)
            const isMoving = isKeyPressed('arrowup') || isKeyPressed('arrowdown') ||
                           isKeyPressed('arrowleft') || isKeyPressed('arrowright');

            // Send damage tick if moving and tick interval passed
            if (isMoving && currentTime - gameState.madnessLastTickTime >= gameState.madnessTickInterval) {
                gameState.madnessLastTickTime = currentTime;
                if (gameState.networkManager) {
                    gameState.networkManager.sendMadnessDamage();
                }
            }
        }
    }

    // Update rage (Hulk Sister E skill)
    if (gameState.rageActive) {
        const elapsed = Date.now() - gameState.rageStartTime;

        // Check if rage duration is over
        if (elapsed >= gameState.rageDuration) {
            gameState.rageActive = false;
            logger.debug('Rage ended');
            if (gameState.networkManager) {
                gameState.networkManager.sendRageEnd();
            }
        }
    }

    // Handle skill input (Q, W, E) - only when not chatting and player is alive
    if (gameState.skillManager && !isChatting && !isPlayerDead) {
        // Q - Character-specific basic attack skill
        if (isKeyJustPressed('q')) {
            handleQSkill();
        }

        // W - Teleport (to random enemy) - Only for characters with teleport skill
        if (isKeyJustPressed('w') && !gameState.teleportEffect.active) {
            handleWSkill();
        }

        // E - Character-specific skill
        if (isKeyJustPressed('e')) {
            handleESkill();
        }
    }

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

// Game loop
function gameLoop(currentTime) {
    if (!gameState.running) return;

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

    // Check current screen state
    if (gameState.screen === 'waitingTeam') {
        // Waiting for server to assign team - show loading
        renderWaitingTeam(ctx);
    } else if (gameState.screen === 'teamAnnounce') {
        // Render team announcement (also runs game in background)
        update(gameState.deltaTime);
        render();
        renderTeamAnnounce(ctx);
    } else {
        // Normal gameplay
        update(gameState.deltaTime);
        render();
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// Render hit vignette effect (red screen edges when damaged)
function renderHitVignette(ctx) {
    if (gameState.hitVignetteTime === 0) return;

    const elapsed = Date.now() - gameState.hitVignetteTime;
    if (elapsed >= gameState.hitVignetteDuration) {
        gameState.hitVignetteTime = 0;
        return;
    }

    // Calculate opacity (starts strong, fades out)
    const progress = elapsed / gameState.hitVignetteDuration;
    const opacity = (1 - progress) * 0.6;

    ctx.save();

    // Create radial gradient from center (transparent) to edges (red)
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const innerRadius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.3;
    const outerRadius = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.8;

    const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(0.5, `rgba(255, 0, 0, ${opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, ${opacity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.restore();
}

// Render waiting for team assignment screen
function renderWaitingTeam(ctx) {
    ctx.save();

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Loading text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 48px Jua, sans-serif';
    ctx.fillText('팀 배정 중...', GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Animated dots
    const dots = '.'.repeat(Math.floor(Date.now() / 500) % 4);
    ctx.font = '600 48px Jua, sans-serif';
    ctx.fillText(dots, GAME_WIDTH / 2 + 150, GAME_HEIGHT / 2);

    ctx.restore();
}

// Render team announcement screen
function renderTeamAnnounce(ctx) {
    const team = gameState.team;
    const elapsed = Date.now() - gameState.teamAnnounceStartTime;
    const duration = gameState.teamAnnounceDuration;

    // Check if announcement is done
    if (elapsed >= duration) {
        gameState.screen = 'playing';
        return;
    }

    // Calculate animation progress
    const progress = elapsed / duration;

    // Background with team color
    const isRed = team === 'red';
    const bgColor = isRed ? 'rgba(220, 38, 38, 0.9)' : 'rgba(37, 99, 235, 0.9)';

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Team text
    const teamText = isRed ? '레드팀!' : '블루팀!';
    const teamEmoji = isRed ? '🔴' : '🔵';

    // Scale animation (starts big, settles)
    const scale = 1 + Math.max(0, (1 - progress * 2)) * 0.3;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Main text
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(120 * scale)}px Jua, sans-serif`;
    ctx.fillText(teamText, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

    // Emoji
    ctx.font = `${Math.round(80 * scale)}px sans-serif`;
    ctx.fillText(teamEmoji, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100);

    // Fade out at the end
    if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        ctx.fillStyle = `rgba(26, 26, 26, ${fadeProgress})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    ctx.restore();
}

// Render death screen with respawn timer
function renderDeathScreen(ctx) {
    // Dark overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Calculate remaining respawn time
    const player = gameState.player;
    const elapsedTime = Date.now() - player.deathTime;
    const remainingTime = Math.max(0, (player.respawnDelay - elapsedTime) / 1000);

    // Death message
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '600 72px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText('YOU DIED', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);

    // Respawn timer
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 36px Jua, sans-serif';
    ctx.fillText(`Respawning in ${remainingTime.toFixed(1)}s`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
}

// Render function
function render() {
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

    // Draw wave effect (local player)
    renderWaveEffect(ctx);

    // Draw pot smash effect (local player - Curry-Bear)
    renderPotSmashEffect(ctx);

    // Draw madness walk effect (local player)
    renderMadnessEffect(ctx);

    // Draw curry recovery effect (local player - Curry-Bear)
    renderCurryRecoveryEffect(ctx);

    // Draw rage effect (local player - Hulk Sister)
    renderRageEffect(ctx);

    // Draw skill UI (above game elements, below vignette)
    if (gameState.skillUI) {
        gameState.skillUI.render(ctx, GAME_WIDTH, GAME_HEIGHT);
    }

    // Draw stored damage UI for curry-bear
    if (gameState.selectedCharacter === 'curry-bear') {
        renderStoredDamageUI(ctx);
    }

    // Draw hit vignette effect (on top of everything)
    renderHitVignette(ctx);

    // Draw confusion effect (spinning spiral when confused)
    renderConfusionEffect(ctx);
}

// Render wave effect for local player (Crazy-Eyes Q skill)
function renderWaveEffect(ctx) {
    if (!gameState.waveEffect || !gameState.waveEffect.active) return;

    const elapsed = Date.now() - gameState.waveEffect.startTime;
    const progress = Math.min(elapsed / gameState.waveEffect.duration, 1);

    // Current radius (expanding outward)
    const currentRadius = gameState.waveEffect.maxRadius * progress;

    // Opacity fades as it expands
    const opacity = 1 - progress * 0.7;

    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.arc(gameState.waveEffect.x, gameState.waveEffect.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 105, 180, ${opacity * 0.5})`;
    ctx.lineWidth = 15;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(gameState.waveEffect.x, gameState.waveEffect.y, currentRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Spiral effect (rotating lines)
    const spiralCount = 6;
    for (let i = 0; i < spiralCount; i++) {
        const angle = (i / spiralCount) * Math.PI * 2 + progress * Math.PI * 2;
        const innerR = currentRadius * 0.3;
        const outerR = currentRadius * 0.9;

        ctx.beginPath();
        ctx.moveTo(
            gameState.waveEffect.x + Math.cos(angle) * innerR,
            gameState.waveEffect.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
            gameState.waveEffect.x + Math.cos(angle) * outerR,
            gameState.waveEffect.y + Math.sin(angle) * outerR
        );
        ctx.strokeStyle = `rgba(255, 182, 193, ${opacity * 0.7})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.restore();
}

// Render pot smash effect for local player (Curry-Bear Q skill)
function renderPotSmashEffect(ctx) {
    if (!gameState.potSmashEffect || !gameState.potSmashEffect.active) return;

    const elapsed = Date.now() - gameState.potSmashEffect.startTime;
    const progress = Math.min(elapsed / gameState.potSmashEffect.duration, 1);

    // End effect when done
    if (progress >= 1) {
        gameState.potSmashEffect.active = false;
        return;
    }

    const effect = gameState.potSmashEffect;
    const halfAngleRad = (effect.angle / 2) * Math.PI / 180;
    const baseAngle = Math.atan2(effect.dirY, effect.dirX);
    const startAngle = baseAngle - halfAngleRad;
    const endAngle = baseAngle + halfAngleRad;

    ctx.save();

    // Draw cone (curry splash)
    const opacity = (1 - progress) * 0.6;
    ctx.globalAlpha = opacity;

    // Fill cone
    ctx.beginPath();
    ctx.moveTo(effect.x, effect.y);
    ctx.arc(effect.x, effect.y, effect.range, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = '#FFD700'; // Gold (curry color)
    ctx.fill();

    // Draw cone outline
    ctx.globalAlpha = opacity * 1.5;
    ctx.strokeStyle = '#FFA500'; // Orange
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pot emoji at the edge
    const emojiDist = effect.range * 0.6 * (1 - progress * 0.3);
    const emojiX = effect.x + Math.cos(baseAngle) * emojiDist;
    const emojiY = effect.y + Math.sin(baseAngle) * emojiDist;

    ctx.globalAlpha = opacity * 1.5;
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍲', emojiX, emojiY);

    // Draw splash particles
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
        const particleAngle = startAngle + (endAngle - startAngle) * (i / (particleCount - 1));
        const particleDist = effect.range * (0.3 + progress * 0.7);
        const px = effect.x + Math.cos(particleAngle) * particleDist;
        const py = effect.y + Math.sin(particleAngle) * particleDist;

        ctx.beginPath();
        ctx.arc(px, py, 10 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
    }

    ctx.restore();
}

// Render madness walk effect (Crazy-Eyes E skill)
function renderMadnessEffect(ctx) {
    if (!gameState.madnessActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.madnessStartTime;
    const progress = elapsed / gameState.madnessDuration;
    const time = Date.now() / 1000;

    ctx.save();

    // Pulsing dark violet aura around player
    const pulseScale = 1 + Math.sin(time * 5) * 0.1;
    const radius = gameState.madnessRadius * pulseScale;

    // Outer glow
    const gradient = ctx.createRadialGradient(
        playerPos.x, playerPos.y, 0,
        playerPos.x, playerPos.y, radius
    );
    gradient.addColorStop(0, 'rgba(148, 0, 211, 0.3)');
    gradient.addColorStop(0.5, 'rgba(148, 0, 211, 0.15)');
    gradient.addColorStop(1, 'rgba(148, 0, 211, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Swirling particles
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time * 3;
        const particleRadius = radius * 0.7;
        const x = playerPos.x + Math.cos(angle) * particleRadius;
        const y = playerPos.y + Math.sin(angle) * particleRadius;

        ctx.fillStyle = `rgba(186, 85, 211, ${0.5 + Math.sin(time * 8 + i) * 0.3})`;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👀', x, y);
    }

    // Remaining time indicator (ring that shrinks)
    const remainingRatio = 1 - progress;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio);
    ctx.strokeStyle = 'rgba(148, 0, 211, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

// Render rage effect (Hulk Sister E skill)
function renderRageEffect(ctx) {
    if (!gameState.rageActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.rageStartTime;
    const progress = elapsed / gameState.rageDuration;
    const pulsePhase = Math.sin(elapsed / 100) * 0.3 + 0.7;

    ctx.save();

    // Red glow around player
    const glowRadius = 80 + Math.sin(elapsed / 150) * 15;
    const gradient = ctx.createRadialGradient(
        playerPos.x, playerPos.y, 0,
        playerPos.x, playerPos.y, glowRadius
    );
    gradient.addColorStop(0, `rgba(255, 0, 0, ${0.3 * pulsePhase})`);
    gradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.2 * pulsePhase})`);
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Flame particles rising
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + elapsed / 500;
        const particleRadius = 45 + Math.sin(elapsed / 200 + i) * 10;
        const riseAmount = (elapsed / 50 + i * 20) % 60;

        const px = playerPos.x + Math.cos(angle) * particleRadius;
        const py = playerPos.y - riseAmount;

        ctx.globalAlpha = 0.8 - (riseAmount / 60) * 0.6;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\uD83D\uDD25', px, py);
    }

    // Rage indicator above head
    ctx.globalAlpha = pulsePhase;
    ctx.font = 'bold 14px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF0000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    const indicatorY = playerPos.y - 70;
    ctx.strokeText('RAGE!', playerPos.x, indicatorY);
    ctx.fillText('RAGE!', playerPos.x, indicatorY);

    // Remaining time ring
    const remainingRatio = 1 - progress;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, glowRadius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
}

// Render confusion effect when player is confused (reversed controls)
function renderConfusionEffect(ctx) {
    if (typeof isConfused !== 'function' || !isConfused()) return;

    // Pink tint overlay
    ctx.save();
    ctx.fillStyle = 'rgba(255, 105, 180, 0.15)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Spinning spirals around edges
    const time = Date.now() / 1000;
    const spiralCount = 8;

    for (let i = 0; i < spiralCount; i++) {
        const angle = (i / spiralCount) * Math.PI * 2 + time * 2;
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;
        const radius = Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.4;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        ctx.fillStyle = `rgba(255, 182, 193, ${0.3 + Math.sin(time * 5 + i) * 0.2})`;
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', x, y);
    }

    // "혼란!" text in center
    ctx.fillStyle = '#FF69B4';
    ctx.font = 'bold 48px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('혼란!', GAME_WIDTH / 2, 80);

    ctx.restore();
}

// Render curry recovery effect (Curry-Bear E skill)
function renderCurryRecoveryEffect(ctx) {
    if (!gameState.curryRecoveryActive || !gameState.player) return;

    const playerPos = gameState.player.getPosition();
    const elapsed = Date.now() - gameState.curryRecoveryStartTime;
    const duration = GAME_CONFIG.SKILL_CURRY_RECOVERY.EFFECT_DURATION_MS;
    const progress = elapsed / duration;

    // End effect after duration
    if (progress >= 1) {
        gameState.curryRecoveryActive = false;
        return;
    }

    ctx.save();

    // Rising curry particles
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const baseRadius = 60;
        const riseAmount = progress * 100;
        const spreadX = Math.cos(angle) * baseRadius * (1 - progress * 0.5);
        const x = playerPos.x + spreadX;
        const y = playerPos.y - riseAmount + Math.sin(angle * 3 + elapsed / 100) * 10;

        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.font = `${20 + progress * 10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍛', x, y);
    }

    // Healing glow
    const glowRadius = 80 + progress * 40;
    const gradient = ctx.createRadialGradient(
        playerPos.x, playerPos.y, 0,
        playerPos.x, playerPos.y, glowRadius
    );
    gradient.addColorStop(0, `rgba(255, 165, 0, ${(1 - progress) * 0.4})`);
    gradient.addColorStop(0.5, `rgba(255, 215, 0, ${(1 - progress) * 0.2})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // "+" symbols rising
    ctx.fillStyle = '#32CD32';
    ctx.font = `bold ${24 + progress * 12}px sans-serif`;
    const plusCount = 5;
    for (let i = 0; i < plusCount; i++) {
        const plusAngle = (i / plusCount) * Math.PI * 2 + elapsed / 200;
        const plusRadius = 40 + progress * 60;
        const plusX = playerPos.x + Math.cos(plusAngle) * plusRadius;
        const plusY = playerPos.y - progress * 80 + Math.sin(elapsed / 150 + i) * 15;

        ctx.globalAlpha = (1 - progress) * 0.9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', plusX, plusY);
    }

    ctx.restore();
}

// Render stored damage UI for curry-bear
function renderStoredDamageUI(ctx) {
    // Always show for curry-bear (even when 0)
    ctx.save();

    // Position below the skill UI
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 120;

    // Background bar
    const barWidth = 150;
    const barHeight = 16;
    const fillRatio = gameState.storedDamage / gameState.maxStoredDamage;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);

    // Fill bar (orange gradient)
    const gradient = ctx.createLinearGradient(x - barWidth / 2, y, x + barWidth / 2, y);
    gradient.addColorStop(0, '#FFA500');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - barWidth / 2, y, barWidth * fillRatio, barHeight);

    // Border
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - barWidth / 2, y, barWidth, barHeight);

    // Label with emoji
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Jua, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`🍛 저장: ${gameState.storedDamage}/${gameState.maxStoredDamage}`, x, y - 2);

    ctx.restore();
}

// Trigger hit vignette effect (called from network.js when local player takes damage)
function triggerHitVignette() {
    gameState.hitVignetteTime = Date.now();
}

// Update stored damage for curry-bear (called from network.js)
function updateStoredDamage(storedDamage, maxStored) {
    gameState.storedDamage = storedDamage;
    gameState.maxStoredDamage = maxStored;
}

// Trigger curry recovery visual effect (called from network.js)
function triggerCurryRecoveryEffect(healAmount) {
    gameState.curryRecoveryActive = true;
    gameState.curryRecoveryStartTime = Date.now();
    gameState.storedDamage = 0; // Reset stored damage after recovery
}

// Find the nearest enemy to the player
// playersOnly: if true, only target other players (not dummies)
function findNearestEnemy(playersOnly = false) {
    const player = gameState.player;
    if (!player) return null;

    const playerPos = player.getPosition();
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    // Check dummies (skip if playersOnly)
    if (!playersOnly) {
        gameState.dummies.forEach(dummy => {
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
    if (gameState.networkManager) {
        gameState.networkManager.remotePlayers.forEach((remotePlayer, playerId) => {
            if (remotePlayer.isAlive()) {
                const dx = remotePlayer.x - playerPos.x;
                const dy = remotePlayer.y - playerPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = { x: remotePlayer.x, y: remotePlayer.y, type: 'player', playerId: playerId };
                }
            }
        });
    }

    // If no enemy found, return a point in front of the player (based on facing direction)
    if (!nearestEnemy) {
        // Default to right direction
        return { x: playerPos.x + 500, y: playerPos.y, type: 'none' };
    }

    return nearestEnemy;
}

// Find a random enemy (dummy or remote player) for teleport targeting
function findRandomEnemy() {
    const enemies = [];

    // Collect all alive dummies
    gameState.dummies.forEach(dummy => {
        if (dummy.isAlive()) {
            enemies.push({ x: dummy.x, y: dummy.y, type: 'dummy' });
        }
    });

    // Collect all alive remote players
    if (gameState.networkManager) {
        gameState.networkManager.remotePlayers.forEach(remotePlayer => {
            if (remotePlayer.isAlive()) {
                enemies.push({ x: remotePlayer.x, y: remotePlayer.y, type: 'player' });
            }
        });
    }

    // Return random enemy or null if none
    if (enemies.length === 0) {
        return null;
    }

    return enemies[Math.floor(Math.random() * enemies.length)];
}

// Handle Q skill based on selected character
function handleQSkill() {
    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'crazy-eyes': // 눈 돌아가는 사람 - 이상한 파동
            // Wave attack doesn't have a visual effect that blocks input
            const waveSkill = gameState.skillManager.useSkill('q');
            if (waveSkill) {
                logger.debug(`Used skill: ${waveSkill.name} - wave attack`);

                // Send wave attack to server
                if (gameState.networkManager) {
                    gameState.networkManager.sendWaveAttack();
                }

                // Show local wave effect (create if not exists)
                if (!gameState.waveEffect) {
                    gameState.waveEffect = {
                        active: false,
                        x: 0,
                        y: 0,
                        startTime: 0,
                        duration: GAME_CONFIG.SKILL_WAVE.EXPAND_DURATION_MS,
                        maxRadius: GAME_CONFIG.SKILL_WAVE.RADIUS
                    };
                }
                gameState.waveEffect.active = true;
                gameState.waveEffect.x = playerPos.x;
                gameState.waveEffect.y = playerPos.y;
                gameState.waveEffect.startTime = Date.now();
            }
            break;

        case 'curry-bear': // 카레 곰돌이 - 냄비 내려치기
            const potSkill = gameState.skillManager.useSkill('q');
            if (potSkill) {
                // Get attack direction (toward nearest enemy or last movement direction)
                let dirX = 1, dirY = 0;
                const target = findNearestEnemy(false);
                if (target) {
                    dirX = target.x - playerPos.x;
                    dirY = target.y - playerPos.y;
                    const len = Math.sqrt(dirX * dirX + dirY * dirY);
                    if (len > 0) {
                        dirX /= len;
                        dirY /= len;
                    }
                }

                logger.debug(`Used skill: ${potSkill.name} - pot smash`);

                // Send pot smash to server
                if (gameState.networkManager) {
                    gameState.networkManager.sendPotSmash(dirX, dirY);
                }

                // Show local pot smash effect
                if (!gameState.potSmashEffect) {
                    gameState.potSmashEffect = {
                        active: false,
                        x: 0,
                        y: 0,
                        dirX: 0,
                        dirY: 0,
                        startTime: 0,
                        duration: GAME_CONFIG.SKILL_POT_SMASH.EFFECT_DURATION_MS,
                        range: GAME_CONFIG.SKILL_POT_SMASH.RANGE,
                        angle: GAME_CONFIG.SKILL_POT_SMASH.ANGLE
                    };
                }
                gameState.potSmashEffect.active = true;
                gameState.potSmashEffect.x = playerPos.x;
                gameState.potSmashEffect.y = playerPos.y;
                gameState.potSmashEffect.dirX = dirX;
                gameState.potSmashEffect.dirY = dirY;
                gameState.potSmashEffect.startTime = Date.now();
            }
            break;

        case 'big-sis-hulk': // 헐크 언니 - 돌려 던지기
            const throwSkill = gameState.skillManager.useSkill('q');
            if (throwSkill) {
                // Find nearest enemy to grab
                const target = findNearestEnemy(true); // players only
                if (target) {
                    const dx = target.x - playerPos.x;
                    const dy = target.y - playerPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance <= GAME_CONFIG.SKILL_SPIN_THROW.GRAB_RANGE) {
                        // Calculate throw direction (away from hulk)
                        const dirX = dx / distance;
                        const dirY = dy / distance;

                        logger.debug(`Used skill: ${throwSkill.name} - grabbing enemy`);

                        // Send spin throw to server
                        if (gameState.networkManager) {
                            gameState.networkManager.sendSpinThrow(target.playerId, dirX, dirY);
                        }

                        // Show local effect
                        if (!gameState.spinThrowEffect) {
                            gameState.spinThrowEffect = {
                                active: false,
                                x: 0,
                                y: 0,
                                targetX: 0,
                                targetY: 0,
                                startTime: 0,
                                duration: GAME_CONFIG.SKILL_SPIN_THROW.EFFECT_DURATION_MS
                            };
                        }
                        gameState.spinThrowEffect.active = true;
                        gameState.spinThrowEffect.x = playerPos.x;
                        gameState.spinThrowEffect.y = playerPos.y;
                        gameState.spinThrowEffect.targetX = target.x;
                        gameState.spinThrowEffect.targetY = target.y;
                        gameState.spinThrowEffect.startTime = Date.now();
                    } else {
                        logger.debug('Enemy too far to grab');
                    }
                } else {
                    logger.debug('No enemy to grab');
                }
            }
            break;

        case 'alien': // 외계인 - 레이저 빔
        default:
            if (!gameState.laserBeamEffect.active) {
                const laserSkill = gameState.skillManager.useSkill('q');
                if (laserSkill) {
                    const target = findNearestEnemy(true); // playersOnly = true
                    if (target) {
                        gameState.laserBeamEffect.start(playerPos.x, playerPos.y, target.x, target.y);
                        logger.debug(`Used skill: ${laserSkill.name} - targeting ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);

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
            break;
    }
}

// Handle W skill based on selected character
function handleWSkill() {
    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'crazy-eyes': // 눈 돌아가는 사람 - W 스킬 없음
        case 'curry-bear': // 카레 곰돌이 - W 스킬 없음
            // 이 캐릭터들은 W 스킬이 없음
            break;

        case 'alien': // 외계인 - 순간이동
        default:
            const skill = gameState.skillManager.useSkill('w');
            if (skill) {
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
            break;
    }
}

// Handle E skill based on selected character
function handleESkill() {
    const playerPos = gameState.player.getPosition();

    switch (gameState.selectedCharacter) {
        case 'curry-bear': // 카레 곰돌이 - 카레 회복
            if (gameState.storedDamage <= 0) {
                logger.debug('No stored damage to recover');
                return;
            }

            const curryRecoverySkill = gameState.skillManager.useSkill('e');
            if (curryRecoverySkill) {
                logger.debug(`Used skill: ${curryRecoverySkill.name} - recovering ${gameState.storedDamage} HP`);

                // Trigger recovery effect
                gameState.curryRecoveryActive = true;
                gameState.curryRecoveryStartTime = Date.now();

                // Send to server
                if (gameState.networkManager) {
                    gameState.networkManager.sendCurryRecovery();
                }
            }
            break;

        case 'big-sis-hulk': // 헐크 언니 - 폭주
            // Don't allow if rage is already active
            if (gameState.rageActive) return;

            const rageSkill = gameState.skillManager.useSkill('e');
            if (rageSkill) {
                logger.debug(`Used skill: ${rageSkill.name} - RAGE activated!`);

                // Initialize rage state
                gameState.rageActive = true;
                gameState.rageStartTime = Date.now();
                gameState.rageDuration = GAME_CONFIG.SKILL_RAGE.DURATION_MS;

                // Send to server
                if (gameState.networkManager) {
                    gameState.networkManager.sendRageStart();
                }
            }
            break;

        case 'crazy-eyes': // 눈 돌아가는 사람 - 광기 산책
            // Don't allow if madness is already active
            if (gameState.madnessActive) return;

            const madnessSkill = gameState.skillManager.useSkill('e');
            if (madnessSkill) {
                logger.debug(`Used skill: ${madnessSkill.name} - madness walk activated`);

                // Initialize madness state
                gameState.madnessActive = true;
                gameState.madnessStartTime = Date.now();
                gameState.madnessDuration = GAME_CONFIG.SKILL_MADNESS.DURATION_MS;
                gameState.madnessLastTickTime = Date.now();
                gameState.madnessTickInterval = GAME_CONFIG.SKILL_MADNESS.TICK_INTERVAL_MS;
                gameState.madnessRadius = GAME_CONFIG.SKILL_MADNESS.RADIUS;

                // Send madness start to server
                if (gameState.networkManager) {
                    gameState.networkManager.sendMadnessStart();
                }
            }
            break;

        case 'alien': // 외계인 - 텔레파시
        default:
            if (!gameState.telepathyEffect.active) {
                const telepathySkill = gameState.skillManager.useSkill('e');
                if (telepathySkill) {
                    gameState.telepathyEffect.start(playerPos.x, playerPos.y);
                    logger.debug(`Used skill: ${telepathySkill.name}`);

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
            break;
    }
}

// Initialize skills based on selected character
function initializeCharacterSkills(characterId) {
    // Clear existing skills (skills is a Map, skillOrder is an array)
    gameState.skillManager.skills.clear();
    gameState.skillManager.skillOrder = [];

    switch (characterId) {
        case 'crazy-eyes': // 눈 돌아가는 사람
            // Q = 이상한 파동 (Wave Attack) - 기본 공격
            gameState.skillManager.addSkill(new Skill('이상한 파동', 'q', GAME_CONFIG.SKILL_WAVE.COOLDOWN_MS, GAME_CONFIG.SKILL_WAVE.COLOR, '🌀'));
            // E = 광기 산책
            gameState.skillManager.addSkill(new Skill('광기 산책', 'e', GAME_CONFIG.SKILL_MADNESS.COOLDOWN_MS, GAME_CONFIG.SKILL_MADNESS.COLOR, '👀'));
            logger.info('Initialized skills for 눈 돌아가는 사람');
            break;

        case 'curry-bear': // 카레 곰돌이
            // Q = 냄비 내려치기
            gameState.skillManager.addSkill(new Skill('냄비 내려치기', 'q', GAME_CONFIG.SKILL_POT_SMASH.COOLDOWN_MS, GAME_CONFIG.SKILL_POT_SMASH.COLOR, '🍲'));
            // E = 카레 회복
            gameState.skillManager.addSkill(new Skill('카레 회복', 'e', GAME_CONFIG.SKILL_CURRY_RECOVERY.COOLDOWN_MS, GAME_CONFIG.SKILL_CURRY_RECOVERY.COLOR, '🍛'));
            logger.info('Initialized skills for 카레 곰돌이');
            break;

        case 'big-sis-hulk': // 헐크 언니
            // Q = 돌려 던지기
            gameState.skillManager.addSkill(new Skill('돌려 던지기', 'q', GAME_CONFIG.SKILL_SPIN_THROW.COOLDOWN_MS, GAME_CONFIG.SKILL_SPIN_THROW.COLOR, '🌀'));
            // E = 폭주
            gameState.skillManager.addSkill(new Skill('폭주', 'e', GAME_CONFIG.SKILL_RAGE.COOLDOWN_MS, GAME_CONFIG.SKILL_RAGE.COLOR, '🔥'));
            logger.info('Initialized skills for 헐크 언니');
            break;

        case 'alien': // 외계인 (기본)
        default:
            // Q = 레이저 빔
            gameState.skillManager.addSkill(new Skill('레이저', 'q', GAME_CONFIG.SKILL_LASER.COOLDOWN_MS, GAME_CONFIG.SKILL_LASER.COLOR, '🎇'));
            // W = 순간이동
            gameState.skillManager.addSkill(new Skill('순간이동', 'w', GAME_CONFIG.SKILL_TELEPORT.COOLDOWN_MS, GAME_CONFIG.SKILL_TELEPORT.COLOR, '💫'));
            // E = 텔레파시
            gameState.skillManager.addSkill(new Skill('텔레파시', 'e', GAME_CONFIG.SKILL_TELEPATHY.COOLDOWN_MS, GAME_CONFIG.SKILL_TELEPATHY.COLOR, '👽'));
            logger.info('Initialized skills for 외계인');
            break;
    }
}

// Cleanup game resources to prevent memory leaks
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
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
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
loadHandler = init;
window.addEventListener('load', loadHandler);

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanupGame);
