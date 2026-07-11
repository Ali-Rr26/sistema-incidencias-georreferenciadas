import { defineConfig } from 'vitest/config';
import { sharedTestConfig, unitTestGlobs } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: unitTestGlobs,
    exclude: ['**/*.integration.test.js', '**/*.snapshot.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
    },
  },
});
