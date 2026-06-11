'use server'

import { prismaAdmin } from '@repo/db'

export type CustomerListRow = {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  createdAt: string
  petCount: number
  pets: Array<{ name: string; species: string }>
  orderCount: number
  lastOrderAt: string | null
  isMember: boolean
}

export async function getCustomers(): Promise<CustomerListRow[]> {
  const rows = await prismaAdmin.customer.findMany({
    include: {
      pets: { select: { name: true, species: true } },
      member: { select: { id: true } },
      orders: {
        where: { status: { not: 'DRAFT' } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: { orders: { where: { status: { not: 'DRAFT' } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    petCount: r.pets.length,
    pets: r.pets.map((p) => ({ name: p.name, species: p.species })),
    orderCount: r._count.orders,
    lastOrderAt: r.orders[0]?.createdAt.toISOString() ?? null,
    isMember: r.member !== null,
  }))
}
