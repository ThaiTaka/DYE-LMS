import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string;
      role: Role;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    username: string;
    displayName: string;
    role: Role;
    mustChangePassword: boolean;
    /** Opaque DB session reference. Written to the cookie by `jwt.encode`. */
    sessionToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sessionToken?: string;
    username?: string;
    displayName?: string;
    role?: Role;
    mustChangePassword?: boolean;
  }
}
