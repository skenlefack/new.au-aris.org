/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Allow unused vars prefixed with _
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // NestJS uses empty constructors with DI
    '@typescript-eslint/no-empty-function': 'off',
    // Allow explicit any in specific cases (DTOs, decorators)
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow require() for dynamic imports
    '@typescript-eslint/no-require-imports': 'off',
    // Consistent type imports
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    // No console in production code
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    // Next.js apps
    {
      files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      rules: {
        // Next.js uses default exports for pages
        'import/no-default-export': 'off',
        // Allow console in frontend for debugging
        'no-console': 'off',
      },
    },
    // Test files
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e.ts', '**/*.integration.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '.next', 'coverage', '*.js', '!.eslintrc.js'],
};
