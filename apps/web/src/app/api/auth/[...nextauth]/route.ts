import { handlers } from '@/auth';

import { epPhanHoiTheoPhien } from '@/lib/cookie-phien';

import type { NextRequest } from 'next/server';

/**
 * Auth.js endpoints (sign-in, sign-out, CSRF, session).
 *
 * Node runtime, not edge: `jwt.decode` resolves the session token through
 * Prisma, which needs a full Node environment.
 *
 * Each handler's response passes through `epPhanHoiTheoPhien`, which strips
 * `Expires` / `Max-Age` from the session cookie. Auth.js sets them on every
 * refresh and there is no option to stop it — see lib/cookie-phien.ts — so a
 * session that must end when the browser closes has to be enforced here, on
 * the wire.
 */
export const runtime = 'nodejs';

type Handler = (req: NextRequest) => Promise<Response>;

function theoPhien(h: Handler): Handler {
  return async (req) => epPhanHoiTheoPhien(await h(req));
}

export const GET = theoPhien(handlers.GET);
export const POST = theoPhien(handlers.POST);
