/**
 * Auth.js v5 wiring.
 *
 * ── The problem this file solves ─────────────────────────────────────────────
 * Auth.js v5 does not support `session: { strategy: 'database' }` together with
 * the Credentials provider — the adapter's `createSession` is never called in
 * the credentials flow. But the brief requires that disabling an account revoke
 * access *immediately*, which a self-contained JWT cannot do.
 *
 * ── The resolution ───────────────────────────────────────────────────────────
 * We keep `strategy: 'jwt'` so credentials work, then override the JWT codec:
 *
 *   encode  →  returns the OPAQUE session token minted by @dye/core.
 *              The cookie therefore carries a random 256-bit reference,
 *              not a self-contained claim set.
 *
 *   decode  →  resolves that reference through `validateSession`, which hits
 *              the database and re-checks `user.isActive` on EVERY request.
 *
 * The result behaves like a database session while satisfying Auth.js's
 * credentials constraints. Auth.js still owns CSRF, cookie flags and routing.
 *
 * Session semantics are proven by the integration tests in
 * packages/core/src/auth.test.ts, which exercise @dye/core directly — so the
 * security guarantees do not rest on Auth.js internals.
 */
import { login, validateSession, SESSION_TTL_DAYS } from '@dye/core';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { db } from './lib/db';

import type { Role } from '@prisma/client';

/** Shape carried on the decoded token and exposed on `session.user`. */
export interface DyeUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  },
  pages: {
    signIn: '/dang-nhap',
    error: '/dang-nhap',
  },
  providers: [
    Credentials({
      name: 'DYE LMS',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      /**
       * Returning null makes Auth.js report a generic CredentialsSignin error.
       * That is intentional: every failure mode — unknown user, wrong password,
       * disabled account, rate limited — must look identical from outside.
       * The specific reason is already in the audit log.
       */
      authorize: async (credentials) => {
        const username = typeof credentials?.username === 'string' ? credentials.username : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!username || !password) return null;

        try {
          const result = await login(db, username, password);
          return {
            id: result.actor.id,
            username: result.actor.username,
            displayName: result.actor.displayName,
            role: result.actor.role,
            mustChangePassword: result.mustChangePassword,
            // Handed to `encode` below and never sent to the client as data.
            sessionToken: result.session.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  jwt: {
    /** The cookie value is our opaque session reference, not a signed claim set. */
    encode: async ({ token }) => {
      const sessionToken = token?.['sessionToken'];
      return typeof sessionToken === 'string' ? sessionToken : '';
    },

    /**
     * Resolve the opaque reference against the database on every request.
     *
     * This is the line that makes "teacher disables account" take effect on the
     * very next page load rather than at token expiry.
     */
    decode: async ({ token }) => {
      if (typeof token !== 'string' || token.length === 0) return null;

      const actor = await validateSession(db, token);
      if (!actor) return null;

      return {
        sub: actor.id,
        sessionToken: token,
        username: actor.username,
        displayName: actor.displayName,
        role: actor.role,
        mustChangePassword: actor.mustChangePassword,
      };
    },
  },

  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        const u = user as unknown as DyeUser & { sessionToken: string };
        token['sessionToken'] = u.sessionToken;
        token.sub = u.id;
        token['username'] = u.username;
        token['displayName'] = u.displayName;
        token['role'] = u.role;
        token['mustChangePassword'] = u.mustChangePassword;
      }
      return token;
    },

    session: ({ session, token }) => {
      if (token.sub) {
        session.user = {
          ...session.user,
          id: token.sub,
          username: String(token['username'] ?? ''),
          displayName: String(token['displayName'] ?? ''),
          role: token['role'] as Role,
          mustChangePassword: Boolean(token['mustChangePassword']),
        };
      }
      return session;
    },
  },
});

/**
 * The signed-in actor, in the shape `@dye/core` guards expect.
 *
 * `isActive` is always true here: `decode` already refused to resolve the token
 * otherwise. Returning null means "not signed in".
 */
export async function currentActor(): Promise<{
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: true;
  mustChangePassword: boolean;
} | null> {
  const session = await auth();
  const user = session?.user as (DyeUser & { id?: string }) | undefined;
  if (!user?.id) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: true,
    mustChangePassword: user.mustChangePassword,
  };
}
