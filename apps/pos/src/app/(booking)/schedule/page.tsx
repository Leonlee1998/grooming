'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { PosLayout } from '@/components/layout/PosLayout'
import { BookingDrawer } from '@/components/booking/BookingDrawer'
import { getSchedule } from './actions'
import type { AppointmentWithDetails, ScheduleData } from './actions'

// ─── Grid constants ───────────────────────────────────────────────────────────

const SLOT_W = 80 // px per 30-min slot
const SLOT_MIN = 30
const HOUR_START = 8 // 08:00
const HOUR_END = 20 // 20:00（不含）
const STAFF_COL_W = 148 // px 美容師欄寬
const ROW_H = 88 // px 每列高度
const HDR_H = 44 // px 時間標題列高度

const GRID_START_MIN = HOUR_START * 60 // 480
const GRID_END_MIN = HOUR_END * 60 // 1200
const TOTAL_SLOTS = (GRID_END_MIN - GRID_START_MIN) / SLOT_MIN // 24
const TOTAL_GRID_W = TOTAL_SLOTS * SLOT_W // 1920

const TIME_SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
  const min = GRID_START_MIN + i * SLOT_MIN
  const h = Math.floor(min / 60)
  const m = min % 60
  return {
    min,
    label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    isHour: m === 0,
  }
})

const UNASSIGNED_ID = '__unassigned__'

// ─── Status config ────────────────────────────────────────────────────────────

type Status = AppointmentWithDetails['status']

const STATUS_CFG: Record<
  Status,
  {
    blockBg: string
    blockBorder: string
    blockText: string
    badge: string
    label: string
  }
> = {
  PENDING: {
    blockBg: 'bg-amber-50',
    blockBorder: 'border-l-amber-400',
    blockText: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-800',
    label: '待確認',
  },
  CONFIRMED: {
    blockBg: 'bg-blue-50',
    blockBorder: 'border-l-blue-500',
    blockText: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-800',
    label: '已確認',
  },
  IN_PROGRESS: {
    blockBg: 'bg-emerald-50',
    blockBorder: 'border-l-emerald-500',
    blockText: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800',
    label: '進行中',
  },
  COMPLETED: {
    blockBg: 'bg-stone-100',
    blockBorder: 'border-l-stone-400',
    blockText: 'text-stone-500',
    badge: 'bg-stone-200 text-stone-600',
    label: '已完成',
  },
  CANCELLED: {
    blockBg: 'bg-red-50 opacity-50',
    blockBorder: 'border-l-red-300',
    blockText: 'text-red-400',
    badge: 'bg-red-100 text-red-600',
    label: '已取消',
  },
  NO_SHOW: {
    blockBg: 'bg-red-50 opacity-50',
    blockBorder: 'border-l-red-300',
    blockText: 'text-red-400',
    badge: 'bg-red-100 text-red-600',
    label: '未到',
  },
}

const SPECIES_LABEL: Record<string, string> = { DOG: '狗', CAT: '貓' }
const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: '現場',
  ONLINE: '線上預約',
  LINE: 'LINE 預約',
  POS_ONSITE: '現場預約',
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTaipeiDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00+08:00`)
  d.setDate(d.getDate() + n)
  return getTaipeiDate(d)
}

function fmtDateDisplay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+08:00`)
  return d.toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins} 分`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`
}

// ─── Block position ───────────────────────────────────────────────────────────

function getBlockPos(
  appt: AppointmentWithDetails,
): { left: number; width: number } | null {
  const d = new Date(appt.scheduledAt)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const startMin = h * 60 + m
  const endMin = startMin + appt.estimatedDuration

  // 完全在格子外
  if (startMin >= GRID_END_MIN || endMin <= GRID_START_MIN) return null

  const clampedStart = Math.max(startMin, GRID_START_MIN)
  const clampedEnd = Math.min(endMin, GRID_END_MIN)
  const left = ((clampedStart - GRID_START_MIN) / SLOT_MIN) * SLOT_W
  const width = ((clampedEnd - clampedStart) / SLOT_MIN) * SLOT_W

  return { left, width }
}

function getNowLeft(): number | null {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const totalMin = h * 60 + m
  if (totalMin < GRID_START_MIN || totalMin > GRID_END_MIN) return null
  return ((totalMin - GRID_START_MIN) / SLOT_MIN) * SLOT_W
}

