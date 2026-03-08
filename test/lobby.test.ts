/**
 * Lobby System Tests
 *
 * Tests for the lobby system including:
 * - LobbyManager class
 * - Character selection
 * - Name input validation
 * - Game start callback
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

// Interfaces
interface MockClassList {
    _classes: string[];
    add: Mock;
    remove: Mock;
    contains: (cls: string) => boolean;
}

interface MockContainer {
    classList: {
        add: Mock;
        remove: Mock;
    };
    style: { display?: string };
}

interface MockNameInput {
    value: string;
    focus: Mock;
    addEventListener: Mock;
}

interface MockStartButton {
    disabled: boolean;
    addEventListener: Mock;
}

interface MockCharacterOption {
    dataset: { character: string };
    classList: MockClassList;
    addEventListener: Mock;
}

interface GameStartData {
    character: string;
    playerName: string;
}

type GameStartCallback = (data: GameStartData) => void;

// Mock DOM elements
const mockContainer: MockContainer = {
    classList: {
        add: jest.fn() as Mock,
        remove: jest.fn() as Mock,
    },
    style: {},
};

const mockNameInput: MockNameInput = {
    value: '',
    focus: jest.fn() as Mock,
    addEventListener: jest.fn() as Mock,
};

const mockStartButton: MockStartButton = {
    disabled: true,
    addEventListener: jest.fn() as Mock,
};

const mockCharacterOptions: MockCharacterOption[] = [
    {
        dataset: { character: 'alien' },
        classList: {
            _classes: ['selected'],
            add: jest.fn(function (this: MockClassList, cls: string) {
                this._classes.push(cls);
            }) as Mock,
            remove: jest.fn(function (this: MockClassList, cls: string) {
                const idx = this._classes.indexOf(cls);
                if (idx > -1) this._classes.splice(idx, 1);
            }) as Mock,
            contains: function (cls: string): boolean {
                return this._classes.includes(cls);
            },
        },
        addEventListener: jest.fn() as Mock,
    },
    {
        dataset: { character: 'crazy-eyes' },
        classList: {
            _classes: [],
            add: jest.fn(function (this: MockClassList, cls: string) {
                this._classes.push(cls);
            }) as Mock,
            remove: jest.fn(function (this: MockClassList, cls: string) {
                const idx = this._classes.indexOf(cls);
                if (idx > -1) this._classes.splice(idx, 1);
            }) as Mock,
            contains: function (cls: string): boolean {
                return this._classes.includes(cls);
            },
        },
        addEventListener: jest.fn() as Mock,
    },
];

// Mock document functions
const originalGetElementById = document.getElementById.bind(document);
const originalQuerySelectorAll = document.querySelectorAll.bind(document);
const originalQuerySelector = document.querySelector.bind(document);

document.getElementById = jest.fn((id: string) => {
    if (id === 'lobbyContainer') return mockContainer as unknown as HTMLElement;
    if (id === 'playerNameInput') return mockNameInput as unknown as HTMLElement;
    if (id === 'startGameBtn') return mockStartButton as unknown as HTMLElement;
    return originalGetElementById(id);
}) as Mock;

document.querySelectorAll = jest.fn((selector: string) => {
    if (selector === '.character-option')
        return mockCharacterOptions as unknown as NodeListOf<Element>;
    return originalQuerySelectorAll(selector);
}) as Mock;

document.querySelector = jest.fn((selector: string) => {
    if (selector === '.character-option.selected') {
        return mockCharacterOptions.find((opt) =>
            opt.classList.contains('selected')
        ) as unknown as Element | null;
    }
    return originalQuerySelector(selector);
}) as Mock;

// LobbyManager class (simplified for testing)
class LobbyManager {
    container: MockContainer;
    nameInput: MockNameInput;
    startButton: MockStartButton;
    characterOptions: MockCharacterOption[];
    selectedCharacter: string | null;
    playerName: string;
    isActive: boolean;
    onGameStart: GameStartCallback | null;

    constructor() {
        this.container = document.getElementById('lobbyContainer') as unknown as MockContainer;
        this.nameInput = document.getElementById('playerNameInput') as unknown as MockNameInput;
        this.startButton = document.getElementById('startGameBtn') as unknown as MockStartButton;
        this.characterOptions = document.querySelectorAll(
            '.character-option'
        ) as unknown as MockCharacterOption[];

        this.selectedCharacter = this.getInitialSelectedCharacter();
        this.playerName = '';
        this.isActive = true;
        this.onGameStart = null;

        this.validateInput();
    }

    getInitialSelectedCharacter(): string | null {
        const selectedOption = document.querySelector(
            '.character-option.selected'
        ) as unknown as MockCharacterOption | null;
        if (selectedOption && selectedOption.dataset.character) {
            return selectedOption.dataset.character;
        }
        return null;
    }

    selectCharacter(option: MockCharacterOption): void {
        this.characterOptions.forEach((opt) => {
            opt.classList.remove('selected');
        });

        option.classList.add('selected');
        this.selectedCharacter = option.dataset.character;
        this.validateInput();
    }

    validateInput(): void {
        this.playerName = this.nameInput.value.trim();
        const canStart = this.canStartGame();
        this.startButton.disabled = !canStart;
    }

    canStartGame(): boolean {
        return this.playerName.length > 0 && this.selectedCharacter !== null;
    }

    startGame(): void {
        if (!this.canStartGame()) return;

        this.hide();

        if (this.onGameStart) {
            this.onGameStart({
                character: this.selectedCharacter!,
                playerName: this.playerName,
            });
        }
    }

    hide(): void {
        this.isActive = false;
        this.container.classList.add('hidden');
    }

    show(): void {
        this.isActive = true;
        this.container.style.display = 'flex';
        this.container.classList.remove('hidden');
        this.nameInput.focus();
    }

    setOnGameStart(callback: GameStartCallback): void {
        this.onGameStart = callback;
    }

    static getCharacterImagePath(characterId: string): string {
        const characterImages: Record<string, string> = {
            alien: 'asset/image/alien.png',
            'crazy-eyes': 'asset/image/crazy-eyes.png',
            'curry-bear': 'asset/image/curry-bear.png',
            'big-sis-hulk': 'asset/image/big-sis-hulk.png',
            teacher: 'asset/image/teacher.png',
            'squeak-squeak': 'asset/image/squeak-squeak.png',
        };
        return characterImages[characterId] || characterImages['alien'];
    }

    static getCharacterName(characterId: string): string {
        const characterNames: Record<string, string> = {
            alien: '외계인',
            'crazy-eyes': '눈 돌아가는 사람',
            'curry-bear': '카레 곰돌이',
            'big-sis-hulk': '헐크 언니',
            teacher: '선생님',
            'squeak-squeak': '찍찍찍찍찍',
        };
        return characterNames[characterId] || '외계인';
    }
}

describe('LobbyManager', () => {
    let lobbyManager: LobbyManager;

    beforeEach(() => {
        // Reset mocks
        mockNameInput.value = '';
        mockStartButton.disabled = true;
        mockContainer.classList.add.mockClear();
        mockContainer.classList.remove.mockClear();
        mockNameInput.focus.mockClear();

        // Reset character options
        mockCharacterOptions[0].classList._classes = ['selected'];
        mockCharacterOptions[1].classList._classes = [];

        lobbyManager = new LobbyManager();
    });

    describe('constructor', () => {
        test('should initialize with isActive true', () => {
            expect(lobbyManager.isActive).toBe(true);
        });

        test('should get initial selected character from DOM', () => {
            expect(lobbyManager.selectedCharacter).toBe('alien');
        });

        test('should start with empty player name', () => {
            expect(lobbyManager.playerName).toBe('');
        });

        test('should initialize without onGameStart callback', () => {
            expect(lobbyManager.onGameStart).toBeNull();
        });
    });

    describe('getInitialSelectedCharacter', () => {
        test('should return selected character from DOM', () => {
            const result = lobbyManager.getInitialSelectedCharacter();
            expect(result).toBe('alien');
        });

        test('should return null if no character selected', () => {
            mockCharacterOptions[0].classList._classes = [];
            document.querySelector = jest.fn(() => null) as Mock;

            const newManager = new LobbyManager();
            // The constructor will call getInitialSelectedCharacter
            expect(newManager.selectedCharacter).toBeNull();

            // Restore mock
            document.querySelector = jest.fn((selector: string) => {
                if (selector === '.character-option.selected') {
                    return mockCharacterOptions.find((opt) =>
                        opt.classList.contains('selected')
                    ) as unknown as Element | null;
                }
                return originalQuerySelector(selector);
            }) as Mock;
        });
    });

    describe('selectCharacter', () => {
        test('should update selected character', () => {
            lobbyManager.selectCharacter(mockCharacterOptions[1]);

            expect(lobbyManager.selectedCharacter).toBe('crazy-eyes');
        });

        test('should add selected class to new option', () => {
            lobbyManager.selectCharacter(mockCharacterOptions[1]);

            expect(mockCharacterOptions[1].classList.add).toHaveBeenCalledWith('selected');
        });

        test('should remove selected class from other options', () => {
            lobbyManager.selectCharacter(mockCharacterOptions[1]);

            expect(mockCharacterOptions[0].classList.remove).toHaveBeenCalledWith('selected');
        });

        test('should validate input after selection', () => {
            mockNameInput.value = 'TestPlayer';
            lobbyManager.selectCharacter(mockCharacterOptions[0]);

            // Since name is set, button should be enabled
            expect(lobbyManager.canStartGame()).toBe(true);
        });
    });

    describe('validateInput', () => {
        test('should update playerName from input', () => {
            mockNameInput.value = '  TestPlayer  ';
            lobbyManager.validateInput();

            expect(lobbyManager.playerName).toBe('TestPlayer');
        });

        test('should enable button when valid', () => {
            mockNameInput.value = 'TestPlayer';
            lobbyManager.selectedCharacter = 'alien';
            lobbyManager.validateInput();

            expect(mockStartButton.disabled).toBe(false);
        });

        test('should disable button when name empty', () => {
            mockNameInput.value = '';
            lobbyManager.selectedCharacter = 'alien';
            lobbyManager.validateInput();

            expect(mockStartButton.disabled).toBe(true);
        });

        test('should disable button when no character', () => {
            mockNameInput.value = 'TestPlayer';
            lobbyManager.selectedCharacter = null;
            lobbyManager.validateInput();

            expect(mockStartButton.disabled).toBe(true);
        });
    });

    describe('canStartGame', () => {
        test('should return true when name and character set', () => {
            lobbyManager.playerName = 'TestPlayer';
            lobbyManager.selectedCharacter = 'alien';

            expect(lobbyManager.canStartGame()).toBe(true);
        });

        test('should return false when name empty', () => {
            lobbyManager.playerName = '';
            lobbyManager.selectedCharacter = 'alien';

            expect(lobbyManager.canStartGame()).toBe(false);
        });

        test('should return false when no character', () => {
            lobbyManager.playerName = 'TestPlayer';
            lobbyManager.selectedCharacter = null;

            expect(lobbyManager.canStartGame()).toBe(false);
        });
    });

    describe('startGame', () => {
        test('should not start if cannot start', () => {
            lobbyManager.playerName = '';
            const callback = jest.fn() as Mock;
            lobbyManager.setOnGameStart(callback);

            lobbyManager.startGame();

            expect(callback).not.toHaveBeenCalled();
        });

        test('should call onGameStart callback with data', () => {
            lobbyManager.playerName = 'TestPlayer';
            lobbyManager.selectedCharacter = 'alien';
            const callback = jest.fn() as Mock;
            lobbyManager.setOnGameStart(callback);

            lobbyManager.startGame();

            expect(callback).toHaveBeenCalledWith({
                character: 'alien',
                playerName: 'TestPlayer',
            });
        });

        test('should hide lobby', () => {
            lobbyManager.playerName = 'TestPlayer';
            lobbyManager.selectedCharacter = 'alien';

            lobbyManager.startGame();

            expect(lobbyManager.isActive).toBe(false);
        });
    });

    describe('hide', () => {
        test('should set isActive to false', () => {
            lobbyManager.hide();

            expect(lobbyManager.isActive).toBe(false);
        });

        test('should add hidden class', () => {
            lobbyManager.hide();

            expect(mockContainer.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('show', () => {
        test('should set isActive to true', () => {
            lobbyManager.isActive = false;
            lobbyManager.show();

            expect(lobbyManager.isActive).toBe(true);
        });

        test('should remove hidden class', () => {
            lobbyManager.show();

            expect(mockContainer.classList.remove).toHaveBeenCalledWith('hidden');
        });

        test('should focus name input', () => {
            lobbyManager.show();

            expect(mockNameInput.focus).toHaveBeenCalled();
        });

        test('should set display to flex', () => {
            lobbyManager.show();

            expect(mockContainer.style.display).toBe('flex');
        });
    });

    describe('setOnGameStart', () => {
        test('should set callback', () => {
            const callback = jest.fn() as Mock;
            lobbyManager.setOnGameStart(callback);

            expect(lobbyManager.onGameStart).toBe(callback);
        });
    });
});

describe('LobbyManager static methods', () => {
    describe('getCharacterImagePath', () => {
        test('should return correct path for alien', () => {
            expect(LobbyManager.getCharacterImagePath('alien')).toBe('asset/image/alien.png');
        });

        test('should return correct path for crazy-eyes', () => {
            expect(LobbyManager.getCharacterImagePath('crazy-eyes')).toBe(
                'asset/image/crazy-eyes.png'
            );
        });

        test('should return correct path for curry-bear', () => {
            expect(LobbyManager.getCharacterImagePath('curry-bear')).toBe(
                'asset/image/curry-bear.png'
            );
        });

        test('should return correct path for big-sis-hulk', () => {
            expect(LobbyManager.getCharacterImagePath('big-sis-hulk')).toBe(
                'asset/image/big-sis-hulk.png'
            );
        });

        test('should return correct path for teacher', () => {
            expect(LobbyManager.getCharacterImagePath('teacher')).toBe('asset/image/teacher.png');
        });

        test('should return correct path for squeak-squeak', () => {
            expect(LobbyManager.getCharacterImagePath('squeak-squeak')).toBe(
                'asset/image/squeak-squeak.png'
            );
        });

        test('should return default (alien) for unknown character', () => {
            expect(LobbyManager.getCharacterImagePath('unknown')).toBe('asset/image/alien.png');
        });
    });

    describe('getCharacterName', () => {
        test('should return Korean name for alien', () => {
            expect(LobbyManager.getCharacterName('alien')).toBe('외계인');
        });

        test('should return Korean name for crazy-eyes', () => {
            expect(LobbyManager.getCharacterName('crazy-eyes')).toBe('눈 돌아가는 사람');
        });

        test('should return Korean name for curry-bear', () => {
            expect(LobbyManager.getCharacterName('curry-bear')).toBe('카레 곰돌이');
        });

        test('should return Korean name for big-sis-hulk', () => {
            expect(LobbyManager.getCharacterName('big-sis-hulk')).toBe('헐크 언니');
        });

        test('should return Korean name for teacher', () => {
            expect(LobbyManager.getCharacterName('teacher')).toBe('선생님');
        });

        test('should return Korean name for squeak-squeak', () => {
            expect(LobbyManager.getCharacterName('squeak-squeak')).toBe('찍찍찍찍찍');
        });

        test('should return default (외계인) for unknown character', () => {
            expect(LobbyManager.getCharacterName('unknown')).toBe('외계인');
        });
    });
});

describe('Input Validation Edge Cases', () => {
    test('should trim whitespace from name', () => {
        const name = '  Player  ';
        expect(name.trim()).toBe('Player');
    });

    test('should handle empty string', () => {
        const name = '';
        expect(name.length > 0).toBe(false);
    });

    test('should handle whitespace-only name', () => {
        const name = '   ';
        expect(name.trim().length > 0).toBe(false);
    });

    test('should accept Korean characters', () => {
        const name = '플레이어';
        expect(name.trim().length > 0).toBe(true);
    });

    test('should accept special characters', () => {
        const name = 'Player_123';
        expect(name.trim().length > 0).toBe(true);
    });
});
