import { napEnv } from '../../scripts/moi-truong.mjs';

/**
 * Load the monorepo-root `.env`.
 *
 * Next.js only looks for `.env` inside the app directory, so in a workspace the
 * root file is invisible to it — AUTH_SECRET and DATABASE_URL would simply be
 * missing and Auth.js would fail at runtime with `MissingSecret`.
 *
 * Copying the file into apps/web would duplicate secrets across the repo, so the
 * single root copy is read instead.
 *
 * The implementation moved to `scripts/moi-truong.mjs` because this file used to
 * hold one of TWO independent copies of it, and the copies had drifted: this one
 * read only `.env`, while the database wrapper also read `.env.production`. On a
 * VPS that meant the same variable could hold different values in the web
 * process and in a migration — a difference that would surface as data going to
 * the wrong database rather than as an error.
 */

/**
 * Is this the dev server?
 *
 * Read BEFORE `loadRootEnv()` on purpose. The repo's `.env` carries
 * `NODE_ENV=development` for local work, so loading it first would let a
 * checked-in file decide a security header: a build started without NODE_ENV
 * set would pick up `development` from disk and ship `unsafe-eval`. Only the
 * real process environment gets a vote, and `next dev` / `next build` both set
 * it before this file is loaded.
 *
 * Compared against the exact string `'development'` rather than testing for
 * "not production", so any other value — including an unset one — yields the
 * STRICT policy. Breaking Fast Refresh is loud and harmless; shipping
 * `unsafe-eval` to a real server is silent and not.
 *
 * Both directions are asserted in src/lib/bao-mat.test.ts.
 */
const laMoiTruongPhatTrien = process.env.NODE_ENV === 'development';

napEnv();

/**
 * Origins allowed to reach the DEV server's internal endpoints.
 *
 * Next 15 rejects cross-origin requests to `/_next/*` from an origin it was not
 * told about. On a laptop that never fires, because the origin is always
 * `localhost`. On a VPS reached by public IP or domain it blocks the dev
 * server's own assets, and the page loads without styles or Fast Refresh while
 * the terminal shows nothing obviously wrong.
 *
 * Comma-separated, so a deployment sets `DEV_ORIGINS=1.2.3.4:3000,lms.truong.vn`
 * without editing this file. Dev-only by definition — `next start` ignores it.
 */
const nguonDev = (process.env.DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  ...(nguonDev.length > 0 ? { allowedDevOrigins: nguonDev } : {}),

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
   * The production CSP omits `unsafe-eval` on this origin, and that is load
   * bearing: this app runs code written by children, and `eval` is the shortest
   * path from an injected string to running script. Pyodide needs it, so the
   * code playground will be served from its own sandboxed origin rather than
   * weakening the policy here.
   *
   * The DEV SERVER ONLY is a different matter. Next.js compiles modules and
   * applies Fast Refresh by evaluating generated source at runtime, so without
   * `unsafe-eval` the dev server throws `EvalError` and renders a blank page.
   * That relaxation is scoped to `laMoiTruongPhatTrien` and never reaches a
   * built artefact — asserted by a test in src/lib/bao-mat.test.ts.
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
              laMoiTruongPhatTrien
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
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
