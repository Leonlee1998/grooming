'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { useCheckinStore } from '@/stores/checkin'
import { createDraftOrder } from '../actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

function now30() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return d.toISOString().slice(0, 16)
}

function addMinutes(base: string, mins: number) {
  const d = new Date(base)
  d.setMinutes(d.getMinutes() + mins)
  return d.toISOString().slice(0, 16)
}

function fmtDatetime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

export default function ConfirmPage() {
  const router = useRouter()
  const store = useCheckinStore()

  const [scheduledAt, setScheduledAt] = useState(now30)
  const [discount, setDiscount] = useState(store.discountAmount)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const calculatedDuration =
    store.selectedServices.reduce(
      (sum, service) => sum + service.estimatedMinutes,
      0,
    ) || 60
  const estimatedDuration = store.estimatedDuration || calculatedDuration
  const pickupDeadline = addMinutes(scheduledAt, estimatedDuration)
  const calculatedSubtotal =
    store.selectedServices.reduce(
      (sum, service) => sum + service.unitPrice * service.quantity,
      0,
    ) + store.staffSurcharge
  const subtotal = store.subtotalAmount || calculatedSubtotal
  const total = Math.max(0, subtotal - discount)

  async function handleConfirm() {
    if (!store.customerId || !store.petId) {
      router.replace('/checkin')
      return
    }
    setError('')
    setLoading(true)
    const result = await createDraftOrder({
      customerId: store.customerId,
      petId: store.petId,
      staffId: store.staffId ?? undefined,
      items: store.selectedServices.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        unitPrice: s.unitPrice,
        quantity: s.quantity,
      })),
      subtotalAmount: subtotal,
      discountAmount: discount,
      totalAmount: total,
      scheduledAt: new Date(scheduledAt).toISOString(),
      estimatedDuration,
      pickupDeadlineAt: new Date(pickupDeadline).toISOString(),
      notes: store.orderNotes || undefined,
    })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    store.setOrder({
      scheduledAt: new Date(scheduledAt).toISOString(),
      estimatedDuration,
      pickupDeadlineAt: new Date(pickupDeadline).toISOString(),
      subtotalAmount: subtotal,
      discountAmount: discount,
      totalAmount: total,
      orderId: result.data.orderId,
    })
    router.push('/checkin/sign')
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-500 text-base">{label}</span>
      <span className="text-stone-900 font-medium text-base">{value}</span>
    </div>
  )

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <StepIndicator current={4} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">費用確認</h1>
          <p className="mt-1 text-stone-500 text-sm">
            法規 §3：簽約前完整揭露費用
          </p>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 px-5 py-4 flex flex-col">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
            客戶與寵物
          </p>
          <Row label="客戶" value={store.customerName} />
          <Row label="寵物" value={store.petName} />
          {store.staffName && (
            <Row label="指定美容師" value={store.staffName} />
          )}
        </div>

        <div className="rounded-xl bg-white border border-stone-200 px-5 py-4 flex flex-col">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
            服務明細
          </p>
          {store.selectedServices.map((s) => (
            <div
              key={s.serviceId}
              className="flex flex-col gap-1 py-2.5 border-b border-stone-100"
            >
              <div className="flex justify-between gap-3">
                <span className="text-stone-700">
                  {s.serviceName}
                  {s.quantity > 1 ? ` × ${s.quantity}` : ''}
                </span>
                <span className="text-stone-900 font-medium">
                  ${s.unitPrice * s.quantity}
                </span>
              </div>
              <div className="flex justify-between text-xs text-stone-400">
                <span>單價 ${s.unitPrice}</span>
                <span>約 {s.estimatedMinutes} 分鐘</span>
              </div>
              {s.priceAdjustments.map((rule) => (
                <div
                  key={rule.ruleName}
                  className="flex justify-between text-xs text-amber-700"
                >
                  <span>{rule.ruleName}</span>
                  <span>+${rule.amount}</span>
                </div>
              ))}
            </div>
          ))}
          {store.staffSurcharge > 0 && (
            <div className="flex justify-between py-2.5 border-b border-stone-100">
              <span className="text-stone-500">指定費</span>
              <span className="text-stone-900 font-medium">
                +${store.staffSurcharge}
              </span>
            </div>
          )}
          <div className="flex justify-between py-2.5 border-b border-stone-100">
            <span className="text-stone-500">小計</span>
            <span className="text-stone-900 font-medium">${subtotal}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-stone-500">折扣</span>
            <div className="flex items-center gap-2">
              <span className="text-stone-400">$</span>
              <input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) =>
                  setDiscount(
                    Math.max(
                      0,
                      Math.min(subtotal, parseInt(e.target.value) || 0),
                    ),
                  )
                }
                className="w-24 text-right rounded-lg border border-stone-300 px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-700 text-white px-5 py-4 flex justify-between items-center">
          <span className="text-emerald-100">總計</span>
          <span className="text-3xl font-bold">${total}</span>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 px-5 py-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
            服務時間
          </p>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              服務開始時間
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <Row label="預估完成時間" value={`${estimatedDuration} 分鐘`} />
          <Row label="約定接回時間" value={fmtDatetime(pickupDeadline)} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="grid grid-cols-[104px_minmax(0,1fr)_128px] gap-3">
          <BigButton
            variant="secondary"
            onClick={() => router.push('/checkin/service')}
          >
            返回
          </BigButton>
          <BigButton fullWidth onClick={handleConfirm} disabled={loading}>
            {loading ? '建立訂單中…' : '前往簽約'}
          </BigButton>
          <CancelCheckinButton />
        </div>
      </div>
    </PosLayout>
  )
}
