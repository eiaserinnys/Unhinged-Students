/**
 * Jest Setup File - Browser API Mocks
 *
 * This file sets up mock implementations for browser APIs
 * that are not available in the Node.js/jsdom environment.
 */

// Canvas Mock
class CanvasMock {
  constructor() {
    this.width = 800;
    this.height = 600;
  }

  getContext() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '16px Arial',
      textAlign: 'left',
      textBaseline: 'top',
      globalAlpha: 1,
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: jest.fn(() => ({ width: 100 })),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      setTransform: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      putImageData: jest.fn(),
    };
  }

  toDataURL() {
    return 'data:image/png;base64,mock';
  }
}

// HTMLCanvasElement mock
Object.defineProperty(global, 'HTMLCanvasElement', {
  value: CanvasMock,
});

// document.createElement mock for canvas
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tagName) => {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = originalCreateElement('canvas');
    canvas.getContext = new CanvasMock().getContext;
    return canvas;
  }
  return originalCreateElement(tagName);
};

// requestAnimationFrame mock
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(() => callback(performance.now()), 16);
});

global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id);
});

// performance.now mock (if not available)
if (typeof performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now()),
  };
}

// Image mock
class ImageMock {
  constructor() {
    this.src = '';
    this.width = 100;
    this.height = 100;
    this.complete = true;
    this.onload = null;
    this.onerror = null;
  }

  addEventListener(event, callback) {
    if (event === 'load') {
      this.onload = callback;
    } else if (event === 'error') {
      this.onerror = callback;
    }
  }

  removeEventListener() {}
}

Object.defineProperty(global, 'Image', {
  value: ImageMock,
});

// Audio mock
class AudioMock {
  constructor() {
    this.src = '';
    this.volume = 1;
    this.currentTime = 0;
    this.paused = true;
    this.muted = false;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  addEventListener() {}
  removeEventListener() {}
}

Object.defineProperty(global, 'Audio', {
  value: AudioMock,
});

// localStorage mock
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// sessionStorage mock
const sessionStorageMock = {
  store: {},
  getItem: jest.fn((key) => sessionStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    sessionStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key) => {
    delete sessionStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    sessionStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
});

// WebSocket mock
class WebSocketMock {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocketMock.OPEN;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  send() {}
  close() {
    this.readyState = WebSocketMock.CLOSED;
  }

  addEventListener(event, callback) {
    this[`on${event}`] = callback;
  }

  removeEventListener() {}
}

WebSocketMock.CONNECTING = 0;
WebSocketMock.OPEN = 1;
WebSocketMock.CLOSING = 2;
WebSocketMock.CLOSED = 3;

Object.defineProperty(global, 'WebSocket', {
  value: WebSocketMock,
});

// Touch events mock
class TouchMock {
  constructor(options = {}) {
    this.identifier = options.identifier || 0;
    this.clientX = options.clientX || 0;
    this.clientY = options.clientY || 0;
    this.pageX = options.pageX || 0;
    this.pageY = options.pageY || 0;
    this.target = options.target || null;
  }
}

Object.defineProperty(global, 'Touch', {
  value: TouchMock,
});

// Resize Observer mock
class ResizeObserverMock {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(global, 'ResizeObserver', {
  value: ResizeObserverMock,
});

// Intersection Observer mock
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(global, 'IntersectionObserver', {
  value: IntersectionObserverMock,
});

// Console error/warn suppression for expected errors (optional)
// Uncomment if needed:
// const originalConsoleError = console.error;
// console.error = (...args) => {
//   if (args[0]?.includes('expected error')) return;
//   originalConsoleError(...args);
// };

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.store = {};
  sessionStorageMock.store = {};
});
