'use server'

import { z } from 'zod'
import { prismaAdmin } from '@repo/db'
import { sendPickupReady, sendOvertimeNotice } from '@repo/line-bot'
import { getStoreId } from '@/lib/store'

// ─── Types ────────────────────────────────────────────────────────────────

export type DisplayStatus =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'AWAITING_PICKUP'
  | 'OVERTIME'
  | 'COMPLETED'
  | 'CANCELLED'

export interface ServiceCard {
  appointmentId: string
  orderId: string | null
  customerName: string
  customerPhone: string
  lineUserId: string | null
  petName: string
  petSpecies: 'DOG' | 'CAT'
  petBreed: string
  petWeightKg: string
  petIsAggressive: boolean
  services: string[]
  staffName: string | null
  scheduledAt: string
  pickupDeadlineAt: string | null
  actualStartAt: string | null
  actualEndAt: string | null
  pickupNotifiedAt: string | null
  overtimeFee: number
  displayStatus: DisplayStatus
  minutesToOvertime: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function computeDisplayStatus(
  status: string,
  pickedUpAt: Date | null,
  pickupDeadlineAt: Date | null,
  now: Date,
): { displayStatus: DisplayStatus; minutesToOvertime: number | null } {
  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    return { displayStatus: 'CANCELLED', minutesToOvertime: null }
  }
  if (status === 'IN_PROGRESS') {
    return { displayStatus: 'IN_PROGRESS', minutesToOvertime: null }
  }
  if (status === 'COMPLETED' && pickedUpAt) {
    return { displayStatus: 'COMPLETED', minutesToOvertime: null }
  }
  if (status === 'COMPLETED' && !pickedUpAt) {
    const minutesToOvertime = pickupDeadlineAt
      ? Math.floor((pickupDeadlineAt.getTime() - now.getTime()) / 60000)
      : null
    if (minutesToOvertime !== null && minutesToOvertime < 0) {
      return { displayStatus: 'OVERTIME', minutesToOvertime }
    }
    return { displayStatus: 'AWAITING_PICKUP', minutesToOvertime }
  }
  return { displayStatus: 'WAITING', minutesToOvertime: null }
}

const STATUS_SORT: Record<DisplayStatus, number> = {
  OVERTIME: 0,
  AWAITING_PICKUP: 1,
  IN_PROGRESS: 2,
  WAITING: 3,
  COMPLETED: 4,
  CANCELLED: 5,
}

// ─── getServiceBoard ───────────────────────────────────────────────────────

export async function getServiceBoard(
  staffId?: string,
  date?: string,
): Promise<ServiceCard[]> {
  const storeId = getStoreId()
  const now = new Date()

  // Compute day range in Asia/Taipei (UTC+8)
  const tzOffsetMs = 8 * 60 * 60 * 1000
  const baseTime = date ? new Date(date) : now
  const dayStart = new Date(
    Math.floor((baseTime.getTime() + tzOffsetMs) / 86400000) * 86400000 -
      tzOffsetMs,
  )
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  const appointments = await prismaAdmin.appointment.findMany({
    where: {
      storeId,
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(staffId ? { staffId } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      estimatedDuration: true,
      actualStartAt: true,
      actualEndAt: true,
      pickupDeadlineAt: true,
      pickedUpAt: true,
      pickupNotifiedAt: true,
      customer: { select: { name: true, phone: true, lineUserId: true } },
      pet: {
        select: {
          name: true,
          species: true,
          breed: true,
          weightKg: true,
          isAggressive: true,
        },
      },
      staff: { select: { name: true } },
      order: {
        select: {
          id: true,
          overtimeFee: true,
          items: { select: { serviceName: true, quantity: true } },
        },
      },
    },
  })

  const cards: ServiceCard[] = appointments.map((appt) => {
    const { displayStatus, minutesToOvertime } = computeDisplayStatus(
      appt.status,
      appt.pickedUpAt,
      appt.pickupDeadlineAt,
      now,
    )
    const services =
      appt.order?.items.map((item) =>
        item.quantity > 1
          ? `${item.serviceName} ×${item.quantity}`
          : item.serviceName,
      ) ?? []

    return {
      appointmentId: appt.id,
      orderId: appt.order?.id ?? null,
      customerName: appt.customer.name,
      customerPhone: appt.customer.phone,
      lineUserId: appt.customer.lineUserId ?? null,
      petName: appt.pet.name,
      petSpecies: appt.pet.species,
      petBreed: appt.pet.breed ?? '',
      petWeightKg: appt.pet.weightKg ? `${appt.pet.weightKg} kg` : '',
      petIsAggressive: appt.pet.isAggressive,
      services,
      staffName: appt.staff?.name ?? null,
      scheduledAt: appt.scheduledAt.toISOString(),
      pickupDeadlineAt: appt.pickupDeadlineAt?.toISOString() ?? null,
      actualStartAt: appt.actualStartAt?.toISOString() ?? null,
      actualEndAt: appt.actualEndAt?.toISOString() ?? null,
      pickupNotifiedAt: appt.pickupNotifiedAt?.toISOString() ?? null,
      overtimeFee: appt.order?.overtimeFee ?? 0,
      displayStatus,
      minutesToOvertime,
    }
  })

  return cards.sort(
    (a, b) => STATUS_SORT[a.displayStatus] - STATUS_SORT[b.displayStatus],
  )
}

// ─── startService ─────────────────────────────────────────────────────────

export async function startService(
  appointmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!appointmentId) return { ok: false, error: '缺少預約 ID' }
  try {
    await prismaAdmin.appointment.update({
      where: { id: appointmentId },
      data: { actualStartAt: new Date(), status: 'IN_PROGRESS' },
    })
    return { ok: true }
  } catch (e) {
    console.error('startService failed:', e)
    return { ok: false, error: '更新狀態失敗，請稍後再試' }
  }
}

