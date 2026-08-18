import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Load the repo-root .env, matching packages/core's approach.
 *
 * These tests run against a real PostgreSQL instance and a real Docker daemon.
 * Mocking either would test the mock: the whole claim of this package is that
 * hostile code is contained by an actual container, and a fake container
 * contains nothing.
 */
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
  test: {
    environment: 'node',
    // Containers are slow, and several tests deliberately wait for a deadline
    // to expire. A short default would fail them for being correct.
    testTimeout: 60_000,
    hookTimeout: 90_000,
    // Sandbox tests count running containers to prove nothing is orphaned, so
    // they must not run alongside each other.
    fileParallelism: false,
  },
});
