import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const DATABASE_URL = process.env.DATABASE_URL as string;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables.');
}

// ── Connection pool ───────────────────────────────────────────────────────────
// Neon (and most managed Postgres) enforces a hard connection cap.
// `max` limits the pg pool to avoid P2037 TooManyConnections.
// Keep this low in dev (5) — increase only for production load.
const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  max: 5,                   // max simultaneous connections from this process
  idleTimeoutMillis: 10_000, // release idle connections after 10 s
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
