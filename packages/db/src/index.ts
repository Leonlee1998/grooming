import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/index.js'

// Load root .env when executed outside of Next.js (seed, studio, scripts)
const rootEnvPath = resolve('../../.env')
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath)
}

function createClient(connectionString: string | undefined): PrismaClient {
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient
  prismaAdmin?: PrismaClient
}

const g = globalThis as PrismaGlobal

/**
 * Regular client — uses connection pooler (DATABASE_URL).
 * RLS applies when requests go through Supabase PostgREST layer.
 * Use for: read queries, client-context operations.
 */
export const prisma = g.prisma ?? createClient(process.env.DATABASE_URL)

/**
 * Admin client — uses direct connection (DIRECT_URL → postgres superuser).
 * Bypasses RLS at the database level.
 * Use for: Server Actions, PDF generation, background jobs, migrations.
 */
export const prismaAdmin =
  g.prismaAdmin ??
  createClient(process.env.DIRECT_URL ?? process.env.DATABASE_URL)

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma
  g.prismaAdmin = prismaAdmin
}

export * from '../generated/client/index.js'
