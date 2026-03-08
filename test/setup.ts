/**
 * Jest Setup File - Browser API Mocks
 *
 * This file sets up mock implementations for browser APIs
 * that are not available in the Node.js/jsdom environment.
 */

import { jest, beforeEach } from '@jest/globals';

// Canvas context type
interface MockCanvasRenderingContext2D {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    font: string;
    textAlign: string;
    textBaseline: string;
    globalAlpha: number;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    fillRect: jest.Mock;
    clearRect: jest.Mock;
    strokeRect: jest.Mock;
    fillText: jest.Mock;
    strokeText: jest.Mock;
    measureText: jest.Mock;
    beginPath: jest.Mock;
    closePath: jest.Mock;
    moveTo: jest.Mock;
    lineTo: jest.Mock;
    arc: jest.Mock;
    fill: jest.Mock;
    stroke: jest.Mock;
    drawImage: jest.Mock;
    save: jest.Mock;
    restore: jest.Mock;
    translate: jest.Mock;
    rotate: jest.Mock;
    scale: jest.Mock;
    setTransform: jest.Mock;
    createLinearGradient: jest.Mock;
    createRadialGradient: jest.Mock;
    getImageData: jest.Mock;
    putImageData: jest.Mock;
}

// Canvas Mock
class CanvasMock {
    width: number;
    height: number;

    constructor() {
        this.width = 800;
        this.height = 600;
    }

    getContext(): MockCanvasRenderingContext2D {
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

    toDataURL(): string {
        return 'data:image/png;base64,mock';
    }
}

// HTMLCanvasElement mock
Object.defineProperty(global, 'HTMLCanvasElement', {
    value: CanvasMock,
});

// document.createElement mock for canvas
const originalCreateElement = document.createElement.bind(document);
document.createElement = ((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
        const canvas = originalCreateElement('canvas');
        (canvas as unknown as { getContext: () => MockCanvasRenderingContext2D }).getContext =
            new CanvasMock().getContext;
        return canvas;
    }
    return originalCreateElement(tagName);
}) as typeof document.createElement;

// requestAnimationFrame mock
(global as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = jest.fn(
    (callback: FrameRequestCallback) => {
        return setTimeout(() => callback(performance.now()), 16) as unknown as number;
    }
) as typeof requestAnimationFrame;

(global as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame = jest.fn(
    (id: number) => {
        clearTimeout(id);
    }
) as typeof cancelAnimationFrame;

// performance.now mock (if not available)
if (typeof performance === 'undefined') {
    (global as unknown as { performance: Performance }).performance = {
        now: jest.fn(() => Date.now()),
    } as unknown as Performance;
}

// Image mock
interface ImageMockType {
    src: string;
    width: number;
    height: number;
    complete: boolean;
    onload: (() => void) | null;
    onerror: ((error: Error) => void) | null;
    addEventListener: (event: string, callback: () => void) => void;
    removeEventListener: () => void;
}

class ImageMock implements ImageMockType {
    src: string;
    width: number;
    height: number;
    complete: boolean;
    onload: (() => void) | null;
    onerror: ((error: Error) => void) | null;

    constructor() {
        this.src = '';
        this.width = 100;
        this.height = 100;
        this.complete = true;
        this.onload = null;
        this.onerror = null;
    }

    addEventListener(event: string, callback: () => void): void {
        if (event === 'load') {
            this.onload = callback;
        } else if (event === 'error') {
            this.onerror = callback as unknown as (error: Error) => void;
        }
    }

    removeEventListener(): void {}
}

Object.defineProperty(global, 'Image', {
    value: ImageMock,
});

// Audio mock
class AudioMock {
    src: string;
    volume: number;
    currentTime: number;
    paused: boolean;
    muted: boolean;

    constructor() {
        this.src = '';
        this.volume = 1;
        this.currentTime = 0;
        this.paused = true;
        this.muted = false;
    }

    play(): Promise<void> {
        this.paused = false;
        return Promise.resolve();
    }

    pause(): void {
        this.paused = true;
    }

    addEventListener(): void {}
    removeEventListener(): void {}
}

Object.defineProperty(global, 'Audio', {
    value: AudioMock,
});

// localStorage mock
interface StorageMock {
    store: Record<string, string>;
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
}

const localStorageMock: StorageMock = {
    store: {},
    getItem: jest.fn((key: string) => localStorageMock.store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
        localStorageMock.store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
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
const sessionStorageMock: StorageMock = {
    store: {},
    getItem: jest.fn((key: string) => sessionStorageMock.store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
        sessionStorageMock.store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
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
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    url: string;
    readyState: number;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;

    constructor(url: string) {
        this.url = url;
        this.readyState = WebSocketMock.OPEN;
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;
    }

    send(): void {}

    close(): void {
        this.readyState = WebSocketMock.CLOSED;
    }

    addEventListener(event: string, callback: (event: Event) => void): void {
        (this as unknown as Record<string, (event: Event) => void>)[`on${event}`] = callback;
    }

    removeEventListener(): void {}
}

Object.defineProperty(global, 'WebSocket', {
    value: WebSocketMock,
});

// Touch events mock
interface TouchOptions {
    identifier?: number;
    clientX?: number;
    clientY?: number;
    pageX?: number;
    pageY?: number;
    target?: EventTarget | null;
}

class TouchMock {
    identifier: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    target: EventTarget | null;

    constructor(options: TouchOptions = {}) {
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
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

Object.defineProperty(global, 'ResizeObserver', {
    value: ResizeObserverMock,
});

// Intersection Observer mock
class IntersectionObserverMock {
    callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
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
