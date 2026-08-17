'use server';

import { AuthError } from 'next-auth';

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

  try {
    await signIn('credentials', { username, password, redirectTo: dichDen });
  } catch (error) {
    if (error instanceof AuthError) {
      return { loi: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
    }
    // `signIn` signals a successful redirect by throwing NEXT_REDIRECT.
    // Swallowing it here would leave the user stuck on the login page.
    throw error;
  }

  return {};
}
