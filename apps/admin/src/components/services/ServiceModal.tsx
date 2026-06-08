'use client'

import { useState, useEffect, FormEvent } from 'react'
import type {
  ServiceData,
  ServiceInput,
} from '@/app/(dashboard)/services/actions'
import {
  createService,
  updateService,
} from '@/app/(dashboard)/services/actions'
import { PriceRuleList } from './PriceRuleList'

const CATEGORIES: Array<{ value: ServiceData['category']; label: string }> = [
  { value: 'BATH', label: '洗澡' },
  { value: 'HAIRCUT', label: '剪毛' },
  { value: 'NAIL', label: '美甲' },
  { value: 'SPA', label: 'SPA' },
  { value: 'OTHER', label: '其他' },
]

interface ServiceModalProps {
  service: ServiceData | null
  onClose: () => void
  onSave: (service: ServiceData) => void
}

export function ServiceModal({ service, onClose, onSave }: ServiceModalProps) {
  const isEdit = service !== null

  const [name, setName] = useState(service?.name ?? '')
  const [category, setCategory] = useState<ServiceData['category']>(
    service?.category ?? 'BATH',
  )
  const [description, setDescription] = useState(service?.description ?? '')
  const [basePrice, setBasePrice] = useState(String(service?.basePrice ?? ''))
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    String(service?.estimatedMinutes ?? '60'),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const basePriceNum = parseInt(basePrice, 10)
    const minutesNum = parseInt(estimatedMinutes, 10)
    if (isNaN(basePriceNum) || basePriceNum < 0) {
      setError('基礎價格必須為非負整數')
      return
    }
    if (isNaN(minutesNum) || minutesNum < 1) {
      setError('預估時間至少 1 分鐘')
      return
    }

    const input: ServiceInput = {
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      basePrice: basePriceNum,
      estimatedMinutes: minutesNum,
    }

    setSubmitting(true)
    try {
      const saved = isEdit
        ? await updateService(service.id, input)
        : await createService(input)
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? `編輯服務：${service.name}` : '新增服務'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 名稱 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                服務名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例：貴賓犬造型剪"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* 分類 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                分類 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={[
                      'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                      category === cat.value
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-emerald-400',
                    ].join(' ')}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 價格 + 時間 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  基礎價格（元） <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    NT$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  預估時間（分鐘） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  required
                  placeholder="60"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 說明 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                服務說明（選填）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="對客戶顯示的服務說明文字"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 定價規則 */}
          {isEdit ? (
            <div className="border-t border-slate-200 px-6 py-5">
              <PriceRuleList
                serviceId={service.id}
                initialRules={service.priceRules}
              />
            </div>
          ) : (
            <div className="border-t border-slate-200 px-6 py-4">
              <p className="text-sm text-slate-400">
                💡 儲存後可進入編輯模式新增定價規則
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '儲存中…' : isEdit ? '儲存變更' : '建立服務'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
