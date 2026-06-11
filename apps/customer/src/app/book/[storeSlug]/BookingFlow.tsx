'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ServicePublic,
  SlotInfo,
  StorePublic,
  SubmitBookingInput,
} from './actions'
import { getAvailableSlots, submitBooking } from './actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  BATH: '洗護美容',
  HAIRCUT: '剪毛造型',
  NAIL: '美甲磨爪',
  SPA: 'SPA 護理',
  OTHER: '其他服務',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// ─── Info step form state ──────────────────────────────────────────────────────

interface InfoState {
  ownerName: string
  ownerPhone: string
  petName: string
  petSpecies: 'DOG' | 'CAT'
  petBreed: string
  petWeightKg: string
  isAggressive: boolean
  hasDisease: boolean
  diseaseNotes: string
  isDewormed: boolean
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function StepProgressBar({
  current,
  total,
}: {
  current: number
  total: number
}) {
  return (
    <div className="flex items-center gap-1 px-4 pt-3 pb-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
            i < current ? 'bg-brand-700' : 'bg-stone-200'
          }`}
        />
      ))}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-brand-700 mb-4 active:opacity-70"
    >
      ← 返回
    </button>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-stone-100 px-4 py-3 flex-shrink-0">
      {children}
    </div>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 rounded-xl bg-brand-700 text-white text-base font-medium disabled:opacity-40 active:scale-[0.98] transition-transform"
    >
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sublabel?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-3 text-left"
    >
      <div>
        <span className="text-[15px] text-brand-900">{label}</span>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <div
        className={`relative flex-shrink-0 ml-3 w-12 h-7 rounded-full transition-colors ${
          checked ? 'bg-brand-700' : 'bg-stone-200'
        }`}
      >
        <div
          className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateList() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const value = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    const [, , dayStr] = value.split('-')
    return {
      value,
      day: String(parseInt(dayStr)),
      weekday: WEEKDAYS[d.getDay()],
      isToday: i === 0,
    }
  })
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const time = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${date} ${time}`
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-sm text-gray-400 w-12 flex-shrink-0 pt-px">
        {label}
      </span>
      <span className="text-sm text-brand-900 flex-1 leading-relaxed">
        {value}
      </span>
    </div>
  )
}

// ─── Step 1: Services ─────────────────────────────────────────────────────────

