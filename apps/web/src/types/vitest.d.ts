/// <reference types="@testing-library/jest-dom/vitest" />

/**
 * Brings the jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …) into
 * TypeScript's view of `expect`.
 *
 * The matchers are registered at runtime in vitest.setup.ts; without this
 * reference they work but do not typecheck, which would leave the test suite
 * green while `npm run typecheck` fails.
 */
export {};
