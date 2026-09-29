module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*.e2e-spec.ts',
    '**/*.integration-spec.ts',
  ],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@ggvault/shared$': '<rootDir>/../../packages/shared/src',
    '^@ggvault/ledger$': '<rootDir>/../../packages/ledger/src',
    '^@ggvault/match-engine$': '<rootDir>/../../packages/match-engine/src',
  },
};
