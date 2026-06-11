import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const rootEnvPath = resolve("../../.env");

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

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
