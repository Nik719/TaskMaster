// Single shared Prisma client for the whole process.
// Prisma 7 talks to Postgres through a driver adapter (here: node-postgres "pg").
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';
import { logger } from './logger.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Failed queries already throw, and those errors reach our central error handler, so Prisma's
// own "error" printing would only duplicate them. Warnings are routed into our logger instead
// of being printed to the console.
export const prisma = new PrismaClient({
  adapter,
  log: [{ emit: 'event', level: 'warn' }],
});

prisma.$on('warn', (event) => logger.warn({ prisma: event }, 'Prisma warning'));

/** Lightweight connectivity check used by the health endpoint. */
export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
