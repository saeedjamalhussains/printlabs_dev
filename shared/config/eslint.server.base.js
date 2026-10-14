import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['node_modules', 'logs']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/store/src/**', '**/admin/src/**', '**/assistant/**'],
            message: 'The server must not import another app source; use HTTP or a shared package.',
          },
          {
            group: ['@printlabs/*/src/**', '@printlabs/*/dist/**'],
            message: 'Import a shared package by its name, not by a deep path.',
          },
        ],
      }],
    },
  },
]);
