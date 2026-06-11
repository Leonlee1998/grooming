'use client'

import { useState, useEffect } from 'react'
import {
  searchCustomerByPhone,
  getPetsByCustomer,
} from '@/app/(grooming)/checkin/actions'
import { getAvailableSlots } from '@/app/(booking)/schedule/actions'
import type {
  BookingFormData,
  TimeSlot,
} from '@/app/(booking)/schedule/actions'

// ─── Constants & helpers ──────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '美甲',
  SPA: 'SPA',
  OTHER: '其他',
}

const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function getTaipeiDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(
    new Date(),
  )
}

export function addMinutes(date: string, time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function buildIso(date: string, time: string) {
  return `${date}T${time}:00+08:00`
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export type CustomerInfo = { id: string; name: string; phone: string }
export type PetInfo = {
  id: string
  name: string
  species: string
  breed: string | null
  weightKg: string | null
}

// ─── MonthCalendar ────────────────────────────────────────────────────────────

export function MonthCalendar({
  value,
  onChange,
}: {
  value: string
  onChange: (d: string) => void
}) {
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
          const past = dateStr < today
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

// ─── Step1Content: 客戶搜尋 + 寵物選擇 ────────────────────────────────────────

export function Step1Content({
  customer,
  petId,
  onCustomerChange,
  onPetChange,
  onNotFound,
}: {
  customer: CustomerInfo | null
  petId: string
  onCustomerChange: (c: CustomerInfo | null) => void
  onPetChange: (id: string, name: string, species: string) => void
  onNotFound?: (phone: string) => void
}) {
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pets, setPets] = useState<PetInfo[]>([])
  const [petsLoading, setPetsLoading] = useState(false)

  useEffect(() => {
    if (!customer) {
      setPets([])
      return
    }
    setPetsLoading(true)
    getPetsByCustomer(customer.id)
      .then((result) => {
        if (result.ok) setPets(result.data)
      })
      .finally(() => setPetsLoading(false))
  }, [customer])

  async function handleSearch() {
    setSearchError(null)
    setSearching(true)
    const result = await searchCustomerByPhone(phone)
    setSearching(false)
    if (!result.ok) {
      setSearchError(result.error)
      return
    }
    if (!result.data) {
      setSearchError('查無此電話的客戶')
      onNotFound?.(phone)
      return
    }
    onCustomerChange(result.data)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-stone-700">
          客戶手機號碼
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="09xx-xxx-xxx"
            className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || phone.length < 8}
            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            {searching ? '搜尋…' : '搜尋'}
          </button>
        </div>
        {searchError && (
          <p className="mt-1.5 text-sm text-red-600">{searchError}</p>
        )}
      </div>

      {customer && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-900">{customer.name}</p>
              <p className="text-sm text-stone-500">{customer.phone}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onCustomerChange(null)
                setPets([])
              }}
              className="text-sm text-stone-400 hover:text-stone-600"
            >
              重新搜尋
            </button>
          </div>
        </div>
      )}

      {customer && (
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-700">選擇寵物</p>
          {petsLoading ? (
            <p className="text-sm text-stone-400">載入中…</p>
          ) : pets.length === 0 ? (
            <p className="text-sm text-stone-400">此客戶尚無寵物資料</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => onPetChange(pet.id, pet.name, pet.species)}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    petId === pet.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-200 bg-white hover:border-stone-300',
                  ].join(' ')}
                >
                  <span className="text-2xl">
                    {pet.species === 'DOG' ? '🐶' : '🐱'}
                  </span>
                  <div>
                    <p className="font-semibold text-stone-900">{pet.name}</p>
                    <p className="text-xs text-stone-500">
                      {pet.breed ?? (pet.species === 'DOG' ? '狗' : '貓')}
                      {pet.weightKg ? ` · ${pet.weightKg} kg` : ''}
                    </p>
                  </div>
                  {petId === pet.id && (
                    <span className="ml-auto text-emerald-600">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step2Content: 服務 + 美容師 + 日期 + 時段 ────────────────────────────────

export function Step2Content({
  formData,
  selectedServiceIds,
  staffId,
  date,
  time,
  pickupTime,
  estimatedMinutes,
  onToggleService,
  onStaffChange,
  onDateChange,
  onTimeChange,
  onPickupTimeChange,
}: {
  formData: BookingFormData
  selectedServiceIds: string[]
  staffId: string
  date: string
  time: string
  pickupTime: string
  estimatedMinutes: number
  onToggleService: (id: string) => void
  onStaffChange: (id: string) => void
  onDateChange: (d: string) => void
  onTimeChange: (t: string) => void
  onPickupTimeChange: (t: string) => void
}) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const grouped = formData.services.reduce<
    Record<string, typeof formData.services>
  >((acc, s) => {
    const cat = CATEGORY_LABELS[s.category] ?? s.category
    acc[cat] = [...(acc[cat] ?? []), s]
    return acc
  }, {})

  useEffect(() => {
    if (!staffId || !date) {
      setSlots([])
      return
    }
    setSlotsLoading(true)
    getAvailableSlots(staffId, date)
      .then(setSlots)
      .finally(() => setSlotsLoading(false))
  }, [staffId, date])

  useEffect(() => {
    if (time && estimatedMinutes > 0) {
      const pickup = addMinutes(date, time, estimatedMinutes + 30)
      onPickupTimeChange(pickup)
    }
  }, [date, time, estimatedMinutes, onPickupTimeChange])

  return (
    <div className="flex flex-col gap-6">
      {/* 服務選擇 */}
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">
          服務項目（可多選）
        </p>
        {Object.entries(grouped).map(([cat, services]) => (
          <div key={cat} className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
              {cat}
            </p>
            <div className="flex flex-col gap-1.5">
              {services.map((s) => {
                const checked = selectedServiceIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                      checked
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-stone-200 bg-white hover:border-stone-300',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleService(s.id)}
                      className="h-5 w-5 rounded accent-emerald-700"
                    />
                    <span className="flex-1 text-sm font-medium text-stone-800">
                      {s.name}
                    </span>
                    <span className="text-xs text-stone-400">
                      NT${s.basePrice.toLocaleString()} · {s.estimatedMinutes}{' '}
                      分
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {estimatedMinutes > 0 && (
          <p className="mt-1 text-right text-sm text-emerald-700 font-medium">
            預估總時間：
            {estimatedMinutes >= 60
              ? `${Math.floor(estimatedMinutes / 60)} 小時 ${estimatedMinutes % 60 ? (estimatedMinutes % 60) + ' 分' : ''}`
              : `${estimatedMinutes} 分`}
          </p>
        )}
      </div>

      {/* 美容師 */}
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">美容師</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStaffChange('')}
            className={[
              'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
              staffId === ''
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 text-stone-600 hover:border-stone-300',
            ].join(' ')}
          >
            不指定
          </button>
          {formData.staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onStaffChange(s.id)}
              className={[
                'rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                staffId === s.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-stone-200 text-stone-600 hover:border-stone-300',
              ].join(' ')}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 日曆 */}
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">預約日期</p>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <MonthCalendar value={date} onChange={onDateChange} />
        </div>
      </div>

      {/* 時段選擇 */}
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">
          預約時間
          {!staffId || !date ? (
            <span className="ml-2 font-normal text-stone-400">
              （請先選擇美容師與日期）
            </span>
          ) : null}
        </p>
        {!staffId || !date ? null : slotsLoading ? (
          <p className="text-sm text-stone-400">載入時段中…</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => onTimeChange(slot.time)}
                className={[
                  'rounded-lg py-2.5 text-sm font-medium transition-colors',
                  !slot.available
                    ? 'bg-stone-100 text-stone-300 cursor-not-allowed line-through'
                    : time === slot.time
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'border border-stone-200 text-stone-700 hover:border-emerald-400 hover:bg-emerald-50',
                ].join(' ')}
              >
                {slot.time}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 接回時間 */}
      {time && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-stone-700">
            接回時間
            <span className="ml-2 font-normal text-xs text-stone-400">
              （可手動調整）
            </span>
          </p>
          <input
            type="time"
            value={pickupTime}
            onChange={(e) => onPickupTimeChange(e.target.value)}
            className="w-40 rounded-xl border border-stone-300 px-4 py-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      )}
    </div>
  )
}

// ─── Step3Content: 確認摘要 + 備注 ───────────────────────────────────────────

export function Step3Content({
  customer,
  petName,
  petSpecies,
  selectedServiceIds,
  formData,
  staffId,
  date,
  time,
  pickupTime,
  estimatedMinutes,
  notes,
  onNotesChange,
}: {
  customer: CustomerInfo
  petName: string
  petSpecies: string
  selectedServiceIds: string[]
  formData: BookingFormData
  staffId: string
  date: string
  time: string
  pickupTime: string
  estimatedMinutes: number
  notes: string
  onNotesChange: (n: string) => void
}) {
  const selectedServices = formData.services.filter((s) =>
    selectedServiceIds.includes(s.id),
  )
  const staff = formData.staff.find((s) => s.id === staffId)
  const dateDisplay = new Date(`${date}T12:00:00+08:00`).toLocaleDateString(
    'zh-TW',
    {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  )

  function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between py-2.5">
        <span className="text-sm text-stone-500">{label}</span>
        <span className="text-sm font-medium text-stone-900">{value}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 divide-y divide-stone-100">
        <SummaryRow
          label="客戶"
          value={`${customer.name}（${customer.phone}）`}
        />
        <SummaryRow
          label="寵物"
          value={`${petName}（${petSpecies === 'DOG' ? '狗' : '貓'}）`}
        />
        <SummaryRow label="美容師" value={staff?.name ?? '不指定'} />
        <SummaryRow label="預約日期" value={dateDisplay} />
        <SummaryRow label="開始時間" value={time} />
        <SummaryRow
          label="預計完成"
          value={addMinutes(date, time, estimatedMinutes)}
        />
        <SummaryRow label="接回時間" value={pickupTime} />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">服務項目</p>
        <div className="rounded-xl border border-stone-200 bg-white px-4 divide-y divide-stone-100">
          {selectedServices.map((s) => (
            <div key={s.id} className="flex justify-between py-2.5">
              <span className="text-sm text-stone-800">{s.name}</span>
              <span className="text-sm text-stone-500">
                NT${s.basePrice.toLocaleString()} · {s.estimatedMinutes} 分
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-stone-700">
          客戶備注（選填）
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="例：對剪刀敏感，請多注意"
          className="w-full resize-none rounded-xl border border-stone-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>
    </div>
  )
}
