'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { useCheckinStore } from '@/stores/checkin'
import { signAndFinalize } from '../actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? '寵物美容店'
const STORE_ADDRESS = process.env.NEXT_PUBLIC_STORE_ADDRESS ?? ''
const STORE_PHONE = process.env.NEXT_PUBLIC_STORE_PHONE ?? ''

function fmtDatetime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

function bool(v: boolean) {
  return v ? '是' : '否'
}

export default function SignPage() {
  const router = useRouter()
  const store = useCheckinStore()
  const setContract = useCheckinStore((s) => s.setContract)

  const [signed, setSigned] = useState(false)
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignConfirm = useCallback((url: string) => {
    setDataUrl(url)
    setSigned(true)
  }, [])

  async function handleSubmit() {
    if (!store.orderId || !store.customerId || !store.petId) {
      router.replace('/checkin')
      return
    }
    setError('')
    setLoading(true)

    const signedAt = fmtDatetime(new Date().toISOString())
    const contractData = {
      storeName: STORE_NAME,
      storeAddress: STORE_ADDRESS,
      storePhone: STORE_PHONE,
      customerName: store.customerName,
      customerPhone: store.customerPhone,
      customerEmail: store.customerEmail,
      emergencyContact: store.emergencyContact,
      emergencyPhone: store.emergencyPhone,
      petName: store.petName,
      petSpecies: store.petSpecies,
      petBreed: store.petBreed || '混種',
      petWeight: store.petWeight || '未知',
      petGender: store.petGender,
      petBirthDate: store.petBirthDate || '未填',
      isAggressive: bool(store.isAggressive),
      hasDisease: bool(store.hasDisease),
      diseaseNotes: store.diseaseNotes || '無',
      isVaccinated: bool(store.isVaccinated),
      isDewormed: bool(store.isDewormed),
      preferredVetName: store.preferredVetName,
      preferredVetPhone: store.preferredVetPhone || '未填',
      services: store.selectedServices.map((s) => ({
        serviceName:
          s.quantity > 1 ? `${s.serviceName} x ${s.quantity}` : s.serviceName,
        unitPrice: s.unitPrice * s.quantity,
      })),
      staffName: store.staffName || '不指定',
      staffSurcharge: store.staffSurcharge,
      subtotalAmount: store.subtotalAmount,
      discountAmount: store.discountAmount,
      totalAmount: store.totalAmount,
      scheduledAt: fmtDatetime(store.scheduledAt),
      estimatedDuration: store.estimatedDuration,
      pickupDeadlineAt: fmtDatetime(store.pickupDeadlineAt),
      customFields: [],
      signedAt,
    }

    const result = await signAndFinalize({
      orderId: store.orderId,
      customerId: store.customerId,
      petId: store.petId,
      contractData,
      signatureDataUrl: dataUrl,
    })

    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setContract({
      contractId: result.data.contractId,
      pdfUrl: result.data.pdfUrl,
    })
    router.push('/checkin/complete')
  }

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <StepIndicator current={5} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">契約簽署</h1>
          <p className="mt-1 text-stone-500 text-sm">
            請客戶閱讀以下條款後簽名
          </p>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 px-5 py-4 flex flex-col gap-3 text-sm text-stone-700">
          <p className="font-semibold text-stone-800 text-base">服務摘要</p>
          <div className="flex justify-between">
            <span className="text-stone-500">客戶</span>
            <span>
              {store.customerName}（{store.customerPhone}）
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">寵物</span>
            <span>
              {store.petName}（{store.petSpecies} / {store.petGender}）
            </span>
          </div>
          {store.staffName && (
            <div className="flex justify-between">
              <span className="text-stone-500">美容師</span>
              <span>{store.staffName}</span>
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1 border-t border-stone-100">
            {store.selectedServices.map((s) => (
              <div key={s.serviceId} className="flex justify-between">
                <span>
                  {s.serviceName}
                  {s.quantity > 1 ? ` × ${s.quantity}` : ''}
                </span>
                <span className="font-medium">${s.unitPrice * s.quantity}</span>
              </div>
            ))}
          </div>
          {store.discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>折扣</span>
              <span className="font-medium">−${store.discountAmount}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900">
            <span>總計</span>
            <span>${store.totalAmount}</span>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">健康聲明確認</p>
          <p>
            有無攻擊性：{bool(store.isAggressive)} / 有無疾病：
            {bool(store.hasDisease)}
          </p>
          <p>
            疫苗接種：{bool(store.isVaccinated)} / 指定獸醫院：
            {store.preferredVetName || '未填'}
          </p>
        </div>

        <div className="rounded-xl bg-stone-50 border border-stone-200 px-5 py-4 text-sm text-stone-600">
          <p className="font-semibold text-stone-800 mb-2">重要條款摘要</p>
          <ul className="list-disc list-inside space-y-1">
            <li>服務費用已於簽約前完整揭露，未列明費用不得收取</li>
            <li>逾約定時間 30 分鐘以上方可計收逾時費</li>
            <li>寵物出現異常時業者將立即通知，並送往指定獸醫院</li>
            <li>3 日內可解除契約並申請退費</li>
          </ul>
        </div>

        {!signed ? (
          <SignaturePad onConfirm={handleSignConfirm} />
        ) : (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-emerald-800 font-semibold">簽名完成</p>
              <p className="text-emerald-600 text-sm">點擊完成簽約以產出 PDF</p>
            </div>
            <button
              onClick={() => setSigned(false)}
              className="text-sm text-stone-400 underline"
            >
              重簽
            </button>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="grid grid-cols-[104px_minmax(0,1fr)_128px] gap-3">
          <BigButton
            variant="secondary"
            onClick={() => router.push('/checkin/confirm')}
            disabled={loading}
          >
            返回
          </BigButton>
          <BigButton
            fullWidth
            onClick={handleSubmit}
            disabled={!signed || loading}
          >
            {loading ? '產生 PDF 中…（約 3-5 秒）' : '完成簽約'}
          </BigButton>
          <CancelCheckinButton />
        </div>
      </div>
    </PosLayout>
  )
}
