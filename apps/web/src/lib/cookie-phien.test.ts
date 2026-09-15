/**
 * The session cookie must be a browser-session cookie: no Expires, no Max-Age.
 *
 * Auth.js cannot be configured to omit them (see cookie-phien.ts), so the
 * guarantee lives in the rewrite, and the rewrite is what is tested — against
 * the exact Set-Cookie lines Auth.js v5 emits, including a chunked token.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import {
  epPhanHoiTheoPhien,
  epTheoPhienTrinhDuyet,
  laCookiePhien,
  TEN_COOKIE_PHIEN,
} from './cookie-phien';

/** What @auth/core 0.41 writes on sign-in, verbatim shape. */
const PHIEN_AUTHJS =
  'authjs.session-token=abc.def; Path=/; Expires=Fri, 16 Oct 2026 07:15:00 GMT; HttpOnly; SameSite=Lax';
const PHIEN_SECURE =
  '__Secure-authjs.session-token=abc.def; Path=/; Max-Age=2592000; Expires=Fri, 16 Oct 2026 07:15:00 GMT; HttpOnly; Secure; SameSite=Lax';
const CSRF = 'authjs.csrf-token=tok%7Chash; Path=/; HttpOnly; SameSite=Lax';

describe('nhận diện cookie phiên', () => {
  it('nhận cả hai tên của Auth.js, và các mảnh (.0, .1) khi token bị chia nhỏ', () => {
    for (const t of TEN_COOKIE_PHIEN) {
      expect(laCookiePhien(t)).toBe(true);
      expect(laCookiePhien(`${t}=x; Path=/`)).toBe(true);
      expect(laCookiePhien(`${t}.0=x; Path=/`)).toBe(true);
      expect(laCookiePhien(`${t}.1`)).toBe(true);
    }
  });

  it('không đụng vào các cookie khác của Auth.js', () => {
    expect(laCookiePhien(CSRF)).toBe(false);
    expect(laCookiePhien('authjs.callback-url=%2F; Path=/')).toBe(false);
    expect(laCookiePhien('authjs.session-tokenX=1')).toBe(false);
  });
});

describe('ép về cookie theo phiên trình duyệt', () => {
  it('bỏ Expires, giữ nguyên mọi thuộc tính khác', () => {
    expect(epTheoPhienTrinhDuyet(PHIEN_AUTHJS)).toBe(
      'authjs.session-token=abc.def; Path=/; HttpOnly; SameSite=Lax',
    );
  });

  it('bỏ cả Max-Age lẫn Expires khi có cả hai, không phân biệt hoa thường', () => {
    expect(epTheoPhienTrinhDuyet(PHIEN_SECURE)).toBe(
      '__Secure-authjs.session-token=abc.def; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    expect(epTheoPhienTrinhDuyet('a=b; MAX-AGE=5; EXPIRES=x; Path=/')).toBe('a=b; Path=/');
  });

  it('giá trị cookie chứa dấu = hay ; đã mã hoá thì không bị cắt', () => {
    // Auth.js values are base64url / percent-encoded; a `=` inside the value
    // must stay on the value side of the first split.
    expect(epTheoPhienTrinhDuyet('authjs.session-token=a==; Path=/; Max-Age=1')).toBe(
      'authjs.session-token=a==; Path=/',
    );
  });
});

describe('ép cả phản hồi', () => {
  function phanHoi(setCookies: string[], body = '{"ok":true}', status = 200): Response {
    const headers = new Headers({ 'content-type': 'application/json', 'x-khac': 'giu' });
    for (const c of setCookies) headers.append('set-cookie', c);
    return new Response(body, { status, headers });
  }

  it('cookie phiên mất hạn, cookie khác nguyên vẹn, thân và mã trạng thái giữ nguyên', async () => {
    const res = epPhanHoiTheoPhien(phanHoi([PHIEN_AUTHJS, CSRF], '{"user":1}', 200));
    const dong = res.headers.getSetCookie();

    expect(dong).toHaveLength(2);
    expect(dong.find((c) => c.startsWith('authjs.session-token='))).toBe(
      'authjs.session-token=abc.def; Path=/; HttpOnly; SameSite=Lax',
    );
    expect(dong).toContain(CSRF);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-khac')).toBe('giu');
    expect(await res.text()).toBe('{"user":1}');
    for (const c of dong) {
      expect(c.toLowerCase()).not.toContain('expires=');
      expect(c.toLowerCase()).not.toContain('max-age=');
    }
  });

  it('mảnh token (.0, .1) đều được ép', () => {
    const res = epPhanHoiTheoPhien(
      phanHoi([
        'authjs.session-token.0=aaaa; Path=/; Expires=Fri, 16 Oct 2026 07:15:00 GMT; HttpOnly; SameSite=Lax',
        'authjs.session-token.1=bbbb; Path=/; Expires=Fri, 16 Oct 2026 07:15:00 GMT; HttpOnly; SameSite=Lax',
      ]),
    );
    for (const c of res.headers.getSetCookie()) expect(c.toLowerCase()).not.toContain('expires=');
  });

  it('không có Set-Cookie thì trả về đúng đối tượng cũ — không sao chép vô ích', () => {
    const goc = new Response('x', { status: 200 });
    expect(epPhanHoiTheoPhien(goc)).toBe(goc);
  });

  it('lệnh XOÁ cookie khi đăng xuất đi qua nguyên vẹn — Max-Age=0 không phải là hạn', () => {
    /*
     * Auth.js signs out by re-setting the cookie empty with `Max-Age=0`. That
     * must reach the browser as written: stripped, it would become an empty
     * cookie that still exists, and the middleware's presence check would
     * keep treating a signed-out browser as signed in.
     */
    const xoa = 'authjs.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
    expect(epTheoPhienTrinhDuyet(xoa)).toBe(xoa);
    const res = epPhanHoiTheoPhien(phanHoi([xoa]));
    expect(res.headers.getSetCookie()).toEqual([xoa]);
    // The past-dated variant some versions emit is a deletion too.
    const cu = 'authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly';
    expect(epTheoPhienTrinhDuyet(cu)).toBe(cu);
  });
});
