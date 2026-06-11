'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { useCheckinStore } from '@/stores/checkin'
import { useShallow } from 'zustand/react/shallow'
import {
  finalizeOrder,
  finalizeSupplementaryOrder,
  getContractPreviewHtml,
  getSupplementaryContractPreviewHtml,
} from '@/app/actions/contract'

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
  const store = useCheckinStore(
    useShallow((s) => ({
      customerId: s.customerId,
      petId: s.petId,
      staffId: s.staffId,
      selectedServices: s.selectedServices,
      subtotalAmount: s.subtotalAmount,
      discountAmount: s.discountAmount,
      totalAmount: s.totalAmount,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      customerEmail: s.customerEmail,
      emergencyContact: s.emergencyContact,
      emergencyPhone: s.emergencyPhone,
      petName: s.petName,
      petSpecies: s.petSpecies,
      petBreed: s.petBreed,
      petWeight: s.petWeight,
      petGender: s.petGender,
      petBirthDate: s.petBirthDate,
      isAggressive: s.isAggressive,
      hasDisease: s.hasDisease,
      diseaseNotes: s.diseaseNotes,
      isVaccinated: s.isVaccinated,
      isDewormed: s.isDewormed,
      preferredVetName: s.preferredVetName,
      preferredVetPhone: s.preferredVetPhone,
      staffName: s.staffName,
      staffSurcharge: s.staffSurcharge,
      orderNotes: s.orderNotes,
      scheduledAt: s.scheduledAt,
      estimatedDuration: s.estimatedDuration,
      pickupDeadlineAt: s.pickupDeadlineAt,
      paymentMethod: s.paymentMethod,
      needsSupplementary: s.needsSupplementary,
      onlineContractId: s.onlineContractId,
      onlineContractServiceIds: s.onlineContractServiceIds,
      originalDraftOrderId: s.originalDraftOrderId,
      appointmentId: s.appointmentId,
      setOrderId: s.setOrderId,
      setContract: s.setContract,
    })),
  )

  const [signed, setSigned] = useState(false)
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  // 補充契約：計算新增服務
  const newServices = store.needsSupplementary
    ? store.selectedServices.filter(
        (s) => !store.onlineContractServiceIds.includes(s.serviceId),
      )
    : []
  const supplementaryAmount = newServices.reduce(
    (sum, s) => sum + s.unitPrice * s.quantity,
    store.staffSurcharge,
  )
  const parentContractRef = store.onlineContractId
    ? store.onlineContractId.slice(-8).toUpperCase()
    : ''

  // 補充契約 data（預覽用，不含 signatureDataUrl）
  const supplementaryContractData = store.needsSupplementary
    ? {
        storeName: STORE_NAME,
        storePhone: STORE_PHONE,
        customerName: store.customerName,
        customerPhone: store.customerPhone,
        petName: store.petName,
        parentContractRef,
        services: newServices.map((s) => ({
          serviceName:
            s.quantity > 1 ? `${s.serviceName} x ${s.quantity}` : s.serviceName,
          unitPrice: s.unitPrice * s.quantity,
        })),
        staffName: store.staffName || '不指定',
        staffSurcharge: store.staffSurcharge,
        supplementaryAmount,
        signedAt: fmtDatetime(new Date().toISOString()),
      }
    : null

  // 建立 contractData（不含 signatureDataUrl，預覽用）
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
    customFields: [] as { label: string; value: string }[],
    signedAt: fmtDatetime(new Date().toISOString()),
  }

  // 載入合約預覽 HTML（依是否需要補簽決定呼叫哪個 action）
  useEffect(() => {
    if (
      !store.customerId ||
      !store.petId ||
      store.selectedServices.length === 0
    ) {
      router.replace('/checkin')
      return
    }
    let cancelled = false
    if (store.needsSupplementary && supplementaryContractData) {
      getSupplementaryContractPreviewHtml(supplementaryContractData).then(
        (html) => {
          if (!cancelled) setPreviewHtml(html)
        },
      )
    } else {
      getContractPreviewHtml(contractData).then((html) => {
        if (!cancelled) setPreviewHtml(html)
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignConfirm = useCallback((url: string) => {
    setDataUrl(url)
    setSigned(true)
  }, [])

  async function handleSubmit() {
    if (
      !store.customerId ||
      !store.petId ||
      store.selectedServices.length === 0
    ) {
      router.replace('/checkin')
      return
    }
    setError('')
    setLoading(true)

    const signedAt = fmtDatetime(new Date().toISOString())

    // 補簽流程：更新既有 DRAFT order + 建立補充契約
    if (
      store.needsSupplementary &&
      store.originalDraftOrderId &&
      store.onlineContractId &&
      store.appointmentId &&
      supplementaryContractData
    ) {
      const result = await finalizeSupplementaryOrder({
        customerId: store.customerId,
        petId: store.petId,
        staffId: store.staffId ?? undefined,
        appointmentId: store.appointmentId,
        originalDraftOrderId: store.originalDraftOrderId,
        parentContractId: store.onlineContractId,
        allOrderItems: store.selectedServices.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          unitPrice: s.unitPrice,
          quantity: s.quantity,
        })),
        newOrderItems: newServices.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          unitPrice: s.unitPrice,
          quantity: s.quantity,
        })),
        subtotalAmount: store.subtotalAmount,
        discountAmount: store.discountAmount,
        totalAmount: store.totalAmount,
        supplementaryAmount,
        contractData: { ...supplementaryContractData, signedAt },
        signatureDataUrl: dataUrl,
        notes: store.orderNotes || undefined,
        paymentMethod: store.paymentMethod ?? undefined,
      })

      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }

      store.setOrderId(result.data.orderId)
      store.setContract({
        contractId: result.data.supplementaryContractId,
        earnedPoints: result.data.earnedPoints,
      })
      router.push('/checkin/complete')
      return
    }

    // 一般報到流程
    const result = await finalizeOrder({
      customerId: store.customerId,
      petId: store.petId,
      staffId: store.staffId ?? undefined,
      orderItems: store.selectedServices.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        unitPrice: s.unitPrice,
        quantity: s.quantity,
      })),
      subtotalAmount: store.subtotalAmount,
      discountAmount: store.discountAmount,
      totalAmount: store.totalAmount,
      contractData: { ...contractData, signedAt },
      signatureDataUrl: dataUrl,
      notes: store.orderNotes || undefined,
      paymentMethod: store.paymentMethod ?? undefined,
    })

    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }

    store.setOrderId(result.data.orderId)
    store.setContract({
      contractId: result.data.contractId,
      earnedPoints: result.data.earnedPoints,
    })
    router.push('/checkin/complete')
  }

  return (
    <PosLayout>
      <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-8">
        <StepIndicator current={5} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {store.needsSupplementary ? '補充契約預覽與簽署' : '契約預覽與簽署'}
          </h1>
          <p className="mt-1 text-stone-500 text-sm">
            {store.needsSupplementary
              ? '以下為加購補充契約，請客戶確認新增服務項目後簽名'
              : '請客戶詳閱以下契約內容後，於下方簽名確認'}
          </p>
          {store.needsSupplementary && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚡ 補充契約（原契約編號：{parentContractRef}
              ）｜僅含加購服務，與原契約合併適用
            </p>
          )}
        </div>

        {/* 合約預覽 iframe */}
        <div className="rounded-xl border border-stone-200 overflow-hidden bg-white">
          <div
            className={`border-b border-stone-200 px-4 py-2.5 ${store.needsSupplementary ? 'bg-amber-50' : 'bg-stone-50'}`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${store.needsSupplementary ? 'text-amber-700' : 'text-stone-500'}`}
            >
              {store.needsSupplementary
                ? '⚡ 加購補充契約'
                : '犬、貓美容服務定型化契約'}
            </p>
          </div>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="契約預覽"
              className="w-full border-0"
              style={{ height: '70vh', minHeight: '400px' }}
            />
          ) : (
            <div className="flex items-center justify-center py-16 text-stone-400 text-sm">
              載入契約預覽中…
            </div>
          )}
        </div>

        {/* 電子簽名 */}
        <div>
          <p className="text-sm font-semibold text-stone-700 mb-3">
            客戶電子簽名
          </p>
          {!signed ? (
            <SignaturePad onConfirm={handleSignConfirm} />
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-emerald-800 font-semibold">簽名完成</p>
                <p className="text-emerald-600 text-sm">
                  點擊「完成簽約」以送出
                </p>
              </div>
              <button
                onClick={() => setSigned(false)}
                className="text-sm text-stone-400 underline min-h-[44px] px-2"
              >
                重簽
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

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
            {loading ? '送出中…' : '完成簽約'}
          </BigButton>
          <CancelCheckinButton />
        </div>
      </div>
    </PosLayout>
  )
}
