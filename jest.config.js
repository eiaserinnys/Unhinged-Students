/**
 * Jest Configuration with Multi-Project Setup
 *
 * This configuration separates client and server tests into different environments:
 * - client: jsdom environment for browser-based tests
 * - server: node environment for server-side tests
 */

// Shared configuration for all projects
const baseConfig = {
  moduleFileExtensions: ['js', 'json'],
  transform: {
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
        '<rootDir>/test/**/*.test.js',
        // Exclude server tests
        '!<rootDir>/test/server/**/*.test.js',
      ],
      testPathIgnorePatterns: [
        '<rootDir>/test/server/',
      ],
      setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    },
    {
      ...baseConfig,
      displayName: 'server',
      testEnvironment: 'node',
      roots: ['<rootDir>/test/server'],
      testMatch: ['<rootDir>/test/server/**/*.test.js'],
      // Server tests may need their own setup
      // setupFilesAfterEnv: ['<rootDir>/test/server/setup.js'],
    },
  ],

  // Coverage configuration (global)
  collectCoverageFrom: [
    'src/**/*.js',
    'server/**/*.js',
    'shared/**/*.js',
    '!**/node_modules/**',
    '!**/*.test.js',
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
