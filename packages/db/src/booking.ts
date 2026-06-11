import { prismaAdmin } from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceInfo = {
  id: string
  name: string
  category: string
  basePrice: number
  estimatedMinutes: number
}

export type StaffInfo = {
  id: string
  name: string
}

export type TimeSlot = {
  time: string // 'HH:MM'
  startMin: number // minutes from midnight
  available: boolean
}

export type StaffSlots = {
  staff: StaffInfo
  slots: TimeSlot[]
}

export type CustomerWithPets = {
  customerId: string
  customerName: string
  pets: Array<{ petId: string; petName: string; species: string }>
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getServicesForBooking(): Promise<ServiceInfo[]> {
  return prismaAdmin.service.findMany({
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
}

export async function getActiveStaff(): Promise<StaffInfo[]> {
  return prismaAdmin.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function getAvailableSlots(
  staffId: string,
  date: string,
): Promise<TimeSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []

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

export async function getAllStaffSlots(date: string): Promise<StaffSlots[]> {
  const staff = await getActiveStaff()
  return Promise.all(
    staff.map(async (s) => ({
      staff: s,
      slots: await getAvailableSlots(s.id, date),
    })),
  )
}

export async function lookupCustomerByLineUser(
  lineUserId: string,
): Promise<CustomerWithPets | null> {
  const customer = await prismaAdmin.customer.findUnique({
    where: { lineUserId },
    select: {
      id: true,
      name: true,
      pets: {
        select: { id: true, name: true, species: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!customer) return null
  return {
    customerId: customer.id,
    customerName: customer.name,
    pets: customer.pets.map((p) => ({
      petId: p.id,
      petName: p.name,
      species: p.species as string,
    })),
  }
}

export async function createBookingFromLine(input: {
  customerId: string
  petId: string
  staffId: string
  serviceIds: string[]
  scheduledAt: Date
}): Promise<{ appointmentId: string; scheduledAt: Date }> {
  const customer = await prismaAdmin.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { storeId: true },
  })
  const { storeId } = customer

  const services = await prismaAdmin.service.findMany({
    where: { id: { in: input.serviceIds } },
    select: { id: true, name: true, basePrice: true, estimatedMinutes: true },
  })
  const estimatedDuration = services.reduce(
    (sum, s) => sum + s.estimatedMinutes,
    0,
  )
  const subtotal = services.reduce((sum, s) => sum + s.basePrice, 0)

  const appt = await prismaAdmin.appointment.create({
    data: {
      storeId,
      customerId: input.customerId,
      petId: input.petId,
      staffId: input.staffId,
      scheduledAt: input.scheduledAt,
      estimatedDuration,
      status: 'CONFIRMED',
      source: 'LINE',
    },
  })

  // 建立 DRAFT order，讓 POS 時間表可看到預定服務
  await prismaAdmin.order.create({
    data: {
      storeId,
      appointmentId: appt.id,
      customerId: input.customerId,
      petId: input.petId,
      staffId: input.staffId,
      status: 'DRAFT',
      subtotalAmount: subtotal,
      totalAmount: subtotal,
      items: {
        create: services.map((s) => ({
          serviceId: s.id,
          serviceName: s.name,
          quantity: 1,
          unitPrice: s.basePrice,
          amount: s.basePrice,
        })),
      },
    },
  })

  return { appointmentId: appt.id, scheduledAt: appt.scheduledAt }
}
