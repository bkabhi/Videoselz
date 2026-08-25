import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Each suite builds its own in-memory database; running them in one
    // process keeps the shared module registry predictable.
    fileParallelism: false,
  },
});