function StepServices({
  services,
  selectedIds,
  onToggle,
  onNext,
}: {
  services: ServicePublic[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onNext: () => void
}) {
  const categories = [...new Set(services.map((s) => s.category))]
  const [activeTab, setActiveTab] = useState(categories[0] ?? '')
  const visible = services.filter((s) => s.category === activeTab)
  const totalMin = services
    .filter((s) => selectedIds.includes(s.id))
    .reduce((sum, s) => sum + s.estimatedMinutes, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-lg font-bold text-brand-900">選擇服務</h2>
        <p className="text-xs text-gray-400 mt-0.5">可複選多項</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2 flex-shrink-0 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveTab(cat)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === cat
                ? 'bg-brand-700 text-white'
                : 'bg-stone-100 text-brand-700'
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="px-4 overflow-y-auto flex-1 space-y-3 pb-3">
        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            此分類暫無服務
          </p>
        )}
        {visible.map((svc) => {
          const sel = selectedIds.includes(svc.id)
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => onToggle(svc.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                sel
                  ? 'border-brand-700 bg-brand-50'
                  : 'border-stone-100 bg-white active:scale-[0.98]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-900 text-[15px] leading-snug">
                    {svc.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    約 {svc.estimatedMinutes} 分鐘
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-brand-700">
                    NT${svc.basePrice.toLocaleString()}
                  </p>
                  {sel && (
                    <span className="text-[11px] text-brand-700 font-semibold">
                      ✓ 已選
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <BottomBar>
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>已選 {selectedIds.length} 項</span>
          {totalMin > 0 && <span>預估約 {totalMin} 分鐘</span>}
        </div>
        <PrimaryBtn onClick={onNext} disabled={selectedIds.length === 0}>
          繼續選日期 →
        </PrimaryBtn>
      </BottomBar>
    </div>
  )
}

// ─── Step 2: Date ─────────────────────────────────────────────────────────────

function StepDate({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: string
  onSelect: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const dates = getDateList()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-3 flex-shrink-0">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold text-brand-900">選擇日期</h2>
        <p className="text-xs text-gray-400 mt-0.5">可預約最近 14 天</p>
      </div>

      {/* Horizontal date strip */}
      <div className="flex gap-2.5 px-4 overflow-x-auto pb-4 flex-shrink-0 scrollbar-hide">
        {dates.map((d) => {
          const isSel = selected === d.value
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onSelect(d.value)}
              className={`flex-shrink-0 flex flex-col items-center w-[3.25rem] py-3 rounded-xl border-2 transition-all ${
                isSel
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-stone-100 bg-white text-brand-900 active:scale-95'
              }`}
            >
              <span
                className={`text-[10px] mb-1 ${isSel ? 'text-brand-100' : 'text-gray-400'}`}
              >
                {d.isToday ? '今天' : `週${d.weekday}`}
              </span>
              <span className="text-xl font-bold leading-none">{d.day}</span>
            </button>
          )
        })}
      </div>

      {/* Selected display */}
      {selected && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-sm text-brand-700 font-medium bg-brand-50 rounded-xl px-4 py-3 text-center">
            已選：{selected.replace(/-/g, '/')}
          </p>
        </div>
      )}

      <BottomBar>
        <PrimaryBtn onClick={onNext} disabled={!selected}>
          {selected ? '繼續選時段 →' : '請先選擇日期'}
        </PrimaryBtn>
      </BottomBar>
    </div>
  )
}

// ─── Step 3: Slot ─────────────────────────────────────────────────────────────

function StepSlot({
  storeId,
  selectedDate,
  selectedSlot,
  onSelect,
  onNext,
  onBack,
}: {
  storeId: string
  selectedDate: string
  selectedSlot: string
  onSelect: (slot: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setSlots([])
    let cancelled = false
    getAvailableSlots(storeId, selectedDate).then((data) => {
      if (!cancelled) {
        setSlots(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [storeId, selectedDate])

  const hasCapacity = slots.some((s) => s.totalCapacity > 0)
  const allFull = hasCapacity && slots.every((s) => s.availableCount === 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-3 flex-shrink-0">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold text-brand-900">選擇時段</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {selectedDate.replace(/-/g, '/')} 可預約時段
        </p>
      </div>

      <div className="px-4 flex-1 overflow-y-auto pb-3">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin mb-3" />
            <span className="text-sm">載入時段中…</span>
          </div>
        )}

        {/* No staff */}
        {!loading && !hasCapacity && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">😴</p>
            <p className="font-semibold text-brand-900 text-[15px]">
              今日未排班
            </p>
            <p className="text-sm mt-1">請選擇其他日期</p>
          </div>
        )}

        {/* All slots full */}
        {!loading && allFull && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📆</p>
            <p className="font-semibold text-brand-900 text-[15px]">
              今日已無空位
            </p>
            <p className="text-sm mt-1">請選擇其他日期</p>
          </div>
        )}

        {/* Slot grid */}
        {!loading && hasCapacity && !allFull && (
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot) => {
              const isFull = slot.availableCount === 0
              const isSel = selectedSlot === slot.slotTime
              return (
                <button
                  key={slot.slotTime}
                  type="button"
                  disabled={isFull}
                  onClick={() => onSelect(slot.slotTime)}
                  className={`flex flex-col items-center py-3.5 rounded-xl border-2 transition-all ${
                    isFull
                      ? 'border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed'
                      : isSel
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-stone-100 bg-white text-brand-900 active:scale-95'
                  }`}
                >
                  <span className="text-[15px] font-bold leading-none">
                    {fmtTime(slot.slotTime)}
                  </span>
                  <span
                    className={`text-[11px] mt-1 ${isSel ? 'text-brand-100' : ''}`}
                  >
                    {isFull ? '已滿' : `剩 ${slot.availableCount} 位`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BottomBar>
        <PrimaryBtn onClick={onNext} disabled={!selectedSlot || loading}>
          {selectedSlot ? '繼續填寫資料 →' : '請先選擇時段'}
        </PrimaryBtn>
      </BottomBar>
    </div>
  )
}

// ─── Step 4: Info ─────────────────────────────────────────────────────────────

function StepInfo({
  info,
  onChange,
  onNext,
  onBack,
}: {
  info: InfoState
  onChange: <K extends keyof InfoState>(k: K, v: InfoState[K]) => void
  onNext: () => void
  onBack: () => void
}) {
  const valid =
    info.ownerName.trim().length > 0 &&
    /^09\d{8}$/.test(info.ownerPhone) &&
    info.petName.trim().length > 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-3 flex-shrink-0">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold text-brand-900">填寫資料</h2>
        <p className="text-xs text-gray-400 mt-0.5">帶 * 為必填</p>
      </div>

      <div className="px-4 pb-4 overflow-y-auto flex-1 space-y-5">
        {/* ── 飼主 ── */}
        <section>
          <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
            飼主資訊
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-1.5">
                姓名 *
              </label>
              <input
                type="text"
                value={info.ownerName}
                onChange={(e) => onChange('ownerName', e.target.value)}
                placeholder="例：王小明"
                className="w-full h-12 px-4 rounded-xl border border-stone-200 text-[15px] bg-white focus:outline-none focus:border-brand-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-1.5">
                手機 *
              </label>
              <input
                type="tel"
                value={info.ownerPhone}
                onChange={(e) =>
                  onChange('ownerPhone', e.target.value.replace(/\D/g, ''))
                }
                placeholder="09xxxxxxxx"
                inputMode="numeric"
                maxLength={10}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 text-[15px] bg-white focus:outline-none focus:border-brand-700"
              />
              {info.ownerPhone.length > 0 &&
                !/^09\d{8}$/.test(info.ownerPhone) && (
                  <p className="text-xs text-red-500 mt-1.5 pl-1">
                    請輸入正確手機號碼（09xxxxxxxx）
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* ── 寵物 ── */}
        <section>
          <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
            寵物資訊
          </p>
          <div className="space-y-3">
            {/* Species */}
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-1.5">
                種類 *
              </label>
              <div className="flex gap-2">
                {(['DOG', 'CAT'] as const).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => onChange('petSpecies', sp)}
                    className={`flex-1 h-12 rounded-xl border-2 text-[15px] font-medium transition-colors ${
                      info.petSpecies === sp
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-stone-100 bg-white text-brand-900'
                    }`}
                  >
                    {sp === 'DOG' ? '🐕 狗' : '🐈 貓'}
                  </button>
                ))}
              </div>
            </div>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-1.5">
                寵物名字 *
              </label>
              <input
                type="text"
                value={info.petName}
                onChange={(e) => onChange('petName', e.target.value)}
                placeholder="例：豆豆"
                className="w-full h-12 px-4 rounded-xl border border-stone-200 text-[15px] bg-white focus:outline-none focus:border-brand-700"
              />
            </div>
            {/* Breed + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-brand-900 mb-1.5">
                  品種（選填）
                </label>
                <input
                  type="text"
                  value={info.petBreed}
                  onChange={(e) => onChange('petBreed', e.target.value)}
                  placeholder="例：貴賓"
                  className="w-full h-12 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-brand-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-900 mb-1.5">
                  體重 kg（選填）
                </label>
                <input
                  type="number"
                  value={info.petWeightKg}
                  onChange={(e) => onChange('petWeightKg', e.target.value)}
                  placeholder="例：3.5"
                  step="0.1"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  className="w-full h-12 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-brand-700"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 健康確認（§4 法規必填）── */}
        <section>
          <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
            健康確認
          </p>
          <p className="text-xs text-gray-400 mt-0.5 mb-3">
            依「犬貓美容服務定型化契約」§4 規定，以下資訊為必填
          </p>
          <div className="divide-y divide-stone-100">
            <Toggle
              checked={info.isAggressive}
              onChange={(v) => onChange('isAggressive', v)}
              label="有攻擊性傾向"
              sublabel="曾咬人或對陌生人/動物有攻擊行為"
            />
            <div>
              <Toggle
                checked={info.hasDisease}
                onChange={(v) => onChange('hasDisease', v)}
                label="有疾病或正在服藥"
              />
              {info.hasDisease && (
                <textarea
                  value={info.diseaseNotes}
                  onChange={(e) => onChange('diseaseNotes', e.target.value)}
                  placeholder="請說明疾病狀況或藥物名稱（例：心臟病、服用利尿劑）"
                  rows={3}
                  className="w-full mt-1 mb-2 p-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-brand-700 resize-none"
                />
              )}
            </div>
            <Toggle
              checked={info.isDewormed}
              onChange={(v) => onChange('isDewormed', v)}
              label="已定期驅蟲"
              sublabel="跳蚤、心絲蟲等"
            />
          </div>
        </section>
      </div>

      <BottomBar>
        <PrimaryBtn onClick={onNext} disabled={!valid}>
          {valid ? '繼續確認預約 →' : '請填寫必填欄位'}
        </PrimaryBtn>
      </BottomBar>
    </div>
  )
}

// ─── Step 5: Sign ─────────────────────────────────────────────────────────────

function StepSign({
  store,
  services,
  selectedServiceIds,
  selectedSlot,
  info,
  submitting,
  error,
  onSubmit,
  onBack,
}: {
  store: StorePublic
  services: ServicePublic[]
  selectedServiceIds: string[]
  selectedSlot: string
  info: InfoState
  submitting: boolean
  error: string | null
  onSubmit: (signOnline: boolean) => void
  onBack: () => void
}) {
  const selected = services.filter((s) => selectedServiceIds.includes(s.id))
  const totalPrice = selected.reduce((sum, s) => sum + s.basePrice, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-3 flex-shrink-0">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold text-brand-900">確認預約</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          確認以下資訊後選擇簽約方式
        </p>
      </div>

      <div className="px-4 pb-4 overflow-y-auto flex-1 space-y-4">
        {/* Summary card */}
        <div className="bg-brand-50 rounded-2xl p-4 space-y-2.5 border border-brand-100">
          <SummaryRow label="店家" value={store.name} />
          <SummaryRow
            label="服務"
            value={selected.map((s) => s.name).join('、') || '（未選擇）'}
          />
          <SummaryRow label="時間" value={fmtDateTime(selectedSlot)} />
          <div className="h-px bg-brand-200" />
          <SummaryRow
            label="飼主"
            value={`${info.ownerName}・${info.ownerPhone}`}
          />
          <SummaryRow
            label="寵物"
            value={[
              `${info.petName}（${info.petSpecies === 'DOG' ? '犬' : '貓'}）`,
              info.petBreed,
              info.petWeightKg ? `${info.petWeightKg} kg` : '',
            ]
              .filter(Boolean)
              .join('・')}
          />
          <div className="h-px bg-brand-200" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">預估費用</span>
            <span className="font-bold text-brand-900">
              NT${totalPrice.toLocaleString()} 起
            </span>
          </div>
          {(info.isAggressive || info.hasDisease) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed">
              ⚠ 請到店時主動告知美容師您寵物的健康狀況
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Contract notice */}
        <p className="text-xs text-gray-400 leading-relaxed">
          依「犬貓美容服務定型化契約」規定，美容前需完成契約簽署。
          您可選擇現在線上簽約，或到店時由工作人員協助完成。
        </p>

        {/* Sign options */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-brand-700 bg-brand-700 text-white transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-2xl flex-shrink-0">📱</span>
            <div className="text-left">
              <p className="font-semibold text-[15px]">現在線上簽約</p>
              <p className="text-xs text-brand-200 mt-0.5">
                預約後立即完成電子簽名
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSubmit(false)}
            disabled={submitting}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-stone-200 bg-white text-brand-900 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-2xl flex-shrink-0">🏪</span>
            <div className="text-left">
              <p className="font-semibold text-[15px]">到店再簽</p>
              <p className="text-xs text-gray-400 mt-0.5">
                先送出預約，到店時現場完成簽約
              </p>
            </div>
          </button>
        </div>

        {submitting && (
          <p className="text-sm text-center text-gray-400">
            <span className="inline-block w-4 h-4 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin mr-2 align-middle" />
            正在送出預約…
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Step 6: Done ─────────────────────────────────────────────────────────────

function StepDone({
  store,
  services,
  selectedServiceIds,
  selectedSlot,
  info,
  appointmentId,
  needsOnlineSign,
  storeSlug,
}: {
  store: StorePublic
  services: ServicePublic[]
  selectedServiceIds: string[]
  selectedSlot: string
  info: InfoState
  appointmentId: string
  needsOnlineSign: boolean
  storeSlug: string
}) {
  const selected = services.filter((s) => selectedServiceIds.includes(s.id))

  return (
    <div className="flex flex-col items-center px-4 pt-10 pb-10 flex-1 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-brand-900 mb-2">
        預約申請已送出！
      </h2>
      <p className="text-sm text-gray-500 leading-relaxed max-w-[280px]">
        我們將盡快確認您的預約，並以 LINE 或簡訊通知您
      </p>

      <div className="w-full mt-8 bg-brand-50 rounded-2xl p-4 space-y-2.5 border border-brand-100 text-left">
        <SummaryRow label="店家" value={store.name} />
        <SummaryRow
          label="服務"
          value={selected.map((s) => s.name).join('、')}
        />
        <SummaryRow label="時間" value={fmtDateTime(selectedSlot)} />
        <SummaryRow label="寵物" value={info.petName} />
      </div>

      {needsOnlineSign && (
        <a
          href={`/book/${storeSlug}/sign/${appointmentId}`}
          className="w-full mt-5 flex items-center justify-center h-12 rounded-xl bg-brand-700 text-white text-base font-medium active:scale-[0.98] transition-transform"
        >
          前往線上簽約 →
        </a>
      )}

      {store.phone && (
        <p className="mt-8 text-xs text-gray-400">
          如需更改，請致電門市：
          <a
            href={`tel:${store.phone}`}
            className="text-brand-700 underline ml-1"
          >
            {store.phone}
          </a>
        </p>
      )}
    </div>
  )
}

// ─── Main: BookingFlow ────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6

export function BookingFlow({
  store,
  services,
  storeSlug,
}: {
  store: StorePublic
  services: ServicePublic[]
  storeSlug: string
}) {
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])

  // Step 2 state
  const [selectedDate, setSelectedDate] = useState('')

  // Step 3 state
  const [selectedSlot, setSelectedSlot] = useState('')

  // Step 4 state
  const [info, setInfo] = useState<InfoState>({
    ownerName: '',
    ownerPhone: '',
    petName: '',
    petSpecies: 'DOG',
    petBreed: '',
    petWeightKg: '',
    isAggressive: false,
    hasDisease: false,
    diseaseNotes: '',
    isDewormed: true,
  })

  // Step 5 state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Step 6 state
  const [doneData, setDoneData] = useState<{
    appointmentId: string
    needsOnlineSign: boolean
  } | null>(null)

  const toggleService = useCallback((id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const setInfoField = useCallback(
    <K extends keyof InfoState>(k: K, v: InfoState[K]) => {
      setInfo((prev) => ({ ...prev, [k]: v }))
    },
    [],
  )

  const handleSubmit = useCallback(
    async (signOnline: boolean) => {
      setSubmitting(true)
      setSubmitError(null)
      const input: SubmitBookingInput = {
        storeId: store.id,
        serviceIds: selectedServiceIds,
        scheduledAt: selectedSlot,
        ownerName: info.ownerName.trim(),
        ownerPhone: info.ownerPhone,
        petName: info.petName.trim(),
        petSpecies: info.petSpecies,
        petBreed: info.petBreed.trim() || undefined,
        petWeightKg: info.petWeightKg
          ? parseFloat(info.petWeightKg)
          : undefined,
        isAggressive: info.isAggressive,
        hasDisease: info.hasDisease,
        diseaseNotes: info.diseaseNotes.trim() || undefined,
        isDewormed: info.isDewormed,
        signOnline,
      }
      const result = await submitBooking(input)
      setSubmitting(false)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }
      setDoneData(result.data)
      setStep(6)
    },
    [store.id, selectedServiceIds, selectedSlot, info],
  )

  return (
    <div className="mobile-container flex flex-col min-h-screen">
      {/* Store header — always visible */}
      <header className="bg-brand-700 text-white px-4 py-4 flex-shrink-0">
        <h1 className="text-[17px] font-bold leading-tight">{store.name}</h1>
        {store.address && (
          <p className="text-xs text-brand-200 mt-0.5 leading-tight">
            {store.address}
          </p>
        )}
      </header>

      {/* Step progress bar (hidden on done screen) */}
      {step < 6 && <StepProgressBar current={step} total={5} />}

      {/* Steps */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {step === 1 && (
          <StepServices
            services={services}
            selectedIds={selectedServiceIds}
            onToggle={toggleService}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepDate
            selected={selectedDate}
            onSelect={setSelectedDate}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepSlot
            storeId={store.id}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            onSelect={setSelectedSlot}
            onNext={() => setStep(4)}
            onBack={() => {
              setSelectedSlot('')
              setStep(2)
            }}
          />
        )}
        {step === 4 && (
          <StepInfo
            info={info}
            onChange={setInfoField}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <StepSign
            store={store}
            services={services}
            selectedServiceIds={selectedServiceIds}
            selectedSlot={selectedSlot}
            info={info}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
            onBack={() => setStep(4)}
          />
        )}
        {step === 6 && doneData && (
          <StepDone
            store={store}
            services={services}
            selectedServiceIds={selectedServiceIds}
            selectedSlot={selectedSlot}
            info={info}
            appointmentId={doneData.appointmentId}
            needsOnlineSign={doneData.needsOnlineSign}
            storeSlug={storeSlug}
          />
        )}
      </div>
    </div>
  )
}
