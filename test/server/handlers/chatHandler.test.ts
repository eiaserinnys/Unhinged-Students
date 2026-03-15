/**
 * @fileoverview Tests for chatHandler.ts — chat message handling
 *
 * Covers: valid message broadcast, message too long, rate limiting,
 * empty message rejected.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ========================================
// MOCKS
// ========================================

const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    cheat: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLevel: jest.fn(() => 'info'),
};

const mockConfig = {
    SERVER_CONFIG: {
        CHAT: { MAX_MESSAGE_LENGTH: 200 },
        RATE_LIMIT: { CHAT_MS: 1000 },
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPlayers = new Map<string, any>();
const mockRateLimit = jest.fn(() => true);

const mockGameState = {
    players: mockPlayers,
    rateLimit: mockRateLimit,
};

jest.mock('../../../logger', () => mockLogger);
jest.mock('../../../server/config', () => mockConfig);
jest.mock('../../../server/gameState', () => mockGameState);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerChatHandlers } = require('../../../server/handlers/chatHandler');

type EventHandler = (...args: unknown[]) => void;

function createMockSocket(id: string) {
    const handlers = new Map<string, EventHandler>();
    return {
        id,
        on: jest.fn((event: string, handler: EventHandler) => {
            handlers.set(event, handler);
        }),
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        _handlers: handlers,
        _trigger(event: string, ...args: unknown[]) {
            const handler = this._handlers.get(event);
            if (handler) handler(...args);
        },
    };
}

function createMockIO() {
    return {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
}

// ========================================
// TESTS
// ========================================

describe('chatHandler', () => {
    let socket: ReturnType<typeof createMockSocket>;
    let io: ReturnType<typeof createMockIO>;

    beforeEach(() => {
        mockPlayers.clear();
        jest.clearAllMocks();
        mockRateLimit.mockReturnValue(true);

        socket = createMockSocket('socket-1');
        io = createMockIO();

        mockPlayers.set('socket-1', {
            playerId: 'socket-1',
            playerName: 'TestPlayer',
        });

        registerChatHandlers(socket, io);
    });

    it('should broadcast a valid chat message', () => {
        socket._trigger('chatMessage', { message: 'Hello world' });

        expect(io.emit).toHaveBeenCalledWith(
            'chatMessage',
            expect.objectContaining({
                playerId: 'socket-1',
                playerName: 'TestPlayer',
                message: 'Hello world',
            })
        );
    });

    it('should reject message that exceeds max length', () => {
        const longMessage = 'a'.repeat(201);
        socket._trigger('chatMessage', { message: longMessage });

        expect(io.emit).not.toHaveBeenCalledWith('chatMessage', expect.any(Object));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('too long'));
    });

    it('should reject empty message', () => {
        socket._trigger('chatMessage', { message: '' });

        expect(io.emit).not.toHaveBeenCalledWith('chatMessage', expect.any(Object));
    });

    it('should reject whitespace-only message', () => {
        socket._trigger('chatMessage', { message: '   ' });

        expect(io.emit).not.toHaveBeenCalledWith('chatMessage', expect.any(Object));
    });

    it('should block messages when rate limited', () => {
        mockRateLimit.mockReturnValue(false);

        socket._trigger('chatMessage', { message: 'Hello' });

        expect(io.emit).not.toHaveBeenCalledWith('chatMessage', expect.any(Object));
    });

    it('should reject non-string message data', () => {
        socket._trigger('chatMessage', { message: 12345 });

        expect(io.emit).not.toHaveBeenCalledWith('chatMessage', expect.any(Object));
    });

    it('should use "Unknown" for player name when player not found', () => {
        mockPlayers.delete('socket-1');

        socket._trigger('chatMessage', { message: 'Hello' });

        expect(io.emit).toHaveBeenCalledWith(
            'chatMessage',
            expect.objectContaining({ playerName: 'Unknown' })
        );
    });
});
