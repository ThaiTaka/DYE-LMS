'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';

export interface TrangThaiDangNhap {
  loi?: string;
}

/**
 * Sign in.
 *
 * Every failure returns the SAME message. Distinguishing "no such account" from
 * "wrong password" — or from "account disabled" — hands an attacker a free
 * user-enumeration oracle. The specific reason is already in the audit log.
 */
export async function dangNhap(
  _prev: TrangThaiDangNhap,
  formData: FormData,
): Promise<TrangThaiDangNhap> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const tiepTuc = String(formData.get('tiep-tuc') ?? '/bang-dieu-khien');

  if (!username || !password) {
    return { loi: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
  }

  // Only allow same-origin relative paths, so `?tiep-tuc=` cannot be used as an
  // open redirect to an attacker's site.
  const dichDen = tiepTuc.startsWith('/') && !tiepTuc.startsWith('//') ? tiepTuc : '/bang-dieu-khien';

  /*
   * ── Why `redirect: false` and our own `redirect()` ─────────────────────────
   * Auth.js does not redirect to a relative path. Given `redirectTo`, `signIn`
   * resolves an ABSOLUTE url through `createActionURL`, which begins:
   *
   *     const envUrl = envObject.AUTH_URL ?? envObject.NEXTAUTH_URL;
   *     if (envUrl) { url = new URL(envUrl) }        // ← wins outright
   *     else { detectedHost = x-forwarded-host ?? host }
   *
   * So AUTH_URL overrides host detection completely, and `trustHost: true` does
   * nothing while it is set. Behind a Cloudflare quick tunnel — whose hostname
   * changes every restart — that pinned a successful login to whichever tunnel
   * host happened to be in the environment when the value was written, and the
   * browser was sent to a hostname that no longer resolved.
   *
   * `redirect: false` makes `signIn` return that url instead of following it. We
   * throw it away and redirect to a path, so the Location header is relative and
   * the browser stays on whatever host it already reached us on. The flow no
   * longer has an opinion about its own hostname.
   *
   * The cookie is still set: `signIn` writes it before the redirect decision.
   */
  try {
    await signIn('credentials', { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { loi: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
    }
    throw error;
  }

  // Outside the try: `redirect()` signals by throwing NEXT_REDIRECT, and catching
  // that would leave the user staring at the login page after a valid sign-in.
  redirect(dichDen);
}
