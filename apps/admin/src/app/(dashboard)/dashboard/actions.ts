'use server'

import { prismaAdmin } from '@repo/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardStats = {
  todayAppointments: number
  completedAppointments: number
  todayRevenue: number
  pendingPickup: number
  newCustomers: number
}

export type AppointmentRow = {
  id: string
  scheduledAt: string
  customerName: string
  customerPhone: string
  petName: string
  petSpecies: string
  staffName: string | null
  status: string
  source: string
  estimatedDuration: number
  pickupDeadlineAt: string | null
  pickedUpAt: string | null
  order: {
    id: string
    totalAmount: number
    subtotalAmount: number
    status: string
    paidAt: string | null
    items: Array<{ serviceName: string; unitPrice: number; quantity: number }>
  } | null
}

export type OvertimeAlert = {
  appointmentId: string
  customerName: string
  petName: string
  pickupDeadlineAt: string
  overtimeMinutes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTaipeiToday() {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
  }).format(now)
  return {
    start: new Date(`${today}T00:00:00+08:00`),
    end: new Date(`${today}T23:59:59.999+08:00`),
    now,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const { start, end } = getTaipeiToday()

  const [todayCount, completedCount, revenue, pendingPickup, newCustomers] =
    await Promise.all([
      prismaAdmin.appointment.count({
        where: { scheduledAt: { gte: start, lte: end } },
      }),
      prismaAdmin.appointment.count({
        where: { scheduledAt: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
      prismaAdmin.order.aggregate({
        where: { paidAt: { gte: start, lte: end }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prismaAdmin.appointment.count({
        where: { status: 'COMPLETED', pickedUpAt: null },
      }),
      prismaAdmin.customer.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
    ])

  return {
    todayAppointments: todayCount,
    completedAppointments: completedCount,
    todayRevenue: revenue._sum.totalAmount ?? 0,
    pendingPickup,
    newCustomers,
  }
}

export async function getTodayAppointments(): Promise<AppointmentRow[]> {
  const { start, end } = getTaipeiToday()

  const rows = await prismaAdmin.appointment.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    include: {
      customer: { select: { name: true, phone: true } },
      pet: { select: { name: true, species: true } },
      staff: { select: { name: true } },
      order: {
        select: {
          id: true,
          totalAmount: true,
          subtotalAmount: true,
          status: true,
          paidAt: true,
          items: {
            select: { serviceName: true, unitPrice: true, quantity: true },
            orderBy: { serviceName: 'asc' },
          },
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  return rows.map((row) => ({
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    customerName: row.customer.name,
    customerPhone: row.customer.phone,
    petName: row.pet.name,
    petSpecies: row.pet.species,
    staffName: row.staff?.name ?? null,
    status: row.status,
    source: row.source,
    estimatedDuration: row.estimatedDuration,
    pickupDeadlineAt: row.pickupDeadlineAt?.toISOString() ?? null,
    pickedUpAt: row.pickedUpAt?.toISOString() ?? null,
    order: row.order
      ? {
          id: row.order.id,
          totalAmount: row.order.totalAmount,
          subtotalAmount: row.order.subtotalAmount,
          status: row.order.status,
          paidAt: row.order.paidAt?.toISOString() ?? null,
          items: row.order.items,
        }
      : null,
  }))
}

export async function getOvertimeAlerts(): Promise<OvertimeAlert[]> {
  const { now } = getTaipeiToday()
  const graceCutoff = new Date(now.getTime() - 30 * 60_000)

  const rows = await prismaAdmin.appointment.findMany({
    where: {
      pickupDeadlineAt: { lt: graceCutoff },
      pickedUpAt: null,
      status: { in: ['IN_PROGRESS', 'COMPLETED'] },
    },
    include: {
      customer: { select: { name: true } },
      pet: { select: { name: true } },
    },
    orderBy: { pickupDeadlineAt: 'asc' },
  })

  return rows.map((row) => ({
    appointmentId: row.id,
    customerName: row.customer.name,
    petName: row.pet.name,
    pickupDeadlineAt: row.pickupDeadlineAt!.toISOString(),
    overtimeMinutes: Math.floor(
      (now.getTime() - row.pickupDeadlineAt!.getTime()) / 60_000,
    ),
  }))
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const updateStatusSchema = z.object({
  appointmentId: z.string().min(1),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
})

export async function updateAppointmentStatus(
  appointmentId: string,
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW',
): Promise<void> {
  const input = updateStatusSchema.parse({ appointmentId, status })

  const extra: { actualStartAt?: Date; actualEndAt?: Date } = {}
  if (input.status === 'IN_PROGRESS') {
    extra.actualStartAt = new Date()
    // 更新訂單狀態為進行中
    await prismaAdmin.order.updateMany({
      where: {
        appointmentId: input.appointmentId,
        status: { in: ['DRAFT', 'CONFIRMED'] },
      },
      data: { status: 'IN_PROGRESS' },
    })
  } else if (input.status === 'COMPLETED') {
    extra.actualEndAt = new Date()
  }

  await prismaAdmin.appointment.update({
    where: { id: input.appointmentId },
    data: { status: input.status, ...extra },
  })

  revalidatePath('/dashboard')
}
