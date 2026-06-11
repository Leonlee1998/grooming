'use server'

import { prismaAdmin, calculatePrice } from '@repo/db'
import type { PriceRuleData } from '@repo/db'
import { z } from 'zod'
import { getStoreId, getStoreIdFromCustomer } from '../../../lib/store'

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
  memberId: string | null
  memberBalance: number | null
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
    const customer = await prismaAdmin.customer.findFirst({
      where: { phone: cleaned, storeId: getStoreId() },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        emergencyContact: true,
        emergencyPhone: true,
        pets: { select: { id: true } },
      },
    })
    if (!customer) return { ok: true, data: null }
    const { pets, ...rest } = customer
    return { ok: true, data: { ...rest, petCount: pets.length } }
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
    const storeId = getStoreId()
    const customer = await prismaAdmin.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      create: {
        storeId,
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
    const storeId = await getStoreIdFromCustomer(data.customerId)
    const pet = await prismaAdmin.pet.create({
      data: {
        ...data,
        storeId,
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
  memberId: null,
  memberBalance: null,
  ...(error ? { error } : {}),
})

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
                  id: true,
                  balance: true,
                  expiresAt: true,
                  plan: {
                    select: { name: true, discountRate: true, isActive: true },
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
              id: true,
              balance: true,
              expiresAt: true,
              plan: {
                select: { name: true, discountRate: true, isActive: true },
              },
            },
          })
        : Promise.resolve(null),
    ])

    if (!pet) return emptyPriceCalculation('找不到寵物資料')

    const now = new Date()
    const rawMember = explicitMember ?? pet.customer.member
    const activeMember =
      rawMember &&
      rawMember.plan.isActive &&
      (!rawMember.expiresAt || rawMember.expiresAt > now)
        ? rawMember
        : null

    const staffSurcharge = staff?.surcharge ?? 0
    const petWeightKg = decimalToNumber(pet.weightKg) ?? undefined
    const memberDiscountRate =
      decimalToNumber(activeMember?.plan.discountRate) ?? 0

    // Map Prisma Decimal → number for PriceRuleData
    const serviceInputs = services.map((service) => ({
      serviceId: service.id,
      serviceName: service.name,
      basePrice: service.basePrice,
      quantity: quantityByServiceId.get(service.id) ?? 1,
      priceRules: service.priceRules.map(
        (rule): PriceRuleData => ({
          id: rule.id,
          name: rule.name,
          weightMin: decimalToNumber(rule.weightMin),
          weightMax: decimalToNumber(rule.weightMax),
          breed: rule.breed,
          priceAdjustment: rule.priceAdjustment,
          adjustmentType: rule.adjustmentType as 'FIXED' | 'PERCENTAGE',
        }),
      ),
    }))

    const result = calculatePrice({
      services: serviceInputs,
      petWeightKg,
      petBreed: pet.breed ?? undefined,
      staffSurcharge,
      memberDiscountRate:
        memberDiscountRate > 0 ? memberDiscountRate : undefined,
    })

    // category / estimatedMinutes are not in PriceResult — build from DB data
    const serviceMeta = new Map(
      services.map((s) => [
        s.id,
        { category: s.category, estimatedMinutes: s.estimatedMinutes },
      ]),
    )

    const calculatedItems: PriceCalculationItem[] = result.items.map((item) => {
      const meta = serviceMeta.get(item.serviceId)
      return {
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        category: meta?.category ?? '',
        basePrice: item.basePrice,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.amount,
        estimatedMinutes: (meta?.estimatedMinutes ?? 0) * item.quantity,
        priceAdjustments: item.appliedRules.map((rule) => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          amount: rule.adjustment,
        })),
      }
    })

    const estimatedMinutes = calculatedItems.reduce(
      (sum, item) => sum + item.estimatedMinutes,
      0,
    )

    return {
      items: calculatedItems,
      subtotalAmount: result.subtotal + result.staffSurcharge,
      discountAmount: result.discountAmount,
      totalAmount: result.total,
      staffSurcharge: result.staffSurcharge,
      estimatedMinutes,
      memberDiscountRate,
      memberName: activeMember?.plan.name ?? null,
      memberId: activeMember?.id ?? null,
      memberBalance: activeMember?.balance ?? null,
    }
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
    const storeId = await getStoreIdFromCustomer(rest.customerId)
    const order = await prismaAdmin.order.create({
      data: {
        ...rest,
        storeId,
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

// ─── Online Contract Detection ───────────────────────────────────────────────
// 查找這位客戶/寵物最近的 PENDING/CONFIRMED 預約，若有線上簽約紀錄則回傳相關資訊

export async function getOnlineContractForPet(
  customerId: string,
  petId: string,
): Promise<
  ActionResult<{
    appointmentId: string
    onlineContractId: string
    originalServiceIds: string[]
    originalDraftOrderId: string | null
  } | null>
> {
  if (!customerId || !petId) return { ok: true, data: null }
  try {
    const appointment = await prismaAdmin.appointment.findFirst({
      where: {
        customerId,
        petId,
        signedOnline: true,
        onlineContractId: { not: null },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        onlineContractId: true,
        order: {
          select: {
            id: true,
            status: true,
            items: { select: { serviceId: true } },
          },
        },
      },
    })

    if (!appointment || !appointment.onlineContractId) {
      return { ok: true, data: null }
    }

    const draftOrder =
      appointment.order?.status === 'DRAFT' ? appointment.order : null

    return {
      ok: true,
      data: {
        appointmentId: appointment.id,
        onlineContractId: appointment.onlineContractId,
        originalServiceIds: draftOrder?.items.map((i) => i.serviceId) ?? [],
        originalDraftOrderId: draftOrder?.id ?? null,
      },
    }
  } catch (e) {
    console.error('getOnlineContractForPet failed:', e)
    return { ok: false, error: '查詢線上預約資料失敗' }
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

// ─── 今日線上已簽約預約偵測（報到頁用）──────────────────────────────────────

export type OnlineAppointmentInfo = {
  id: string
  scheduledAt: string
  petId: string
  petName: string
  petSpecies: string
  staffName: string | null
  serviceNames: string[]
}

export async function checkOnlineBooking(
  customerId: string,
): Promise<ActionResult<{ appointments: OnlineAppointmentInfo[] }>> {
  if (!customerId) return { ok: false, error: '缺少客戶 ID' }
  try {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
    }).format(new Date())
    const gte = new Date(`${todayStr}T00:00:00+08:00`)
    const lt = new Date(gte.getTime() + 86_400_000)

    const appts = await prismaAdmin.appointment.findMany({
      where: {
        customerId,
        signedOnline: true,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte, lt },
      },
      select: {
        id: true,
        scheduledAt: true,
        pet: { select: { id: true, name: true, species: true } },
        staff: { select: { name: true } },
        order: {
          select: {
            items: { select: { serviceName: true }, orderBy: { id: 'asc' } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return {
      ok: true,
      data: {
        appointments: appts.map((a) => ({
          id: a.id,
          scheduledAt: a.scheduledAt.toISOString(),
          petId: a.pet.id,
          petName: a.pet.name,
          petSpecies: a.pet.species,
          staffName: a.staff?.name ?? null,
          serviceNames: a.order?.items.map((i) => i.serviceName) ?? [],
        })),
      },
    }
  } catch (e) {
    console.error('checkOnlineBooking error:', e)
    return { ok: false, error: '查詢線上預約失敗' }
  }
}

// 確認到店（採用線上合約，不補簽）
export async function confirmOnlineBookingWalkIn(
  appointmentId: string,
  customerId: string,
): Promise<
  ActionResult<{
    orderId: string
    petName: string
    petId: string
    totalAmount: number
    pickupDeadlineAt: string | null
    earnedPoints: number | null
  }>
> {
  if (!appointmentId || !customerId) return { ok: false, error: '缺少必要參數' }

  try {
    const appt = await prismaAdmin.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        pickupDeadlineAt: true,
        pet: { select: { id: true, name: true } },
        order: {
          select: { id: true, status: true, totalAmount: true },
        },
      },
    })

    if (!appt) return { ok: false, error: '找不到預約紀錄' }
    if (!appt.order) {
      return {
        ok: false,
        error: '此預約尚未關聯訂單，請透過正常報到流程建立服務訂單',
      }
    }

    const now = new Date()
    let earnedPoints: number | null = null

    await prismaAdmin.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'IN_PROGRESS', actualStartAt: now },
      })

      if (appt.order!.status === 'DRAFT') {
        await tx.order.update({
          where: { id: appt.order!.id },
          data: { status: 'CONFIRMED' },
        })
      }

      const member = await tx.member.findUnique({
        where: { customerId },
        select: {
          id: true,
          expiresAt: true,
          plan: { select: { pointRate: true, isActive: true } },
        },
      })

      if (
        member &&
        member.plan.isActive &&
        (!member.expiresAt || member.expiresAt > now) &&
        appt.order!.totalAmount > 0
      ) {
        const earned = Math.floor(
          appt.order!.totalAmount * Number(member.plan.pointRate),
        )
        if (earned > 0) {
          await tx.pointTransaction.create({
            data: {
              memberId: member.id,
              orderId: appt.order!.id,
              amount: earned,
              type: 'EARN',
              note: '到店確認獲得點數',
            },
          })
          await tx.member.update({
            where: { id: member.id },
            data: { points: { increment: earned } },
          })
          earnedPoints = earned
        }
      }

      await tx.orderAuditLog.create({
        data: {
          orderId: appt.order!.id,
          action: 'UPDATED',
          newValue: JSON.stringify({ status: 'CONFIRMED' }),
          note: '客戶到店確認（採用線上合約）',
        },
      })
    })

    return {
      ok: true,
      data: {
        orderId: appt.order.id,
        petName: appt.pet.name,
        petId: appt.pet.id,
        totalAmount: appt.order.totalAmount,
        pickupDeadlineAt: appt.pickupDeadlineAt?.toISOString() ?? null,
        earnedPoints,
      },
    }
  } catch (e) {
    console.error('confirmOnlineBookingWalkIn error:', e)
    return { ok: false, error: '確認到店失敗，請稍後再試' }
  }
}
