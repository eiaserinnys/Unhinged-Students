// 미친 제자들 (Unhinged Students) - Main Game File
//
// Note: canvas, ctx, GAME_WIDTH, GAME_HEIGHT, scale, offset variables
// are defined in src/core/gameState.ts and accessed via getters/setters
// Use getCanvas() and getCtx() to access canvas and context

import { GAME_CONFIG, ASSET_BASE } from './config.js';
import { logger } from './utils/logger.js';
import {
    gameState,
    GAME_WIDTH,
    GAME_HEIGHT,
    getScale,
    setScale,
    setOffsetX,
    setOffsetY,
    getCanvas,
    setCanvas,
    getCtx,
    setCtx,
    getResizeHandler,
    setResizeHandler,
    setLoadHandler,
} from './core/gameState.js';
import {
    initInput,
    cleanupInput,
    updateInput,
    updateConfusion,
    isKeyPressed,
    isKeyJustPressed,
    Input,
} from './input.js';
import { LobbyManager } from './lobby.js';
import { Character } from './character.js';
import { ShardManager } from './shard.js';
import { ChatManager } from './chat.js';
import { SkillUI } from './skill.js';
import { NetworkManager } from './network/NetworkManager.js';
import type { TeamType } from './types/index.js';

// Game submodules
import {
    // Skill executor
    initSkillSystem,
    initializeCharacterSkills,
    handleQSkill,
    handleWSkill,
    handleESkill,
    handleRSkill,
    handleTSkill,
    cleanupSkillSystem,
    getLaserBeamEffect,
    getTeleportEffect,
    getTelepathyEffect,
    getSkillManager,
    getWaveEffect,
    getRatIllusionEffect,
    // Render effects
    renderHitVignette,
    renderWaitingTeam,
    renderTeamAnnounce,
    renderDeathScreen,
    renderWaveEffect,
    renderPotSmashEffect,
    renderMadnessEffect,
    renderRageEffect,
    renderRatIllusionEffect,
    renderConfusionEffect,
    renderCurryRecoveryEffect,
    renderStoredDamageUI,
    // Combat state
    updateStoredDamage,
    triggerCurryRecoveryEffect,
    startRatIllusionOnMe,
    endRatIllusionOnMe,
    getPotSmashEffect,
    // Match UI
    renderMatchTimer,
    renderScoreboard,
    renderMatchResult,
} from './game/index.js';

// Module-level references for managers (not in submodules)
let shardManager: ShardManager | null = null;
let chatManager: ChatManager | null = null;

// Resize canvas to fill window while maintaining 16:9 aspect ratio
function resizeCanvas(): void {
    const canvas = getCanvas();
    if (!canvas) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspectRatio = windowWidth / windowHeight;
    const gameAspectRatio = GAME_WIDTH / GAME_HEIGHT;

    let newOffsetX: number;
    let newOffsetY: number;

    if (windowAspectRatio > gameAspectRatio) {
        canvas.height = windowHeight;
        canvas.width = windowHeight * gameAspectRatio;
        newOffsetX = (windowWidth - canvas.width) / 2;
        newOffsetY = 0;
    } else {
        canvas.width = windowWidth;
        canvas.height = windowWidth / gameAspectRatio;
        newOffsetX = 0;
        newOffsetY = (windowHeight - canvas.height) / 2;
    }

    const newScale = canvas.width / GAME_WIDTH;

    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);

    canvas.style.position = 'absolute';
    canvas.style.left = newOffsetX + 'px';
    canvas.style.top = newOffsetY + 'px';

    logger.debug(
        `Canvas resized to ${canvas.width}x${canvas.height}, scale: ${newScale.toFixed(2)}`
    );
}

// Initialize game (called on page load)
function init(): void {
    console.log('[game.ts] init() called');
    logger.info('Initializing...');

    const canvasElement = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (!canvasElement) {
        console.error('[game.ts] Canvas element not found!');
        return;
    }

    const ctxElement = canvasElement.getContext('2d');
    if (!ctxElement) {
        console.error('[game.ts] Could not get 2D context!');
        return;
    }

    setCanvas(canvasElement);
    setCtx(ctxElement);

    resizeCanvas();
    setResizeHandler(resizeCanvas);
    window.addEventListener('resize', resizeCanvas);

    initInput(canvasElement);

    console.log('[game.ts] Creating LobbyManager...');
    gameState.lobbyManager = new LobbyManager();
    console.log('[game.ts] LobbyManager created:', gameState.lobbyManager);
    gameState.lobbyManager.setOnGameStart((selection) => {
        console.log('[game.ts] onGameStart callback fired with:', selection);
        gameState.selectedCharacter = selection.character;
        gameState.playerName = selection.playerName;
        startGame();
    });

    console.log('[game.ts] init() complete');
    logger.info('Lobby initialized - waiting for player input');
}

