'use server'

import { prismaAdmin } from '@repo/db'
import { fillTemplate, generatePdf, uploadContractPdf } from '@repo/contract'
import type { ContractData } from '@repo/contract'
import { z } from 'zod'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── Step 1: Customer ─────────────────────────────────────────────────────

export async function searchCustomerByPhone(phone: string): Promise<
  ActionResult<{
    id: string
    name: string
    phone: string
    email: string | null
    emergencyContact: string | null
    emergencyPhone: string | null
    petCount: number
  } | null>
> {
  const cleaned = phone.trim().replace(/\s/g, '')
  if (cleaned.length < 8) return { ok: false, error: '電話格式不正確' }
  try {
    const customer = await prismaAdmin.customer.findUnique({
      where: { phone: cleaned },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        emergencyContact: true,
        emergencyPhone: true,
        _count: { select: { pets: true } },
      },
    })
    if (!customer) return { ok: true, data: null }
    const { _count, ...rest } = customer
    return { ok: true, data: { ...rest, petCount: _count.pets } }
  } catch {
    return { ok: false, error: '查詢客戶失敗，請稍後再試' }
  }
}

const upsertCustomerSchema = z.object({
  phone: z.string().min(8).max(15),
  name: z.string().min(1, '姓名必填'),
  email: z.string().email('Email 格式錯誤').optional().or(z.literal('')),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

export async function upsertCustomer(raw: unknown): Promise<
  ActionResult<{
    id: string
    name: string
    phone: string
    email: string | null
    emergencyContact: string | null
    emergencyPhone: string | null
  }>
> {
  const parsed = upsertCustomerSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { phone, name, email, emergencyContact, emergencyPhone } = parsed.data
  try {
    const customer = await prismaAdmin.customer.upsert({
      where: { phone },
      create: {
        phone,
        name,
        email: email || null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
      },
      update: {
        name,
        email: email || null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        emergencyContact: true,
        emergencyPhone: true,
      },
    })
    return { ok: true, data: customer }
  } catch {
    return { ok: false, error: '儲存客戶資料失敗' }
  }
}

// ─── Step 2: Pets ─────────────────────────────────────────────────────────

export async function getPetsByCustomer(customerId: string): Promise<
  ActionResult<
    Array<{
      id: string
      name: string
      species: string
      breed: string | null
      weightKg: string | null
      gender: string
      birthDate: string | null
      isAggressive: boolean
      hasDisease: boolean
      diseaseNotes: string | null
      isVaccinated: boolean
      isDewormed: boolean
      preferredVetName: string | null
      preferredVetPhone: string | null
    }>
  >
> {
  if (!customerId) return { ok: false, error: '缺少客戶 ID' }
  try {
    const pets = await prismaAdmin.pet.findMany({
      where: { customerId },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        weightKg: true,
        gender: true,
        birthDate: true,
        isAggressive: true,
        hasDisease: true,
        diseaseNotes: true,
        isVaccinated: true,
        isDewormed: true,
        preferredVetName: true,
        preferredVetPhone: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return {
      ok: true,
      data: pets.map((p) => ({
        ...p,
        weightKg: p.weightKg?.toString() ?? null,
        birthDate: p.birthDate?.toISOString().split('T')[0] ?? null,
      })),
    }
  } catch {
    return { ok: false, error: '讀取寵物資料失敗' }
  }
}

const createPetSchema = z.object({
  customerId: z.string(),
  name: z.string().min(1, '寵物名稱必填'),
  species: z.enum(['DOG', 'CAT']),
  breed: z.string().optional(),
  weightKg: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']),
  birthDate: z.string().optional(),
  isAggressive: z.boolean(),
  hasDisease: z.boolean(),
  diseaseNotes: z.string().optional(),
  isVaccinated: z.boolean(),
  isDewormed: z.boolean(),
  preferredVetName: z.string().min(1, '指定獸醫院必填（法規 §4）'),
  preferredVetPhone: z.string().optional(),
})

export async function createPet(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = createPetSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { weightKg, birthDate, ...data } = parsed.data
  try {
    const pet = await prismaAdmin.pet.create({
      data: {
        ...data,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
      },
      select: { id: true, name: true },
    })
    return { ok: true, data: pet }
  } catch {
    return { ok: false, error: '建立寵物資料失敗' }
  }
}

// ─── Step 3: Services + Staff ─────────────────────────────────────────────

export async function getActiveServices(): Promise<
  ActionResult<
    Array<{
      id: string
      name: string
      category: string
      basePrice: number
      estimatedMinutes: number
    }>
  >
> {
  try {
    const services = await prismaAdmin.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        estimatedMinutes: true,
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    return { ok: true, data: services }
  } catch {
    return { ok: false, error: '讀取服務項目失敗' }
  }
}

export async function getActiveStaff(): Promise<
  ActionResult<Array<{ id: string; name: string; surcharge: number }>>
> {
  try {
    const staff = await prismaAdmin.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, surcharge: true },
      orderBy: { name: 'asc' },
    })
    return { ok: true, data: staff }
  } catch {
    return { ok: false, error: '讀取美容師清單失敗' }
  }
}

// ─── Step 4: Create Draft Order ───────────────────────────────────────────

const createOrderSchema = z.object({
  customerId: z.string(),
  petId: z.string(),
  staffId: z.string().optional(),
  items: z.array(
    z.object({
      serviceId: z.string(),
      serviceName: z.string(),
      unitPrice: z.number().int().nonnegative(),
      quantity: z.number().int().positive().default(1),
    }),
  ),
  subtotalAmount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  scheduledAt: z.string(),
  estimatedDuration: z.number().int().positive(),
  pickupDeadlineAt: z.string(),
})

export async function createDraftOrder(
  raw: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = createOrderSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { items, ...rest } = parsed.data
  try {
    const order = await prismaAdmin.order.create({
      data: {
        ...rest,
        overtimeFee: 0,
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            amount: item.unitPrice * item.quantity,
          })),
        },
      },
      select: { id: true },
    })
    return { ok: true, data: { orderId: order.id } }
  } catch (e) {
    console.error(e)
    return { ok: false, error: '建立訂單失敗' }
  }
}

// ─── Step 5: Sign + Finalize ──────────────────────────────────────────────

const signSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  petId: z.string(),
  contractData: z.record(z.unknown()),
  signatureDataUrl: z.string().startsWith('data:image/'),
})

export async function signAndFinalize(
  raw: unknown,
): Promise<ActionResult<{ contractId: string; pdfUrl: string }>> {
  const parsed = signSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { orderId, customerId, petId, contractData, signatureDataUrl } =
    parsed.data

  try {
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { id: true, htmlContent: true },
      orderBy: { version: 'desc' },
    })
    if (!template)
      return { ok: false, error: '找不到契約模板，請先執行 db:seed' }

    const filledData = { ...contractData, signatureDataUrl } as ContractData
    const filledHtml = fillTemplate(template.htmlContent, filledData)
    const pdfBuffer = await generatePdf(filledHtml)
    const pdfUrl = await uploadContractPdf(pdfBuffer, orderId)

    const now = new Date()
    const contract = await prismaAdmin.contract.create({
      data: {
        orderId,
        templateId: template.id,
        customerId,
        petId,
        filledData: filledData as object,
        signatureDataUrl,
        signedAt: now,
        pdfUrl,
        pdfGeneratedAt: now,
      },
      select: { id: true },
    })

    await prismaAdmin.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    })

    return { ok: true, data: { contractId: contract.id, pdfUrl } }
  } catch (e) {
    console.error(e)
    return { ok: false, error: '簽約失敗，請稍後再試' }
  }
}
