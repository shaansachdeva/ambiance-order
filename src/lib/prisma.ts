import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isPostgres = process.env.DB_PROVIDER === "postgresql";

  if (isPostgres) {
    // Production: Supabase Postgres — standard PrismaClient, URL from DATABASE_URL env
    // Type assertion needed because generated types depend on which schema was used for generation
    // When built with `npm run build:prod`, the Postgres schema generates compatible types
    return new (PrismaClient as any)();
  } else {
    // Local dev: SQLite with better-sqlite3 adapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const dbPath = path.join(process.cwd(), "dev.db");
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    return new PrismaClient({ adapter });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
