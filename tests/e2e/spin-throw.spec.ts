import { test, expect, Page, ConsoleMessage } from '@playwright/test';

/**
 * E2E Test: Hulk Sister's Spin Throw (Q Skill) Damage Application
 *
 * Test Scenario:
 * 1. Connect to the game
 * 2. Select Hulk Sister (big-sis-hulk) character in lobby
 * 3. Enter player name and start game
 * 4. Move close to Dummy
 * 5. Use Q skill (Spin Throw) on Dummy
 * 6. Verify Dummy's HP bar decreases
 * 7. Check console logs for [SpinThrow] messages
 */

// Store console logs for analysis
interface ConsoleLog {
    type: string;
    text: string;
    timestamp: number;
}

test.describe('Spin Throw Skill Damage Test', () => {
    let consoleLogs: ConsoleLog[] = [];

    test.beforeEach(async ({ page }) => {
        consoleLogs = [];

        // Capture all console messages
        page.on('console', (msg: ConsoleMessage) => {
            consoleLogs.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
            });
        });
    });

    test('should apply damage to Dummy with Q skill (Spin Throw)', async ({ page }) => {
        // Step 1: Navigate to the game
        console.log('Step 1: Navigating to the game...');
        await page.goto('/game/');

        // Wait for the game to load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // Allow game initialization

        // Step 2: Take initial screenshot of lobby
        await page.screenshot({
            path: 'tests/e2e/artifacts/01-lobby-loaded.png',
            fullPage: true
        });
        console.log('Screenshot: Lobby loaded');

        // Step 3: Select Hulk Sister character
        console.log('Step 3: Selecting Hulk Sister character...');

        // Look for the character selection option with data-character="big-sis-hulk"
        const hulkOption = page.locator('[data-character="big-sis-hulk"]');
        const isHulkVisible = await hulkOption.isVisible().catch(() => false);

        if (isHulkVisible) {
            await hulkOption.click();
            console.log('Hulk Sister character selected');
        } else {
            // Try alternative selectors
            const altHulk = page.locator('.character-option:has-text("hulk")').or(
                page.locator('.character-option:has-text("Hulk")')
            );
            const isAltVisible = await altHulk.first().isVisible().catch(() => false);
            if (isAltVisible) {
                await altHulk.first().click();
                console.log('Hulk Sister character selected (alt selector)');
            } else {
                console.log('Warning: Could not find Hulk Sister character option');
            }
        }
        await page.waitForTimeout(500);

        // Step 4: Enter player name
        console.log('Step 4: Entering player name...');
        const nameInput = page.locator('#playerNameInput');
        const isNameInputVisible = await nameInput.isVisible().catch(() => false);

        if (isNameInputVisible) {
            await nameInput.fill('TestPlayer');
            console.log('Player name entered');
        } else {
            console.log('Warning: Player name input not found');
        }

        await page.screenshot({
            path: 'tests/e2e/artifacts/02-character-selected.png',
            fullPage: true
        });

        // Step 5: Click start game button
        console.log('Step 5: Starting game...');
        const startButton = page.locator('#startGameBtn');
        const isStartVisible = await startButton.isVisible().catch(() => false);

        if (isStartVisible) {
            await startButton.click();
            console.log('Start game button clicked');
        } else {
            // Try pressing Enter as alternative
            await page.keyboard.press('Enter');
            console.log('Pressed Enter to start game');
        }

        // Wait for game to start and connect
        await page.waitForTimeout(5000);

        await page.screenshot({
            path: 'tests/e2e/artifacts/03-game-started.png',
            fullPage: true
        });

        // Step 6: Check game state using window.gameState
        console.log('Step 6: Checking game state...');
        const gameState = await page.evaluate(() => {
            // @ts-ignore - gameState is a global variable
            const gs = window.gameState;
            if (!gs) return { error: 'gameState not found' };

            return {
                screen: gs.screen,
                running: gs.running,
                hasDummies: gs.dummies && gs.dummies.length > 0,
                dummyCount: gs.dummies?.length || 0,
                dummies: gs.dummies?.map((d: any, i: number) => ({
                    index: i,
                    currentHP: d.currentHP,
                    maxHP: d.maxHP,
                    x: d.x,
                    y: d.y,
                })),
                player: gs.player ? {
                    characterId: gs.player.characterId,
                    x: gs.player.x,
                    y: gs.player.y,
                    currentHP: gs.player.currentHP,
                } : null,
                selectedCharacter: gs.selectedCharacter,
                networkConnected: gs.networkManager?.connected || false,
            };
        });

        console.log('Game state:', JSON.stringify(gameState, null, 2));

        // Wait more if game is not running
        if (gameState.screen !== 'playing' || !gameState.running) {
            console.log('Game not fully started yet, waiting...');
            await page.waitForTimeout(5000);

            // Re-evaluate
            const newGameState = await page.evaluate(() => {
                // @ts-ignore
                const gs = window.gameState;
                return {
                    screen: gs?.screen,
                    running: gs?.running,
                    hasDummies: gs?.dummies?.length > 0,
                    dummyCount: gs?.dummies?.length || 0,
                    playerCharacter: gs?.player?.characterId,
                    networkConnected: gs?.networkManager?.connected,
                };
            });
            console.log('Updated game state:', JSON.stringify(newGameState, null, 2));
        }

        // Step 7: Move player close to Dummy
        console.log('Step 7: Moving player close to Dummy...');

        const moveResult = await page.evaluate(() => {
            // @ts-ignore
            const gs = window.gameState;
            if (!gs || !gs.player || !gs.dummies || gs.dummies.length === 0) {
                return { error: 'Game entities not found', details: {
                    hasGameState: !!gs,
                    hasPlayer: !!gs?.player,
                    dummyCount: gs?.dummies?.length
                }};
            }

            const dummy = gs.dummies[0];
            const player = gs.player;

            // Calculate direction to dummy
            const dx = dummy.x - player.x;
            const dy = dummy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Move player closer to dummy (within Q skill range ~150px)
            const targetDistance = 100;
            if (distance > targetDistance) {
                const ratio = (distance - targetDistance) / distance;
                player.x = player.x + dx * ratio;
                player.y = player.y + dy * ratio;
            }

            return {
                playerPos: { x: player.x, y: player.y },
                dummyPos: { x: dummy.x, y: dummy.y },
                distance: Math.sqrt(
                    Math.pow(dummy.x - player.x, 2) +
                    Math.pow(dummy.y - player.y, 2)
                ),
                playerCharacter: player.characterId,
            };
        });

        console.log('Move result:', JSON.stringify(moveResult, null, 2));
        await page.waitForTimeout(500);

        // Step 8: Record Dummy's HP before attack
        const dummyHPBefore = await page.evaluate(() => {
            // @ts-ignore
            return window.gameState?.dummies?.[0]?.currentHP || 0;
        });
        console.log(`Step 8: Dummy HP before Q skill: ${dummyHPBefore}`);

        await page.screenshot({
            path: 'tests/e2e/artifacts/04-before-attack.png',
            fullPage: true
        });

        // Step 9: Use Q skill (Spin Throw)
        console.log('Step 9: Using Q skill (Spin Throw)...');

        // Clear previous console logs count for comparison
        const spinThrowLogsCountBefore = consoleLogs.filter(log =>
            log.text.includes('[SpinThrow]') || log.text.includes('spinThrow')
        ).length;
        console.log(`SpinThrow logs before attack: ${spinThrowLogsCountBefore}`);

        // First, click on the canvas to ensure it has focus (not the chat input)
        const canvas = page.locator('#gameCanvas');
        await canvas.click({ position: { x: 640, y: 360 } });
        console.log('Clicked on canvas to focus');
        await page.waitForTimeout(500);

        // Press Escape to close any chat/UI that might be open
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // Press Q key to use the skill
        await page.keyboard.press('KeyQ');
        console.log('Q key pressed');

        // Wait for skill animation and network sync
        await page.waitForTimeout(2000);

        // Try pressing Q again
        await canvas.click({ position: { x: 640, y: 360 } });
        await page.keyboard.press('KeyQ');
        console.log('Q key pressed again');
        await page.waitForTimeout(2000);

        // Step 10: Check for SpinThrow console logs
        const spinThrowLogsAfter = consoleLogs.filter(log =>
            log.text.includes('[SpinThrow]') ||
            log.text.includes('spinThrow') ||
            log.text.includes('SpinThrow')
        );
        console.log(`Step 10: SpinThrow logs after attack: ${spinThrowLogsAfter.length}`);

        spinThrowLogsAfter.forEach((log, i) => {
            console.log(`  Log ${i + 1}: ${log.text}`);
        });

        await page.screenshot({
            path: 'tests/e2e/artifacts/05-after-attack.png',
            fullPage: true
        });

        // Step 11: Check Dummy's HP after attack
        const dummyHPAfter = await page.evaluate(() => {
            // @ts-ignore
            return window.gameState?.dummies?.[0]?.currentHP || 0;
        });
        console.log(`Step 11: Dummy HP after Q skill: ${dummyHPAfter}`);

        // Step 12: Calculate damage
        const damageDone = dummyHPBefore - dummyHPAfter;
        console.log(`Step 12: Damage done: ${damageDone}`);

        // Step 13: Final screenshot
        await page.screenshot({
            path: 'tests/e2e/artifacts/06-final-state.png',
            fullPage: true
        });

        // Step 14: Generate test report
        console.log('\n========== TEST REPORT ==========');
        console.log(`Character: ${moveResult.playerCharacter || 'unknown'}`);
        console.log(`Dummy HP Before: ${dummyHPBefore}`);
        console.log(`Dummy HP After: ${dummyHPAfter}`);
        console.log(`Damage Applied: ${damageDone}`);
        console.log(`SpinThrow Events Received: ${spinThrowLogsAfter.length}`);

        // Check if damage was applied
        const damageApplied = damageDone > 0;
        console.log(`Damage Applied Successfully: ${damageApplied ? 'YES' : 'NO'}`);

        // Check for playerSpinThrow event in logs
        const hasSpinThrowEvent = spinThrowLogsAfter.some(log =>
            log.text.includes('[SpinThrow] Received')
        );
        console.log(`playerSpinThrow Event Received: ${hasSpinThrowEvent ? 'YES' : 'NO'}`);

        // Check if damage value is in the event
        const hasDamageValue = spinThrowLogsAfter.some(log =>
            log.text.includes('damage')
        );
        console.log(`Damage Value in Event: ${hasDamageValue ? 'YES' : 'NO'}`);

        console.log('================================\n');

        // Output all relevant console logs for debugging
        console.log('\n========== ALL RELEVANT CONSOLE LOGS ==========');
        consoleLogs
            .filter(log =>
                log.text.includes('SpinThrow') ||
                log.text.includes('spinThrow') ||
                log.text.includes('dummy') ||
                log.text.includes('Dummy') ||
                log.text.includes('damage') ||
                log.text.includes('HP') ||
                log.text.includes('Connected') ||
                log.text.includes('character')
            )
            .slice(-30) // Last 30 relevant logs
            .forEach(log => {
                console.log(`[${log.type}] ${log.text}`);
            });
        console.log('================================================\n');

        // Possible issues analysis
        if (!damageApplied) {
            console.log('\n!!! WARNING: No damage was applied to Dummy !!!');
            console.log('Possible causes:');
            console.log('1. Player was not close enough to Dummy');
            console.log('2. Q skill did not target Dummy correctly');
            console.log('3. Server did not process the spinThrow event');
            console.log('4. Character is not Hulk Sister (big-sis-hulk)');
            console.log('5. Game was not fully started');

            // Check if the character is correct
            const characterId = moveResult.playerCharacter;
            if (characterId !== 'big-sis-hulk') {
                console.log(`\n>>> Character is "${characterId}", not "big-sis-hulk"!`);
                console.log('>>> Q skill for this character may not be Spin Throw.');
            }
        }

        // Soft assertion - report findings rather than fail
        expect.soft(damageApplied, 'Damage should be applied to Dummy').toBeTruthy();
        expect.soft(spinThrowLogsAfter.length, 'Should have SpinThrow related logs').toBeGreaterThan(0);
    });

    test('verify game loads and Dummy exists', async ({ page }) => {
        console.log('Test: Verify game loads and Dummy exists');

        await page.goto('/game/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check if lobby is visible
        const lobbyVisible = await page.locator('#lobbyContainer').isVisible().catch(() => false);
        console.log(`Lobby visible: ${lobbyVisible}`);

        if (lobbyVisible) {
            // Select any character and start game
            const firstChar = page.locator('.character-option').first();
            if (await firstChar.isVisible()) {
                await firstChar.click();
            }

            const nameInput = page.locator('#playerNameInput');
            if (await nameInput.isVisible()) {
                await nameInput.fill('Tester');
            }

            const startBtn = page.locator('#startGameBtn');
            if (await startBtn.isVisible()) {
                await startBtn.click();
            }

            await page.waitForTimeout(5000);
        }

        // Check game state
        const gameInfo = await page.evaluate(() => {
            // @ts-ignore
            const gs = window.gameState;
            if (!gs) return { error: 'No gameState' };

            return {
                screen: gs.screen,
                running: gs.running,
                dummyCount: gs.dummies?.length || 0,
                hasPlayer: !!gs.player,
                selectedCharacter: gs.selectedCharacter,
                networkConnected: gs.networkManager?.connected,
            };
        });

        console.log('Game info:', JSON.stringify(gameInfo, null, 2));

        await page.screenshot({
            path: 'tests/e2e/artifacts/verify-game-state.png',
            fullPage: true
        });

        // Check that game is running and has dummies
        expect(gameInfo.running).toBeTruthy();
        expect(gameInfo.dummyCount).toBeGreaterThan(0);
    });
});
