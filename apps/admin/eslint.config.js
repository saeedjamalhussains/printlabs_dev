import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

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
    // The shared UI layer follows the shadcn convention of exporting a
    // component alongside its variant helper (buttonVariants, badgeVariants)
    // or a companion function (toast). That trips the react-refresh rule,
    // which wants one component per module. Splitting each of these into a
    // second file to satisfy a fast-refresh heuristic would cost more in
    // indirection than the rule saves, so it is disabled for this directory
    // only — everywhere else still has to obey it.
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    /* ── Architecture enforcement ──────────────────────────────────────
       The boundaries in this repo are currently clean — no application
       imports another application's source. These rules are here so that
       stays true by accident-proofing rather than by vigilance: a
       reach-across is a lint error at the moment it is written, not a
       discovery months later.

         - no importing a sibling application's source tree
         - no reaching past a shared package's public entry point; the
           package exports what it means to expose, and deep paths into
           its internals are not part of that contract
    */
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/apps/store/src/**', '**/apps/admin/src/**', '**/apps/server/**', '**/apps/assistant/**', '../../*/src/**'],
            message:
              'Applications must not import another application\u2019s source. Move the shared piece into shared/, or talk to the other app over its HTTP API.',
          },
          {
            group: ['@printlabs/*/src/**', '@printlabs/*/dist/**'],
            message:
              'Import a shared package by its name only. Its index defines the public API; deep paths reach past it into private implementation.',
          },
        ],
      }],
    },
  },
])
