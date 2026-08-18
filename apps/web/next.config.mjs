import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load the monorepo-root `.env`.
 *
 * Next.js only looks for `.env` inside the app directory, so in a workspace the
 * root file is invisible to it — AUTH_SECRET and DATABASE_URL would simply be
 * missing and Auth.js would fail at runtime with `MissingSecret`.
 *
 * Copying the file into apps/web would duplicate secrets across the repo, so we
 * read the single root copy here instead. Existing process env always wins, so
 * real deployment variables are never overwritten by a stray dev file.
 */
function loadRootEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, '../../.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Workspace packages ship TypeScript source, not a build artefact.
  transpilePackages: ['@dye/core', '@dye/db'],

  /*
   * Standalone output — for the Docker image ONLY.
   *
   * Tracing the modules actually reached lets the runtime image ship a
   * self-contained server with no build toolchain and no dev dependencies. In a
   * monorepo that matters more than usual: without it the image would have to
   * carry the whole workspace's node_modules.
   *
   * Gated behind a flag because enabling it unconditionally BREAKS `next start`
   * ("next start does not work with output: standalone"), and `next start` is
   * how the Playwright suite serves the app. A deployment concern must not take
   * away a normal local workflow. apps/web/Dockerfile sets the flag.
   */
  ...(process.env['BUILD_STANDALONE'] === '1' ? { output: 'standalone' } : {}),

  // Prisma's query engine is a native binary; bundling it breaks the client.
  // Native or Node-only packages that must run from node_modules rather than
  // being traced into the bundle. `bullmq` is here because it is server-only by
  // construction (imported from lib/judge-queue.ts, which is `server-only`), and
  // because bundling it makes webpack try to resolve an optional Valkey client
  // we do not use and warn that it is missing.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2', 'bullmq'],

  /**
   * Security headers.
   *
   * CSP deliberately omits `unsafe-eval` on this origin. Pyodide needs it, so
   * the code playground will be served from its own sandboxed origin in Phase 7
   * rather than weakening the policy here.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              /*
               * The MakeCode editor is embedded as an iframe for Micro:bit
               * lessons. `frame-src` is the narrowest directive that allows it:
               * scripts still may not come from that origin, only a framed
               * document. Listed by exact host, never a wildcard.
               *
               * https, so a Micro:bit lesson cannot introduce mixed content on
               * an https deployment.
               */
              'frame-src https://makecode.microbit.org',
            ].join('; '),
          },
        ],
      },

      {
        /*
         * Uploaded project files get a far tighter policy than the app.
         *
         * These bytes were written by a student. Serving them under the app's
         * own CSP would let anything the browser decided to treat as a document
         * run with `script-src 'self'` — which is the app's own origin. The
         * `sandbox` directive strips the origin, scripts, forms and plugins, so
         * even a content type mis-honoured somewhere downstream has nothing to
         * act with.
         *
         * Listed AFTER the catch-all: for a matching path, the later rule wins.
         */
        source: '/api/du-an/:id/tep/:fileId',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; sandbox; style-src 'unsafe-inline'",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
