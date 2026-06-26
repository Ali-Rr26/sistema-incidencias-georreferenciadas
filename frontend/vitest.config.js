import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./app/core/vitest.setup.js'],
    include: ['app/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
