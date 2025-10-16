/// <reference types="vitest" />

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/coverage/**',
      '**/examples/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['**/*.{test,spec}.ts', '**/*.d.ts', '**/types/**', 'src/index.ts'],
      reportOnFailure: true,
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: true,
      },
    },
    reporters: ['verbose'],
    clearMocks: true,
    restoreMocks: true,
    sequence: {
      hooks: 'stack',
      shuffle: false,
    },
    retry: 1,
    maxConcurrency: 1,
  },
});
