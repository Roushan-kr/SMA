import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DATABASE_URL = process.env["DATABASE_URL"] as string;
const adapter = new PrismaPostgresAdapter({ connectionString: DATABASE_URL })

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
