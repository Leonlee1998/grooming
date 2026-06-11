'use server'

import { prismaAdmin } from '@repo/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type MemberListRow = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  planName: string
  points: number
  balance: number
  joinedAt: string
  expiresAt: string | null
}

export async function getMembers(): Promise<MemberListRow[]> {
  const rows = await prismaAdmin.member.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      plan: { select: { name: true } },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: r.customer.name,
    customerPhone: r.customer.phone,
    planName: r.plan.name,
    points: r.points,
    balance: r.balance,
    joinedAt: r.joinedAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }))
}

const topUpSchema = z.object({
  memberId: z.string().min(1),
  amount: z.number().int().positive(),
  note: z.string().optional(),
})

export async function topUpBalance(
  memberId: string,
  amount: number,
  note?: string,
): Promise<void> {
  const input = topUpSchema.parse({ memberId, amount, note })

  await prismaAdmin.$transaction([
    prismaAdmin.member.update({
      where: { id: input.memberId },
      data: { balance: { increment: input.amount } },
    }),
    prismaAdmin.balanceTransaction.create({
      data: {
        memberId: input.memberId,
        amount: input.amount,
        type: 'TOPUP',
        note: input.note ?? '後台儲值',
      },
    }),
  ])

  revalidatePath('/members')
}
