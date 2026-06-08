'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'

export default function CompletePage() {
  const router = useRouter()
  const { customerName, petName, totalAmount, pdfUrl, orderId, reset } =
    useCheckinStore((s) => ({
      customerName: s.customerName,
      petName: s.petName,
      totalAmount: s.totalAmount,
      pdfUrl: s.pdfUrl,
      orderId: s.orderId,
      reset: s.reset,
    }))

  useEffect(() => {
    if (!orderId) router.replace('/checkin')
  }, [orderId, router])

  function handleNewCheckin() {
    reset()
    router.push('/checkin')
  }

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col items-center gap-8 pt-8">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-12 h-12 text-emerald-600"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-stone-900">報到完成！</h1>
          <p className="mt-2 text-stone-500 text-lg">
            {customerName} 與 {petName} 已完成簽約
          </p>
        </div>

        <div className="w-full rounded-xl bg-white border border-stone-200 px-6 py-5 flex flex-col gap-3">
          <div className="flex justify-between">
            <span className="text-stone-500">應收金額</span>
            <span className="text-2xl font-bold text-emerald-700">
              ${totalAmount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">訂單狀態</span>
            <span className="text-emerald-700 font-medium">已確認</span>
          </div>
        </div>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border-2 border-emerald-600 text-emerald-700 font-semibold text-center py-4 text-lg hover:bg-emerald-50 transition-colors"
          >
            下載契約 PDF
          </a>
        )}

        <BigButton fullWidth onClick={handleNewCheckin}>
          下一位客戶報到
        </BigButton>
      </div>
    </PosLayout>
  )
}
