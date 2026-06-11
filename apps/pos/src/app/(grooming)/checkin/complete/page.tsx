'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { useShallow } from 'zustand/react/shallow'
import { generateAndSendContract } from '@/app/actions/contract'

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

type LineState = 'sending' | 'sent' | 'no-line' | 'error'

export default function CompletePage() {
  const router = useRouter()
  const {
    customerId,
    customerName,
    petName,
    totalAmount,
    orderId,
    earnedPoints,
    pickupDeadlineAt,
    paymentMethod,
    hasOnlineContract,
    reset,
  } = useCheckinStore(
    useShallow((s) => ({
      customerId: s.customerId,
      customerName: s.customerName,
      petName: s.petName,
      totalAmount: s.totalAmount,
      orderId: s.orderId,
      earnedPoints: s.earnedPoints,
      pickupDeadlineAt: s.pickupDeadlineAt,
      paymentMethod: s.paymentMethod,
      hasOnlineContract: s.hasOnlineContract,
      reset: s.reset,
    })),
  )

  const [lineState, setLineState] = useState<LineState>('sending')
  const [lineError, setLineError] = useState('')
  const triggered = useRef(false)

  useEffect(() => {
    if (!orderId) {
      router.replace('/checkin')
      return
    }
    if (triggered.current) return
    triggered.current = true

    // 線上合約情況下不重新產出 PDF
    if (hasOnlineContract) {
      setLineState('no-line')
      return
    }

    if (!customerId) return

    generateAndSendContract({ orderId, customerId }).then((result) => {
      if (!result.ok) {
        setLineError(result.error)
        setLineState('error')
        return
      }
      setLineState(result.data.sent ? 'sent' : 'no-line')
    })
  }, [orderId, customerId, hasOnlineContract, router])

  async function handleRetry() {
    if (!customerId || !orderId) return
    setLineState('sending')
    setLineError('')
    const result = await generateAndSendContract({ orderId, customerId })
    if (!result.ok) {
      setLineError(result.error)
      setLineState('error')
      return
    }
    setLineState(result.data.sent ? 'sent' : 'no-line')
  }

  function handleNewCheckin() {
    reset()
    router.push('/checkin')
  }

  const PAYMENT_LABEL: Record<string, string> = {
    CASH: '現金',
    CARD: '刷卡',
    TRANSFER: '轉帳',
    MEMBER_BALANCE: '儲值金',
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
          <h1 className="text-3xl font-bold text-stone-900">
            {hasOnlineContract ? '到店確認完成！' : '報到完成！'}
          </h1>
          <p className="mt-2 text-stone-500 text-lg">
            {hasOnlineContract
              ? `${customerName} 的 ${petName} 已確認到店`
              : `${customerName} 與 ${petName} 已完成簽約`}
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
          {paymentMethod && (
            <div className="flex justify-between items-center px-5 py-4">
              <span className="text-stone-500 text-sm">付款方式</span>
              <span className="font-medium text-stone-900 text-sm">
                {PAYMENT_LABEL[paymentMethod] ?? paymentMethod}
              </span>
            </div>
          )}
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

        {/* 累積點數 */}
        {earnedPoints !== null && earnedPoints > 0 && (
          <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 text-amber-700"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-amber-900">
                本次累積 {earnedPoints} 點
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                已自動存入會員帳戶
              </p>
            </div>
          </div>
        )}

        {/* PDF 產出 & LINE 通知狀態 */}
        <div className="w-full">
          {lineState === 'sending' && (
            <div className="w-full rounded-xl border-2 border-stone-200 text-stone-400 font-semibold text-center py-4 text-base flex items-center justify-center gap-2">
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
              產出 PDF 並傳送 LINE 通知中…
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
              契約 PDF 已透過 LINE 傳送給客戶
            </div>
          )}

          {lineState === 'no-line' && (
            <div className="w-full rounded-xl border-2 border-stone-200 bg-stone-50 text-stone-500 font-medium text-center py-4 text-sm">
              {hasOnlineContract
                ? '已採用線上簽約合約，無需重新產出 PDF。'
                : 'PDF 已產出並存檔。此客戶尚未綁定 LINE，無法傳送通知。'}
            </div>
          )}

          {lineState === 'error' && (
            <div className="w-full flex flex-col gap-2">
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
                {lineError}
              </div>
              <button
                onClick={handleRetry}
                className="text-sm text-stone-500 underline text-center min-h-[44px]"
              >
                重新嘗試 PDF 產出 / LINE 傳送
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