// Start game after lobby selection
function startGame(): void {
    logger.info(
        `Starting game with character: ${gameState.selectedCharacter}, name: ${gameState.playerName}`
    );

    gameState.screen = 'waitingTeam';

    const characterImage = LobbyManager.getCharacterImagePath(gameState.selectedCharacter);

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
    } else if (gameState.selectedCharacter === 'squeak-squeak') {
        gameState.player.maxHP = GAME_CONFIG.SQUEAK_STATS.MAX_HP;
        gameState.player.currentHP = GAME_CONFIG.SQUEAK_STATS.MAX_HP;
        gameState.player.speed = GAME_CONFIG.SQUEAK_STATS.SPEED;
        logger.debug(
            `Squeak-Squeak: HP=${GAME_CONFIG.SQUEAK_STATS.MAX_HP}, Speed=${GAME_CONFIG.SQUEAK_STATS.SPEED}`
        );
    }

    // Create test dummies
    const dummyConfig = GAME_CONFIG.DUMMY;
    const dummyPositions = dummyConfig.POSITIONS.map((pos) => ({
        x: GAME_WIDTH / 2 + pos.offsetX,
        y: GAME_HEIGHT / 2 + pos.offsetY,
        name: pos.name,
    }));

    dummyPositions.forEach((pos) => {
        const dummy = new Character(
            pos.x,
            pos.y,
            `${ASSET_BASE}/image/alien.png`,
            GAME_HEIGHT,
            pos.name,
            true
        );
        dummy.speed = 0;
        dummy.maxHP = dummyConfig.MAX_HP;
        dummy.currentHP = dummyConfig.MAX_HP;
        gameState.dummies.push(dummy);
    });

    logger.debug(`Created ${gameState.dummies.length} test dummies`);

    // Initialize skill system (from skillExecutor module)
    const skills = initSkillSystem();
    gameState.skillManager = skills.skillManager;
    gameState.laserBeamEffect = skills.laserBeamEffect;
    gameState.teleportEffect = skills.teleportEffect;
    gameState.telepathyEffect = skills.telepathyEffect;

    initializeCharacterSkills(gameState.selectedCharacter);

    gameState.skillUI = new SkillUI(skills.skillManager);

    logger.debug('Skill system initialized');

    // Create shard manager
    shardManager = new ShardManager();
    shardManager.enableServerMode();
    gameState.shardManager = shardManager;

    // Initialize chat manager
    chatManager = new ChatManager();
    chatManager.setPlayer(gameState.player);
    gameState.chatManager = chatManager;

    // Initialize network manager
    gameState.networkManager = new NetworkManager();
    gameState.networkManager.setShardManager(shardManager);
    gameState.networkManager.setLocalPlayer(gameState.player);
    gameState.networkManager.setDummies(gameState.dummies);

    gameState.networkManager.onTeamAssigned = (team: TeamType) => {
        gameState.team = team;
        gameState.screen = 'teamAnnounce';
        gameState.teamAnnounceStartTime = Date.now();
        logger.info(`Team assigned: ${team}`);
    };

    gameState.networkManager.setGameCallbacks({
        onStoredDamageUpdate: updateStoredDamage,
        onCurryRecoveryEffect: triggerCurryRecoveryEffect,
        onRatIllusionStart: startRatIllusionOnMe,
        onRatIllusionEnd: endRatIllusionOnMe,
    });

    gameState.networkManager.connect();

    setTimeout(() => {
        if (gameState.networkManager?.socket && chatManager) {
            chatManager.setSocket(gameState.networkManager.socket);
            chatManager.addSystemMessage('Connected to server. Press Enter to chat.');
        }
    }, 500);

    gameState.running = true;
    gameLoop(0);
}

