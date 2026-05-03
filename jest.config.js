/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  /** Pool/Redis are closed in `tests/jest.setup.js` after the last file; teardown here runs in another process and does not help the worker. */
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 60000,
};
