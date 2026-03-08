import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default [
    js.configs.recommended,
    eslintConfigPrettier,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                // Socket.io client global
                io: 'readonly',
                // Game globals exposed on window
                updateStoredDamage: 'readonly',
                triggerCurryRecoveryEffect: 'readonly',
            },
        },
        plugins: {
            prettier: eslintPluginPrettier,
        },
        rules: {
            // Prettier 연동
            'prettier/prettier': 'warn',

            // 핵심 규칙
            'no-redeclare': 'error',
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'warn',

            // 베스트 프랙티스
            eqeqeq: ['error', 'always'],
            'no-implicit-globals': 'error',
            'no-shadow': 'warn',
            'no-use-before-define': ['error', { functions: false }],
        },
    },
    {
        // 테스트 파일용 설정
        files: ['test/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
];
