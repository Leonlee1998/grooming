'use server'

import { prismaAdmin } from '@repo/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type AppointmentListRow = {
  id: string
  scheduledAt: string
  estimatedDuration: number
  pickupDeadlineAt: string | null
  status: string
  source: string
  notes: string | null
  customerName: string
  customerPhone: string
  petName: string
  petSpecies: string
  staffName: string | null
  orderId: string | null
  orderStatus: string | null
  totalAmount: number | null
}

export async function getAppointments(
  daysBack = 30,
): Promise<AppointmentListRow[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)

  const rows = await prismaAdmin.appointment.findMany({
    where: { scheduledAt: { gte: cutoff } },
    include: {
      customer: { select: { name: true, phone: true } },
      pet: { select: { name: true, species: true } },
      staff: { select: { name: true } },
      order: { select: { id: true, status: true, totalAmount: true } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 200,
  })

  return rows.map((r) => ({
    id: r.id,
    scheduledAt: r.scheduledAt.toISOString(),
    estimatedDuration: r.estimatedDuration,
    pickupDeadlineAt: r.pickupDeadlineAt?.toISOString() ?? null,
    status: r.status,
    source: r.source,
    notes: r.notes,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    petName: r.pet.name,
    petSpecies: r.pet.species,
    staffName: r.staff?.name ?? null,
    orderId: r.order?.id ?? null,
    orderStatus: r.order?.status ?? null,
    totalAmount: r.order?.totalAmount ?? null,
  }))
}

const updateStatusSchema = z.object({
  id: z.string().min(1),
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
  id: string,
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW',
): Promise<void> {
  const input = updateStatusSchema.parse({ id, status })

  const extra: { actualStartAt?: Date; actualEndAt?: Date } = {}
  if (input.status === 'IN_PROGRESS') extra.actualStartAt = new Date()
  if (input.status === 'COMPLETED') extra.actualEndAt = new Date()

  await prismaAdmin.appointment.update({
    where: { id: input.id },
    data: { status: input.status, ...extra },
  })

  revalidatePath('/appointments')
}
