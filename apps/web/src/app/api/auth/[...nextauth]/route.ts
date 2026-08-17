import { handlers } from '@/auth';

/**
 * Auth.js endpoints (sign-in, sign-out, CSRF, session).
 *
 * Node runtime, not edge: `jwt.decode` resolves the session token through
 * Prisma, which needs a full Node environment.
 */
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
