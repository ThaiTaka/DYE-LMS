/**
 * Server-side guards for route handlers, server actions and server components.
 *
 * Every one of these funnels into `authorize()` from `@dye/core`, so the web
 * layer holds no authorization logic of its own — there is exactly one place
 * where "may this actor do this?" is decided, and it is covered by the
 * integration tests in packages/core.
 */
import {
  authorize,
  ForbiddenError,
  requireActor,
  type Actor,
  type AuthzRequest,
} from '@dye/core';
import { redirect } from 'next/navigation';

import { currentActor } from '../auth';
import { db } from './db';

import type { Role } from '@prisma/client';

/** The signed-in actor, or redirect to the login page. */
export async function requireSession(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect('/dang-nhap');

  // A teacher-provisioned account must set its own password before doing
  // anything else, so the initial shared password cannot linger.
  if (actor.mustChangePassword) redirect('/doi-mat-khau');

  return actor;
}

/** As above, but also requires one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<Actor> {
  const actor = await requireSession();
  if (!roles.includes(actor.role)) redirect('/khong-co-quyen');
  return actor;
}

/**
 * Assert a permission inside a server component or action.
 *
 * Throws `ForbiddenError` / `UnauthorizedError`, which the error boundary maps
 * to 403 / 401. Never returns data — callers fetch after this resolves.
 */
export async function guard(request: AuthzRequest): Promise<Actor> {
  const actor = requireActor(await currentActor());
  await authorize(db, actor, request);
  return actor;
}

/**
 * Run a page's data loader, turning an expected refusal into a value.
 *
 * A teacher opening a URL for a class they do not own is a NORMAL event — a
 * stale bookmark, a shared link, a typed id. It is not an exception, and it must
 * not be handled like one.
 *
 * Letting `ForbiddenError` escape a server component produces an HTTP 500 with
 * Next.js's internal error shell: a server-component throw is only picked up by
 * `error.tsx` after client hydration, so the first paint is a crash page and the
 * status line claims the server broke when it worked exactly as designed.
 *
 * The caller redirects on `{ ok: false }` — outside this try/catch, because
 * `redirect()` signals by throwing and would otherwise be swallowed here.
 *
 * Only `ForbiddenError` is absorbed. Everything else still propagates, so a real
 * fault stays loud.
 */
export async function xemDuoc<T>(viec: Promise<T>): Promise<{ ok: true; du: T } | { ok: false }> {
  try {
    return { ok: true, du: await viec };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false };
    throw error;
  }
}

/**
 * Guard for API route handlers.
 *
 * Returns a `Response` on failure instead of redirecting, because an API client
 * needs a status code, not an HTML login page.
 */
export async function guardApi(
  request: AuthzRequest,
): Promise<{ ok: true; actor: Actor } | { ok: false; response: Response }> {
  const actor = await currentActor();

  if (!actor) {
    return {
      ok: false,
      response: Response.json({ error: 'Chưa đăng nhập.' }, { status: 401 }),
    };
  }

  try {
    await authorize(db, actor, request);
    return { ok: true, actor };
  } catch {
    // Deliberately does not echo the internal reason — that detail is for the
    // audit log, not for the caller.
    return {
      ok: false,
      response: Response.json({ error: 'Không có quyền.' }, { status: 403 }),
    };
  }
}
