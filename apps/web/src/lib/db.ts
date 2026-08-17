import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared Prisma client.
 *
 * Next.js dev-mode hot reload re-evaluates modules on every edit; without this
 * cache each reload would open a new connection pool and exhaust Postgres.
 */
export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
