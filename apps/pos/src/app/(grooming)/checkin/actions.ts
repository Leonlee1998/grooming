'use server'

import { prismaAdmin } from '@repo/db'
import { fillTemplate, generatePdf, uploadContractPdf } from '@repo/contract'
import type { ContractData } from '@repo/contract'
import { z } from 'zod'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type OrderItemInput = {
  serviceId: string
  quantity: number
}

export type PriceAdjustmentDetail = {
  ruleId: string
  ruleName: string
  amount: number
}

export type PriceCalculationItem = {
  serviceId: string
  serviceName: string
  category: string
  basePrice: number
  unitPrice: number
  quantity: number
  amount: number
  estimatedMinutes: number
  priceAdjustments: PriceAdjustmentDetail[]
}

export type PriceCalculation = {
  items: PriceCalculationItem[]
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  staffSurcharge: number
  estimatedMinutes: number
  memberDiscountRate: number
  memberName: string | null
  error?: string
}

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
      lastGroomedAt: string | null
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
        orders: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return {
      ok: true,
      data: pets.map((p) => {
        const { orders, ...rest } = p
        return {
          ...rest,
          weightKg: p.weightKg?.toString() ?? null,
          birthDate: p.birthDate?.toISOString().split('T')[0] ?? null,
          lastGroomedAt: orders[0]?.createdAt.toISOString() ?? null,
        }
      }),
    }
  } catch {
    return { ok: false, error: '讀取寵物資料失敗' }
  }
}

const updateHealthSchema = z.object({
  petId: z.string(),
  isAggressive: z.boolean(),
  hasDisease: z.boolean(),
  diseaseNotes: z.string().optional(),
  isVaccinated: z.boolean(),
  isDewormed: z.boolean(),
  preferredVetName: z.string().optional(),
  preferredVetPhone: z.string().optional(),
})

