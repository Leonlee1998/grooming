'use server'

import { revalidatePath } from 'next/cache'
import { prismaAdmin } from '@repo/db'
import {
  generatePriceRuleName,
  priceRuleSchema,
  serviceSchema,
  type PriceRuleFormInput,
  type ServiceFormInput,
} from './schemas'
import type { PriceRule, Service } from './types'

function serializePriceRule(rule: {
  id: string
  serviceId: string
  name: string
  weightMin: unknown
  weightMax: unknown
  breed: string | null
  priceAdjustment: number
  adjustmentType: string
  isActive: boolean
}): PriceRule {
  return {
    id: rule.id,
    serviceId: rule.serviceId,
    name: rule.name,
    weightMin: rule.weightMin === null ? null : String(rule.weightMin),
    weightMax: rule.weightMax === null ? null : String(rule.weightMax),
    breed: rule.breed,
    priceAdjustment: rule.priceAdjustment,
    adjustmentType: rule.adjustmentType as PriceRule['adjustmentType'],
    isActive: rule.isActive,
  }
}

function serializeService(service: {
  id: string
  name: string
  category: string
  description: string | null
  basePrice: number
  estimatedMinutes: number
  sortOrder: number
  isActive: boolean
  priceRules: Parameters<typeof serializePriceRule>[0][]
}): Service {
  return {
    id: service.id,
    name: service.name,
    category: service.category as Service['category'],
    description: service.description,
    basePrice: service.basePrice,
    estimatedMinutes: service.estimatedMinutes,
    sortOrder: service.sortOrder,
    isActive: service.isActive,
    priceRules: service.priceRules.map(serializePriceRule),
  }
}

const serviceSelect = {
  id: true,
  name: true,
  category: true,
  description: true,
  basePrice: true,
  estimatedMinutes: true,
  sortOrder: true,
  isActive: true,
  priceRules: {
    orderBy: { name: 'asc' },
    select: {
      id: true,
      serviceId: true,
      name: true,
      weightMin: true,
      weightMax: true,
      breed: true,
      priceAdjustment: true,
      adjustmentType: true,
      isActive: true,
    },
  },
} as const

export async function getServices(): Promise<Service[]> {
  const services = await prismaAdmin.service.findMany({
    select: serviceSelect,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return services.map(serializeService)
}

export async function createService(data: ServiceFormInput): Promise<Service> {
  const parsed = serviceSchema.parse(data)
  const service = await prismaAdmin.service.create({
    data: {
      ...parsed,
      description: parsed.description || null,
    },
    select: serviceSelect,
  })

  revalidatePath('/admin/services')
  return serializeService(service)
}

export async function updateService(
  id: string,
  data: ServiceFormInput,
): Promise<Service> {
  const parsed = serviceSchema.parse(data)
  const service = await prismaAdmin.service.update({
    where: { id },
    data: {
      ...parsed,
      description: parsed.description || null,
    },
    select: serviceSelect,
  })

  revalidatePath('/admin/services')
  return serializeService(service)
}

export async function toggleServiceActive(id: string): Promise<Service> {
  const current = await prismaAdmin.service.findUnique({
    where: { id },
    select: { isActive: true },
  })
  if (!current) throw new Error('找不到服務項目')

  const service = await prismaAdmin.service.update({
    where: { id },
    data: { isActive: !current.isActive },
    select: serviceSelect,
  })

  revalidatePath('/admin/services')
  return serializeService(service)
}

export async function reorderServices(ids: string[]): Promise<void> {
  await prismaAdmin.$transaction(
    ids.map((id, index) =>
      prismaAdmin.service.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  )

  revalidatePath('/admin/services')
}

export async function createPriceRule(
  data: PriceRuleFormInput,
): Promise<PriceRule> {
  const parsed = priceRuleSchema.parse(data)
  const rule = await prismaAdmin.priceRule.create({
    data: {
      serviceId: parsed.serviceId,
      name: generatePriceRuleName(parsed),
      weightMin: parsed.weightMin ? Number(parsed.weightMin) : null,
      weightMax: parsed.weightMax ? Number(parsed.weightMax) : null,
      breed: parsed.breed || null,
      priceAdjustment: parsed.priceAdjustment,
      adjustmentType: parsed.adjustmentType,
      isActive: parsed.isActive,
    },
    select: {
      id: true,
      serviceId: true,
      name: true,
      weightMin: true,
      weightMax: true,
      breed: true,
      priceAdjustment: true,
      adjustmentType: true,
      isActive: true,
    },
  })

  revalidatePath('/admin/services')
  return serializePriceRule(rule)
}

export async function deletePriceRule(id: string): Promise<void> {
  await prismaAdmin.priceRule.delete({ where: { id } })
  revalidatePath('/admin/services')
}
