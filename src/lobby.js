// Lobby system for Unhinged Students

class LobbyManager {
    constructor() {
        // DOM elements
        this.container = document.getElementById('lobbyContainer');
        this.nameInput = document.getElementById('playerNameInput');
        this.startButton = document.getElementById('startGameBtn');
        this.characterOptions = document.querySelectorAll('.character-option');

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
    }

    // Get the initially selected character from DOM
    getInitialSelectedCharacter() {
        const selectedOption = document.querySelector('.character-option.selected');
        if (selectedOption && selectedOption.dataset.character) {
            return selectedOption.dataset.character;
        }
        return null; // No character selected
    }

    setupEventListeners() {
        // Character selection
        this.characterOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectCharacter(option);
            });
        });

        // Name input
        this.nameInput.addEventListener('input', () => {
            this.validateInput();
        });

        // Enter key to start game
        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.canStartGame()) {
                this.startGame();
            }
        });

        // Start button
        this.startButton.addEventListener('click', () => {
            if (this.canStartGame()) {
                this.startGame();
            }
        });

        // Focus name input on load
        setTimeout(() => {
            this.nameInput.focus();
        }, 100);
    }

    selectCharacter(option) {
        // Remove selected class from all options
        this.characterOptions.forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selected class to clicked option
        option.classList.add('selected');

        // Update selected character
        this.selectedCharacter = option.dataset.character;
        console.log(`Selected character: ${this.selectedCharacter}`);

        // Validate input to update button state
        this.validateInput();
    }

    validateInput() {
        this.playerName = this.nameInput.value.trim();

        // Enable button if name is not empty and character is selected
        const canStart = this.canStartGame();
        this.startButton.disabled = !canStart;
    }

    canStartGame() {
        return this.playerName.length > 0 && this.selectedCharacter !== null;
    }

    startGame() {
        if (!this.canStartGame()) return;

        console.log(`Starting game with character: ${this.selectedCharacter}, name: ${this.playerName}`);

        // Hide lobby with animation
        this.hide();

        // Call game start callback
        if (this.onGameStart) {
            this.onGameStart({
                character: this.selectedCharacter,
                playerName: this.playerName
            });
        }
    }

    hide() {
        this.isActive = false;
        this.container.classList.add('hidden');

        // Remove from DOM after animation
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 500);
    }

    show() {
        this.isActive = true;
        this.container.style.display = 'flex';
        this.container.classList.remove('hidden');
        this.nameInput.focus();
    }

    // Set callback for game start
    setOnGameStart(callback) {
        this.onGameStart = callback;
    }

    // Get character image path based on character ID
    static getCharacterImagePath(characterId) {
        const characterImages = {
            'alien': 'asset/image/alien.png',
            'crazy-eyes': 'asset/image/crazy-eyes.png',
            'curry-bear': 'asset/image/curry-bear.png',
            'big-sis-hulk': 'asset/image/big-sis-hulk.png',
            'teacher': 'asset/image/teacher.png',
            'squeak-squeak': 'asset/image/squeak-squeak.png'
        };
        return characterImages[characterId] || characterImages['alien'];
    }

    // Get character display name
    static getCharacterName(characterId) {
        const characterNames = {
            'alien': '외계인',
            'crazy-eyes': '눈 돌아가는 사람',
            'curry-bear': '카레 곰돌이',
            'big-sis-hulk': '헐크 언니',
            'teacher': '선생님',
            'squeak-squeak': '찍찍찍찍찍'
        };
        return characterNames[characterId] || '외계인';
    }
}
