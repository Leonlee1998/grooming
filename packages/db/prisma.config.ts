import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // DIRECT_URL bypasses the connection pooler for migrations
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "./prisma/migrations",
  },
});
