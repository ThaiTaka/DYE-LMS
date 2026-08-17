/**
 * Database-backed sessions.
 *
 * Chosen over pure JWT for one reason the brief makes non-negotiable: a teacher
 * disabling a student account must revoke access *immediately*. A signed JWT
 * stays valid until it expires no matter what the database says; a session row
 * can be deleted, and `validateSession` re-checks `user.isActive` on every call.
 *
 * ── What is stored ───────────────────────────────────────────────────────────
 * The `Session.sessionToken` column holds a **SHA-256 hash** of the token, not
 * the token itself. The raw token exists only in the user's cookie. If the
 * database leaks, the stolen rows cannot be replayed as valid sessions.
 *
 * This is why the Auth.js `PrismaAdapter` session methods are NOT used — they
 * look sessions up by raw token. We own this layer instead. See apps/web/src/auth.ts.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { PrismaClient, Role } from '@prisma/client';

/** Default session lifetime. Short-ish: school machines are often shared. */
export const SESSION_TTL_DAYS = 7;

/** 256 bits of entropy, url-safe. */
const TOKEN_BYTES = 32;

export interface Actor {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface SessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedSession {
  /** Raw token — goes in the cookie. Never stored anywhere. */
  token: string;
  expiresAt: Date;
}

/** Hash a raw session token for storage and lookup. */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex digests.
 *
 * Lookup is by indexed equality (fast, and the value is already a hash), but
 * where we compare digests directly we do it without an early-exit branch.
 */
export function safeDigestEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Issue a new session for a user.
 *
 * Refuses to issue for a disabled account — otherwise a race between "teacher
 * disables account" and "student logs in" could mint a session that outlives
 * the disablement.
 */
export async function createSession(
  db: PrismaClient,
  userId: string,
  context: SessionContext = {},
  ttlDays: number = SESSION_TTL_DAYS,
): Promise<IssuedSession> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new Error('Không thể tạo phiên cho tài khoản đã bị vô hiệu hoá.');
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      sessionToken: hashToken(token),
      userId,
      expires: expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw token to an actor, or null.
 *
 * Returns null (never throws) for every failure mode — expired, unknown,
 * disabled account — so callers cannot accidentally leak which one it was.
 *
 * An expired or orphaned row is deleted on sight, so the table self-cleans.
 */
export async function validateSession(
  db: PrismaClient,
  token: string | null | undefined,
): Promise<Actor | null> {
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: hashToken(token) },
    select: {
      id: true,
      expires: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expires.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // The account may have been disabled AFTER this session was issued.
  // This check is what makes deactivation take effect immediately.
  if (!session.user.isActive) {
    await db.session.deleteMany({ where: { userId: session.user.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

/** Log out one device. Idempotent. */
export async function revokeSession(db: PrismaClient, token: string): Promise<void> {
  await db.session.deleteMany({ where: { sessionToken: hashToken(token) } });
}

/**
 * Log out everywhere.
 *
 * Called when an account is disabled, when a password changes, and when a role
 * changes — any event where existing sessions should no longer be trusted.
 */
export async function revokeAllSessions(db: PrismaClient, userId: string): Promise<number> {
  const result = await db.session.deleteMany({ where: { userId } });
  return result.count;
}

/**
 * Replace a session token while keeping the user logged in.
 *
 * Session fixation defence: call after any privilege change so a token captured
 * before the change cannot be used after it.
 */
export async function rotateSession(
  db: PrismaClient,
  oldToken: string,
  context: SessionContext = {},
): Promise<IssuedSession | null> {
  const actor = await validateSession(db, oldToken);
  if (!actor) return null;

  await revokeSession(db, oldToken);
  return createSession(db, actor.id, context);
}

/**
 * Disable an account and revoke every session it holds, atomically.
 *
 * Doing these two writes in one transaction closes the window where an account
 * is already disabled but its sessions are still live.
 */
export async function deactivateUser(db: PrismaClient, userId: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { isActive: false } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}

/** Housekeeping: drop expired rows. Safe to run on a schedule. */
export async function purgeExpiredSessions(db: PrismaClient): Promise<number> {
  const result = await db.session.deleteMany({ where: { expires: { lte: new Date() } } });
  return result.count;
}