// ─── AppointmentBlock ─────────────────────────────────────────────────────────

function AppointmentBlock({
  appt,
  onClick,
  isSelected,
}: {
  appt: AppointmentWithDetails
  onClick: () => void
  isSelected: boolean
}) {
  const pos = getBlockPos(appt)
  if (!pos) return null

  const cfg = STATUS_CFG[appt.status]
  const narrow = pos.width < 100

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        left: pos.left + 2,
        width: pos.width - 4,
        top: 6,
        bottom: 6,
      }}
      className={[
        'rounded border border-stone-200 border-l-4 px-1.5 overflow-hidden text-left cursor-pointer',
        'hover:brightness-95 active:brightness-90 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1',
        cfg.blockBg,
        cfg.blockBorder,
        cfg.blockText,
        isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : '',
      ].join(' ')}
      title={`${appt.customer.name} · ${appt.pet.name}`}
    >
      {narrow ? (
        <span className="text-[10px] font-bold leading-tight truncate block">
          {appt.pet.name}
        </span>
      ) : (
        <>
          <p className="text-xs font-semibold leading-snug truncate">
            {appt.customer.name} · {appt.pet.name}
          </p>
          {pos.width >= 160 && appt.order?.items[0] && (
            <p className="text-[10px] leading-snug truncate opacity-70">
              {appt.order.items[0].serviceName}
              {appt.order.items.length > 1
                ? ` +${appt.order.items.length - 1}`
                : ''}
            </p>
          )}
          <p className="text-[10px] leading-snug opacity-60">
            {fmtTime(appt.scheduledAt)}
          </p>
        </>
      )}
    </button>
  )
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

