/**
 * Stub for the `server-only` package during tests.
 *
 * `server-only` exists to make a build fail if a server module is pulled into
 * the client bundle. In a vitest run there is no client bundle, and the
 * integration tests import those server modules on purpose — so the guard is
 * aliased to this empty module in vitest.config.ts.
 *
 * The real package still protects `next build`, which is where it matters.
 */
export {};
