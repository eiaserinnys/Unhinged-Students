// Lobby system for Unhinged Students

import { logger } from './utils/logger.js';
import type { CharacterType, ILobbyManager } from './types/index.js';

interface CharacterInfo {
    stats: string;
    skills: string;
}

interface GameStartData {
    character: CharacterType;
    playerName: string;
}

export class LobbyManager implements ILobbyManager {
    container: HTMLElement | null;
    nameInput: HTMLInputElement | null;
    startButton: HTMLButtonElement | null;
    characterOptions: NodeListOf<Element>;
    characterStats: HTMLElement | null;
    characterSkills: HTMLElement | null;
    selectedCharacter: CharacterType | null;
    playerName: string;
    isActive: boolean;
    onGameStart: ((data: GameStartData) => void) | null;

    constructor() {
        // DOM elements
        this.container = document.getElementById('lobbyContainer');
        this.nameInput = document.getElementById('playerNameInput') as HTMLInputElement | null;
        this.startButton = document.getElementById('startGameBtn') as HTMLButtonElement | null;
        this.characterOptions = document.querySelectorAll('.character-option');
        this.characterStats = document.querySelector('.character-stats');
        this.characterSkills = document.querySelector('.character-skills');

        // State - sync with DOM's initial selected character
        this.selectedCharacter = this.getInitialSelectedCharacter();
        this.playerName = '';
        this.isActive = true;

        // Callbacks
        this.onGameStart = null;

        // Initialize
        this.setupEventListeners();

        // Validate input to set initial button state
        this.validateInput();

        // Update character info for initial selection
        this.updateCharacterInfo();
    }

    // Get the initially selected character from DOM
    getInitialSelectedCharacter(): CharacterType | null {
        const selectedOption = document.querySelector(
            '.character-option.selected'
        ) as HTMLElement | null;
        console.log('[LobbyManager] getInitialSelectedCharacter - selectedOption:', selectedOption);
        if (selectedOption?.dataset.character) {
            console.log('[LobbyManager] Initial character:', selectedOption.dataset.character);
            return selectedOption.dataset.character as CharacterType;
        }
        console.log('[LobbyManager] No initial character selected');
        return null; // No character selected
    }

    setupEventListeners(): void {
        console.log('[LobbyManager] setupEventListeners called');
        console.log('[LobbyManager] characterOptions count:', this.characterOptions.length);
        console.log('[LobbyManager] startButton:', this.startButton);
        console.log('[LobbyManager] nameInput:', this.nameInput);

        // Character selection
        this.characterOptions.forEach((option, index) => {
            console.log(
                '[LobbyManager] Adding click listener to character option',
                index,
                (option as HTMLElement).dataset.character
            );
            option.addEventListener('click', () => {
                console.log(
                    '[LobbyManager] Character option clicked:',
                    (option as HTMLElement).dataset.character
                );
                this.selectCharacter(option);
            });
        });

        // Name input
        if (this.nameInput) {
            this.nameInput.addEventListener('input', () => {
                console.log('[LobbyManager] Name input changed:', this.nameInput?.value);
                this.validateInput();
            });

            // Enter key to start game
            this.nameInput.addEventListener('keypress', (e: KeyboardEvent) => {
                console.log('[LobbyManager] Keypress:', e.key);
                if (e.key === 'Enter' && this.canStartGame()) {
                    this.startGame();
                }
            });

            // Focus name input on load
            setTimeout(() => {
                this.nameInput?.focus();
            }, 100);
        }

        // Start button
        if (this.startButton) {
            this.startButton.addEventListener('click', () => {
                console.log(
                    '[LobbyManager] Start button clicked, canStartGame:',
                    this.canStartGame()
                );
                if (this.canStartGame()) {
                    this.startGame();
                }
            });
        }
    }

    selectCharacter(option: Element): void {
        // Remove selected class from all options
        this.characterOptions.forEach((opt) => {
            opt.classList.remove('selected');
        });

        // Add selected class to clicked option
        option.classList.add('selected');

        // Update selected character
        const htmlOption = option as HTMLElement;
        this.selectedCharacter = (htmlOption.dataset.character as CharacterType) || null;
        logger.debug(`Selected character: ${this.selectedCharacter}`);

        // Update character info display
        this.updateCharacterInfo();

        // Validate input to update button state
        this.validateInput();
    }

