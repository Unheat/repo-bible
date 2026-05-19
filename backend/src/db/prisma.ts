/**
 * Prisma Client Singleton
 * 
 * Ensures a single Prisma Client instance is used throughout the application.
 * Prevents connection pool exhaustion in development with hot reloading.
 */

import { PrismaClient } from '../generated/prisma';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export types for convenience
export type { Repository, File, CodeChunk, GeneratedDoc } from '../generated/prisma';

// Made with Bob
