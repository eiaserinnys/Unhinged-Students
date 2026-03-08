/**
 * Jest Configuration with Multi-Project Setup
 *
 * This configuration separates client and server tests into different environments:
 * - client: jsdom environment for browser-based tests
 * - server: node environment for server-side tests
 *
 * TypeScript support via ts-jest
 */

// Shared configuration for all projects
const baseConfig = {
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                useESM: false,
                tsconfig: 'tsconfig.json',
            },
        ],
        '^.+\\.js$': 'babel-jest',
    },
    testTimeout: 10000,
};

module.exports = {
    // Multi-project configuration
    projects: [
        {
            ...baseConfig,
            displayName: 'client',
            testEnvironment: 'jsdom',
            roots: ['<rootDir>/test'],
            testMatch: [
                '<rootDir>/test/**/*.test.ts',
                '<rootDir>/test/**/*.test.js',
                // Exclude server tests
                '!<rootDir>/test/server/**/*.test.ts',
                '!<rootDir>/test/server/**/*.test.js',
            ],
            testPathIgnorePatterns: ['<rootDir>/test/server/'],
            setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/src/$1',
                '^@shared/(.*)$': '<rootDir>/shared/$1',
            },
        },
        {
            ...baseConfig,
            displayName: 'server',
            testEnvironment: 'node',
            roots: ['<rootDir>/test/server'],
            testMatch: ['<rootDir>/test/server/**/*.test.ts', '<rootDir>/test/server/**/*.test.js'],
            transform: {
                '^.+\\.ts$': [
                    'ts-jest',
                    {
                        useESM: false,
                        tsconfig: 'tsconfig.server.json',
                    },
                ],
                '^.+\\.js$': 'babel-jest',
            },
            moduleNameMapper: {
                '^@server/(.*)$': '<rootDir>/server/$1',
                '^@shared/(.*)$': '<rootDir>/shared/$1',
            },
            // Server tests may need their own setup
            // setupFilesAfterEnv: ['<rootDir>/test/server/setup.ts'],
        },
    ],

    // Coverage configuration (global)
    collectCoverageFrom: [
        'src/**/*.ts',
        'src/**/*.js',
        'server/**/*.ts',
        'server/**/*.js',
        'shared/**/*.ts',
        'shared/**/*.js',
        '!**/node_modules/**',
        '!**/*.test.ts',
        '!**/*.test.js',
        '!**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },

    // Global options
    verbose: true,
};
