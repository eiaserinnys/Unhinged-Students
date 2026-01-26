// Reconnect UI Manager
class ReconnectUI {
    constructor() {
        this.overlay = document.getElementById('reconnectOverlay');
        this.statusEl = document.getElementById('reconnectStatus');
        this.reconnectBtn = document.getElementById('reconnectBtn');
        this.reloadBtn = document.getElementById('reloadBtn');
        this.autoReconnectToggle = document.getElementById('autoReconnectToggle');
        this.countdownEl = document.getElementById('reconnectCountdown');

        this.isVisible = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3 seconds
        this.countdownInterval = null;
        this.reconnectTimeout = null;
        this.onReconnect = null; // Callback for reconnect attempts

        // Load auto-reconnect preference from localStorage
        const savedPref = localStorage.getItem('autoReconnect');
        this.autoReconnectToggle.checked = savedPref !== 'false'; // Default to true

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.reconnectBtn.addEventListener('click', () => {
            this.attemptReconnect();
        });

        this.reloadBtn.addEventListener('click', () => {
            window.location.reload();
        });

        this.autoReconnectToggle.addEventListener('change', () => {
            localStorage.setItem('autoReconnect', this.autoReconnectToggle.checked);
            if (this.autoReconnectToggle.checked && this.isVisible) {
                this.startAutoReconnect();
            } else {
                this.stopAutoReconnect();
            }
        });
    }

    show() {
        if (this.isVisible) return;

        this.isVisible = true;
        this.reconnectAttempts = 0;
        this.overlay.classList.add('visible');
        this.setStatus('서버와의 연결이 끊어졌습니다.');
        this.reconnectBtn.disabled = false;

        if (this.autoReconnectToggle.checked) {
            this.startAutoReconnect();
        }
    }

    hide() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.overlay.classList.remove('visible');
        this.stopAutoReconnect();
        this.reconnectAttempts = 0;
    }

    setStatus(message) {
        this.statusEl.textContent = message;
    }

    attemptReconnect() {
        if (!this.onReconnect) return;

        this.reconnectAttempts++;
        this.reconnectBtn.disabled = true;
        this.setStatus(`재연결 시도 중... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.countdownEl.textContent = '';

        this.onReconnect();
    }

    onReconnectSuccess() {
        this.setStatus('연결되었습니다!');
        setTimeout(() => this.hide(), 500);
    }

    onReconnectFailed() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.setStatus('재연결 실패. 수동으로 다시 시도해주세요.');
            this.reconnectBtn.disabled = false;
            this.stopAutoReconnect();
            this.countdownEl.textContent = '';
        } else {
            this.setStatus(`재연결 실패 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.reconnectBtn.disabled = false;

            if (this.autoReconnectToggle.checked) {
                this.startAutoReconnect();
            }
        }
    }

    startAutoReconnect() {
        this.stopAutoReconnect(); // Clear any existing timers

        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

        let countdown = Math.ceil(this.reconnectDelay / 1000);
        this.countdownEl.textContent = `${countdown}초 후 자동 재연결...`;

        this.countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.countdownEl.textContent = `${countdown}초 후 자동 재연결...`;
            } else {
                this.countdownEl.textContent = '';
            }
        }, 1000);

        this.reconnectTimeout = setTimeout(() => {
            this.stopAutoReconnect();
            this.attemptReconnect();
        }, this.reconnectDelay);
    }

    stopAutoReconnect() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.countdownEl.textContent = '';
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ReconnectUI = ReconnectUI;
}