    updateCharacterInfo(): void {
        if (!this.selectedCharacter) return;

        const info = LobbyManager.getCharacterInfo(this.selectedCharacter);
        if (this.characterStats) {
            this.characterStats.textContent = info.stats;
        }
        if (this.characterSkills) {
            this.characterSkills.textContent = info.skills;
        }
    }

    validateInput(): void {
        this.playerName = this.nameInput?.value.trim() ?? '';

        // Enable button if name is not empty and character is selected
        const canStart = this.canStartGame();
        console.log(
            '[LobbyManager] validateInput - playerName:',
            this.playerName,
            'selectedCharacter:',
            this.selectedCharacter,
            'canStart:',
            canStart
        );
        if (this.startButton) {
            this.startButton.disabled = !canStart;
            console.log('[LobbyManager] startButton.disabled =', this.startButton.disabled);
        }
    }

    canStartGame(): boolean {
        return this.playerName.length > 0 && this.selectedCharacter !== null;
    }

    startGame(): void {
        if (!this.canStartGame()) return;

        logger.info(
            `Starting game with character: ${this.selectedCharacter}, name: ${this.playerName}`
        );

        // Hide lobby with animation
        this.hide();

        // Call game start callback
        if (this.onGameStart && this.selectedCharacter) {
            this.onGameStart({
                character: this.selectedCharacter,
                playerName: this.playerName,
            });
        }
    }

    hide(): void {
        this.isActive = false;
        if (this.container) {
            this.container.classList.add('hidden');

            // Remove from DOM after animation
            setTimeout(() => {
                if (this.container) {
                    this.container.style.display = 'none';
                }
            }, 500);
        }
    }

    show(): void {
        this.isActive = true;
        if (this.container) {
            this.container.style.display = 'flex';
            this.container.classList.remove('hidden');
        }
        this.nameInput?.focus();
    }

    // Set callback for game start
    setOnGameStart(callback: (data: GameStartData) => void): void {
        this.onGameStart = callback;
    }

    // Get character image path based on character ID
    static getCharacterImagePath(characterId: CharacterType): string {
        const characterImages: Record<CharacterType, string> = {
            alien: 'asset/image/alien.png',
            'crazy-eyes': 'asset/image/crazy-eyes.png',
            'curry-bear': 'asset/image/curry-bear.png',
            'big-sis-hulk': 'asset/image/big-sis-hulk.png',
            teacher: 'asset/image/teacher.png',
            'squeak-squeak': 'asset/image/squeak-squeak.png',
        };
        return characterImages[characterId] || characterImages['alien'];
    }

    // Get character display name
    static getCharacterName(characterId: CharacterType): string {
        const characterNames: Record<CharacterType, string> = {
            alien: '외계인',
            'crazy-eyes': '눈 돌아가는 사람',
            'curry-bear': '카레 곰돌이',
            'big-sis-hulk': '헐크 언니',
            teacher: '선생님',
            'squeak-squeak': '찍찍찍찍찍',
        };
        return characterNames[characterId] || '외계인';
    }

    // Get character info (stats and skills)
    static getCharacterInfo(characterId: CharacterType): CharacterInfo {
        const characterInfo: Record<CharacterType, CharacterInfo> = {
            alien: {
                stats: '❤️ 체력: 보통 | ⚡ 속도: 빠름',
                skills: '🎇 레이저 | 💫 순간이동 | 👽 텔레파시',
            },
            'crazy-eyes': {
                stats: '❤️ 체력: 보통 | ⚡ 속도: 보통',
                skills: '🌀 이상한 파동 | 👀 광기 산책',
            },
            'curry-bear': {
                stats: '❤️ 체력: 높음 | ⚡ 속도: 느림',
                skills: '🍲 냄비 내려치기 | 🍛 카레 회복',
            },
            'big-sis-hulk': {
                stats: '❤️ 체력: 매우 높음 | ⚡ 속도: 느림',
                skills: '🌀 던지기 | 🔥 폭주',
            },
            teacher: {
                stats: '❤️ 체력: 보통 | ⚡ 속도: 보통',
                skills: '🎭 위장 능력',
            },
            'squeak-squeak': {
                stats: '❤️ 체력: 낮음 | ⚡ 속도: 빠름',
                skills: '👻 쥐 환상 | 😴 수면 가루 | 💣 쥐 폭탄',
            },
        };
        return characterInfo[characterId] || characterInfo['alien'];
    }
}
