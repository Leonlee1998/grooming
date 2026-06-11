import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata: Metadata = { title: '我的預約' }

// ── 型別 ──────────────────────────────────────────────────────────────────────

type AppointmentRow = {
  id: string
  scheduledAt: string
  pickupDeadlineAt: string | null
  status: string
  signedOnline: boolean
  pet: RelationOne<{ name: string; species: string }>
  staff: RelationOne<{ name: string }>
  store: RelationOne<{ name: string }>
  order: RelationOne<{
    totalAmount: number
    overtimeFee: number
    items: RelationMany<{ serviceName: string; quantity: number }>
  }>
}

type RelationOne<T> = T | T[] | null
type RelationMany<T> = T | T[] | null

// ── 常數 ──────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認',
  CONFIRMED: '已確認',
  IN_PROGRESS: '進行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  NO_SHOW: '未到場',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-stone-100 text-stone-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-red-100 text-red-600',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function firstRelation<T>(value: RelationOne<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function relationList<T>(value: RelationMany<T>): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AppointmentsPage() {
  const cookieStore = await cookies()

  // 使用 anon key + cookie session — RLS 自動過濾只顯示自己的預約
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: cookieStore.toString() } } },
  )

  const {
    data: { session },
  } = await client.auth.getSession()

  if (!session) redirect('/login')

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // RLS policy "appointment_select_self" 過濾 customerId = current_customer_id()
  const { data: rows, error } = await client
    .from('Appointment')
    .select(
      `
      id,
      scheduledAt,
      pickupDeadlineAt,
      status,
      signedOnline,
      pet:Pet ( name, species ),
      staff:Staff ( name ),
      store:Store ( name ),
      order:Order!Order_appointmentId_fkey (
        totalAmount,
        overtimeFee,
        items:OrderItem ( serviceName, quantity )
      )
    `,
    )
    .gte('scheduledAt', since)
    .order('scheduledAt', { ascending: false })

  if (error) {
    console.error('[appointments] Supabase error:', error.message)
  }

  const appointments = (rows ?? []) as AppointmentRow[]

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-[#3B2F2A] mb-4">我的預約</h1>

      {appointments.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🐾</div>
          <p className="text-sm text-gray-500">近 90 天內尚無預約紀錄</p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center px-6 rounded-xl bg-[#78573A] text-white text-sm font-semibold"
          >
            立即預約
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const pet = firstRelation(appt.pet)
            const staff = firstRelation(appt.staff)
            const store = firstRelation(appt.store)
            const order = firstRelation(appt.order)
            const services =
              relationList(order?.items ?? null)
                .map((i) =>
                  i.quantity > 1
                    ? `${i.serviceName} ×${i.quantity}`
                    : i.serviceName,
                )
                .join('、') ?? '—'

            const statusLabel = STATUS_LABEL[appt.status] ?? appt.status
            const statusColor =
              STATUS_COLOR[appt.status] ?? 'bg-stone-100 text-stone-600'

            const totalAmount = order
              ? order.totalAmount + (order.overtimeFee ?? 0)
              : null

            return (
              <div
                key={appt.id}
                className="rounded-2xl border border-[#E5D9CC] bg-white overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#FAF7F2]">
                  <div>
                    <span className="font-semibold text-[#3B2F2A]">
                      {pet?.name ?? '—'}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      {pet?.species === 'DOG' ? '狗' : '貓'}
                    </span>
                  </div>
                  <span
                    className={[
                      'text-xs font-semibold rounded-full px-3 py-1',
                      statusColor,
                    ].join(' ')}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2 text-sm">
                  <Row label="店家" value={store?.name ?? '—'} />
                  <Row label="預約時間" value={fmtDateTime(appt.scheduledAt)} />
                  {appt.pickupDeadlineAt && (
                    <Row
                      label="取件截止"
                      value={fmtDateTime(appt.pickupDeadlineAt)}
                    />
                  )}
                  <Row label="服務項目" value={services} />
                  {staff && <Row label="美容師" value={staff.name} />}
                  {totalAmount !== null && (
                    <Row label="費用" value={`NT$ ${totalAmount}`} />
                  )}
                  {appt.signedOnline && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 w-fit">
                      <span>📄</span>
                      <span>已線上簽約</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className="text-right text-[#3B2F2A]">{value}</span>
    </div>
  )
}
