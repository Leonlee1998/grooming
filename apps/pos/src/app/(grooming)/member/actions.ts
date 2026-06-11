'use server'

import { prismaAdmin } from '@repo/db'
import { z } from 'zod'
import { getStoreId } from '../../../lib/store'

export type CustomerSearchResult = {
  id: string
  name: string
  phone: string
  email: string | null
  isMember: boolean
}

export type MemberPlanOption = {
  id: string
  name: string
  description: string | null
  monthlyFee: number
  pointRate: number
  discountRate: number
}

export type PointTransaction = {
  id: string
  orderId: string | null
  amount: number
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE'
  note: string | null
  createdAt: string
}

export type BalanceTransaction = {
  id: string
  orderId: string | null
  amount: number
  type: 'TOPUP' | 'SPEND' | 'REFUND'
  note: string | null
  createdAt: string
}

export type Member = {
  id: string
  customerId: string
  planId: string
  points: number
  balance: number
  joinedAt: string
  expiresAt: string | null
}

export type MemberWithPlan = Member & {
  customer: {
    id: string
    name: string
    phone: string
  }
  plan: MemberPlanOption
  annualSpend: number
  pointTransactions: PointTransaction[]
  balanceTransactions: BalanceTransaction[]
}

const customerPhoneSchema = z.string().trim().min(8).max(15)
const enrollSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
})
const topUpSchema = z.object({
  memberId: z.string().min(1),
  amount: z.coerce.number().int().positive().max(1_000_000),
})

function serializePlan(plan: {
  id: string
  name: string
  description: string | null
  monthlyFee: number
  pointRate: unknown
  discountRate: unknown
}): MemberPlanOption {
  return {
    ...plan,
    pointRate: Number(plan.pointRate),
    discountRate: Number(plan.discountRate),
  }
}

function serializePointTransaction(tx: {
  id: string
  orderId: string | null
  amount: number
  type: PointTransaction['type']
  note: string | null
  createdAt: Date
}): PointTransaction {
  return {
    ...tx,
    createdAt: tx.createdAt.toISOString(),
  }
}

function serializeBalanceTransaction(tx: {
  id: string
  orderId: string | null
  amount: number
  type: BalanceTransaction['type']
  note: string | null
  createdAt: Date
}): BalanceTransaction {
  return {
    ...tx,
    createdAt: tx.createdAt.toISOString(),
  }
}

function serializeMember(member: {
  id: string
  customerId: string
  planId: string
  points: number
  balance: number
  joinedAt: Date
  expiresAt: Date | null
}): Member {
  return {
    ...member,
    joinedAt: member.joinedAt.toISOString(),
    expiresAt: member.expiresAt?.toISOString() ?? null,
  }
}

function startOfYearInTaipei() {
  const year = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
  })
  return new Date(`${year}-01-01T00:00:00+08:00`)
}

export async function searchMemberCustomerByPhone(
  rawPhone: string,
): Promise<CustomerSearchResult | null> {
  const parsed = customerPhoneSchema.safeParse(rawPhone.replace(/\s/g, ''))
  if (!parsed.success) return null

  const customer = await prismaAdmin.customer.findFirst({
    where: { phone: parsed.data, storeId: getStoreId() },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      member: { select: { id: true } },
    },
  })

  if (!customer) return null

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    isMember: Boolean(customer.member),
  }
}

export async function getActiveMemberPlans(): Promise<MemberPlanOption[]> {
  const plans = await prismaAdmin.memberPlan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      monthlyFee: true,
      pointRate: true,
      discountRate: true,
    },
    orderBy: [{ monthlyFee: 'asc' }, { name: 'asc' }],
  })

  return plans.map(serializePlan)
}

export async function getMemberInfo(
  customerId: string,
): Promise<MemberWithPlan | null> {
  if (!customerId) return null

  const [member, annualSpend] = await Promise.all([
    prismaAdmin.member.findUnique({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            monthlyFee: true,
            pointRate: true,
            discountRate: true,
          },
        },
        pointTransactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderId: true,
            amount: true,
            type: true,
            note: true,
            createdAt: true,
          },
        },
        balanceTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderId: true,
            amount: true,
            type: true,
            note: true,
            createdAt: true,
          },
        },
      },
    }),
    prismaAdmin.order.aggregate({
      where: {
        customerId,
        createdAt: { gte: startOfYearInTaipei() },
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      _sum: { totalAmount: true },
    }),
  ])

  if (!member) return null

  return {
    ...serializeMember(member),
    customer: member.customer,
    plan: serializePlan(member.plan),
    annualSpend: annualSpend._sum.totalAmount ?? 0,
    pointTransactions: member.pointTransactions.map(serializePointTransaction),
    balanceTransactions: member.balanceTransactions.map(
      serializeBalanceTransaction,
    ),
  }
}

export async function topUpBalance(
  memberId: string,
  amount: number,
): Promise<BalanceTransaction> {
  const parsed = topUpSchema.safeParse({ memberId, amount })
  if (!parsed.success) throw new Error('儲值金額格式不正確')

  const transaction = await prismaAdmin.$transaction(async (tx) => {
    const created = await tx.balanceTransaction.create({
      data: {
        memberId: parsed.data.memberId,
        amount: parsed.data.amount,
        type: 'TOPUP',
        note: '會員儲值',
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        type: true,
        note: true,
        createdAt: true,
      },
    })

    await tx.member.update({
      where: { id: parsed.data.memberId },
      data: { balance: { increment: parsed.data.amount } },
    })

    return created
  })

  return serializeBalanceTransaction(transaction)
}

export async function enrollMember(
  customerId: string,
  planId: string,
): Promise<Member> {
  const parsed = enrollSchema.safeParse({ customerId, planId })
  if (!parsed.success) throw new Error('會員申辦資料格式不正確')

  const member = await prismaAdmin.$transaction(async (tx) => {
    const existing = await tx.member.findUnique({
      where: { customerId: parsed.data.customerId },
    })
    if (existing) return existing

    const plan = await tx.memberPlan.findFirst({
      where: { id: parsed.data.planId, isActive: true },
      select: { id: true },
    })
    if (!plan) throw new Error('會員方案不存在或已停用')

    return tx.member.create({
      data: {
        customerId: parsed.data.customerId,
        planId: parsed.data.planId,
      },
    })
  })

  return serializeMember(member)
}
