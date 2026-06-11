'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SignaturePad } from '@repo/ui'
import { useBookingStore } from '@/stores/booking'
import { finalizeOnlineBooking } from './actions'

interface Props {
  storeSlug: string
  storeName: string
  contractHtml: string | null
  contractError?: string
}

export function SignPageClient({
  storeSlug,
  storeName,
  contractHtml,
  contractError,
}: Props) {
  const router = useRouter()
  const draft = useBookingStore((s) => s.draft)
  const clearDraft = useBookingStore((s) => s.clearDraft)

  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const contractRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = contractRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  const handleSign = useCallback(
    async (signatureDataUrl: string) => {
      if (!draft) {
        setErrorMsg('預約草稿遺失，請重新填寫')
        return
      }
      if (!agreed) {
        setErrorMsg('請先勾選「我已詳閱並同意」')
        return
      }

      setSubmitting(true)
      setErrorMsg(null)

      const result = await finalizeOnlineBooking({
        storeSlug,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        customerEmail: draft.customerEmail,
        emergencyContact: draft.emergencyContact,
        emergencyPhone: draft.emergencyPhone,
        petName: draft.petName,
        petSpecies: draft.petSpecies,
        petBreed: draft.petBreed,
        petWeight: draft.petWeight,
        petGender: draft.petGender,
        petBirthDate: draft.petBirthDate,
        isAggressive: draft.isAggressive,
        hasDisease: draft.hasDisease,
        diseaseNotes: draft.diseaseNotes,
        isVaccinated: draft.isVaccinated,
        isDewormed: draft.isDewormed,
        preferredVetName: draft.preferredVetName,
        preferredVetPhone: draft.preferredVetPhone,
        services: draft.services,
        staffId: draft.staffId,
        staffName: draft.staffName,
        staffSurcharge: draft.staffSurcharge,
        subtotalAmount: draft.subtotalAmount,
        discountAmount: draft.discountAmount,
        totalAmount: draft.totalAmount,
        scheduledAt: draft.scheduledAt,
        estimatedDuration: draft.estimatedDuration,
        pickupDeadlineAt: draft.pickupDeadlineAt,
        signatureDataUrl,
        signedAt: new Date().toISOString(),
      })

      setSubmitting(false)

      if (!result.ok) {
        setErrorMsg(result.error)
        return
      }

      clearDraft()
      router.push(
        `/book/${storeSlug}/sign/complete?appointmentId=${result.data.appointmentId}`,
      )
    },
    [draft, agreed, storeSlug, clearDraft, router],
  )

  // 守衛：draft 遺失（直接進入 /sign URL）
  if (!draft) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-[#3B2F2A]">
          找不到預約資料，請重新填寫。
        </p>
        <button
          onClick={() => router.push(`/book/${storeSlug}`)}
          className="rounded-xl bg-[#78573A] px-6 py-3 text-white"
        >
          返回預約頁
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#E5D9CC] bg-[#FAF7F2] px-4 py-3">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F0E8DF]"
        >
          <span className="text-xl">←</span>
        </button>
        <div>
          <h1 className="font-semibold text-[#3B2F2A]">確認並簽署契約</h1>
          <p className="text-xs text-[#78573A]">{storeName}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 說明文字 */}
        <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">線上簽約說明</p>
          <p className="mt-1 leading-relaxed">
            本次為線上簽約。如到店有需要增加服務項目，將由店家協助補簽「補充服務契約」，原契約費用不變。
          </p>
        </div>

        {/* 契約全文 */}
        <div className="mx-4 mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#3B2F2A]">
              定型化契約全文
            </h2>
            <button
              onClick={scrollToBottom}
              className="rounded-lg bg-[#F0E8DF] px-3 py-1 text-xs text-[#78573A]"
            >
              跳至底部 ↓
            </button>
          </div>

          <div
            ref={contractRef}
            className="max-h-[50vh] overflow-y-auto rounded-xl border border-[#E5D9CC] bg-white p-4"
          >
            {contractError ? (
              <p className="py-8 text-center text-sm text-red-500">
                {contractError}
              </p>
            ) : contractHtml ? (
              <div
                className="prose prose-sm max-w-none text-[13px] leading-relaxed text-[#3B2F2A]"
                dangerouslySetInnerHTML={{ __html: contractHtml }}
              />
            ) : (
              <p className="py-8 text-center text-sm text-[#9ca3af]">
                載入契約中…
              </p>
            )}
          </div>
        </div>

        {/* 同意 checkbox */}
        <label className="mx-4 mt-4 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-[#E5D9CC] bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-5 w-5 accent-[#78573A]"
          />
          <span className="text-sm text-[#3B2F2A]">
            我已詳閱並同意以上定型化契約條款
          </span>
        </label>

        {/* 簽名區 */}
        <div className="mx-4 mt-4 mb-6">
          <h2 className="mb-2 text-sm font-medium text-[#3B2F2A]">電子簽名</h2>
          <p className="mb-3 text-xs text-[#9ca3af]">
            請在下方空白處以手指簽署您的姓名
          </p>

          {submitting ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[#E5D9CC] bg-white">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E5D9CC] border-t-[#78573A]" />
                <p className="text-sm text-[#78573A]">處理中，請稍候…</p>
              </div>
            </div>
          ) : (
            <SignaturePad
              onConfirm={handleSign}
              confirmLabel={agreed ? '確認送出' : '請先勾選同意'}
              clearLabel="重新簽名"
            />
          )}

          {errorMsg && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
