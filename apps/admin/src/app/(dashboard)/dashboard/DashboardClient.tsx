'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { DashboardStats, AppointmentRow, OvertimeAlert } from './actions'
import {
  updateAppointmentStatus,
  getDashboardStats,
  getTodayAppointments,
  getOvertimeAlerts,
} from './actions'

// Supabase 瀏覽器客戶端（僅用於 Realtime 訂閱）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
)

// ─── 型別 ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

// ─── 常數 ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認',
  CONFIRMED: '已確認',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  NO_SHOW: '未到場',
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-slate-100 text-slate-400',
}

const SPECIES_LABEL: Record<string, string> = {
  DOG: '🐕',
  CAT: '🐈',
}

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: '現場',
  ONLINE: '線上',
  LINE: 'LINE',
}

// ─── 子元件 ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold tracking-tight ${accent ?? 'text-slate-900'}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function NextActionButton({
  appointment,
  onUpdate,
}: {
  appointment: AppointmentRow
  onUpdate: (id: string, status: AppointmentStatus) => Promise<void>
}) {
  const nextActions: Partial<
    Record<string, { label: string; status: AppointmentStatus; style: string }>
  > = {
    PENDING: {
      label: '確認',
      status: 'CONFIRMED',
      style: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    },
    CONFIRMED: {
      label: '開始',
      status: 'IN_PROGRESS',
      style: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200',
    },
    IN_PROGRESS: {
      label: '完成',
      status: 'COMPLETED',
      style: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
    },
  }

  const action = nextActions[appointment.status]
  if (!action) return null

  return (
    <button
      onClick={() => onUpdate(appointment.id, action.status)}
      className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${action.style}`}
    >
      {action.label}
    </button>
  )
}

function AppointmentDetailRow({
  appointment,
}: {
  appointment: AppointmentRow
}) {
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      maximumFractionDigits: 0,
    }).format(n)

  return (
    <tr className="bg-slate-50">
      <td colSpan={8} className="px-6 py-4">
        <div className="flex gap-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              服務明細
            </p>
            {appointment.order?.items && appointment.order.items.length > 0 ? (
              <ul className="space-y-1">
                {appointment.order.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-sm text-slate-700"
                  >
                    <span className="min-w-[120px]">{item.serviceName}</span>
                    <span className="text-slate-400">×{item.quantity}</span>
                    <span className="font-medium">
                      {fmtCurrency(item.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">尚無服務明細（待報到）</p>
            )}
          </div>

          {appointment.order && (
            <div className="border-l border-slate-200 pl-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                訂單資訊
              </p>
              <dl className="space-y-1 text-sm">
                <div className="flex gap-3">
                  <dt className="w-16 text-slate-500">訂單號</dt>
                  <dd className="font-mono text-slate-700">
                    #{appointment.order.id.slice(-8).toUpperCase()}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-16 text-slate-500">小計</dt>
                  <dd className="text-slate-700">
                    {fmtCurrency(appointment.order.subtotalAmount)}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-16 text-slate-500">總計</dt>
                  <dd className="font-semibold text-slate-900">
                    {fmtCurrency(appointment.order.totalAmount)}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-16 text-slate-500">付款</dt>
                  <dd
                    className={
                      appointment.order.paidAt
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }
                  >
                    {appointment.order.paidAt ? '已付款' : '未付款'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="border-l border-slate-200 pl-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              預約資訊
            </p>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-3">
                <dt className="w-16 text-slate-500">預估</dt>
                <dd className="text-slate-700">
                  {appointment.estimatedDuration} 分鐘
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 text-slate-500">來源</dt>
                <dd className="text-slate-700">
                  {SOURCE_LABEL[appointment.source] ?? appointment.source}
                </dd>
              </div>
              {appointment.pickupDeadlineAt && (
                <div className="flex gap-3">
                  <dt className="w-16 text-slate-500">接回</dt>
                  <dd className="text-slate-700">
                    {new Intl.DateTimeFormat('zh-TW', {
                      timeZone: 'Asia/Taipei',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(appointment.pickupDeadlineAt))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────

interface Props {
  stats: DashboardStats
  appointments: AppointmentRow[]
  overtimeAlerts: OvertimeAlert[]
}

export function DashboardClient({
  stats: initialStats,
  appointments: initialAppointments,
  overtimeAlerts: initialAlerts,
}: Props) {
  const [stats, setStats] = useState(initialStats)
  const [appointments, setAppointments] = useState(initialAppointments)
  const [overtimeAlerts, setOvertimeAlerts] = useState(initialAlerts)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ── Supabase Realtime 訂閱 ────────────────────────────────────────────────
  useEffect(() => {
    async function refresh() {
      setIsRefreshing(true)
      try {
        const [newStats, newAppointments, newAlerts] = await Promise.all([
          getDashboardStats(),
          getTodayAppointments(),
          getOvertimeAlerts(),
        ])
        setStats(newStats)
        setAppointments(newAppointments)
        setOvertimeAlerts(newAlerts)
      } finally {
        setIsRefreshing(false)
      }
    }

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          void refresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // ── 狀態更新 ──────────────────────────────────────────────────────────────
  async function handleStatusUpdate(id: string, status: AppointmentStatus) {
    await updateAppointmentStatus(id, status)
    const [newStats, newAppointments, newAlerts] = await Promise.all([
      getDashboardStats(),
      getTodayAppointments(),
      getOvertimeAlerts(),
    ])
    setStats(newStats)
    setAppointments(newAppointments)
    setOvertimeAlerts(newAlerts)
  }

  // ── 展開/收合 ─────────────────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── 時間格式 ──────────────────────────────────────────────────────────────
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))

  const todayLabel = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <div
      className={`space-y-6 transition-opacity ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">今日總覽</h1>
          <p className="mt-0.5 text-sm text-slate-400">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/appointments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          >
            <span>＋</span> 建立新預約
          </a>
          <a
            href="/customers"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            查詢客戶
          </a>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="今日預約"
          value={`${stats.todayAppointments} / ${stats.completedAppointments}`}
          sub="總數 / 已完成"
        />
        <StatCard
          label="今日營收"
          value={`$${stats.todayRevenue.toLocaleString('zh-TW')}`}
          sub="已結帳訂單"
          accent="text-emerald-700"
        />
        <StatCard
          label="待接回"
          value={stats.pendingPickup}
          sub="美容完成尚未接回"
          accent={stats.pendingPickup > 0 ? 'text-amber-600' : 'text-slate-900'}
        />
        <StatCard
          label="新客戶"
          value={stats.newCustomers}
          sub="今日首次到店"
        />
      </div>

      {/* ── Overtime Alert Banner ───────────────────────────────────────────── */}
      {overtimeAlerts.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="font-semibold text-orange-800">
              逾時警示：{overtimeAlerts.length} 隻寵物已超過接回時間
            </p>
          </div>
          <ul className="space-y-1">
            {overtimeAlerts.map((alert) => (
              <li
                key={alert.appointmentId}
                className="flex items-center gap-3 text-sm text-orange-700"
              >
                <span className="font-medium">
                  {alert.petName}（{alert.customerName}）
                </span>
                <span>
                  逾時{' '}
                  <span className="font-bold">
                    {alert.overtimeMinutes >= 60
                      ? `${Math.floor(alert.overtimeMinutes / 60)} 小時 ${alert.overtimeMinutes % 60} 分`
                      : `${alert.overtimeMinutes} 分鐘`}
                  </span>
                </span>
                <span className="text-orange-500">
                  截止{' '}
                  {new Intl.DateTimeFormat('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(alert.pickupDeadlineAt))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Today's Appointments Table ──────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-700">
          今日預約（{appointments.length} 筆）
        </h2>

        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
            今日尚無預約
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 w-20">時間</th>
                  <th className="px-4 py-3 w-40">客戶</th>
                  <th className="px-4 py-3 w-32">寵物</th>
                  <th className="px-4 py-3 w-24">美容師</th>
                  <th className="px-4 py-3">服務</th>
                  <th className="px-4 py-3 w-28">狀態</th>
                  <th className="px-4 py-3 w-24">操作</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <Fragment key={appt.id}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors ${
                        expandedIds.has(appt.id) ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {fmtTime(appt.scheduledAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {appt.customerName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {appt.customerPhone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="mr-1">
                          {SPECIES_LABEL[appt.petSpecies] ?? '🐾'}
                        </span>
                        <span className="text-slate-700">{appt.petName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {appt.staffName ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {appt.order?.items && appt.order.items.length > 0 ? (
                          <span className="text-slate-700">
                            {appt.order.items
                              .map((i) => i.serviceName)
                              .join('、')}
                          </span>
                        ) : (
                          <span className="text-slate-300">待報到</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={appt.status} />
                      </td>
                      <td className="px-4 py-3">
                        <NextActionButton
                          appointment={appt}
                          onUpdate={handleStatusUpdate}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(appt.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label={
                            expandedIds.has(appt.id) ? '收合' : '展開'
                          }
                        >
                          {expandedIds.has(appt.id) ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>
                    {expandedIds.has(appt.id) && (
                      <AppointmentDetailRow appointment={appt} />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
