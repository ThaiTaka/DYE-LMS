/**
 * Edge middleware — a redirect for user experience, NOT a security boundary.
 *
 * It only checks whether a session cookie is *present*. It cannot validate the
 * token, because validation requires Prisma and Prisma does not run on the edge
 * runtime. A forged cookie therefore sails past this file.
 *
 * That is fine, and deliberate: the real boundary is `authorize()` running
 * server-side on every data access. This exists so a signed-out visitor lands on
 * the login page instead of a flash of empty dashboard.
 *
 * Never add "if the cookie exists, trust it" logic below this line.
 *
 * Every redirect here is host-agnostic on purpose — see the note at the redirect
 * itself. The deployment is reached through a Cloudflare tunnel whose hostname
 * changes, so nothing in the auth flow may hardcode or infer an origin.
 */
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/dang-nhap', '/khong-co-quyen'];

/** Auth.js cookie name; the `__Secure-` prefix is used over HTTPS. */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasCookie) return NextResponse.next();

  /*
   * Built from `request.nextUrl`, and never from configuration.
   *
   * A relative Location would be ideal and is not possible here: Next.js parses
   * the header as a URL and throws before the response leaves middleware —
   *
   *     TypeError: Invalid URL … code: 'ERR_INVALID_URL',
   *     input: '/dang-nhap?tiep-tuc=%2Fgiao-vien'
   *
   * so an absolute url is mandatory. What matters is where the origin comes from.
   * `nextUrl` is derived from the incoming request (honouring `x-forwarded-host`),
   * so it echoes back whatever hostname the visitor actually used — the tunnel
   * host today, a different tunnel host tomorrow, localhost in development.
   * Reading AUTH_URL or hardcoding an origin here is what would break.
   */
  const url = request.nextUrl.clone();
  url.pathname = '/dang-nhap';
  url.searchParams.set('tiep-tuc', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, the auth endpoints and static files.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)',
  ],
};
