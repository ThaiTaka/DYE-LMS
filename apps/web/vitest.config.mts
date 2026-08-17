import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Load the monorepo-root .env — Next.js only looks inside the app directory. */
function loadRootEnv(): void {
  const envPath = resolve(import.meta.dirname, '../../.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] ??= trimmed.slice(eq + 1).trim();
  }
}

loadRootEnv();

export default defineConfig({
  plugins: [react()],
  // tsconfig uses `jsx: "preserve"` because Next.js does its own transform.
  // Vitest has no Next.js in the loop, so it must be told to use the automatic
  // runtime — otherwise esbuild emits classic `React.createElement` calls and
  // every render fails with "React is not defined".
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      // `server-only` throws on import outside a React Server Component bundle.
      // The integration tests exercise the same server modules directly, so the
      // guard has to be neutralised here — it protects the client bundle, and
      // there is no client bundle in a vitest run.
      'server-only': resolve(import.meta.dirname, './src/testing/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Integration tests share one database; parallel files would race on cleanup.
    fileParallelism: false,
  },
});
