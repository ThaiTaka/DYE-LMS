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

  // Prisma's query engine is a native binary; bundling it breaks the client.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],

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
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
