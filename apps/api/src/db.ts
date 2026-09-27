// Shared Prisma client singleton (local Postgres).
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __edufarmPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__edufarmPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__edufarmPrisma = prisma;
}