// ─── completeService ──────────────────────────────────────────────────────

export async function completeService(
  appointmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!appointmentId) return { ok: false, error: '缺少預約 ID' }
  try {
    const appt = await prismaAdmin.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        scheduledAt: true,
        estimatedDuration: true,
        pickupDeadlineAt: true,
      },
    })

    const now = new Date()
    const pickupDeadlineAt =
      appt.pickupDeadlineAt ??
      new Date(appt.scheduledAt.getTime() + appt.estimatedDuration * 60000)

    await prismaAdmin.appointment.update({
      where: { id: appointmentId },
      data: { actualEndAt: now, status: 'COMPLETED', pickupDeadlineAt },
    })
    return { ok: true }
  } catch (e) {
    console.error('completeService failed:', e)
    return { ok: false, error: '更新狀態失敗，請稍後再試' }
  }
}

// ─── notifyPickup ─────────────────────────────────────────────────────────

const notifyPickupSchema = z.object({
  appointmentId: z.string().min(1),
  customerName: z.string(),
  petName: z.string(),
  lineUserId: z.string().min(1),
})

export async function notifyPickup(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = notifyPickupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: '資料格式錯誤' }

  const { appointmentId, petName, lineUserId } = parsed.data

  try {
    // Look up store name and order ID for the Flex Message
    const appt = await prismaAdmin.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        store: { select: { name: true } },
        order: { select: { id: true } },
      },
    })

    const storeName = appt.store.name
    const customerAppUrl = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL ?? ''
    const orderUrl = appt.order?.id
      ? `${customerAppUrl}/orders/${appt.order.id}`
      : customerAppUrl

    await sendPickupReady(lineUserId, { petName, storeName, orderUrl })

    await prismaAdmin.appointment.update({
      where: { id: appointmentId },
      data: { pickupNotifiedAt: new Date() },
    })

    return { ok: true }
  } catch (e) {
    console.error('notifyPickup failed:', e)
    return { ok: false, error: 'LINE 發送失敗，請改以電話通知' }
  }
}

// ─── addOvertimeFee ────────────────────────────────────────────────────────

export async function addOvertimeFee(
  appointmentId: string,
): Promise<{ ok: boolean; fee?: number; error?: string }> {
  if (!appointmentId) return { ok: false, error: '缺少預約 ID' }

  try {
    const appt = await prismaAdmin.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        pickupDeadlineAt: true,
        customer: { select: { lineUserId: true } },
        pet: { select: { name: true } },
        order: { select: { id: true } },
        store: {
          select: {
            name: true,
            overtimeFeePerHour: true,
            overtimeGraceMinutes: true,
          },
        },
      },
    })

    if (!appt.order) return { ok: false, error: '此預約尚無訂單' }
    if (!appt.pickupDeadlineAt) return { ok: false, error: '尚未設定接回時限' }

    const now = new Date()
    const overtimeMins = Math.floor(
      (now.getTime() - appt.pickupDeadlineAt.getTime()) / 60_000,
    )
    const graceMins = appt.store.overtimeGraceMinutes

    if (overtimeMins <= graceMins) {
      return {
        ok: false,
        error: `尚在寬限期內（${graceMins} 分鐘），不可計費`,
      }
    }

    const billableMins = overtimeMins - graceMins
    const fee = Math.ceil(billableMins / 60) * appt.store.overtimeFeePerHour

    await prismaAdmin.order.update({
      where: { id: appt.order.id },
      data: { overtimeFee: fee },
    })

    // Re-notify customer about overtime fee if they have LINE
    if (appt.customer.lineUserId) {
      try {
        await sendOvertimeNotice(appt.customer.lineUserId, {
          petName: appt.pet.name,
          overtimeMinutes: overtimeMins,
          fee,
        })
      } catch (e) {
        console.error('addOvertimeFee: LINE notify failed (non-fatal)', e)
      }
    }

    return { ok: true, fee }
  } catch (e) {
    console.error('addOvertimeFee failed:', e)
    return { ok: false, error: '計費失敗，請稍後再試' }
  }
}
