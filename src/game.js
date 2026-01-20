// 미친 제자들 (Unhinged Students) - Main Game File

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game world constants (16:9 aspect ratio)
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

// Viewport/scaling variables
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Game state
const gameState = {
    screen: 'lobby', // 'lobby' | 'playing'
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
    hitVignetteDuration: 300, // 300ms vignette effect
    // Player selection from lobby
    selectedCharacter: 'alien',
    playerName: 'Player'
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

    console.log(`Canvas resized to ${canvas.width}x${canvas.height}, scale: ${scale.toFixed(2)}`);
}

// Initialize game (called on page load)
function init() {
    console.log('Initializing...');

    // Setup canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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

    console.log('Lobby initialized - waiting for player input');
}

// Start game after lobby selection
function startGame() {
    console.log(`Starting game with character: ${gameState.selectedCharacter}, name: ${gameState.playerName}`);

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
    const dummyPositions = [
        { x: GAME_WIDTH / 2 + 300, y: GAME_HEIGHT / 2, name: 'Dummy 1' },
        { x: GAME_WIDTH / 2 - 300, y: GAME_HEIGHT / 2, name: 'Dummy 2' },
        { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 300, name: 'Dummy 3' },
    ];

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
        dummy.maxHP = 30; // 3 hits to kill (10 damage x 3 = 30)
        dummy.currentHP = 30;
        gameState.dummies.push(dummy);
    });

    console.log(`Created ${gameState.dummies.length} test dummies`);

    // Initialize skill system
    gameState.skillManager = new SkillManager();

    // Add skills: Q = Laser Beam, W = Teleport, E = Telepathy
    gameState.skillManager.addSkill(new Skill('레이저', 'q', 2000, '#FF4444')); // Red - 2sec cooldown
    gameState.skillManager.addSkill(new Skill('순간이동', 'w', 7000, '#44FF44')); // Green - 7sec cooldown
    gameState.skillManager.addSkill(new Skill('텔레파시', 'e', 12000, '#8B5CF6')); // Purple - 12sec cooldown

    // Initialize skill UI
    gameState.skillUI = new SkillUI(gameState.skillManager);

    // Initialize laser beam effect
    gameState.laserBeamEffect = new LaserBeamEffect();

    // Initialize teleport effect
    gameState.teleportEffect = new TeleportEffect();

    // Initialize telepathy effect
    gameState.telepathyEffect = new TelepathyEffect();

    console.log('Skill system initialized');

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
            console.log(`Collected ${collectedShards.length} shard(s)! Total: ${gameState.stats.shardsCollected}`);

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
        // Q - Laser Beam (targets players only, not dummies)
        if (isKeyJustPressed('q') && !gameState.laserBeamEffect.active) {
            const skill = gameState.skillManager.useSkill('q');
            if (skill) {
                const playerPos = gameState.player.getPosition();
                const target = findNearestEnemy(true); // playersOnly = true
                if (target) {
                    gameState.laserBeamEffect.start(playerPos.x, playerPos.y, target.x, target.y);
                    console.log(`Used skill: ${skill.name} - targeting ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);

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
                    console.log(`Used skill: ${skill.name} - teleporting to ${target.type} at (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`);
                } else {
                    // No enemies, teleport randomly
                    gameState.teleportEffect.start(playerPos.x, playerPos.y, GAME_WIDTH, GAME_HEIGHT);
                    console.log(`Used skill: ${skill.name} - random teleport (no enemies)`);
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
                console.log(`Used skill: ${skill.name}`);

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

    // Update and render
    update(gameState.deltaTime);
    render();

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

    // Draw skill UI (above game elements, below vignette)
    if (gameState.skillUI) {
        gameState.skillUI.render(ctx, GAME_WIDTH, GAME_HEIGHT);
    }

    // Draw hit vignette effect (on top of everything)
    renderHitVignette(ctx);
}

// Trigger hit vignette effect (called from network.js when local player takes damage)
function triggerHitVignette() {
    gameState.hitVignetteTime = Date.now();
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
        gameState.networkManager.remotePlayers.forEach(remotePlayer => {
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

// Start game when page loads
window.addEventListener('load', init);
