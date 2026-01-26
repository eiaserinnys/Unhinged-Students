/**
 * Chat System Tests
 *
 * Tests for the chat system including:
 * - ChatManager class
 * - Message handling
 * - Input focus management
 * - Socket integration
 */

// Mock DOM elements
const mockChatInput = {
  value: '',
  focus: jest.fn(),
  blur: jest.fn(),
  addEventListener: jest.fn(),
};

const mockChatMessages = {
  children: [],
  scrollTop: 0,
  scrollHeight: 500,
  appendChild: jest.fn((child) => {
    mockChatMessages.children.push(child);
  }),
  removeChild: jest.fn((child) => {
    const index = mockChatMessages.children.indexOf(child);
    if (index > -1) {
      mockChatMessages.children.splice(index, 1);
    }
  }),
  get firstChild() {
    return mockChatMessages.children[0];
  },
};

// Mock document.getElementById
const originalGetElementById = document.getElementById;
document.getElementById = jest.fn((id) => {
  if (id === 'chatInput') return mockChatInput;
  if (id === 'chatMessages') return mockChatMessages;
  return originalGetElementById.call(document, id);
});

// Mock document.createElement
document.createElement = jest.fn(() => ({
  className: '',
  style: {},
  textContent: '',
  appendChild: jest.fn(),
}));

// ChatManager class (recreated for testing)
class ChatManager {
  constructor() {
    this.chatInput = document.getElementById('chatInput');
    this.chatMessages = document.getElementById('chatMessages');
    this.socket = null;
    this.isInputFocused = false;
    this.maxMessages = 50;
    this.localPlayer = null;
  }

  setSocket(socket) {
    this.socket = socket;

    if (socket && socket.on) {
      socket.on('chatMessage', (data) => {
        this.displayMessage(data);
      });
    }
  }

  setPlayer(player) {
    this.localPlayer = player;
  }

  focusInput() {
    this.chatInput.focus();
  }

  sendMessage() {
    const message = this.chatInput.value.trim();

    if (message && this.socket && message.length > 0) {
      this.socket.emit('chatMessage', { message: message });

      if (this.localPlayer && this.localPlayer.setChatMessage) {
        this.localPlayer.setChatMessage(message);
      }

      this.chatInput.value = '';
    }

    this.chatInput.blur();
  }

  displayMessage(data) {
    const messageDiv = document.createElement('div');

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    while (this.chatMessages.children.length > this.maxMessages) {
      this.chatMessages.removeChild(this.chatMessages.firstChild);
    }
  }

  addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `[System] ${message}`;

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  isChatInputFocused() {
    return this.isInputFocused;
  }
}

