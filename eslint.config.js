import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'coverage/', 'uploads/', 'prisma/migrations/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn', // use the logger; env.js is the one justified exception
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/config/env.js', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
  // Must stay last: turns off stylistic rules that would fight with Prettier.
  prettier,
];
