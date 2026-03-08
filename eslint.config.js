import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                ...globals.browser,
                ...globals.node,
                // Socket.io client global
                io: 'readonly',
            },
        },
        plugins: {
            prettier: eslintPluginPrettier,
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Prettier 연동
            'prettier/prettier': 'warn',

            // TypeScript 규칙 (JS 규칙 비활성화)
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

            // 핵심 규칙
            'no-var': 'error',
            'prefer-const': 'warn',

            // 베스트 프랙티스
            eqeqeq: ['error', 'always'],
            'no-implicit-globals': 'error',
        },
    },
    {
        // Server files
        files: ['server/**/*.ts', 'shared/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            prettier: eslintPluginPrettier,
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Prettier 연동
            'prettier/prettier': 'warn',

            // TypeScript 규칙
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

            // 핵심 규칙
            'no-var': 'error',
            'prefer-const': 'warn',

            // 베스트 프랙티스
            eqeqeq: ['error', 'always'],
        },
    },
    {
        // 테스트 파일용 설정
        files: ['test/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
        plugins: {
            prettier: eslintPluginPrettier,
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Prettier 연동
            'prettier/prettier': 'warn',

            // TypeScript 규칙
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
];
