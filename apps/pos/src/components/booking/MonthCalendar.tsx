'use client'

import { useState } from 'react'

const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function getTaipeiDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(
    new Date(),
  )
}

interface MonthCalendarProps {
  value: string
  onChange: (d: string) => void
  disablePast?: boolean
}

export function MonthCalendar({
  value,
  onChange,
  disablePast = true,
}: MonthCalendarProps) {
  const today = getTaipeiDate()
  const [ym, setYm] = useState(value.slice(0, 7) || today.slice(0, 7))
  const [year, month] = ym.split('-').map(Number)

  const firstDow = new Date(`${ym}-01T12:00:00+08:00`).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<number | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function nav(delta: number) {
    const d = new Date(`${ym}-01T12:00:00+08:00`)
    d.setMonth(d.getMonth() + delta)
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 active:bg-stone-200 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-stone-800">
          {year} 年 {month} 月
        </span>
        <button
          type="button"
          onClick={() => nav(1)}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 active:bg-stone-200 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-stone-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${ym}-${String(day).padStart(2, '0')}`
          const past = disablePast && dateStr < today
          const selected = dateStr === value
          const isToday = dateStr === today

          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => onChange(dateStr)}
              className={[
                'flex aspect-square w-full items-center justify-center rounded-full text-sm transition-colors',
                selected
                  ? 'bg-emerald-700 font-bold text-white'
                  : isToday
                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                    : past
                      ? 'cursor-not-allowed text-stone-300'
                      : 'text-stone-700 hover:bg-stone-100',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
