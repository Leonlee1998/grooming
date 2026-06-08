'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { getActiveServices, getActiveStaff } from '../actions'
import type { SelectedService } from '@/stores/checkin'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

const CATEGORY_LABEL: Record<string, string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '指甲',
  SPA: 'SPA',
  OTHER: '其他',
}

type Service = {
  id: string
  name: string
  category: string
  basePrice: number
  estimatedMinutes: number
}
type Staff = { id: string; name: string; surcharge: number }

export default function ServicePage() {
  const router = useRouter()
  const { petName, setServices, setStaff } = useCheckinStore((s) => ({
    petName: s.petName,
    setServices: s.setServices,
    setStaff: s.setStaff,
  }))
  const petId = useCheckinStore((s) => s.petId)

  const [services, setServicesList] = useState<Service[]>([])
  const [staff, setStaffList] = useState<Staff[]>([])
  const [selected, setSelected] = useState<SelectedService[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId) {
      router.replace('/checkin/pet')
      return
    }
    Promise.all([getActiveServices(), getActiveStaff()]).then(([svc, stf]) => {
      if (svc.ok) setServicesList(svc.data)
      if (stf.ok) setStaffList(stf.data)
      setLoading(false)
    })
  }, [petId, router])

  function toggleService(svc: Service) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.serviceId === svc.id)
      if (exists) return prev.filter((s) => s.serviceId !== svc.id)
      return [
        ...prev,
        { serviceId: svc.id, serviceName: svc.name, unitPrice: svc.basePrice },
      ]
    })
  }

  const staffSurcharge =
    staff.find((s) => s.id === selectedStaffId)?.surcharge ?? 0
  const staffName = staff.find((s) => s.id === selectedStaffId)?.name ?? ''
  const subtotal = selected.reduce((sum, s) => sum + s.unitPrice, 0)
  const total = subtotal + staffSurcharge

  function handleConfirm() {
    if (selected.length === 0) {
      setError('請至少選擇一項服務')
      return
    }
    setServices(selected)
    setStaff({ staffId: selectedStaffId, staffName, staffSurcharge })
    router.push('/checkin/confirm')
  }

  const grouped = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const key = svc.category
    if (!acc[key]) acc[key] = []
    acc[key].push(svc)
    return acc
  }, {})

  return (
    <PosLayout>
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <StepIndicator current={3} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">選擇服務</h1>
          <p className="mt-1 text-stone-500">{petName} 的美容服務</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">載入中…</div>
        ) : (
          <>
            {Object.entries(grouped).map(([cat, svcs]) => (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {svcs.map((svc) => {
                    const isSelected = selected.some(
                      (s) => s.serviceId === svc.id,
                    )
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggleService(svc)}
                        className={[
                          'text-left rounded-xl border-2 px-4 py-4 transition-colors',
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-stone-200 bg-white hover:border-stone-300',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-stone-900">
                            {svc.name}
                          </p>
                          {isSelected && (
                            <span className="text-emerald-600 text-lg">✓</span>
                          )}
                        </div>
                        <p className="text-emerald-700 font-semibold mt-1">
                          ${svc.basePrice}
                        </p>
                        <p className="text-stone-400 text-xs mt-0.5">
                          約 {svc.estimatedMinutes} 分鐘
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {staff.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  指定美容師（選填）
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedStaffId(null)}
                    className={[
                      'rounded-xl border-2 px-4 py-3 text-base transition-colors',
                      selectedStaffId === null
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-600',
                    ].join(' ')}
                  >
                    不指定
                  </button>
                  {staff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaffId(s.id)}
                      className={[
                        'rounded-xl border-2 px-4 py-3 text-base transition-colors',
                        selectedStaffId === s.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 bg-white text-stone-600',
                      ].join(' ')}
                    >
                      {s.name}
                      {s.surcharge > 0 && (
                        <span className="ml-1 text-sm text-stone-400">
                          +${s.surcharge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-stone-400 text-sm">
                  已選 {selected.length} 項
                  {staffSurcharge > 0 ? ` · 指定費 +$${staffSurcharge}` : ''}
                </p>
                <p className="text-2xl font-bold mt-0.5">${total}</p>
              </div>
              <div className="flex gap-3">
                <BigButton
                  variant="secondary"
                  onClick={() => router.push('/checkin/pet')}
                  className="bg-stone-700 text-white border-stone-600"
                >
                  返回
                </BigButton>
                <BigButton
                  onClick={handleConfirm}
                  disabled={selected.length === 0}
                >
                  下一步
                </BigButton>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
          </>
        )}
      </div>
    </PosLayout>
  )
}
