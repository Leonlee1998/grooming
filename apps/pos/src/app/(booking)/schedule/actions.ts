'use server'

import { prismaAdmin } from '@repo/db'
import { z } from 'zod'
import { getStoreIdFromCustomer } from '../../../lib/store'

export type StaffRow = {
  id: string
  name: string
}

export type AppointmentWithDetails = {
  id: string
  scheduledAt: string
  estimatedDuration: number
  actualStartAt: string | null
  actualEndAt: string | null
  pickupDeadlineAt: string | null
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW'
  source: 'WALK_IN' | 'ONLINE' | 'LINE' | 'POS_ONSITE'
  notes: string | null
  staffId: string | null
  customer: { id: string; name: string; phone: string }
  pet: { id: string; name: string; species: string; breed: string | null }
  staff: { id: string; name: string } | null
  order: {
    id: string
    status: string
    totalAmount: number
    items: { serviceName: string; quantity: number }[]
  } | null
}

export type ScheduleData = {
  appointments: AppointmentWithDetails[]
  staff: StaffRow[]
}

export async function getSchedule(
  date: string,
  staffId?: string,
): Promise<ScheduleData> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { appointments: [], staff: [] }
  }

  // 轉為台北時區的一整天 UTC 範圍
  const gte = new Date(`${date}T00:00:00+08:00`)
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000)

  try {
    const [rawAppts, staff] = await Promise.all([
      prismaAdmin.appointment.findMany({
        where: {
          scheduledAt: { gte, lt },
          ...(staffId ? { staffId } : {}),
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          pet: { select: { id: true, name: true, species: true, breed: true } },
          staff: { select: { id: true, name: true } },
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              items: {
                select: { serviceName: true, quantity: true },
                orderBy: { id: 'asc' },
              },
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      prismaAdmin.staff.findMany({
        where: { isActive: true, ...(staffId ? { id: staffId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return {
      appointments: rawAppts.map((a) => ({
        id: a.id,
        scheduledAt: a.scheduledAt.toISOString(),
        estimatedDuration: a.estimatedDuration,
        actualStartAt: a.actualStartAt?.toISOString() ?? null,
        actualEndAt: a.actualEndAt?.toISOString() ?? null,
        pickupDeadlineAt: a.pickupDeadlineAt?.toISOString() ?? null,
        status: a.status,
        source: a.source,
        notes: a.notes,
        staffId: a.staffId,
        customer: a.customer,
        pet: {
          id: a.pet.id,
          name: a.pet.name,
          species: a.pet.species as string,
          breed: a.pet.breed,
        },
        staff: a.staff,
        order: a.order
          ? {
              id: a.order.id,
              status: a.order.status,
              totalAmount: a.order.totalAmount,
              items: a.order.items,
            }
          : null,
      })),
      staff,
    }
  } catch (e) {
    console.error('getSchedule error:', e)
    return { appointments: [], staff: [] }
  }
}

// ─── Booking form data ────────────────────────────────────────────────────────

export type BookingService = {
  id: string
  name: string
  category: string
  basePrice: number
  estimatedMinutes: number
}

export type BookingStaff = {
  id: string
  name: string
}

export type BookingFormData = {
  services: BookingService[]
  staff: BookingStaff[]
}

export async function getBookingFormData(): Promise<BookingFormData> {
  const [services, staff] = await Promise.all([
    prismaAdmin.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        basePrice: true,
        estimatedMinutes: true,
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    }),
    prismaAdmin.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return { services, staff }
}

// ─── Available time slots ─────────────────────────────────────────────────────

export type TimeSlot = {
  time: string // 'HH:MM'
  startMin: number // minutes from midnight
  available: boolean
}

export async function getAvailableSlots(
  staffId: string,
  date: string,
): Promise<TimeSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !staffId) return []

  // All 30-min slots from 08:00 to 19:30
  const slots: TimeSlot[] = []
  for (let startMin = 8 * 60; startMin <= 19 * 60 + 30; startMin += 30) {
    const h = Math.floor(startMin / 60)
    const m = startMin % 60
    slots.push({
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      startMin,
      available: true,
    })
  }

  const gte = new Date(`${date}T00:00:00+08:00`)
  const lt = new Date(gte.getTime() + 86_400_000)

  const appts = await prismaAdmin.appointment.findMany({
    where: {
      staffId,
      scheduledAt: { gte, lt },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { scheduledAt: true, estimatedDuration: true },
  })

  appts.forEach((appt) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(appt.scheduledAt))
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
    const apptStart = h * 60 + m
    const apptEnd = apptStart + appt.estimatedDuration

    slots.forEach((slot) => {
      if (slot.startMin < apptEnd && slot.startMin >= apptStart) {
        slot.available = false
      }
    })
  })

  return slots
}

// ─── Create appointment ───────────────────────────────────────────────────────

const createAppointmentSchema = z.object({
  customerId: z.string().min(1),
  petId: z.string().min(1),
  staffId: z.string().nullable().optional(),
  serviceIds: z.array(z.string()).min(1, '至少選擇一項服務'),
  scheduledAt: z.string().min(1),
  pickupDeadlineAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z
    .enum(['WALK_IN', 'ONLINE', 'LINE', 'POS_ONSITE'])
    .default('WALK_IN'),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>

export async function createAppointment(
  raw: CreateAppointmentInput,
): Promise<AppointmentWithDetails> {
  const data = createAppointmentSchema.parse(raw)

  const services = await prismaAdmin.service.findMany({
    where: { id: { in: data.serviceIds } },
    select: { estimatedMinutes: true },
  })
  const estimatedDuration = services.reduce(
    (sum, s) => sum + s.estimatedMinutes,
    0,
  )

  const storeId = await getStoreIdFromCustomer(data.customerId)

  const appt = await prismaAdmin.appointment.create({
    data: {
      storeId,
      customerId: data.customerId,
      petId: data.petId,
      staffId: data.staffId ?? null,
      scheduledAt: new Date(data.scheduledAt),
      estimatedDuration,
      pickupDeadlineAt: data.pickupDeadlineAt
        ? new Date(data.pickupDeadlineAt)
        : null,
      notes: data.notes ?? null,
      source: data.source,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      pet: { select: { id: true, name: true, species: true, breed: true } },
      staff: { select: { id: true, name: true } },
    },
  })

  return {
    id: appt.id,
    scheduledAt: appt.scheduledAt.toISOString(),
    estimatedDuration: appt.estimatedDuration,
    actualStartAt: null,
    actualEndAt: null,
    pickupDeadlineAt: appt.pickupDeadlineAt?.toISOString() ?? null,
    status: appt.status,
    source: appt.source,
    notes: appt.notes,
    staffId: appt.staffId,
    customer: appt.customer,
    pet: { ...appt.pet, species: appt.pet.species as string },
    staff: appt.staff,
    order: null,
  }
}
