import { defineConfig } from 'vitest/config';
import { integrationTestGlobs, sharedTestConfig } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: integrationTestGlobs,
  },
});
