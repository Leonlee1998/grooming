'use server'

import { prismaAdmin } from '@repo/db'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenuePoint = {
  date: string
  revenue: number
  orderCount: number
  avgOrderValue: number
}

export type RevenueReport = {
  points: RevenuePoint[]
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  newCustomers: number
}

export type ServiceStat = {
  serviceId: string
  serviceName: string
  count: number
  revenue: number
}

export type CustomerStat = {
  newCustomers: number
  returningCustomers: number
  memberRevenue: number
  nonMemberRevenue: number
  memberOrders: number
  nonMemberOrders: number
}

export type StaffPerf = {
  staffId: string
  staffName: string
  orderCount: number
  revenue: number
  avgOrderValue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const tpeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toTaipeiDateStr(date: Date): string {
  return tpeFmt.format(date)
}

function groupKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const ymd = toTaipeiDateStr(date)
  if (groupBy === 'day') return ymd
  if (groupBy === 'month') return ymd.slice(0, 7)

  // Week: find the ISO Monday of the week
  const [y, m, d] = ymd.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  const dow = local.getDay() || 7
  local.setDate(local.getDate() - (dow - 1))
  const wy = String(local.getFullYear())
  const wm = String(local.getMonth() + 1).padStart(2, '0')
  const wd = String(local.getDate()).padStart(2, '0')
  return `${wy}-${wm}-${wd}`
}

function parseDateRange(startDate: string, endDate: string) {
  const { startDate: sd, endDate: ed } = dateRangeSchema.parse({
    startDate,
    endDate,
  })
  return {
    gte: new Date(`${sd}T00:00:00+08:00`),
    lte: new Date(`${ed}T23:59:59+08:00`),
  }
}

// ─── Revenue Report ───────────────────────────────────────────────────────────

export async function getRevenueReport(
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month',
): Promise<RevenueReport> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const [orders, newCustomerCount] = await Promise.all([
    prismaAdmin.order.findMany({
      where: { paidAt: { gte, lte }, status: 'COMPLETED' },
      select: { paidAt: true, totalAmount: true },
      orderBy: { paidAt: 'asc' },
    }),
    // 新客：在本期間內第一次有 COMPLETED 訂單的 customer
    prismaAdmin.customer.count({
      where: {
        orders: {
          some: { paidAt: { gte, lte }, status: 'COMPLETED' },
          none: { paidAt: { lt: gte }, status: 'COMPLETED' },
        },
      },
    }),
  ])

  const grouped = new Map<string, { revenue: number; orderCount: number }>()
  for (const order of orders) {
    if (!order.paidAt) continue
    const key = groupKey(order.paidAt, groupBy)
    const existing = grouped.get(key)
    if (existing) {
      existing.revenue += order.totalAmount
      existing.orderCount++
    } else {
      grouped.set(key, { revenue: order.totalAmount, orderCount: 1 })
    }
  }

  const points: RevenuePoint[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orderCount: data.orderCount,
      avgOrderValue: Math.round(data.revenue / data.orderCount),
    }))

  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0)
  const totalOrders = points.reduce((s, p) => s + p.orderCount, 0)

  return {
    points,
    totalRevenue,
    totalOrders,
    avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    newCustomers: newCustomerCount,
  }
}

// ─── Service Stats ────────────────────────────────────────────────────────────

