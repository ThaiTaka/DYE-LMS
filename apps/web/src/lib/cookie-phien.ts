import 'server-only';

import { cookies } from 'next/headers';

/**
 * A session cookie that dies with the browser.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Students share machines. A session that outlives the browser window is the
 * next child at that desk logged in as the last one. The session cookie must
 * therefore carry NO `Expires` and NO `Max-Age` — a "session cookie" in the
 * cookie spec's own sense, which the browser discards when it fully closes.
 *
 * ── Why this is not a config option ──────────────────────────────────────────
 * Auth.js v5 sets `Expires` on the session cookie from `session.maxAge`, on
 * sign-in and on every refresh, by passing it INTO the cookie store's `chunk()`
 * — where it is merged AFTER the configured `cookies.sessionToken.options`,
 * so it wins over anything put there. There is no setting that removes it.
 * The attribute has to be stripped from the response, which is what the two
 * functions below do at the only two places this app writes the cookie:
 *
 *   • the credentials sign-in server action (`dangNhap`) — Auth.js writes the
 *     cookie into Next's mutable cookie store; `datLaiCookiePhien` overwrites
 *     it, same name and value, without a lifetime.
 *   • the `/api/auth/*` route handlers — the response's Set-Cookie headers are
 *     rewritten by `epPhanHoiTheoPhien`.
 *
 * `auth()` in server components and actions never writes cookies (React
 * Server Components cannot), so there is no third path.
 *
 * ── What still bounds a session ──────────────────────────────────────────────
 * The server-side `Session` row keeps its own expiry (`SESSION_TTL_DAYS`). A
 * browser that restores its previous session on launch — Chrome's "Continue
 * where you left off", Edge's equivalent, Firefox's session restore — keeps
 * session cookies too; that is the browser's policy and no header changes it,
 * so the row's expiry is the guarantee that actually holds on such a machine.
 */

/** Auth.js v5 session cookie names, insecure and secure prefixes. */
export const TEN_COOKIE_PHIEN = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

/** Is this Set-Cookie line (or cookie name) the session cookie, or one of its chunks? */
export function laCookiePhien(tenHoacDong: string): boolean {
  const ten = tenHoacDong.split('=')[0]?.trim() ?? '';
  return TEN_COOKIE_PHIEN.some((t) => ten === t || ten.startsWith(`${t}.`));
}

/**
 * Drop `Expires` and `Max-Age` from one Set-Cookie line.
 *
 * Pure, so it can be tested against real header strings. Every other
 * attribute — Path, HttpOnly, Secure, SameSite — is kept byte-for-byte.
 *
 * A DELETION passes through untouched. Auth.js signs out by re-setting the
 * cookie with an empty value and `Max-Age=0`; that is not a lifetime, it is
 * the instruction to remove the cookie, and stripping it would leave an
 * empty cookie in the browser that the middleware still counts as present.
 */
export function epTheoPhienTrinhDuyet(setCookie: string): string {
  const [dauTien = '', ...thuocTinh] = setCookie.split(';');
  const giaTri = dauTien.slice(dauTien.indexOf('=') + 1).trim();
  const laXoa = giaTri === '' || thuocTinh.some((t) => /^\s*max-age\s*=\s*0\s*$/i.test(t));
  if (laXoa) return setCookie;

  return [dauTien, ...thuocTinh.filter((t) => !/^\s*(expires|max-age)\s*=/i.test(t)).map((t) => t.trim())].join(
    '; ',
  );
}

/**
 * Rewrite a response so its session cookie has no lifetime.
 *
 * Non-session cookies (CSRF, callback-url, PKCE) pass through untouched. A
 * response with no Set-Cookie is returned as-is — same object, no copy.
 */
export function epPhanHoiTheoPhien(res: Response): Response {
  const dong = res.headers.getSetCookie();
  if (dong.length === 0) return res;

  const headers = new Headers(res.headers);
  headers.delete('set-cookie');
  for (const c of dong) headers.append('set-cookie', laCookiePhien(c) ? epTheoPhienTrinhDuyet(c) : c);

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * After a server-action sign-in: re-set the session cookie without a lifetime.
 *
 * Next's `cookies()` store in a server action is name-keyed and reads back
 * what was set earlier in the same action, so this overwrites the cookie
 * Auth.js just wrote — same name, same value, no `Expires`. The attributes
 * mirror Auth.js's own defaults; only the lifetime is absent.
 */
export async function datLaiCookiePhien(): Promise<void> {
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (!laCookiePhien(c.name)) continue;
    jar.set(c.name, c.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: c.name.startsWith('__Secure-'),
    });
  }
}
