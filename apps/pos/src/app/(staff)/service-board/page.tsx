'use client'

import { useCallback, useEffect, useState } from 'react'
import { PosLayout } from '@/components/layout/PosLayout'
import {
  getServiceBoard,
  startService,
  completeService,
  notifyPickup,
  addOvertimeFee,
  type ServiceCard,
  type DisplayStatus,
} from './actions'

// ─── Constants ────────────────────────────────────────────────────────────

const SPECIES_LABEL: Record<string, string> = { DOG: '狗', CAT: '貓' }

const STATUS_CONFIG: Record<
  DisplayStatus,
  { label: string; badgeClass: string; cardBorderClass: string }
> = {
  WAITING: {
    label: '待服務',
    badgeClass: 'bg-stone-100 text-stone-600',
    cardBorderClass: 'border-stone-200',
  },
  IN_PROGRESS: {
    label: '進行中',
    badgeClass: 'bg-blue-100 text-blue-700',
    cardBorderClass: 'border-blue-300',
  },
  AWAITING_PICKUP: {
    label: '等待接送',
    badgeClass: 'bg-amber-100 text-amber-700',
    cardBorderClass: 'border-amber-300',
  },
  OVERTIME: {
    label: '逾時',
    badgeClass: 'bg-red-100 text-red-700',
    cardBorderClass: 'border-red-400',
  },
  COMPLETED: {
    label: '已完成',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    cardBorderClass: 'border-emerald-200',
  },
  CANCELLED: {
    label: '已取消',
    badgeClass: 'bg-stone-100 text-stone-400',
    cardBorderClass: 'border-stone-200',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

function fmtCountdown(minutesToOvertime: number | null): string {
  if (minutesToOvertime === null) return ''
  if (minutesToOvertime < 0) {
    const abs = Math.abs(minutesToOvertime)
    return abs >= 60
      ? `逾時 ${Math.floor(abs / 60)} 時 ${abs % 60} 分`
      : `逾時 ${abs} 分鐘`
  }
  if (minutesToOvertime === 0) return '接回時限：現在'
  return minutesToOvertime >= 60
    ? `距逾時 ${Math.floor(minutesToOvertime / 60)} 時 ${minutesToOvertime % 60} 分`
    : `距逾時 ${minutesToOvertime} 分鐘`
}

// ─── ServiceCardItem ──────────────────────────────────────────────────────

function ServiceCardItem({
  card,
  now,
  onAction,
}: {
  card: ServiceCard
  now: Date
  onAction: () => void
}) {
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [overtimeLoading, setOvertimeLoading] = useState(false)
  const [toast, setToast] = useState('')
  const cfg = STATUS_CONFIG[card.displayStatus]

  // Recompute live countdown
  const liveMinutes = card.pickupDeadlineAt
    ? Math.floor(
        (new Date(card.pickupDeadlineAt).getTime() - now.getTime()) / 60000,
      )
    : null
  const countdownText =
    card.displayStatus === 'AWAITING_PICKUP' ||
    card.displayStatus === 'OVERTIME'
      ? fmtCountdown(liveMinutes)
      : ''

  const isOvertime = liveMinutes !== null && liveMinutes < 0

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  async function handleStart() {
    setNotifyLoading(true)
    const res = await startService(card.appointmentId)
    setNotifyLoading(false)
    if (!res.ok) {
      showToast(res.error ?? '操作失敗')
    } else {
      onAction()
    }
  }

  async function handleComplete() {
    setNotifyLoading(true)
    const res = await completeService(card.appointmentId)
    setNotifyLoading(false)
    if (!res.ok) {
      showToast(res.error ?? '操作失敗')
    } else {
      onAction()
    }
  }

  async function handleNotify() {
    if (!card.lineUserId) return
    setNotifyLoading(true)
    const res = await notifyPickup({
      appointmentId: card.appointmentId,
      customerName: card.customerName,
      petName: card.petName,
      lineUserId: card.lineUserId,
    })
    setNotifyLoading(false)
    showToast(res.ok ? 'LINE 通知已發送' : (res.error ?? '發送失敗'))
    if (res.ok) onAction()
  }

  async function handleAddOvertimeFee() {
    setOvertimeLoading(true)
    const res = await addOvertimeFee(card.appointmentId)
    setOvertimeLoading(false)
    if (!res.ok) {
      showToast(res.error ?? '計費失敗')
    } else {
      showToast(`已加收逾時費 $${res.fee}，LINE 通知已發送`)
      onAction()
    }
  }

  const isAwaitingOrOvertime =
    card.displayStatus === 'AWAITING_PICKUP' ||
    card.displayStatus === 'OVERTIME'

  return (
    <div
      className={[
        'relative bg-white rounded-2xl border-2 p-5 flex flex-col gap-3 shadow-sm',
        cfg.cardBorderClass,
        isOvertime ? 'ring-2 ring-red-300 ring-offset-1' : '',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-stone-900">
              {card.petName}
            </span>
            {card.petIsAggressive && (
              <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">
                ⚠ 攻擊性
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mt-0.5">{card.customerName}</p>
        </div>
        <span
          className={[
            'shrink-0 text-xs font-semibold rounded-full px-3 py-1',
            cfg.badgeClass,
            isOvertime ? 'animate-pulse' : '',
          ].join(' ')}
        >
          {cfg.label}
        </span>
      </div>

      {/* Pet info */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600">
        <span>{SPECIES_LABEL[card.petSpecies] ?? card.petSpecies}</span>
        {card.petBreed && <span>{card.petBreed}</span>}
        {card.petWeightKg && <span>{card.petWeightKg}</span>}
      </div>

      {/* Services */}
      {card.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.services.map((s) => (
            <span
              key={s}
              className="text-xs bg-stone-100 text-stone-700 rounded-lg px-2.5 py-1 font-medium"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Time info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-stone-400 text-xs">預約時間</span>
          <p className="font-semibold text-stone-800">
            {fmtTime(card.scheduledAt)}
          </p>
        </div>
        {card.pickupDeadlineAt && (
          <div>
            <span className="text-stone-400 text-xs">接回時限</span>
            <p className="font-semibold text-stone-800">
              {fmtTime(card.pickupDeadlineAt)}
            </p>
          </div>
        )}
        {card.actualStartAt && (
          <div>
            <span className="text-stone-400 text-xs">開始服務</span>
            <p className="font-semibold text-stone-800">
              {fmtTime(card.actualStartAt)}
            </p>
          </div>
        )}
        {card.actualEndAt && (
          <div>
            <span className="text-stone-400 text-xs">服務完成</span>
            <p className="font-semibold text-stone-800">
              {fmtTime(card.actualEndAt)}
            </p>
          </div>
        )}
      </div>

      {/* Countdown */}
      {countdownText && (
        <p
          className={[
            'text-sm font-bold text-center rounded-xl py-2',
            isOvertime
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200',
          ].join(' ')}
        >
          {countdownText}
        </p>
      )}

      {/* Action buttons */}
      <div className="pt-1 flex flex-col gap-2">
        {card.displayStatus === 'WAITING' && (
          <ActionButton
            loading={notifyLoading}
            onClick={handleStart}
            color="blue"
          >
            開始服務
          </ActionButton>
        )}

        {card.displayStatus === 'IN_PROGRESS' && (
          <ActionButton
            loading={notifyLoading}
            onClick={handleComplete}
            color="emerald"
          >
            服務完成
          </ActionButton>
        )}

        {isAwaitingOrOvertime && (
          <>
            {/* Notification button / already-notified state */}
            {card.pickupNotifiedAt ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold text-center py-3 leading-tight">
                  已通知 ✓{' '}
                  <span className="font-normal">
                    {fmtTime(card.pickupNotifiedAt)}
                  </span>
                </span>
                <button
                  onClick={handleNotify}
                  disabled={notifyLoading || !card.lineUserId}
                  className="min-h-[48px] px-4 rounded-xl border-2 border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-50 disabled:opacity-40 transition-colors"
                >
                  {notifyLoading ? '…' : '再次提醒'}
                </button>
              </div>
            ) : (
              <ActionButton
                loading={notifyLoading}
                onClick={handleNotify}
                color={isOvertime ? 'red' : 'amber'}
                disabled={!card.lineUserId}
                title={
                  !card.lineUserId ? '客戶未綁定 LINE，請電話通知' : undefined
                }
              >
                {card.lineUserId ? '一鍵通知接送' : '無 LINE（請電話通知）'}
              </ActionButton>
            )}

            {/* Overtime fee button — only for OVERTIME cards with an order */}
            {card.displayStatus === 'OVERTIME' &&
              card.orderId &&
              (card.overtimeFee > 0 ? (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold text-center py-3">
                  已加收逾時費 ${card.overtimeFee}
                </div>
              ) : (
                <ActionButton
                  loading={overtimeLoading}
                  onClick={handleAddOvertimeFee}
                  color="red"
                >
                  加收逾時費
                </ActionButton>
              ))}
          </>
        )}
      </div>

      {/* Staff */}
      {card.staffName && (
        <p className="text-xs text-stone-400 -mt-1">美容師：{card.staffName}</p>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={[
            'absolute bottom-4 left-4 right-4 text-center text-sm font-semibold rounded-xl px-4 py-2 shadow-lg',
            toast.includes('失敗') || toast.includes('錯誤')
              ? 'bg-red-600 text-white'
              : 'bg-emerald-700 text-white',
          ].join(' ')}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  children,
  loading,
  onClick,
  color,
  disabled,
  title,
}: {
  children: React.ReactNode
  loading: boolean
  onClick: () => void
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'stone'
  disabled?: boolean
  title?: string
}) {
  const colorMap = {
    blue: 'bg-blue-600 text-white active:bg-blue-700',
    emerald: 'bg-emerald-700 text-white active:bg-emerald-800',
    amber: 'bg-amber-500 text-white active:bg-amber-600',
    red: 'bg-red-600 text-white active:bg-red-700',
    stone: 'bg-stone-200 text-stone-800 active:bg-stone-300',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      title={title}
      className={[
        'w-full min-h-[52px] rounded-xl text-base font-semibold transition-opacity disabled:opacity-40',
        colorMap[color],
      ].join(' ')}
    >
      {loading ? '處理中…' : children}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ServiceBoardPage() {
  const [cards, setCards] = useState<ServiceCard[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const data = await getServiceBoard()
    setCards(data)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  // Initial load + 30s auto-refresh
  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  // Tick every 60s to recompute countdowns
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(tick)
  }, [])

  // ── Stats ─────────────────────────────────────────────────────────────
  const total = cards.filter((c) => c.displayStatus !== 'CANCELLED').length
  const completed = cards.filter((c) => c.displayStatus === 'COMPLETED').length
  const overtimeCount = cards.filter(
    (c) => c.displayStatus === 'OVERTIME',
  ).length
  const hasOvertime = overtimeCount > 0

  return (
    <PosLayout>
      <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-8">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">今日服務看板</h1>
            {lastRefresh && (
              <p className="text-xs text-stone-400 mt-0.5">
                更新於{' '}
                {lastRefresh.toLocaleTimeString('zh-TW', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'Asia/Taipei',
                })}
              </p>
            )}
          </div>
          <button
            onClick={load}
            className="min-h-[44px] px-4 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold active:bg-stone-200 transition-colors"
          >
            重新整理
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="今日總數" value={total} color="stone" />
          <StatCard label="已完成" value={completed} color="emerald" />
          <StatCard
            label="逾時"
            value={overtimeCount}
            color={overtimeCount > 0 ? 'red' : 'stone'}
          />
        </div>

        {/* Overtime banner */}
        {hasOvertime && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 flex items-center gap-3">
            <span className="text-2xl animate-bounce">🚨</span>
            <div>
              <p className="font-bold text-red-800">
                有 {overtimeCount} 隻寵物已逾時等待接送
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                請立即通知客戶來店領取，並確認是否需計收逾時費
              </p>
            </div>
          </div>
        )}

        {/* Card list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-stone-100 animate-pulse"
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white px-6 py-16 flex flex-col items-center gap-2 text-stone-400">
            <span className="text-4xl">🐾</span>
            <p className="text-base font-semibold">今日尚無服務</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {cards.map((card) => (
              <ServiceCardItem
                key={card.appointmentId}
                card={card}
                now={now}
                onAction={load}
              />
            ))}
          </div>
        )}
      </div>
    </PosLayout>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'stone' | 'emerald' | 'red'
}) {
  const colorMap = {
    stone: 'bg-white border-stone-200 text-stone-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div
      className={[
        'rounded-2xl border-2 px-4 py-3 flex flex-col items-center gap-1',
        colorMap[color],
      ].join(' ')}
    >
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}
