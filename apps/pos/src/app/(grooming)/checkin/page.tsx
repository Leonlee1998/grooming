'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { searchCustomerByPhone, upsertCustomer } from './actions'

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
  const { reset, setCustomer } = useCheckinStore((s) => ({
    reset: s.reset,
    setCustomer: s.setCustomer,
  }))

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      setFound(undefined)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const result = await searchCustomerByPhone(phone)
      setSearching(false)
      if (result.ok) setFound(result.data as FoundCustomer | null)
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
          <button
            onClick={() => proceed(found)}
            className="w-full text-left rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-6 py-5 hover:bg-emerald-100 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 text-2xl font-bold flex-shrink-0">
                {found.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-stone-900">{found.name}</p>
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
                點擊進入寵物選擇
              </span>
              <span className="text-emerald-600 text-xl">→</span>
            </div>
          </button>
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
