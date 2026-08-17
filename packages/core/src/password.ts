/**
 * Password hashing.
 *
 * Argon2id with OWASP's first recommended parameter set (m=19 MiB, t=2, p=1).
 * These live here as the single source of truth so the seed and the login path
 * can never drift apart — mismatched parameters are a silent security downgrade.
 */
import { hash, verify } from '@node-rs/argon2';

/**
 * OWASP Password Storage Cheat Sheet, Argon2id option 2:
 * 19 MiB memory, 2 iterations, 1 degree of parallelism.
 */
export const PASSWORD_PARAMS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Minimum length for a student password. Kept modest — these are 12-year-olds. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Precomputed hash of a value nobody can log in with.
 *
 * Used to burn the same CPU time when a username does not exist, so an attacker
 * cannot tell "no such user" from "wrong password" by timing the response.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash('dye-lms-nonexistent-account-placeholder', PASSWORD_PARAMS);
  return dummyHashPromise;
}

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  return hash(plain, PASSWORD_PARAMS);
}

/**
 * Verify a password against a stored hash.
 *
 * Never throws on a malformed hash — a corrupted row must fail closed (return
 * false), not crash the login route and leak a stack trace.
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/**
 * Burn roughly one verification's worth of CPU without checking anything.
 *
 * Call this on the "user not found" branch so both branches take similar time.
 */
export async function burnVerificationTime(plain: string): Promise<void> {
  try {
    await verify(await getDummyHash(), plain);
  } catch {
    // Intentionally ignored — the point is the elapsed time, not the result.
  }
}
