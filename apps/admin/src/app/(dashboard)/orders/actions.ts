'use server'

import { prismaAdmin } from '@repo/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type OrderListRow = {
  id: string
  createdAt: string
  paidAt: string | null
  customerName: string
  customerPhone: string
  petName: string
  staffName: string | null
  status: string
  paymentMethod: string | null
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  services: string
  source: string | null
  contractId: string | null
  hasSupplementary: boolean
}

export type AuditLogRow = {
  id: string
  action: string
  oldValue: string | null
  newValue: string | null
  note: string | null
  createdAt: string
}

export async function getOrders(daysBack = 30): Promise<OrderListRow[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)

  const rows = await prismaAdmin.order.findMany({
    where: {
      status: { not: 'DRAFT' },
      createdAt: { gte: cutoff },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      pet: { select: { name: true } },
      staff: { select: { name: true } },
      items: { select: { serviceName: true, quantity: true } },
      appointment: { select: { source: true } },
      contract: {
        select: {
          id: true,
          isSupplementary: true,
          supplements: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    petName: r.pet.name,
    staffName: r.staff?.name ?? null,
    status: r.status,
    paymentMethod: r.paymentMethod,
    subtotalAmount: r.subtotalAmount,
    discountAmount: r.discountAmount,
    totalAmount: r.totalAmount,
    services: r.items
      .map((i) =>
        i.quantity > 1 ? `${i.serviceName}×${i.quantity}` : i.serviceName,
      )
      .join('、'),
    source: r.appointment?.source ?? null,
    contractId: r.contract?.id ?? null,
    hasSupplementary: (r.contract?.supplements.length ?? 0) > 0,
  }))
}

export async function getOrderAuditLogs(
  orderId: string,
): Promise<AuditLogRow[]> {
  z.string().min(1).parse(orderId)
  const rows = await prismaAdmin.orderAuditLog.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    oldValue: r.oldValue,
    newValue: r.newValue,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

const cancelSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1, '請填寫取消原因'),
})

export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<void> {
  const { orderId: id, reason: note } = cancelSchema.parse({ orderId, reason })

  const order = await prismaAdmin.order.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  })

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    throw new Error(`訂單已是 ${order.status} 狀態，無法再次取消`)
  }

  await prismaAdmin.$transaction([
    prismaAdmin.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    }),
    prismaAdmin.orderAuditLog.create({
      data: {
        orderId: id,
        action: 'CANCELLED',
        oldValue: order.status,
        newValue: 'CANCELLED',
        note,
      },
    }),
  ])

  revalidatePath('/orders')
}

const refundSchema = z.object({
  orderId: z.string().min(1),
  refundAmount: z.number().int().positive(),
  reason: z.string().min(1, '請填寫退款原因'),
})

export async function refundOrder(
  orderId: string,
  refundAmount: number,
  reason: string,
): Promise<void> {
  const {
    orderId: id,
    refundAmount: amount,
    reason: note,
  } = refundSchema.parse({
    orderId,
    refundAmount,
    reason,
  })

  const order = await prismaAdmin.order.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      totalAmount: true,
      paymentMethod: true,
      customer: {
        select: { id: true, member: { select: { id: true, balance: true } } },
      },
    },
  })

  if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
    throw new Error(`訂單已是 ${order.status} 狀態，無法退款`)
  }
  if (amount > order.totalAmount) {
    throw new Error(`退款金額不可超過訂單金額 $${order.totalAmount}`)
  }

  await prismaAdmin.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: 'REFUNDED' } })
    await tx.orderAuditLog.create({
      data: {
        orderId: id,
        action: 'REFUNDED',
        oldValue: order.status,
        newValue: JSON.stringify({ status: 'REFUNDED', refundAmount: amount }),
        note,
      },
    })

    // 若原本以儲值金付款，將退款金額退回會員帳戶
    if (order.paymentMethod === 'MEMBER_BALANCE' && order.customer.member) {
      await tx.member.update({
        where: { id: order.customer.member.id },
        data: { balance: { increment: amount } },
      })
      await tx.balanceTransaction.create({
        data: {
          memberId: order.customer.member.id,
          orderId: id,
          amount,
          type: 'REFUND',
          note: `訂單 ${id} 退款`,
        },
      })
    }
  })
  revalidatePath('/orders')
}
