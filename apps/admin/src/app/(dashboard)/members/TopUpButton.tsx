'use client'

import { useState, useTransition } from 'react'
import { topUpBalance } from './actions'

interface TopUpButtonProps {
  memberId: string
  customerName: string
}

export function TopUpButton({ memberId, customerName }: TopUpButtonProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleOpen() {
    setAmount('')
    setNote('')
    setError('')
    setOpen(true)
  }

  function handleSubmit() {
    const num = parseInt(amount, 10)
    if (isNaN(num) || num <= 0) {
      setError('請輸入正整數金額')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await topUpBalance(memberId, num, note || undefined)
        setOpen(false)
      } catch {
        setError('儲值失敗，請重試')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        儲值
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="font-semibold text-slate-900">
                儲值 — {customerName}
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  儲值金額（元） <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    NT$
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-slate-500 focus:outline-none"
                    placeholder="500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  備註（選填）
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  placeholder="現金儲值"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {pending ? '儲值中...' : '確認儲值'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
