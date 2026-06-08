import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/index.js'

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

export const prisma = g.prisma ?? createClient(process.env.DATABASE_URL)

export const prismaAdmin =
  g.prismaAdmin ??
  createClient(process.env.DIRECT_URL ?? process.env.DATABASE_URL)

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma
  g.prismaAdmin = prismaAdmin
}
