import "dotenv/config";
import { defineConfig } from "prisma/config";

const isPostgres = process.env.DB_PROVIDER === "postgresql";

export default defineConfig({
  schema: isPostgres
    ? "prisma/schema.postgres.prisma"
    : "prisma/schema.sqlite.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
