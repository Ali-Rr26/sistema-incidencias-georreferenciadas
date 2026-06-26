import { defineConfig } from 'vitest/config';
import { sharedTestConfig, snapshotTestGlobs } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: snapshotTestGlobs,
  },
});
