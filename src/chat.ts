// Chat system for multiplayer

import type { ICharacter, SocketIOClient } from './types/index.js';

interface ChatMessageData {
    playerName: string;
    message: string;
}

export class ChatManager {
    chatInput: HTMLInputElement | null;
    chatMessages: HTMLElement | null;
    socket: SocketIOClient | null;
    isInputFocused: boolean;
    maxMessages: number;
    localPlayer: ICharacter | null; // Reference to local player for chat bubbles

    constructor() {
        this.chatInput = document.getElementById('chatInput') as HTMLInputElement | null;
        this.chatMessages = document.getElementById('chatMessages');
        this.socket = null;
        this.isInputFocused = false;
        this.maxMessages = 50;
        this.localPlayer = null;

        this.setupEventListeners();
    }

    setupEventListeners(): void {
        // Handle Enter key to send message
        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
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
        }

        // Press Enter anywhere to focus chat input (if not already focused)
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !this.isInputFocused) {
                e.preventDefault();
                this.focusInput();
            }
        });
    }

    setSocket(socket: SocketIOClient): void {
        this.socket = socket;

        // Listen for chat messages from server
        this.socket.on('chatMessage', (data: unknown) => {
            this.displayMessage(data as ChatMessageData);
        });
    }

    setPlayer(player: ICharacter): void {
        this.localPlayer = player;
    }

    focusInput(): void {
        this.chatInput?.focus();
    }

    sendMessage(): void {
        if (!this.chatInput) return;

        const message = this.chatInput.value.trim();

        if (message && this.socket && message.length > 0) {
            // Send to server
            this.socket.emit('chatMessage', { message: message });

            // Show chat bubble on local player
            if (this.localPlayer) {
                this.localPlayer.setChatMessage(message);
            }

            // Clear input
            this.chatInput.value = '';
        }

        // Blur input after sending
        this.chatInput.blur();
    }

    displayMessage(data: ChatMessageData): void {
        if (!this.chatMessages) return;

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
            const firstChild = this.chatMessages.firstChild;
            if (firstChild) {
                this.chatMessages.removeChild(firstChild);
            }
        }
    }

    addSystemMessage(message: string): void {
        if (!this.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chatMessage';
        messageDiv.style.color = '#A78BFA';
        messageDiv.style.fontStyle = 'italic';
        messageDiv.textContent = `[System] ${message}`;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    isChatInputFocused(): boolean {
        return this.isInputFocused;
    }
}
