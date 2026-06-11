'use server'

import { prismaAdmin } from '@repo/db'
import { z } from 'zod'

// ─── Serialized types (plain objects, safe to pass to Client Components) ──────

export interface PriceRuleData {
  id: string
  serviceId: string
  name: string
  weightMin: number | null
  weightMax: number | null
  breed: string | null
  priceAdjustment: number
  adjustmentType: 'FIXED' | 'PERCENTAGE'
  isActive: boolean
}

export interface ServiceData {
  id: string
  name: string
  category: 'BATH' | 'HAIRCUT' | 'NAIL' | 'SPA' | 'OTHER'
  description: string | null
  basePrice: number
  isActive: boolean
  sortOrder: number
  estimatedMinutes: number
  createdAt: string
  updatedAt: string
  priceRules: PriceRuleData[]
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z.string().min(1, '服務名稱必填'),
  category: z.enum(['BATH', 'HAIRCUT', 'NAIL', 'SPA', 'OTHER']),
  description: z.string().optional(),
  basePrice: z.number().int().min(0, '基礎價格不得為負數'),
  estimatedMinutes: z.number().int().min(1, '預估時間至少 1 分鐘'),
})

const priceRuleSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1, '規則名稱必填'),
  weightMin: z.number().min(0).nullable().optional(),
  weightMax: z.number().min(0).nullable().optional(),
  breed: z.string().nullable().optional(),
  priceAdjustment: z.number().int('金額必須為整數'),
  adjustmentType: z.enum(['FIXED', 'PERCENTAGE']),
  isActive: z.boolean().default(true),
})

export type ServiceInput = z.infer<typeof serviceSchema>
export type PriceRuleInput = z.infer<typeof priceRuleSchema>

// ─── Serialization helpers ────────────────────────────────────────────────────

type RawRule = {
  id: string
  serviceId: string
  name: string
  weightMin: unknown
  weightMax: unknown
  breed: string | null
  priceAdjustment: number
  adjustmentType: string
  isActive: boolean
}

type RawService = {
  id: string
  name: string
  category: string
  description: string | null
  basePrice: number
  isActive: boolean
  sortOrder: number
  estimatedMinutes: number
  createdAt: Date
  updatedAt: Date
  priceRules: RawRule[]
}

function serializeRule(r: RawRule): PriceRuleData {
  return {
    id: r.id,
    serviceId: r.serviceId,
    name: r.name,
    weightMin: r.weightMin != null ? Number(r.weightMin) : null,
    weightMax: r.weightMax != null ? Number(r.weightMax) : null,
    breed: r.breed,
    priceAdjustment: r.priceAdjustment,
    adjustmentType: r.adjustmentType as PriceRuleData['adjustmentType'],
    isActive: r.isActive,
  }
}

function serializeService(s: RawService): ServiceData {
  return {
    id: s.id,
    name: s.name,
    category: s.category as ServiceData['category'],
    description: s.description,
    basePrice: s.basePrice,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    estimatedMinutes: s.estimatedMinutes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    priceRules: s.priceRules.map(serializeRule),
  }
}

const withRules = { priceRules: { orderBy: { id: 'asc' as const } } }

async function getAdminStoreId(): Promise<string> {
  const store =
    (await prismaAdmin.store.findFirst({
      where: { slug: process.env.STORE_SLUG ?? 'default', isActive: true },
      select: { id: true },
    })) ??
    (await prismaAdmin.store.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (!store) {
    throw new Error('No active store found')
  }

  return store.id
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getServices(): Promise<ServiceData[]> {
  const storeId = await getAdminStoreId()
  const rows = await prismaAdmin.service.findMany({
    where: { storeId },
    include: withRules,
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map(serializeService)
}

export async function createService(raw: ServiceInput): Promise<ServiceData> {
  const data = serviceSchema.parse(raw)
  const storeId = await getAdminStoreId()
  const top = await prismaAdmin.service.findFirst({
    where: { storeId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const service = await prismaAdmin.service.create({
    data: { ...data, storeId, sortOrder: (top?.sortOrder ?? 0) + 1 },
    include: withRules,
  })
  return serializeService(service)
}

export async function updateService(
  id: string,
  raw: ServiceInput,
): Promise<ServiceData> {
  const data = serviceSchema.parse(raw)
  const service = await prismaAdmin.service.update({
    where: { id },
    data,
    include: withRules,
  })
  return serializeService(service)
}

export async function toggleServiceActive(id: string): Promise<ServiceData> {
  const current = await prismaAdmin.service.findUniqueOrThrow({
    where: { id },
    select: { isActive: true },
  })
  const service = await prismaAdmin.service.update({
    where: { id },
    data: { isActive: !current.isActive },
    include: withRules,
  })
  return serializeService(service)
}

export async function reorderServices(ids: string[]): Promise<void> {
  const storeId = await getAdminStoreId()
  await Promise.all(
    ids.map((id, index) =>
      prismaAdmin.service.update({
        where: { id, storeId },
        data: { sortOrder: index },
      }),
    ),
  )
}

export async function createPriceRule(
  raw: PriceRuleInput,
): Promise<PriceRuleData> {
  const data = priceRuleSchema.parse(raw)
  const rule = await prismaAdmin.priceRule.create({ data })
  return serializeRule(rule)
}

export async function deletePriceRule(id: string): Promise<void> {
  await prismaAdmin.priceRule.delete({ where: { id } })
}