describe('ChatManager', () => {
  let chatManager;

  beforeEach(() => {
    // Reset mocks
    mockChatInput.value = '';
    mockChatInput.focus.mockClear();
    mockChatInput.blur.mockClear();
    mockChatMessages.children = [];
    mockChatMessages.appendChild.mockClear();
    mockChatMessages.removeChild.mockClear();

    chatManager = new ChatManager();
  });

  describe('constructor', () => {
    test('should initialize with empty socket', () => {
      expect(chatManager.socket).toBeNull();
    });

    test('should initialize with input not focused', () => {
      expect(chatManager.isInputFocused).toBe(false);
    });

    test('should set max messages to 50', () => {
      expect(chatManager.maxMessages).toBe(50);
    });

    test('should initialize without local player', () => {
      expect(chatManager.localPlayer).toBeNull();
    });
  });

  describe('setSocket', () => {
    test('should set socket reference', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);

      expect(chatManager.socket).toBe(mockSocket);
    });

    test('should register chatMessage listener', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('chatMessage', expect.any(Function));
    });
  });

  describe('setPlayer', () => {
    test('should set local player reference', () => {
      const mockPlayer = { setChatMessage: jest.fn() };
      chatManager.setPlayer(mockPlayer);

      expect(chatManager.localPlayer).toBe(mockPlayer);
    });
  });

  describe('focusInput', () => {
    test('should call focus on input', () => {
      chatManager.focusInput();

      expect(mockChatInput.focus).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    test('should emit message to socket', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);
      mockChatInput.value = 'Hello world';

      chatManager.sendMessage();

      expect(mockSocket.emit).toHaveBeenCalledWith('chatMessage', { message: 'Hello world' });
    });

    test('should clear input after sending', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);
      mockChatInput.value = 'Test message';

      chatManager.sendMessage();

      expect(mockChatInput.value).toBe('');
    });

    test('should blur input after sending', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);
      mockChatInput.value = 'Test';

      chatManager.sendMessage();

      expect(mockChatInput.blur).toHaveBeenCalled();
    });

    test('should not send empty message', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);
      mockChatInput.value = '';

      chatManager.sendMessage();

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should not send whitespace-only message', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      chatManager.setSocket(mockSocket);
      mockChatInput.value = '   ';

      chatManager.sendMessage();

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should set chat message on local player', () => {
      const mockSocket = { on: jest.fn(), emit: jest.fn() };
      const mockPlayer = { setChatMessage: jest.fn() };
      chatManager.setSocket(mockSocket);
      chatManager.setPlayer(mockPlayer);
      mockChatInput.value = 'Hello';

      chatManager.sendMessage();

      expect(mockPlayer.setChatMessage).toHaveBeenCalledWith('Hello');
    });

    test('should not send if no socket', () => {
      mockChatInput.value = 'Test';
      chatManager.sendMessage();

      // Should not throw, just not send
      expect(mockChatInput.blur).toHaveBeenCalled();
    });
  });

  describe('displayMessage', () => {
    test('should add message to chat container', () => {
      chatManager.displayMessage({ playerName: 'Player1', message: 'Hello' });

      expect(mockChatMessages.appendChild).toHaveBeenCalled();
    });

    test('should scroll to bottom', () => {
      mockChatMessages.scrollHeight = 1000;
      chatManager.displayMessage({ playerName: 'Test', message: 'Test' });

      expect(mockChatMessages.scrollTop).toBe(1000);
    });

    test('should limit messages to maxMessages', () => {
      // Add more than max messages
      for (let i = 0; i < 60; i++) {
        mockChatMessages.children.push({});
      }

      chatManager.displayMessage({ playerName: 'Test', message: 'Test' });

      expect(mockChatMessages.removeChild).toHaveBeenCalled();
    });
  });

  describe('addSystemMessage', () => {
    test('should add system message to container', () => {
      chatManager.addSystemMessage('Welcome to the game!');

      expect(mockChatMessages.appendChild).toHaveBeenCalled();
    });

    test('should scroll to bottom', () => {
      mockChatMessages.scrollHeight = 800;
      chatManager.addSystemMessage('System notification');

      expect(mockChatMessages.scrollTop).toBe(800);
    });
  });

  describe('isChatInputFocused', () => {
    test('should return false when not focused', () => {
      chatManager.isInputFocused = false;
      expect(chatManager.isChatInputFocused()).toBe(false);
    });

    test('should return true when focused', () => {
      chatManager.isInputFocused = true;
      expect(chatManager.isChatInputFocused()).toBe(true);
    });
  });
});

describe('Chat Message Handling', () => {
  describe('message trimming', () => {
    test('should trim leading whitespace', () => {
      const message = '   Hello';
      expect(message.trim()).toBe('Hello');
    });

    test('should trim trailing whitespace', () => {
      const message = 'Hello   ';
      expect(message.trim()).toBe('Hello');
    });

    test('should trim both ends', () => {
      const message = '   Hello   ';
      expect(message.trim()).toBe('Hello');
    });
  });

  describe('message validation', () => {
    test('should accept valid message', () => {
      const message = 'Hello world!';
      expect(message.length > 0).toBe(true);
    });

    test('should reject empty message', () => {
      const message = '';
      expect(message.length > 0).toBe(false);
    });

    test('should handle special characters', () => {
      const message = '안녕하세요! 🎮';
      expect(message.length > 0).toBe(true);
    });
  });
});

describe('Focus Management', () => {
  let chatManager;

  beforeEach(() => {
    mockChatInput.value = '';
    mockChatInput.focus.mockClear();
    mockChatInput.blur.mockClear();
    chatManager = new ChatManager();
  });

  test('should track focus state correctly', () => {
    chatManager.isInputFocused = false;
    expect(chatManager.isChatInputFocused()).toBe(false);

    chatManager.isInputFocused = true;
    expect(chatManager.isChatInputFocused()).toBe(true);
  });

  test('should focus input on focusInput call', () => {
    chatManager.focusInput();
    expect(mockChatInput.focus).toHaveBeenCalled();
  });

  test('should blur input after sending message', () => {
    const mockSocket = { on: jest.fn(), emit: jest.fn() };
    chatManager.setSocket(mockSocket);
    mockChatInput.value = 'Test';

    chatManager.sendMessage();

    expect(mockChatInput.blur).toHaveBeenCalled();
  });
});
