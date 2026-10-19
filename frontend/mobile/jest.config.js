/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The first renderRouter call in a file loads the whole route tree, which takes several seconds on CI runners.
  testTimeout: 15000,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/__tests__/**', '!src/test-utils/**'],
  coverageReporters: ['text', 'lcov'],
}
