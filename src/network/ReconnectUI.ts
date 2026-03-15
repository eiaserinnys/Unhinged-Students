// Reconnect UI Manager
import type { IReconnectUI } from '../types/index.js';

/**
 * Manages the reconnection UI overlay for when connection is lost
 */
export class ReconnectUI implements IReconnectUI {
    private overlay: HTMLElement | null;
    private statusEl: HTMLElement | null;
    private reconnectBtn: HTMLButtonElement | null;
    private reloadBtn: HTMLButtonElement | null;
    private autoReconnectToggle: HTMLInputElement | null;
    private countdownEl: HTMLElement | null;

    isVisible: boolean;
    private reconnectAttempts: number;
    private maxReconnectAttempts: number;
    private reconnectDelay: number;
    private countdownInterval: ReturnType<typeof setInterval> | null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null;
    onReconnect: (() => void) | null;

    constructor() {
        this.overlay = document.getElementById('reconnectOverlay');
        this.statusEl = document.getElementById('reconnectStatus');
        this.reconnectBtn = document.getElementById('reconnectBtn') as HTMLButtonElement | null;
        this.reloadBtn = document.getElementById('reloadBtn') as HTMLButtonElement | null;
        this.autoReconnectToggle = document.getElementById(
            'autoReconnectToggle'
        ) as HTMLInputElement | null;
        this.countdownEl = document.getElementById('reconnectCountdown');

        this.isVisible = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3 seconds
        this.countdownInterval = null;
        this.reconnectTimeout = null;
        this.onReconnect = null; // Callback for reconnect attempts

        // Load auto-reconnect preference from localStorage
        if (this.autoReconnectToggle) {
            const savedPref = localStorage.getItem('autoReconnect');
            this.autoReconnectToggle.checked = savedPref !== 'false'; // Default to true
        }

        this.setupEventListeners();
    }

    /**
     * Set up event listeners for UI elements
     */
    private setupEventListeners(): void {
        if (this.reconnectBtn) {
            this.reconnectBtn.addEventListener('click', () => {
                this.attemptReconnect();
            });
        }

        if (this.reloadBtn) {
            this.reloadBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }

        if (this.autoReconnectToggle) {
            this.autoReconnectToggle.addEventListener('change', () => {
                if (this.autoReconnectToggle) {
                    localStorage.setItem('autoReconnect', String(this.autoReconnectToggle.checked));
                    if (this.autoReconnectToggle.checked && this.isVisible) {
                        this.startAutoReconnect();
                    } else {
                        this.stopAutoReconnect();
                    }
                }
            });
        }
    }

    /**
     * Show the reconnect overlay
     */
    show(): void {
        if (this.isVisible) return;

        this.isVisible = true;
        this.reconnectAttempts = 0;
        if (this.overlay) {
            this.overlay.classList.add('visible');
        }
        this.setStatus(
            '\uC11C\uBC84\uC640\uC758 \uC5F0\uACB0\uC774 \uB04A\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.'
        );
        if (this.reconnectBtn) {
            this.reconnectBtn.disabled = false;
        }

        if (this.autoReconnectToggle?.checked) {
            this.startAutoReconnect();
        }
    }

    /**
     * Hide the reconnect overlay
     */
    hide(): void {
        if (!this.isVisible) return;

        this.isVisible = false;
        if (this.overlay) {
            this.overlay.classList.remove('visible');
        }
        this.stopAutoReconnect();
        this.reconnectAttempts = 0;
    }

    /**
     * Set the status message
     */
    private setStatus(message: string): void {
        if (this.statusEl) {
            this.statusEl.textContent = message;
        }
    }

    /**
     * Attempt to reconnect to the server
     */
    private attemptReconnect(): void {
        if (!this.onReconnect) return;

        this.reconnectAttempts++;
        if (this.reconnectBtn) {
            this.reconnectBtn.disabled = true;
        }
        this.setStatus(
            `\uC7AC\uC5F0\uACB0 \uC2DC\uB3C4 \uC911... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        if (this.countdownEl) {
            this.countdownEl.textContent = '';
        }

        this.onReconnect();
    }

    /**
     * Called when reconnection succeeds
     */
    onReconnectSuccess(): void {
        this.setStatus('\uC5F0\uACB0\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
        setTimeout(() => this.hide(), 500);
    }

    /**
     * Called when reconnection fails
     */
    onReconnectFailed(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.setStatus(
                '\uC7AC\uC5F0\uACB0 \uC2E4\uD328. \uC218\uB3D9\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
            );
            if (this.reconnectBtn) {
                this.reconnectBtn.disabled = false;
            }
            this.stopAutoReconnect();
            if (this.countdownEl) {
                this.countdownEl.textContent = '';
            }
        } else {
            this.setStatus(
                `\uC7AC\uC5F0\uACB0 \uC2E4\uD328 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            );
            if (this.reconnectBtn) {
                this.reconnectBtn.disabled = false;
            }

            if (this.autoReconnectToggle?.checked) {
                this.startAutoReconnect();
            }
        }
    }

    /**
     * Start the auto-reconnect countdown
     */
    private startAutoReconnect(): void {
        this.stopAutoReconnect(); // Clear any existing timers

        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

        let countdown = Math.ceil(this.reconnectDelay / 1000);
        if (this.countdownEl) {
            this.countdownEl.textContent = `${countdown}\uCD08 \uD6C4 \uC790\uB3D9 \uC7AC\uC5F0\uACB0...`;
        }

        this.countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                if (this.countdownEl) {
                    this.countdownEl.textContent = `${countdown}\uCD08 \uD6C4 \uC790\uB3D9 \uC7AC\uC5F0\uACB0...`;
                }
            } else {
                if (this.countdownEl) {
                    this.countdownEl.textContent = '';
                }
            }
        }, 1000);

        this.reconnectTimeout = setTimeout(() => {
            this.stopAutoReconnect();
            this.attemptReconnect();
        }, this.reconnectDelay);
    }

    /**
     * Stop the auto-reconnect countdown
     */
    private stopAutoReconnect(): void {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.countdownEl) {
            this.countdownEl.textContent = '';
        }
    }
}
