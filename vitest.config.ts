import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': '/app/src/shared',
      '@server': '/app/src/server',
      '@client': '/app/src/client',
    },
  },
});