// Update game logic
function update(deltaTime: number): void {
    const isChatting = chatManager && chatManager.isChatInputFocused();
    const isPlayerDead = gameState.player && gameState.player.isDead;
    const skillManager = getSkillManager();
    const laserBeamEffect = getLaserBeamEffect();
    const teleportEffect = getTeleportEffect();
    const telepathyEffect = getTelepathyEffect();
    const ratIllusionEffect = getRatIllusionEffect();
    const waveEffect = getWaveEffect();

    if (gameState.player && !isChatting && !isPlayerDead) {
        gameState.player.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);

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

    if (shardManager && gameState.player) {
        shardManager.update();

        const collectedShards = shardManager.checkCollisions(gameState.player);
        if (collectedShards.length > 0) {
            gameState.stats.shardsCollected += collectedShards.length;
            logger.debug(
                `Collected ${collectedShards.length} shard(s)! Total: ${gameState.stats.shardsCollected}`
            );

            gameState.player.addExperience(collectedShards.length);

            if (gameState.networkManager) {
                collectedShards.forEach((shard) => {
                    if (shard.id !== null) {
                        gameState.networkManager?.sendShardCollection(shard.id);
                    }
                });
            }
        }
    }

    // Update dummies
    gameState.dummies.forEach((dummy) => {
        dummy.update({ width: GAME_WIDTH, height: GAME_HEIGHT }, deltaTime);
    });

    // Send attack to server
    if (gameState.player && gameState.player.isAttacking && !gameState.player.isDead) {
        const attackArea = gameState.player.getAttackArea();

        const currentTime = Date.now();
        if (
            !gameState.lastAttackSentTime ||
            currentTime - gameState.lastAttackSentTime > gameState.player.attackCooldown
        ) {
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
    }

    // Update remote players
    if (gameState.networkManager) {
        gameState.networkManager.update();
    }

    // Update confusion effect
    if (typeof updateConfusion === 'function') {
        updateConfusion();
    }

    // Update skill manager
    if (skillManager) {
        skillManager.update();
    }

    // Update wave effect
    if (waveEffect && waveEffect.active) {
        const elapsed = Date.now() - waveEffect.startTime;
        if (elapsed >= waveEffect.duration) {
            waveEffect.active = false;
        }
    }

    // Update rat illusion effect (Squeak-Squeak Q skill)
    if (ratIllusionEffect && ratIllusionEffect.active) {
        const elapsed = Date.now() - ratIllusionEffect.startTime;
        if (elapsed >= ratIllusionEffect.duration) {
            ratIllusionEffect.active = false;
            ratIllusionEffect.rats = [];
        } else {
            const speed = 0.02;
            for (const rat of ratIllusionEffect.rats) {
                const dx = rat.targetX - rat.x;
                const dy = rat.targetY - rat.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 5) {
                    rat.x += dx * speed;
                    rat.y += dy * speed;
                    rat.angle = Math.atan2(dy, dx);
                } else {
                    const newAngle = Math.random() * Math.PI * 2;
                    const newDistance = ratIllusionEffect.radius * (0.3 + Math.random() * 0.7);
                    rat.targetX = ratIllusionEffect.x + Math.cos(newAngle) * newDistance;
                    rat.targetY = ratIllusionEffect.y + Math.sin(newAngle) * newDistance;
                }

                rat.wigglePhase += 0.3;
            }

            // Mouse click on rats
            if (Input.mouse.pressed && Input.mouse.button === 0) {
                const scale = getScale();
                const gameX = Input.mouse.x / scale;
                const gameY = Input.mouse.y / scale;

                const clickRadius = 40;
                for (let i = 0; i < ratIllusionEffect.rats.length; i++) {
                    const rat = ratIllusionEffect.rats[i];
                    const rdx = gameX - rat.x;
                    const rdy = gameY - rat.y;
                    const distance = Math.sqrt(rdx * rdx + rdy * rdy);

                    if (distance < clickRadius) {
                        logger.debug(`Clicked rat ${i}`);
                        if (gameState.networkManager) {
                            gameState.networkManager.sendRatClick(i);
                        }
                        Input.mouse.pressed = false;
                        break;
                    }
                }
            }
        }
    }

    // Update madness walk (Crazy-Eyes E skill)
    if (gameState.madnessActive) {
        const currentTime = Date.now();
        const elapsed = currentTime - gameState.madnessStartTime;

        if (elapsed >= gameState.madnessDuration) {
            gameState.madnessActive = false;
            logger.debug('Madness walk ended');
            if (gameState.networkManager) {
                gameState.networkManager.sendMadnessEnd();
            }
        } else {
            const isMoving =
                isKeyPressed('arrowup') ||
                isKeyPressed('arrowdown') ||
                isKeyPressed('arrowleft') ||
                isKeyPressed('arrowright');

            if (
                isMoving &&
                currentTime - gameState.madnessLastTickTime >= gameState.madnessTickInterval
            ) {
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

        if (elapsed >= gameState.rageDuration) {
            gameState.rageActive = false;
            logger.debug('Rage ended');
            if (gameState.networkManager) {
                gameState.networkManager.sendRageEnd();
            }
        }
    }

    // Handle skill input (Q, W, E, R, T)
    if (skillManager && !isChatting && !isPlayerDead) {
        if (isKeyJustPressed('q')) {
            handleQSkill();
        }

        if (isKeyJustPressed('w') && teleportEffect && !teleportEffect.active) {
            handleWSkill();
        }

        if (isKeyJustPressed('e')) {
            handleESkill();
        }

        if (isKeyJustPressed('r')) {
            handleRSkill();
        }

        if (isKeyJustPressed('t')) {
            handleTSkill();
        }
    }

    // Update laser beam effect
    if (laserBeamEffect && laserBeamEffect.active) {
        const playerPos = gameState.player?.getPosition();
        if (playerPos) {
            laserBeamEffect.update(playerPos.x, playerPos.y);
        }

        if (laserBeamEffect.shouldDealDamage()) {
            const line = laserBeamEffect.getLaserLine();
            if (line && gameState.networkManager) {
                gameState.networkManager.sendLaserAttack(
                    line.x1,
                    line.y1,
                    line.x2,
                    line.y2,
                    laserBeamEffect.damage
                );
            }
        }
    }

    // Update teleport effect
    if (teleportEffect && teleportEffect.active) {
        const teleportResult = teleportEffect.update();

        if (teleportResult && teleportResult.teleported && gameState.player) {
            gameState.player.x = teleportResult.x;
            gameState.player.y = teleportResult.y;
        }

        if (teleportEffect.shouldDealDamage()) {
            const area = teleportEffect.getDamageArea();
            if (area && gameState.networkManager) {
                gameState.networkManager.sendTeleportDamage(
                    area.x,
                    area.y,
                    area.radius,
                    area.damage ?? GAME_CONFIG.SKILL_TELEPORT.DAMAGE
                );
            }
        }
    }

    // Update telepathy effect
    if (telepathyEffect && telepathyEffect.active) {
        const playerPos = gameState.player?.getPosition();
        if (playerPos) {
            telepathyEffect.update(playerPos.x, playerPos.y);
        }

        if (telepathyEffect.shouldDealDamage()) {
            const area = telepathyEffect.getDamageArea();
            if (area && gameState.networkManager) {
                gameState.networkManager.sendTelepathyDamage(
                    area.x,
                    area.y,
                    area.radius,
                    area.damagePerTarget ?? GAME_CONFIG.SKILL_TELEPATHY.DAMAGE_PER_TICK,
                    area.maxHeal ?? GAME_CONFIG.SKILL_TELEPATHY.MAX_HEAL_PER_TICK
                );
            }
        }
    }
}

// Game loop
function gameLoop(currentTime: number): void {
    if (!gameState.running) return;

    const ctx = getCtx();
    const canvas = getCanvas();

    if (!ctx || !canvas) return;

    if (gameState.lastFrameTime === 0) {
        gameState.lastFrameTime = currentTime;
    }
    gameState.deltaTime = (currentTime - gameState.lastFrameTime) / 1000;
    gameState.lastFrameTime = currentTime;

    if (gameState.deltaTime > 0.1) {
        gameState.deltaTime = 0.1;
    }

    updateInput();

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(getScale(), getScale());

    if (gameState.screen === 'waitingTeam') {
        renderWaitingTeam(ctx);
    } else if (gameState.screen === 'teamAnnounce') {
        update(gameState.deltaTime);
        render();
        renderTeamAnnounce(ctx);
    } else if (gameState.screen === 'matchResult') {
        // Freeze gameplay, show result overlay
        render();
        renderMatchResult(ctx);
    } else {
        update(gameState.deltaTime);
        render();
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// Render function
function render(): void {
    const ctx = getCtx();
    if (!ctx) return;

    const laserBeamEffect = getLaserBeamEffect();
    const teleportEffect = getTeleportEffect();
    const telepathyEffect = getTelepathyEffect();
    const waveEffect = getWaveEffect();
    const potSmashEffect = getPotSmashEffect();
    const ratIllusionEffect = getRatIllusionEffect();

    // Draw match timer + scoreboard (replaces title during match)
    if (gameState.matchRemainingMs > 0) {
        renderMatchTimer(ctx);
        renderScoreboard(ctx);
    } else {
        // Default: title + connection status
        ctx.fillStyle = '#00D9FF';
        ctx.font = '600 28px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('미친 제자들', GAME_WIDTH / 2, 40);

        ctx.fillStyle = '#E0E0E0';
        ctx.font = '16px Jua, sans-serif';
        const connectionStatus =
            gameState.networkManager && gameState.networkManager.connected
                ? 'Connected'
                : 'Connecting...';
        const playerCount = gameState.networkManager
            ? gameState.networkManager.remotePlayers.size + 1
            : 1;
        ctx.fillText(`${connectionStatus} | Players: ${playerCount}`, GAME_WIDTH / 2, 70);
    }

    // Draw shards
    if (shardManager) {
        shardManager.render(ctx);
    }

    // Draw remote players
    if (gameState.networkManager) {
        gameState.networkManager.render(ctx);
    }

    // Draw test dummies
    gameState.dummies.forEach((dummy) => {
        if (dummy.isAlive()) {
            dummy.render(ctx);
        }
    });

    // Draw local player
    if (gameState.player) {
        if (gameState.player.isDead) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            gameState.player.render(ctx);
            ctx.restore();
        } else {
            gameState.player.render(ctx);
        }
    }

    // Draw death screen overlay
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

        if (level >= gameState.player.maxLevel) {
            ctx.fillText(`Level: ${level} (MAX)`, 10, 40);
        } else {
            ctx.fillText(`Level: ${level} (${exp}/${requiredExp} exp)`, 10, 40);
        }
    }

    if (shardManager) {
        ctx.fillText(`Shards Collected: ${gameState.stats.shardsCollected}`, 10, 60);
        ctx.fillText(
            `Active Shards: ${shardManager.getActiveShardCount()}/${shardManager.getMaxActiveShards()}`,
            10,
            80
        );
    }

    // Draw effects
    if (laserBeamEffect) {
        laserBeamEffect.render(ctx);
    }
    if (teleportEffect) {
        teleportEffect.render(ctx);
    }
    if (telepathyEffect) {
        telepathyEffect.render(ctx);
    }

    renderWaveEffect(ctx, waveEffect);
    renderPotSmashEffect(ctx, potSmashEffect);
    renderMadnessEffect(ctx);
    renderCurryRecoveryEffect(ctx);
    renderRageEffect(ctx);
    renderRatIllusionEffect(ctx, ratIllusionEffect);

    // Draw skill UI
    if (gameState.skillUI) {
        gameState.skillUI.render(ctx, GAME_WIDTH, GAME_HEIGHT);
    }

    // Draw stored damage UI for curry-bear
    if (gameState.selectedCharacter === 'curry-bear') {
        renderStoredDamageUI(ctx);
    }

    // Draw hit vignette effect (on top of everything)
    renderHitVignette(ctx);

    // Draw confusion effect
    renderConfusionEffect(ctx);
}

// Cleanup game resources to prevent memory leaks
function cleanupGame(): void {
    gameState.running = false;

    if (typeof cleanupInput === 'function') {
        cleanupInput();
    }

    if (gameState.networkManager) {
        gameState.networkManager.disconnect();
        gameState.networkManager = null;
    }

    const currentResizeHandler = getResizeHandler();
    if (currentResizeHandler) {
        window.removeEventListener('resize', currentResizeHandler);
        setResizeHandler(() => {});
    }

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

    // Clear module-level references
    shardManager = null;
    chatManager = null;
    cleanupSkillSystem();

    logger.info('Game cleaned up');
}

// Start game when page loads
setLoadHandler(init);
window.addEventListener('load', init);

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanupGame);
