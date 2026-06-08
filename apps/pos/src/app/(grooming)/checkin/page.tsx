'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { searchCustomerByPhone, upsertCustomer } from './actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

type Mode = 'search' | 'found' | 'new'

export default function CheckinPage() {
  const router = useRouter()
  const setCustomer = useCheckinStore((s) => s.setCustomer)

  const [phone, setPhone] = useState('')
  const [mode, setMode] = useState<Mode>('search')
  const [found, setFound] = useState<{
    id: string
    name: string
    phone: string
    email: string | null
    emergencyContact: string | null
    emergencyPhone: string | null
  } | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    emergencyContact: '',
    emergencyPhone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    setError('')
    setLoading(true)
    const result = await searchCustomerByPhone(phone)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.data) {
      setFound(result.data)
      setForm({
        name: result.data.name,
        email: result.data.email ?? '',
        emergencyContact: result.data.emergencyContact ?? '',
        emergencyPhone: result.data.emergencyPhone ?? '',
      })
      setMode('found')
    } else {
      setForm({ name: '', email: '', emergencyContact: '', emergencyPhone: '' })
      setMode('new')
    }
  }

  async function handleConfirm() {
    setError('')
    setLoading(true)
    const result = await upsertCustomer({ phone, ...form })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCustomer({
      customerId: result.data.id,
      customerName: result.data.name,
      customerPhone: result.data.phone,
      customerEmail: result.data.email ?? '',
      emergencyContact: result.data.emergencyContact ?? '',
      emergencyPhone: result.data.emergencyPhone ?? '',
    })
    router.push('/checkin/pet')
  }

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <StepIndicator current={1} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">客戶查詢</h1>
          <p className="mt-1 text-stone-500">輸入手機號碼搜尋客戶</p>
        </div>

        {mode === 'search' && (
          <div className="flex flex-col gap-4">
            <input
              type="tel"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-4 text-xl tracking-widest placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <BigButton
              fullWidth
              onClick={handleSearch}
              disabled={loading || phone.length < 8}
            >
              {loading ? '查詢中…' : '查詢'}
            </BigButton>
          </div>
        )}

        {(mode === 'found' || mode === 'new') && (
          <div className="flex flex-col gap-4">
            {mode === 'found' ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                  {found?.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-stone-800">{found?.name}</p>
                  <p className="text-sm text-stone-500">{found?.phone}</p>
                </div>
                <span className="ml-auto text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-1">
                  已有紀錄
                </span>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-amber-800 font-medium">
                  找不到此號碼，建立新客戶
                </p>
                <p className="text-amber-600 text-sm">{phone}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {[
                { label: '姓名', key: 'name', required: true },
                { label: 'Email', key: 'email', required: false },
                {
                  label: '緊急聯絡人',
                  key: 'emergencyContact',
                  required: false,
                },
                {
                  label: '緊急聯絡電話',
                  key: 'emergencyPhone',
                  required: false,
                },
              ].map(({ label, key, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <BigButton
                variant="secondary"
                onClick={() => {
                  setMode('search')
                  setFound(null)
                }}
                className="w-28"
              >
                返回
              </BigButton>
              <BigButton
                fullWidth
                onClick={handleConfirm}
                disabled={loading || !form.name}
              >
                {loading
                  ? '儲存中…'
                  : mode === 'found'
                    ? '確認並繼續'
                    : '建立並繼續'}
              </BigButton>
            </div>
          </div>
        )}
      </div>
    </PosLayout>
  )
}
