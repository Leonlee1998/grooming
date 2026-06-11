'use client'

import { useState } from 'react'
import type {
  PriceRuleData,
  PriceRuleInput,
} from '@/app/(dashboard)/services/actions'
import {
  createPriceRule,
  deletePriceRule,
} from '@/app/(dashboard)/services/actions'

function describeRule(rule: PriceRuleData): string {
  const parts: string[] = []
  if (rule.weightMin != null && rule.weightMax != null) {
    parts.push(`${rule.weightMin}–${rule.weightMax} kg`)
  } else if (rule.weightMin != null) {
    parts.push(`>${rule.weightMin} kg`)
  } else if (rule.weightMax != null) {
    parts.push(`≤${rule.weightMax} kg`)
  }
  if (rule.breed) parts.push(rule.breed)
  const sign = rule.priceAdjustment >= 0 ? '+' : ''
  parts.push(
    rule.adjustmentType === 'FIXED'
      ? `${sign}${rule.priceAdjustment} 元`
      : `${sign}${rule.priceAdjustment}%`,
  )
  return parts.join('，')
}

const EMPTY_FORM = {
  name: '',
  adjustmentType: 'FIXED' as PriceRuleData['adjustmentType'],
  priceAdjustment: '',
  weightMin: '',
  weightMax: '',
  breed: '',
}

function AddRuleForm({
  serviceId,
  onAdd,
}: {
  serviceId: string
  onAdd: (rule: PriceRuleData) => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleAdd() {
    setError(null)
    if (!form.name.trim()) {
      setError('規則名稱必填')
      return
    }
    const adj = parseInt(form.priceAdjustment, 10)
    if (isNaN(adj)) {
      setError('調整金額必填')
      return
    }

    const input: PriceRuleInput = {
      serviceId,
      name: form.name.trim(),
      adjustmentType: form.adjustmentType,
      priceAdjustment: adj,
      weightMin: form.weightMin ? parseFloat(form.weightMin) : null,
      weightMax: form.weightMax ? parseFloat(form.weightMax) : null,
      breed: form.breed.trim() || null,
      isActive: true,
    }
    setSubmitting(true)
    try {
      const rule = await createPriceRule(input)
      onAdd(rule)
      setForm(EMPTY_FORM)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const previewRule: PriceRuleData = {
    id: 'preview',
    serviceId: '',
    name: form.name || '規則',
    weightMin: form.weightMin ? parseFloat(form.weightMin) : null,
    weightMax: form.weightMax ? parseFloat(form.weightMax) : null,
    breed: form.breed || null,
    priceAdjustment: parseInt(form.priceAdjustment) || 0,
    adjustmentType: form.adjustmentType,
    isActive: true,
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
      >
        <span className="text-base leading-none">+</span> 新增規則
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">新增定價規則</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          規則名稱 *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="例：大型犬加價"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            調整類型 *
          </label>
          <select
            value={form.adjustmentType}
            onChange={(e) => set('adjustmentType', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="FIXED">固定金額</option>
            <option value="PERCENTAGE">百分比</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {form.adjustmentType === 'FIXED'
              ? '金額（元，可為負）'
              : '百分比（可為負）'}{' '}
            *
          </label>
          <input
            type="number"
            step={1}
            value={form.priceAdjustment}
            onChange={(e) => set('priceAdjustment', e.target.value)}
            placeholder="200"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            體重下限 kg（選填）
          </label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={form.weightMin}
            onChange={(e) => set('weightMin', e.target.value)}
            placeholder="10"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            體重上限 kg（選填）
          </label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={form.weightMax}
            onChange={(e) => set('weightMax', e.target.value)}
            placeholder="20"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          品種（選填）
        </label>
        <input
          type="text"
          value={form.breed}
          onChange={(e) => set('breed', e.target.value)}
          placeholder="例：貴賓犬"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {(form.name || form.priceAdjustment) && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          預覽：{describeRule(previewRule)}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setForm(EMPTY_FORM)
            setError(null)
          }}
          className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
        >
          {submitting ? '新增中…' : '確認新增'}
        </button>
      </div>
    </div>
  )
}

interface PriceRuleListProps {
  serviceId: string
  initialRules: PriceRuleData[]
}

export function PriceRuleList({ serviceId, initialRules }: PriceRuleListProps) {
  const [rules, setRules] = useState(initialRules)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  async function handleDelete(id: string) {
    if (!window.confirm('確定要刪除這條規則嗎？')) return
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await deletePriceRule(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        定價規則
        <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {rules.length} 條
        </span>
      </h3>

      {rules.length === 0 ? (
        <p className="text-sm text-slate-400">尚無規則，將直接使用基礎價格</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {rule.name}
                </p>
                <p className="text-xs text-slate-500">{describeRule(rule)}</p>
              </div>
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={deletingIds.has(rule.id)}
                className="ml-4 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                aria-label="刪除規則"
              >
                {deletingIds.has(rule.id) ? '…' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddRuleForm
        serviceId={serviceId}
        onAdd={(rule) => setRules((prev) => [...prev, rule])}
      />
    </div>
  )
}
