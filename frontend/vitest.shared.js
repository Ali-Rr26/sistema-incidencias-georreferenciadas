export const sharedTestConfig = {
  environment: 'jsdom',
  setupFiles: ['./app/core/vitest.setup.js'],
  globals: true,
  clearMocks: true,
  restoreMocks: true,
  mockReset: true,
  // Without this, Vitest stubs every *.css import to an empty module — the
  // stub regex also matches `x.component.css?raw`, which would silently
  // turn the bundled `style` strings of migrated components into ''.
  css: true,
};

export const unitTestGlobs = [
  'app/**/*.test.js',
  'app/**/__tests__/**/*.spec.js',
];
export const integrationTestGlobs = ['app/**/*.integration.test.js'];
export const snapshotTestGlobs = ['app/**/*.snapshot.test.js'];
export const allTestGlobs = [
  ...unitTestGlobs,
  ...integrationTestGlobs,
  ...snapshotTestGlobs,
];
