/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
  coverageReporters: ['text', 'lcov'],
}
