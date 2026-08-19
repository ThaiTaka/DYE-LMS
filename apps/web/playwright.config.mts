import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

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

const PORT = Number(process.env['E2E_PORT'] ?? 3101);
const BASE = `http://localhost:${PORT}`;

/**
 * End-to-end tests against a real production build.
 *
 * ── Why `next start` and not `next dev` ──────────────────────────────────────
 * Dev mode compiles on demand and behaves differently around server actions and
 * bundling. Two of the bugs found during Phases 7–11 — `node:crypto` reaching a
 * client bundle, and a `'use server'` export invoked as a lazy initialiser —
 * only appear in a production build. Testing dev mode would have missed both.
 *
 * ── Why this file is .mts ────────────────────────────────────────────────────
 * `apps/web` is not `"type": "module"`, so Playwright would load a `.ts` config
 * through CJS and `import.meta` becomes a syntax error. The extension forces ESM
 * — the same reason `vitest.config.mts` carries it.
 *
 * ── Serial, one worker ───────────────────────────────────────────────────────
 * These tests move real rows: a student submits, a teacher unlocks a lesson. Two
 * workers sharing one seeded database would race on the same student and fail
 * for reasons that have nothing to do with the code.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The UI is Vietnamese; a mismatched locale changes date rendering and would
    // make assertions fail for the wrong reason.
    locale: 'vi-VN',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE}/dang-nhap`,
    /*
     * Never reuse a server this config did not start.
     *
     * With reuse on, a stray `next start` — or a dev server on another port —
     * silently becomes the system under test, and a run can pass against a build
     * that is not the one on disk. Starting fresh every time costs a few seconds
     * and removes a whole class of results that cannot be trusted.
     */
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      /*
       * AUTH_URL is deliberately EMPTY, not set to this server.
       *
       * It used to be pinned to BASE, because a stale AUTH_URL sent the browser
       * off the server under test after a successful login — silently asserting
       * against a different build whenever something else was listening there.
       *
       * The login action no longer lets Auth.js issue that redirect; it redirects
       * to a path itself, so no host needs pinning. Passing an empty string
       * blanks any AUTH_URL inherited from the root .env, which means the suite
       * exercises the same unpinned configuration a tunnel or a proxy runs — the
       * one that was broken. Pinning it here would hide exactly that bug.
       */
      AUTH_URL: '',
      AUTH_TRUST_HOST: 'true',
    },
  },
});
