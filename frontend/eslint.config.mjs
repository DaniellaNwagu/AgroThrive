// Flat config for ESLint 9 (replaces the legacy .eslintrc.json, which ESLint 9
// no longer reads). Mirrors the previous settings rule-for-rule.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['node_modules/', 'build/', 'dist/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // The two rules `plugin:react-hooks/recommended` meant when this config was
      // written. eslint-plugin-react-hooks v6+ also folds the React Compiler rules
      // into that preset; adopting those is a separate refactor.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': 'warn',
      'no-dupe-keys': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/no-array-index-key': 'error',
      'no-alert': 'error',
    },
  },
  {
    // Vitest runs with `globals: true` (vitest.config.js).
    files: ['src/**/*.{test,spec}.{js,jsx}', 'src/test/**/*.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.vitest } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