export async function updatePetHealthInfo(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateHealthSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { petId, ...data } = parsed.data
  try {
    const pet = await prismaAdmin.pet.update({
      where: { id: petId },
      data: {
        isAggressive: data.isAggressive,
        hasDisease: data.hasDisease,
        diseaseNotes: data.hasDisease ? (data.diseaseNotes ?? null) : null,
        isVaccinated: data.isVaccinated,
        isDewormed: data.isDewormed,
        preferredVetName: data.preferredVetName || null,
        preferredVetPhone: data.preferredVetPhone || null,
      },
      select: { id: true },
    })
    return { ok: true, data: pet }
  } catch {
    return { ok: false, error: '更新健康資訊失敗' }
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
  preferredVetName: z.string().optional(),
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
  Array<{
    id: string
    name: string
    category: string
    basePrice: number
    estimatedMinutes: number
  }>
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
    return services
  } catch (e) {
    console.error(e)
    return []
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

const orderItemInputSchema = z.array(
  z.object({
    serviceId: z.string().min(1),
    quantity: z.number().int().positive().max(20),
  }),
)

const emptyPriceCalculation = (error?: string): PriceCalculation => ({
  items: [],
  subtotalAmount: 0,
  discountAmount: 0,
  totalAmount: 0,
  staffSurcharge: 0,
  estimatedMinutes: 0,
  memberDiscountRate: 0,
  memberName: null,
  ...(error ? { error } : {}),
})

type CalculatePriceInput = {
  items: Array<{
    serviceId: string
    serviceName: string
    category: string
    basePrice: number
    estimatedMinutes: number
    quantity: number
    priceRules: Array<{
      id: string
      name: string
      weightMin: unknown
      weightMax: unknown
      breed: string | null
      priceAdjustment: number
      adjustmentType: string
    }>
  }>
  pet: {
    weightKg: unknown
    breed: string | null
  }
  staffSurcharge: number
  member: {
    plan: {
      name: string
      discountRate: unknown
    }
  } | null
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function ruleMatchesPet(
  rule: CalculatePriceInput['items'][number]['priceRules'][number],
  pet: CalculatePriceInput['pet'],
) {
  const weight = decimalToNumber(pet.weightKg)
  const weightMin = decimalToNumber(rule.weightMin)
  const weightMax = decimalToNumber(rule.weightMax)
  const petBreed = (pet.breed ?? '').trim().toLowerCase()
  const ruleBreed = (rule.breed ?? '').trim().toLowerCase()

  if (weightMin !== null && (weight === null || weight < weightMin))
    return false
  if (weightMax !== null && (weight === null || weight > weightMax))
    return false
  if (ruleBreed && petBreed !== ruleBreed) return false

  return true
}

function calculatePrice(input: CalculatePriceInput): PriceCalculation {
  const calculatedItems = input.items.map((item) => {
    let unitPrice = item.basePrice
    const priceAdjustments: PriceAdjustmentDetail[] = []

    item.priceRules.forEach((rule) => {
      if (!ruleMatchesPet(rule, input.pet)) return

      const amount =
        rule.adjustmentType === 'PERCENTAGE'
          ? Math.round((unitPrice * rule.priceAdjustment) / 100)
          : rule.priceAdjustment

      unitPrice += amount
      priceAdjustments.push({
        ruleId: rule.id,
        ruleName: rule.name,
        amount,
      })
    })

    return {
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      category: item.category,
      basePrice: item.basePrice,
      unitPrice,
      quantity: item.quantity,
      amount: unitPrice * item.quantity,
      estimatedMinutes: item.estimatedMinutes * item.quantity,
      priceAdjustments,
    }
  })

  const serviceSubtotal = calculatedItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  )
  const subtotalAmount = serviceSubtotal + input.staffSurcharge
  const memberDiscountRate =
    decimalToNumber(input.member?.plan.discountRate) ?? 0
  const discountAmount = Math.round(subtotalAmount * memberDiscountRate)
  const totalAmount = Math.max(0, subtotalAmount - discountAmount)
  const estimatedMinutes = calculatedItems.reduce(
    (sum, item) => sum + item.estimatedMinutes,
    0,
  )

  return {
    items: calculatedItems,
    subtotalAmount,
    discountAmount,
    totalAmount,
    staffSurcharge: input.staffSurcharge,
    estimatedMinutes,
    memberDiscountRate,
    memberName: input.member?.plan.name ?? null,
  }
}

export async function calculateOrderPrice(
  items: OrderItemInput[],
  petId: string,
  staffId?: string,
  memberId?: string,
): Promise<PriceCalculation> {
  const parsed = orderItemInputSchema.safeParse(items)
  if (!parsed.success) return emptyPriceCalculation('服務數量格式不正確')
  if (!petId) return emptyPriceCalculation('缺少寵物 ID')
  if (parsed.data.length === 0) return emptyPriceCalculation()

  try {
    const quantityByServiceId = new Map(
      parsed.data.map((item) => [item.serviceId, item.quantity]),
    )

    const [services, pet, staff, explicitMember] = await Promise.all([
      prismaAdmin.service.findMany({
        where: {
          id: { in: parsed.data.map((item) => item.serviceId) },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          category: true,
          basePrice: true,
          estimatedMinutes: true,
          priceRules: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              weightMin: true,
              weightMax: true,
              breed: true,
              priceAdjustment: true,
              adjustmentType: true,
            },
          },
        },
      }),
      prismaAdmin.pet.findUnique({
        where: { id: petId },
        select: {
          weightKg: true,
          breed: true,
          customer: {
            select: {
              member: {
                select: {
                  expiresAt: true,
                  plan: {
                    select: {
                      name: true,
                      discountRate: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      staffId
        ? prismaAdmin.staff.findFirst({
            where: { id: staffId, isActive: true },
            select: { surcharge: true },
          })
        : Promise.resolve(null),
      memberId
        ? prismaAdmin.member.findUnique({
            where: { id: memberId },
            select: {
              expiresAt: true,
              plan: {
                select: {
                  name: true,
                  discountRate: true,
                  isActive: true,
                },
              },
            },
          })
        : Promise.resolve(null),
    ])

    if (!pet) return emptyPriceCalculation('找不到寵物資料')

    const now = new Date()
    const member = explicitMember ?? pet.customer.member
    const activeMember =
      member &&
      member.plan.isActive &&
      (!member.expiresAt || member.expiresAt > now)
        ? member
        : null

    const serviceItems = services.map((service) => ({
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      basePrice: service.basePrice,
      estimatedMinutes: service.estimatedMinutes,
      quantity: quantityByServiceId.get(service.id) ?? 1,
      priceRules: service.priceRules,
    }))

    return calculatePrice({
      items: serviceItems,
      pet,
      staffSurcharge: staff?.surcharge ?? 0,
      member: activeMember,
    })
  } catch (e) {
    console.error(e)
    return emptyPriceCalculation('試算金額失敗，請稍後再試')
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
  notes: z.string().optional(),
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

export async function cancelDraftOrder(
  orderId: string | null,
): Promise<ActionResult<{ cancelled: boolean }>> {
  if (!orderId) return { ok: true, data: { cancelled: false } }

  try {
    const result = await prismaAdmin.order.updateMany({
      where: { id: orderId, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    })
    return { ok: true, data: { cancelled: result.count > 0 } }
  } catch (e) {
    console.error(e)
    return { ok: false, error: '取消草稿訂單失敗' }
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