export async function getServiceStats(
  startDate: string,
  endDate: string,
): Promise<ServiceStat[]> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const orders = await prismaAdmin.order.findMany({
    where: { paidAt: { gte, lte }, status: 'COMPLETED' },
    select: {
      items: {
        select: {
          serviceId: true,
          serviceName: true,
          amount: true,
          quantity: true,
        },
      },
    },
  })

  const map = new Map<string, ServiceStat>()
  for (const order of orders) {
    for (const item of order.items) {
      const existing = map.get(item.serviceId)
      if (existing) {
        existing.count += item.quantity
        existing.revenue += item.amount
      } else {
        map.set(item.serviceId, {
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          count: item.quantity,
          revenue: item.amount,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

// ─── Customer Stats ───────────────────────────────────────────────────────────

export async function getCustomerStats(
  startDate: string,
  endDate: string,
): Promise<CustomerStat> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const orders = await prismaAdmin.order.findMany({
    where: { paidAt: { gte, lte }, status: 'COMPLETED' },
    select: {
      customerId: true,
      totalAmount: true,
      customer: { select: { member: { select: { id: true } } } },
    },
  })

  const customerIds = [...new Set(orders.map((o) => o.customerId))]

  const prevOrders = await prismaAdmin.order.findMany({
    where: {
      customerId: { in: customerIds },
      paidAt: { lt: gte },
      status: 'COMPLETED',
    },
    select: { customerId: true },
    distinct: ['customerId'],
  })

  const returningIds = new Set(prevOrders.map((o) => o.customerId))
  const newCustomerSet = new Set<string>()
  const returningCustomerSet = new Set<string>()
  let memberRevenue = 0,
    nonMemberRevenue = 0,
    memberOrders = 0,
    nonMemberOrders = 0

  for (const order of orders) {
    if (returningIds.has(order.customerId)) {
      returningCustomerSet.add(order.customerId)
    } else {
      newCustomerSet.add(order.customerId)
    }

    if (order.customer.member) {
      memberRevenue += order.totalAmount
      memberOrders++
    } else {
      nonMemberRevenue += order.totalAmount
      nonMemberOrders++
    }
  }

  return {
    newCustomers: newCustomerSet.size,
    returningCustomers: returningCustomerSet.size,
    memberRevenue,
    nonMemberRevenue,
    memberOrders,
    nonMemberOrders,
  }
}

// ─── Staff Performance ────────────────────────────────────────────────────────

export async function getStaffPerformance(
  startDate: string,
  endDate: string,
): Promise<StaffPerf[]> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const orders = await prismaAdmin.order.findMany({
    where: { paidAt: { gte, lte }, status: 'COMPLETED' },
    select: {
      staffId: true,
      totalAmount: true,
      staff: { select: { name: true } },
    },
  })

  const map = new Map<
    string,
    { name: string; count: number; revenue: number }
  >()
  for (const order of orders) {
    const key = order.staffId ?? '__none__'
    const name = order.staff?.name ?? '未分配'
    const existing = map.get(key)
    if (existing) {
      existing.count++
      existing.revenue += order.totalAmount
    } else {
      map.set(key, { name, count: 1, revenue: order.totalAmount })
    }
  }

  return Array.from(map.entries())
    .map(([staffId, data]) => ({
      staffId,
      staffName: data.name,
      orderCount: data.count,
      revenue: data.revenue,
      avgOrderValue: Math.round(data.revenue / data.count),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ─── Booking Source Stats ─────────────────────────────────────────────────

export type BookingSourceStat = {
  source: string
  count: number
}

export async function getBookingSourceStats(
  startDate: string,
  endDate: string,
): Promise<BookingSourceStat[]> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const rows = await prismaAdmin.appointment.groupBy({
    by: ['source'],
    where: {
      scheduledAt: { gte, lte },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    _count: { id: true },
  })

  return rows.map((r) => ({ source: r.source, count: r._count.id }))
}

// ─── Service Category Revenue ─────────────────────────────────────────────

export type CategoryRevenueStat = {
  category: string
  revenue: number
  count: number
}

export async function getCategoryRevenue(
  startDate: string,
  endDate: string,
): Promise<CategoryRevenueStat[]> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const orders = await prismaAdmin.order.findMany({
    where: { paidAt: { gte, lte }, status: 'COMPLETED' },
    select: {
      items: {
        select: {
          amount: true,
          quantity: true,
          service: { select: { category: true } },
        },
      },
    },
  })

  const map = new Map<string, { revenue: number; count: number }>()
  for (const order of orders) {
    for (const item of order.items) {
      const cat = item.service?.category ?? 'OTHER'
      const existing = map.get(cat)
      if (existing) {
        existing.revenue += item.amount
        existing.count += item.quantity
      } else {
        map.set(cat, { revenue: item.amount, count: item.quantity })
      }
    }
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

export async function exportOrdersCsv(
  startDate: string,
  endDate: string,
): Promise<string> {
  const { gte, lte } = parseDateRange(startDate, endDate)

  const orders = await prismaAdmin.order.findMany({
    where: { paidAt: { gte, lte }, status: 'COMPLETED' },
    include: {
      customer: { select: { name: true, phone: true } },
      pet: { select: { name: true } },
      staff: { select: { name: true } },
      items: {
        select: {
          serviceName: true,
          quantity: true,
          unitPrice: true,
          amount: true,
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  const dtFmt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const headers = [
    '訂單ID',
    '結帳時間',
    '客戶姓名',
    '電話',
    '寵物',
    '美容師',
    '服務項目',
    '小計',
    '優惠',
    '加班費',
    '總金額',
    '付款方式',
  ]

  const rows = orders.map((order) => [
    order.id,
    order.paidAt ? dtFmt.format(order.paidAt) : '',
    order.customer.name,
    order.customer.phone,
    order.pet.name,
    order.staff?.name ?? '',
    order.items.map((i) => `${i.serviceName}×${i.quantity}`).join('；'),
    order.subtotalAmount,
    order.discountAmount,
    order.overtimeFee,
    order.totalAmount,
    order.paymentMethod ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')

  return '﻿' + csv
}
