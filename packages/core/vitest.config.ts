import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Load the repo-root .env without adding a dotenv dependency.
 *
 * The auth tests run against a real PostgreSQL instance (docker compose up -d
 * postgres). Mocking Prisma here would test the mock, not the authorization
 * rules — and the rules are the whole point of this package.
 */
function loadRootEnv(): void {
  const envPath = resolve(import.meta.dirname, '../../.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    process.env[key] ??= value;
  }
}

loadRootEnv();

export default defineConfig({
  test: {
    // Argon2id is deliberately slow; a full login round trip is ~100 ms.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Fixtures share a database, so parallel files would race on cleanup.
    fileParallelism: false,
  },
});
