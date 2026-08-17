/**
 * Login, logout and password change.
 *
 * Every attempt — success or failure — is written to `AuditLog`. That log is
 * also what the rate limiter counts, so brute-force protection works without
 * Redis being up. Redis will front this in Phase 8 for speed, but correctness
 * must not depend on a cache.
 */
import {
  AccountDisabledError,
  RateLimitedError,
  UnauthorizedError,
} from './errors';
import { burnVerificationTime, hashPassword, verifyPassword } from './password';
import {
  createSession,
  revokeAllSessions,
  revokeSession,
  type Actor,
  type IssuedSession,
  type SessionContext,
} from './session';

import type { PrismaClient } from '@prisma/client';

/** Audit actions. Kept as constants so queries and writes cannot drift. */
export const AUDIT = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_DISABLED: 'auth.login.disabled_account',
  LOGIN_RATE_LIMITED: 'auth.login.rate_limited',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password.changed',
  SESSIONS_REVOKED: 'auth.sessions.revoked',
} as const;

export interface RateLimitPolicy {
  /** Failures allowed inside the window before lockout. */
  maxAttempts: number;
  /** Window length, in seconds. */
  windowSeconds: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: RateLimitPolicy = {
  maxAttempts: 8,
  windowSeconds: 15 * 60,
};

export interface LoginResult {
  actor: Actor;
  session: IssuedSession;
  /** True when the teacher provisioned the account and the password is still the initial one. */
  mustChangePassword: boolean;
}

async function audit(
  db: PrismaClient,
  action: string,
  actorId: string | null,
  context: SessionContext,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entityType: 'User',
      entityId: actorId,
      meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });
}

/**
 * Count recent failures for a username.
 *
 * Keyed on the attempted username rather than the user id, because failures
 * against a non-existent account have no id — and those are exactly the
 * attempts an enumeration scan produces.
 */
async function recentFailures(
  db: PrismaClient,
  username: string,
  policy: RateLimitPolicy,
): Promise<number> {
  const since = new Date(Date.now() - policy.windowSeconds * 1000);
  return db.auditLog.count({
    where: {
      action: AUDIT.LOGIN_FAILED,
      createdAt: { gte: since },
      meta: { path: ['username'], equals: username },
    },
  });
}

/**
 * Authenticate a username/password pair and issue a session.
 *
 * Failure modes all raise the same `UnauthorizedError` with the same message.
 * The specific reason goes to the audit log only — distinguishing "no such user"
 * from "wrong password" hands an attacker a free user-enumeration oracle.
 */
export async function login(
  db: PrismaClient,
  usernameInput: string,
  password: string,
  context: SessionContext = {},
  policy: RateLimitPolicy = DEFAULT_LOGIN_RATE_LIMIT,
): Promise<LoginResult> {
  const username = usernameInput.trim().toLowerCase();

  // ── Rate limit ───────────────────────────────────────────────────────────
  const failures = await recentFailures(db, username, policy);
  if (failures >= policy.maxAttempts) {
    await audit(db, AUDIT.LOGIN_RATE_LIMITED, null, context, { username });
    throw new RateLimitedError(policy.windowSeconds);
  }

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      passwordHash: true,
    },
  });

  // ── Unknown account ──────────────────────────────────────────────────────
  if (!user) {
    // Spend comparable CPU so response time does not reveal that the account
    // is missing.
    await burnVerificationTime(password);
    await audit(db, AUDIT.LOGIN_FAILED, null, context, { username, reason: 'unknown-user' });
    throw new UnauthorizedError('unknown-user');
  }

  // ── Wrong password ───────────────────────────────────────────────────────
  // Checked BEFORE the disabled-account branch: otherwise the error tells an
  // attacker that the username exists, just disabled.
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await audit(db, AUDIT.LOGIN_FAILED, user.id, context, { username, reason: 'bad-password' });
    throw new UnauthorizedError('bad-password');
  }

  // ── Disabled account ─────────────────────────────────────────────────────
  if (!user.isActive) {
    await audit(db, AUDIT.LOGIN_DISABLED, user.id, context, { username });
    throw new AccountDisabledError();
  }

  const session = await createSession(db, user.id, context);

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(db, AUDIT.LOGIN_SUCCESS, user.id, context, { username });

  const actor: Actor = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };

  return { actor, session, mustChangePassword: user.mustChangePassword };
}

export async function logout(
  db: PrismaClient,
  token: string,
  actorId: string | null,
  context: SessionContext = {},
): Promise<void> {
  await revokeSession(db, token);
  await audit(db, AUDIT.LOGOUT, actorId, context);
}

/**
 * Change a password and log every other device out.
 *
 * Revoking all sessions is the point: if the password was changed because it
 * leaked, leaving old sessions alive would defeat the change entirely. The
 * caller issues a fresh session for the current device.
 */
export async function changePassword(
  db: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: SessionContext = {},
): Promise<IssuedSession> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, passwordHash: true },
  });

  if (!user) throw new UnauthorizedError('unknown-user');
  if (!user.isActive) throw new AccountDisabledError();

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    await audit(db, AUDIT.LOGIN_FAILED, userId, context, { reason: 'bad-current-password' });
    throw new UnauthorizedError('bad-current-password');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);

  await audit(db, AUDIT.PASSWORD_CHANGED, userId, context);

  return createSession(db, userId, context);
}

/**
 * Reset a student's password.
 *
 * Teacher-initiated. Forces a change on next login and logs every device out,
 * so a reset always ends any session an unauthorised holder had.
 * The CALLER must have authorized this against the teacher→student relationship.
 */
export async function resetPasswordByStaff(
  db: PrismaClient,
  staffId: string,
  studentId: string,
  temporaryPassword: string,
  context: SessionContext = {},
): Promise<void> {
  const passwordHash = await hashPassword(temporaryPassword);

  await db.$transaction([
    db.user.update({
      where: { id: studentId },
      data: { passwordHash, mustChangePassword: true },
    }),
    db.session.deleteMany({ where: { userId: studentId } }),
  ]);

  await db.auditLog.create({
    data: {
      actorId: staffId,
      action: AUDIT.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: studentId,
      meta: { by: 'staff' },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });
}

/** Force-logout every device for a user. Used on role change and on disable. */
export async function revokeAllForUser(
  db: PrismaClient,
  actorId: string | null,
  userId: string,
  context: SessionContext = {},
): Promise<number> {
  const count = await revokeAllSessions(db, userId);
  await db.auditLog.create({
    data: {
      actorId,
      action: AUDIT.SESSIONS_REVOKED,
      entityType: 'User',
      entityId: userId,
      meta: { count },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });
  return count;
}
