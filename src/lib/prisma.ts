import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const DATABASE_URL = process.env["DATABASE_URL"] as string;
const adapter = new PrismaPg({ connectionString: DATABASE_URL })

export const prisma = new PrismaClient({ adapter });
