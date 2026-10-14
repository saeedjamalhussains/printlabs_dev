import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/store/src/**', '**/admin/src/**', '**/server/**', '**/assistant/**', '../../*/src/**'],
            message: 'Apps must not import another app source tree. Move shared code to shared/packages or use the app HTTP API.',
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
