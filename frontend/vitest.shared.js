export const sharedTestConfig = {
  environment: 'jsdom',
  setupFiles: ['./app/core/vitest.setup.js'],
  globals: true,
  clearMocks: true,
  restoreMocks: true,
  mockReset: true,
};

export const unitTestGlobs = ['app/**/*.test.js'];
export const integrationTestGlobs = ['app/**/*.integration.test.js'];
export const snapshotTestGlobs = ['app/**/*.snapshot.test.js'];
export const allTestGlobs = [
  ...unitTestGlobs,
  ...integrationTestGlobs,
  ...snapshotTestGlobs,
];
