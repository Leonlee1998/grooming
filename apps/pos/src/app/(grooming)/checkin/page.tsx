'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { useShallow } from 'zustand/react/shallow'
import {
  searchCustomerByPhone,
  upsertCustomer,
  checkOnlineBooking,
  confirmOnlineBookingWalkIn,
  type OnlineAppointmentInfo,
} from './actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

type FoundCustomer = {
  id: string
  name: string
  phone: string
  email: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  petCount: number
}

const INITIAL_FORM = {
  name: '',
  email: '',
  emergencyContact: '',
  emergencyPhone: '',
}

export default function CheckinPage() {
  const router = useRouter()
  const {
    reset,
    setCustomer,
    setPet,
    setOrderId,
    setContract,
    setPriceQuote,
    setSchedule,
    setHasOnlineContract,
  } = useCheckinStore(
    useShallow((s) => ({
      reset: s.reset,
      setCustomer: s.setCustomer,
      setPet: s.setPet,
      setOrderId: s.setOrderId,
      setContract: s.setContract,
      setPriceQuote: s.setPriceQuote,
      setSchedule: s.setSchedule,
      setHasOnlineContract: s.setHasOnlineContract,
    })),
  )

  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  // undefined = 尚未搜尋, null = 找不到, FoundCustomer = 找到
  const [found, setFound] = useState<FoundCustomer | null | undefined>(
    undefined,
  )

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 線上預約偵測
  const [onlineAppts, setOnlineAppts] = useState<OnlineAppointmentInfo[]>([])
  const [confirmingApptId, setConfirmingApptId] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      setFound(undefined)
      setOnlineAppts([])
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const result = await searchCustomerByPhone(phone)
      setSearching(false)
      if (result.ok) {
        setFound(result.data as FoundCustomer | null)
        if (result.data) {
          checkOnlineBooking(result.data.id).then((r) => {
            if (r.ok) setOnlineAppts(r.data.appointments)
          })
        } else {
          setOnlineAppts([])
        }
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [phone])

  function proceed(c: FoundCustomer) {
    setCustomer({
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      customerEmail: c.email ?? '',
      emergencyContact: c.emergencyContact ?? '',
      emergencyPhone: c.emergencyPhone ?? '',
    })
    router.push('/checkin/pet')
  }

  async function handleConfirmOnlineArrival(appt: OnlineAppointmentInfo) {
    if (!found) return
    setConfirmingApptId(appt.id)
    setConfirmError('')

    setCustomer({
      customerId: found.id,
      customerName: found.name,
      customerPhone: found.phone,
      customerEmail: found.email ?? '',
      emergencyContact: found.emergencyContact ?? '',
      emergencyPhone: found.emergencyPhone ?? '',
    })

    const result = await confirmOnlineBookingWalkIn(appt.id, found.id)
    setConfirmingApptId(null)

    if (!result.ok) {
      setConfirmError(result.error)
      return
    }

    setPet({
      petId: result.data.petId,
      petName: result.data.petName,
      petSpecies: appt.petSpecies,
      petBreed: '',
      petWeight: '',
      petGender: '',
      petBirthDate: '',
      isAggressive: false,
      hasDisease: false,
      diseaseNotes: '',
      isVaccinated: false,
      isDewormed: false,
      preferredVetName: '',
      preferredVetPhone: '',
    })
    setPriceQuote({
      estimatedDuration: 60,
      subtotalAmount: result.data.totalAmount,
      discountAmount: 0,
      totalAmount: result.data.totalAmount,
      memberId: null,
      memberBalance: null,
    })
    if (result.data.pickupDeadlineAt) {
      setSchedule({
        scheduledAt: new Date().toISOString(),
        estimatedDuration: 60,
        pickupDeadlineAt: result.data.pickupDeadlineAt,
      })
    }
    setOrderId(result.data.orderId)
    setContract({
      contractId: 'online',
      earnedPoints: result.data.earnedPoints,
    })
    setHasOnlineContract(true)
    router.push('/checkin/complete')
  }

  function openModal() {
    setForm(INITIAL_FORM)
    setFormError('')
    setShowModal(true)
  }

  function returnHome() {
    reset()
    router.push('/')
  }

  async function handleCreate() {
    setFormError('')
    setSubmitting(true)
    const result = await upsertCustomer({ phone, ...form })
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    proceed({
      id: result.data.id,
      name: result.data.name,
      phone: result.data.phone,
      email: result.data.email,
      emergencyContact: result.data.emergencyContact,
      emergencyPhone: result.data.emergencyPhone,
      petCount: 0,
    })
  }

  const digits = phone.replace(/\D/g, '')

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-8">
        <StepIndicator current={1} total={5} labels={STEPS} />

        <div>
          <h1 className="text-3xl font-bold text-stone-900">客戶查詢</h1>
          <p className="mt-1 text-stone-500">輸入 10 碼手機號碼自動搜尋</p>
        </div>

        {/* 搜尋框 */}
        <div className="relative">
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            placeholder="09XX-XXX-XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border-2 border-stone-300 bg-white px-6 py-5 text-3xl font-mono tracking-widest placeholder:text-stone-300 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searching && (
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          )}
          {!searching && digits.length > 0 && digits.length < 10 && (
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-400 text-base font-mono tabular-nums">
              {digits.length}/10
            </div>
          )}
        </div>

        {/* 找到客戶 */}
        {found && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => proceed(found)}
              className="w-full text-left rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-6 py-5 hover:bg-emerald-100 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 text-2xl font-bold flex-shrink-0">
                  {found.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-stone-900">
                    {found.name}
                  </p>
                  <p className="text-stone-500 mt-0.5">{found.phone}</p>
                  {found.email && (
                    <p className="text-stone-400 text-sm truncate">
                      {found.email}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-bold text-emerald-700">
                    {found.petCount}
                  </p>
                  <p className="text-stone-400 text-sm">隻寵物</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-emerald-700 font-semibold">
                  {onlineAppts.length > 0
                    ? '加購服務 → 點此走一般報到流程'
                    : '點擊進入寵物選擇'}
                </span>
                <span className="text-emerald-600 text-xl">→</span>
              </div>
            </button>

            {/* 線上預約已簽約 banner */}
            {onlineAppts.length > 0 && (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-blue-800 font-bold text-lg">
                    已線上預約並簽約
                  </p>
                  <span className="text-xs bg-blue-700 text-white rounded-full px-2 py-0.5 font-semibold">
                    今日
                  </span>
                </div>

                {onlineAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className="mb-3 last:mb-0 rounded-xl bg-white border border-blue-200 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-stone-900">
                          {appt.petSpecies === 'DOG' ? '🐶' : '🐱'}{' '}
                          {appt.petName}
                        </p>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {new Date(appt.scheduledAt).toLocaleTimeString(
                            'zh-TW',
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Taipei',
                            },
                          )}
                          {appt.staffName && ` · ${appt.staffName}`}
                        </p>
                        {appt.serviceNames.length > 0 && (
                          <p className="text-xs text-stone-400 mt-1 truncate">
                            {appt.serviceNames.join('、')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleConfirmOnlineArrival(appt)}
                        disabled={confirmingApptId !== null}
                        className="shrink-0 rounded-xl bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors min-h-[44px]"
                      >
                        {confirmingApptId === appt.id ? '確認中…' : '確認到店'}
                      </button>
                    </div>
                  </div>
                ))}

                {confirmError && (
                  <p className="mt-3 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
                    {confirmError}
                  </p>
                )}

                <p className="mt-3 text-xs text-blue-600">
                  「確認到店」直接採用線上合約，無需補簽。若需加購服務，請點上方客戶卡片走一般報到流程。
                </p>
              </div>
            )}
          </div>
        )}

        {/* 找不到客戶 */}
        {found === null && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 px-6 py-5">
              <p className="text-amber-900 font-semibold text-lg">查無此號碼</p>
              <p className="text-amber-700 mt-1">{phone} 尚未有客戶紀錄</p>
            </div>
            <BigButton fullWidth onClick={openModal}>
              ＋ 建立新客戶
            </BigButton>
          </div>
        )}

        <div className="border-t border-stone-200 pt-5">
          <BigButton variant="secondary" fullWidth onClick={returnHome}>
            返回首頁
          </BigButton>
        </div>
      </div>

      {/* 新增客戶 Bottom Sheet */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-t-3xl shadow-2xl px-6 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 rounded-full bg-stone-300 mx-auto mb-6" />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-stone-900">建立新客戶</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {/* 手機（唯讀） */}
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  手機號碼
                </label>
                <div className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-lg font-mono text-stone-500">
                  {phone}
                </div>
              </div>

              {/* 姓名 */}
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="王小明"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  Email{' '}
                  <span className="text-stone-400 font-normal">（選填）</span>
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* 緊急聯絡 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    緊急聯絡人{' '}
                    <span className="text-stone-400 font-normal">（選填）</span>
                  </label>
                  <input
                    type="text"
                    placeholder="王大明"
                    value={form.emergencyContact}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        emergencyContact: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    緊急聯絡電話{' '}
                    <span className="text-stone-400 font-normal">（選填）</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={form.emergencyPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, emergencyPhone: e.target.value }))
                    }
                    className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
                  {formError}
                </p>
              )}

              <BigButton
                fullWidth
                onClick={handleCreate}
                disabled={submitting || !form.name.trim()}
                className="mt-2"
              >
                {submitting ? '建立中…' : '建立並繼續'}
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </PosLayout>
  )
}