function DetailPanel({
  appt,
  onClose,
}: {
  appt: AppointmentWithDetails | null
  onClose: () => void
}) {
  const show = appt !== null

  return (
    <>
      {/* 背景遮罩 */}
      {show && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* 側邊面板 */}
      <div
        className={[
          'fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl border-l border-stone-200',
          'flex flex-col transform transition-transform duration-200 ease-out',
          show ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* 面板標題 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-900 text-base">預約詳情</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-stone-100 active:bg-stone-200 transition-colors text-stone-500"
            aria-label="關閉"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {appt && (
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {/* 狀態 */}
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CFG[appt.status].badge}`}
              >
                {STATUS_CFG[appt.status].label}
              </span>
              <span className="text-xs text-stone-400">
                {SOURCE_LABEL[appt.source]}
              </span>
              <span className="ml-auto text-xs text-stone-400 font-mono">
                #{appt.id.slice(-6).toUpperCase()}
              </span>
            </div>

            {/* 客戶資訊 */}
            <DetailSection title="客戶">
              <DetailRow label="姓名" value={appt.customer.name} />
              <DetailRow label="手機" value={appt.customer.phone} />
            </DetailSection>

            {/* 寵物資訊 */}
            <DetailSection title="寵物">
              <DetailRow label="名字" value={appt.pet.name} />
              <DetailRow
                label="品種"
                value={`${SPECIES_LABEL[appt.pet.species] ?? appt.pet.species}${appt.pet.breed ? ` · ${appt.pet.breed}` : ''}`}
              />
            </DetailSection>

            {/* 時間資訊 */}
            <DetailSection title="時間安排">
              <DetailRow label="開始時間" value={fmtTime(appt.scheduledAt)} />
              <DetailRow
                label="預估時間"
                value={fmtMins(appt.estimatedDuration)}
              />
              {appt.pickupDeadlineAt && (
                <DetailRow
                  label="接回時間"
                  value={fmtTime(appt.pickupDeadlineAt)}
                />
              )}
              {appt.actualStartAt && (
                <DetailRow
                  label="實際開始"
                  value={fmtTime(appt.actualStartAt)}
                />
              )}
              {appt.actualEndAt && (
                <DetailRow label="實際結束" value={fmtTime(appt.actualEndAt)} />
              )}
            </DetailSection>

            {/* 服務明細 */}
            {appt.order && appt.order.items.length > 0 && (
              <DetailSection title="服務項目">
                {appt.order.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between py-1.5 border-b border-stone-50 last:border-0"
                  >
                    <span className="text-sm text-stone-700">
                      {item.serviceName}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-sm text-stone-400">
                        ×{item.quantity}
                      </span>
                    )}
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-semibold">
                  <span className="text-sm text-stone-600">總計</span>
                  <span className="text-sm text-emerald-700">
                    ${appt.order.totalAmount}
                  </span>
                </div>
              </DetailSection>
            )}

            {/* 備注 */}
            {appt.notes && (
              <DetailSection title="備注">
                <p className="text-sm text-stone-600 leading-relaxed">
                  {appt.notes}
                </p>
              </DetailSection>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="rounded-xl bg-stone-50 px-3 divide-y divide-stone-100">
        {children}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-xs text-stone-400 shrink-0">{label}</span>
      <span className="text-sm text-stone-800 font-medium text-right ml-2">
        {value}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const today = getTaipeiDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [staffFilter, setStaffFilter] = useState<string>('') // '' = 全部
  const [selectedAppt, setSelectedAppt] =
    useState<AppointmentWithDetails | null>(null)
  const [nowLeft, setNowLeft] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['schedule', selectedDate, staffFilter],
    queryFn: () => getSchedule(selectedDate, staffFilter || undefined),
    placeholderData: keepPreviousData,
  })
  const scheduleData: ScheduleData = data ?? { appointments: [], staff: [] }

  useEffect(() => {
    setSelectedAppt(null)
  }, [selectedDate, staffFilter])

  // 目前時間指示器（每分鐘更新）
  useEffect(() => {
    function update() {
      setNowLeft(selectedDate === today ? getNowLeft() : null)
    }
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [selectedDate, today])

  function handleDateChange(n: number) {
    setSelectedDate((d) => addDays(d, n))
  }

  // 組合要顯示的列（active staff + 可能有的「未指定」列）
  const unassignedAppts = scheduleData.appointments.filter((a) => !a.staffId)
  const rows: Array<{ id: string; name: string; isUnassigned?: boolean }> = [
    ...scheduleData.staff,
    ...(unassignedAppts.length > 0
      ? [{ id: UNASSIGNED_ID, name: '未指定美容師', isUnassigned: true }]
      : []),
  ]

  const appointmentsForRow = (rowId: string) =>
    rowId === UNASSIGNED_ID
      ? unassignedAppts
      : scheduleData.appointments.filter((a) => a.staffId === rowId)

  return (
    <PosLayout>
      <div className="flex flex-col gap-4 h-full">
        {/* ── 工具列 ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 日期切換 */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white overflow-hidden">
            <button
              onClick={() => handleDateChange(-1)}
              className="w-11 h-11 flex items-center justify-center text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              aria-label="前一天"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => setSelectedDate(today)}
              className={[
                'px-3 h-11 text-sm font-medium transition-colors',
                selectedDate === today
                  ? 'text-emerald-700 font-semibold'
                  : 'text-stone-600 hover:text-stone-900',
              ].join(' ')}
            >
              {selectedDate === today ? '今日' : '回今日'}
            </button>
            <button
              onClick={() => handleDateChange(1)}
              className="w-11 h-11 flex items-center justify-center text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              aria-label="後一天"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* 日期顯示 */}
          <span className="text-base font-semibold text-stone-800">
            {fmtDateDisplay(selectedDate)}
          </span>

          {/* loading 指示 */}
          {isFetching && (
            <svg
              className="w-5 h-5 animate-spin text-stone-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}

          {/* 美容師篩選 */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="ml-auto h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="">全部美容師</option>
            {scheduleData.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* 新增預約 */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="h-11 px-5 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-800 active:bg-emerald-900 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            新增預約
          </button>
        </div>

        {/* ── 時間表格 ─────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="overflow-x-auto rounded-xl border border-stone-200 bg-white flex-1"
          style={{ minHeight: HDR_H + ROW_H }}
        >
          <div
            className="relative"
            style={{ minWidth: STAFF_COL_W + TOTAL_GRID_W }}
          >
            {/* ── 標題列 ──────────────────────────────────────────────── */}
            <div
              className="flex border-b border-stone-200 bg-stone-50 sticky top-0 z-20"
              style={{ height: HDR_H }}
            >
              {/* 左上角 */}
              <div
                className="sticky left-0 z-30 bg-stone-50 border-r border-stone-200 flex items-center justify-center flex-shrink-0"
                style={{ width: STAFF_COL_W }}
              >
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                  美容師
                </span>
              </div>

              {/* 時間格 */}
              <div className="flex flex-shrink-0">
                {TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.min}
                    className={[
                      'flex items-end pb-1.5 justify-start border-r border-stone-200 flex-shrink-0',
                      slot.isHour ? 'border-r-stone-300' : 'border-r-stone-100',
                    ].join(' ')}
                    style={{ width: SLOT_W }}
                  >
                    <span
                      className={[
                        'pl-1.5 text-[11px]',
                        slot.isHour
                          ? 'font-semibold text-stone-600'
                          : 'text-stone-400',
                      ].join(' ')}
                    >
                      {slot.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 無資料提示 ───────────────────────────────────────────── */}
            {!isFetching && rows.length === 0 && (
              <div
                className="flex items-center justify-center text-stone-400 text-sm"
                style={{ height: ROW_H * 2 }}
              >
                目前沒有排班資料，請先新增美容師
              </div>
            )}

            {/* ── 美容師列 ─────────────────────────────────────────────── */}
            {rows.map((row, rowIdx) => {
              const rowAppts = appointmentsForRow(row.id)
              const isLast = rowIdx === rows.length - 1

              return (
                <div
                  key={row.id}
                  className={[
                    'flex',
                    !isLast ? 'border-b border-stone-100' : '',
                  ].join(' ')}
                  style={{ height: ROW_H }}
                >
                  {/* 美容師名稱（sticky left）*/}
                  <div
                    className={[
                      'sticky left-0 z-10 bg-white border-r border-stone-200',
                      'flex flex-col items-start justify-center px-3 flex-shrink-0',
                      row.isUnassigned ? 'bg-stone-50' : '',
                    ].join(' ')}
                    style={{ width: STAFF_COL_W }}
                  >
                    <span
                      className={[
                        'text-sm font-semibold leading-tight',
                        row.isUnassigned ? 'text-stone-400' : 'text-stone-800',
                      ].join(' ')}
                    >
                      {row.name}
                    </span>
                    <span className="text-xs text-stone-400 mt-0.5">
                      {rowAppts.length > 0
                        ? `${rowAppts.length} 件預約`
                        : '無預約'}
                    </span>
                  </div>

                  {/* 預約格（相對定位容器）*/}
                  <div
                    className="relative flex-shrink-0"
                    style={{ width: TOTAL_GRID_W }}
                  >
                    {/* 背景格線 */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {TIME_SLOTS.map((slot) => (
                        <div
                          key={slot.min}
                          className={[
                            'h-full flex-shrink-0 border-r',
                            slot.isHour
                              ? 'border-stone-200 bg-white'
                              : 'border-stone-100 bg-white',
                          ].join(' ')}
                          style={{ width: SLOT_W }}
                        />
                      ))}
                    </div>

                    {/* 目前時間指示線 */}
                    {nowLeft !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                        style={{ left: nowLeft }}
                      >
                        {rowIdx === 0 && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400" />
                        )}
                      </div>
                    )}

                    {/* 預約方塊 */}
                    {rowAppts.map((appt) => (
                      <AppointmentBlock
                        key={appt.id}
                        appt={appt}
                        isSelected={selectedAppt?.id === appt.id}
                        onClick={() =>
                          setSelectedAppt((prev) =>
                            prev?.id === appt.id ? null : appt,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* 今日無預約提示 */}
            {!isFetching &&
              rows.length > 0 &&
              scheduleData.appointments.length === 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ top: HDR_H }}
                >
                  <span className="text-stone-300 text-sm select-none">
                    {selectedDate === today ? '今日' : ''}尚無預約
                  </span>
                </div>
              )}
          </div>
        </div>

        {/* 圖例 */}
        <div className="flex items-center gap-4 flex-wrap pb-2">
          {(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'PENDING'] as const).map(
            (s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-sm border-l-2 ${STATUS_CFG[s].blockBg.split(' ')[0]} ${STATUS_CFG[s].blockBorder}`}
                />
                <span className="text-xs text-stone-500">
                  {STATUS_CFG[s].label}
                </span>
              </div>
            ),
          )}
          {nowLeft !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-red-400 rounded" />
              <span className="text-xs text-stone-500">現在時間</span>
            </div>
          )}
        </div>
      </div>

      {/* 側邊詳情面板 */}
      <DetailPanel appt={selectedAppt} onClose={() => setSelectedAppt(null)} />

      {/* 新增預約 Drawer */}
      <BookingDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialDate={selectedDate}
      />
    </PosLayout>
  )
}
