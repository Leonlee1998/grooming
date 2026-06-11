'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { sendContractToLine } from '@/app/actions/contract'

function fmtDatetime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

function OrderIdBadge({ orderId }: { orderId: string }) {
  return (
    <span className="font-mono text-sm bg-stone-100 text-stone-600 rounded px-2 py-0.5">
      #{orderId.slice(-8).toUpperCase()}
    </span>
  )
}

type LineState = 'idle' | 'sending' | 'sent' | 'no-line' | 'error'

export default function CompletePage() {
  const router = useRouter()
  const {
    customerId,
    customerName,
    petName,
    totalAmount,
    pdfUrl,
    orderId,
    pickupDeadlineAt,
    reset,
  } = useCheckinStore((s) => ({
    customerId: s.customerId,
    customerName: s.customerName,
    petName: s.petName,
    totalAmount: s.totalAmount,
    pdfUrl: s.pdfUrl,
    orderId: s.orderId,
    pickupDeadlineAt: s.pickupDeadlineAt,
    reset: s.reset,
  }))

  const [lineState, setLineState] = useState<LineState>('idle')
  const [lineError, setLineError] = useState('')

  useEffect(() => {
    if (!orderId) router.replace('/checkin')
  }, [orderId, router])

  async function handleSendLine() {
    if (!customerId || !orderId || !pdfUrl) return
    setLineState('sending')
    setLineError('')

    const result = await sendContractToLine({ customerId, orderId, pdfUrl })
    if (!result.ok) {
      setLineState('error')
      setLineError(result.error)
      return
    }
    setLineState(result.data.sent ? 'sent' : 'no-line')
  }

  function handleNewCheckin() {
    reset()
    router.push('/checkin')
  }

  if (!orderId) return null

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6 pt-6 pb-10">
        {/* 完成圖示 */}
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-10 h-10 text-emerald-600"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* 標題 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-stone-900">報到完成！</h1>
          <p className="mt-2 text-stone-500 text-lg">
            {customerName} 與 {petName} 已完成簽約
          </p>
        </div>

        {/* 訂單資訊卡 */}
        <div className="w-full rounded-xl bg-white border border-stone-200 divide-y divide-stone-100">
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-stone-500 text-sm">訂單編號</span>
            <OrderIdBadge orderId={orderId} />
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-stone-500 text-sm">應收金額</span>
            <span className="text-2xl font-bold text-emerald-700">
              ${totalAmount}
            </span>
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-stone-500 text-sm">訂單狀態</span>
            <span className="text-emerald-700 font-medium text-sm">已確認</span>
          </div>
          {pickupDeadlineAt && (
            <div className="flex justify-between items-center px-5 py-4">
              <span className="text-stone-500 text-sm">約定接回時間</span>
              <span className="font-semibold text-stone-900 text-sm">
                {fmtDatetime(pickupDeadlineAt)}
              </span>
            </div>
          )}
        </div>

        {/* PDF 按鈕 */}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border-2 border-emerald-600 text-emerald-700 font-semibold text-center py-4 text-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 13h6m-3-3v6"
              />
            </svg>
            查看 / 下載契約 PDF
          </a>
        )}

        {/* LINE 通知按鈕 */}
        <div className="w-full">
          {lineState === 'idle' && (
            <button
              onClick={handleSendLine}
              className="w-full rounded-xl border-2 border-[#06c755] text-[#06c755] font-semibold text-center py-4 text-lg hover:bg-green-50 active:bg-green-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              發送 LINE 通知給客戶
            </button>
          )}

          {lineState === 'sending' && (
            <div className="w-full rounded-xl border-2 border-stone-200 text-stone-400 font-semibold text-center py-4 text-lg flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              傳送中…
            </div>
          )}

          {lineState === 'sent' && (
            <div className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-center py-4 text-base flex items-center justify-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              LINE 通知已成功傳送！
            </div>
          )}

          {lineState === 'no-line' && (
            <div className="w-full rounded-xl border-2 border-stone-200 bg-stone-50 text-stone-500 font-medium text-center py-4 text-sm">
              此客戶尚未綁定 LINE，無法傳送通知
            </div>
          )}

          {lineState === 'error' && (
            <div className="w-full flex flex-col gap-2">
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
                {lineError}
              </div>
              <button
                onClick={handleSendLine}
                className="text-sm text-stone-400 underline text-center"
              >
                重新嘗試
              </button>
            </div>
          )}
        </div>

        {/* 完成按鈕 */}
        <BigButton fullWidth onClick={handleNewCheckin}>
          完成，返回首頁
        </BigButton>
      </div>
    </PosLayout>
  )
}
