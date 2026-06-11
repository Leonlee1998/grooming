'use server'

import { prismaAdmin } from '@repo/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { LOCKED_FIELDS, type CustomFieldDef } from './constants'

export type { CustomFieldDef } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffData = {
  id: string
  name: string
  role: 'GROOMER' | 'MANAGER' | 'ADMIN'
  phone: string | null
  isActive: boolean
  surcharge: number
}

export type StaffInput = {
  name: string
  role: 'GROOMER' | 'MANAGER' | 'ADMIN'
  phone?: string | null
  isActive: boolean
  surcharge: number
}

// ─── Settings key whitelist ──────────────────────────────────────────────────

const ALLOWED_KEYS = new Set([
  'store.name',
  'store.address',
  'store.phone',
  'store.email',
  'store.owner',
  'store.slug',
  'overtime.rate',
  'overtime.grace',
  'notification.pickup.minutes',
  'notification.line.enabled',
  'line.oaName',
  'line.oaId',
  'online.booking.enabled',
])

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

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prismaAdmin.setting.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function updateSettings(
  data: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(data).filter(([k]) => ALLOWED_KEYS.has(k))

  await Promise.all(
    entries.map(([key, value]) =>
      prismaAdmin.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  )

  revalidatePath('/settings')
}

// ─── Contract Custom Fields ────────────────────────────────────────────────────

const customFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, '只能以小寫英文開頭，含數字和底線'),
  label: z.string().min(1, '欄位名稱必填'),
  type: z.enum(['text', 'textarea', 'number', 'date', 'checkbox']),
  required: z.boolean(),
  locked: z.boolean().optional(),
  sortOrder: z.number().int(),
})

export async function getContractCustomFields(): Promise<CustomFieldDef[]> {
  const setting = await prismaAdmin.setting.findUnique({
    where: { key: 'contract.customFields' },
  })

  if (!setting) return [...LOCKED_FIELDS]

  let userFields: CustomFieldDef[] = []
  try {
    userFields = JSON.parse(setting.value) as CustomFieldDef[]
  } catch {
    // ignore invalid JSON
  }

  return [...LOCKED_FIELDS, ...userFields]
}

export async function updateContractCustomFields(
  fields: CustomFieldDef[],
): Promise<void> {
  const lockedKeys = new Set(LOCKED_FIELDS.map((f) => f.key))
  const userFields = fields.filter((f) => !lockedKeys.has(f.key))
  const parsed = z.array(customFieldSchema).parse(userFields)

  await prismaAdmin.setting.upsert({
    where: { key: 'contract.customFields' },
    create: { key: 'contract.customFields', value: JSON.stringify(parsed) },
    update: { value: JSON.stringify(parsed) },
  })

  revalidatePath('/settings')
}

// ─── Staff ─────────────────────────────────────────────────────────────────────

const staffSchema = z.object({
  name: z.string().min(1, '姓名必填'),
  role: z.enum(['GROOMER', 'MANAGER', 'ADMIN']),
  phone: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  surcharge: z.number().int().min(0).default(0),
})

export async function getStaff(): Promise<StaffData[]> {
  const storeId = await getAdminStoreId()
  const rows = await prismaAdmin.staff.findMany({
    where: { storeId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as StaffData['role'],
    phone: r.phone,
    isActive: r.isActive,
    surcharge: r.surcharge,
  }))
}

export async function upsertStaff(
  id: string | null,
  raw: StaffInput,
): Promise<StaffData> {
  const data = staffSchema.parse(raw)
  const storeId = await getAdminStoreId()

  const row = id
    ? await prismaAdmin.staff.update({ where: { id, storeId }, data })
    : await prismaAdmin.staff.create({ data: { ...data, storeId } })

  revalidatePath('/settings')

  return {
    id: row.id,
    name: row.name,
    role: row.role as StaffData['role'],
    phone: row.phone,
    isActive: row.isActive,
    surcharge: row.surcharge,
  }
}

export async function toggleStaffActive(id: string): Promise<void> {
  z.string().min(1).parse(id)
  const storeId = await getAdminStoreId()

  const current = await prismaAdmin.staff.findUniqueOrThrow({
    where: { id, storeId },
    select: { isActive: true },
  })
  await prismaAdmin.staff.update({
    where: { id, storeId },
    data: { isActive: !current.isActive },
  })

  revalidatePath('/settings')
}
