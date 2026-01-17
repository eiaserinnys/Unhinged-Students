// Chat system for multiplayer
class ChatManager {
    constructor() {
        this.chatInput = document.getElementById('chatInput');
        this.chatMessages = document.getElementById('chatMessages');
        this.socket = null;
        this.isInputFocused = false;
        this.maxMessages = 50;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle Enter key to send message
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Track input focus state
        this.chatInput.addEventListener('focus', () => {
            this.isInputFocused = true;
        });

        this.chatInput.addEventListener('blur', () => {
            this.isInputFocused = false;
        });

        // Press Enter anywhere to focus chat input (if not already focused)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.isInputFocused) {
                e.preventDefault();
                this.focusInput();
            }
        });
    }

    setSocket(socket) {
        this.socket = socket;

        // Listen for chat messages from server
        this.socket.on('chatMessage', (data) => {
            this.displayMessage(data);
        });
    }

    focusInput() {
        this.chatInput.focus();
    }

    sendMessage() {
        const message = this.chatInput.value.trim();

        if (message && this.socket && message.length > 0) {
            // Send to server
            this.socket.emit('chatMessage', { message: message });

            // Clear input
            this.chatInput.value = '';
        }

        // Blur input after sending
        this.chatInput.blur();
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chatMessage';

        const playerNameSpan = document.createElement('span');
        playerNameSpan.className = 'playerName';
        playerNameSpan.textContent = `${data.playerName}: `;

        const messageTextSpan = document.createElement('span');
        messageTextSpan.className = 'messageText';
        messageTextSpan.textContent = data.message;

        messageDiv.appendChild(playerNameSpan);
        messageDiv.appendChild(messageTextSpan);

        this.chatMessages.appendChild(messageDiv);

        // Auto-scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Limit number of messages
        while (this.chatMessages.children.length > this.maxMessages) {
            this.chatMessages.removeChild(this.chatMessages.firstChild);
        }
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chatMessage';
        messageDiv.style.color = '#ffff00';
        messageDiv.style.fontStyle = 'italic';
        messageDiv.textContent = `[System] ${message}`;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    isChatInputFocused() {
        return this.isInputFocused;
    }
}
