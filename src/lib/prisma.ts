import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const DATABASE_URL = process.env.DATABASE_URL as string;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables.');
}

// ── Connection pool ───────────────────────────────────────────────────────────
// Neon's serverless pooler (ap-southeast-1) cold-starts after ~5 min inactivity.
// keepAlive probes prevent the TCP socket from being silently killed while idle.
const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  // @ts-ignore — pg accepts these but typedefs lag
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
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

// ── Retry wrapper ─────────────────────────────────────────────────────────────
// Neon's pooler returns "Can't reach database server" on cold-start.
// Retry up to 3 times with exponential backoff before propagating the error.

const RETRYABLE = [
  'Can\'t reach database server',
  'Connection terminated unexpectedly',
  'Connection ended unexpectedly',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
];

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE.some((s) => msg.includes(s));
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) break;
      console.warn(`[db] Retryable error on attempt ${i + 1}/${attempts}: ${(err as Error).message}. Retrying in ${delayMs * (i + 1)}ms…`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Global safety net ─────────────────────────────────────────────────────────
// Swallow connection-drop noise that escapes try/catch so the server doesn't crash.
process.on('unhandledRejection', (reason) => {
  if (isRetryable(reason)) {
    console.warn('[prisma] Pool connection was closed by the server — will reconnect on next query.');
    return;
  }
  console.error('[unhandledRejection]', reason);
});
