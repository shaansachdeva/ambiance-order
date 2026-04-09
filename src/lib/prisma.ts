import { PrismaClient } from "@/generated/prisma/client";
import path from "path";
import dns from "dns";

// Force IPv4 DNS resolution — EC2 can't reach Supabase over IPv6
dns.setDefaultResultOrder("ipv4first");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isPostgres = process.env.DB_PROVIDER === "postgresql";

  if (isPostgres) {
    // Production: Supabase Postgres — Prisma 7 requires a driver adapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, family: 4 });
    const adapter = new PrismaPg(pool);
    return new (PrismaClient as any)({ adapter });
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

// Always cache on globalThis — not just in dev.
// In production, omitting this creates a new PrismaClient per module evaluation,
// exhausting the connection pool under concurrent load.
globalForPrisma.prisma = prisma;
