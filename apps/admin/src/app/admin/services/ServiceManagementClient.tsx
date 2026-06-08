'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createPriceRule,
  createService,
  deletePriceRule,
  reorderServices,
  toggleServiceActive,
  updateService,
} from './actions'
import {
  generatePriceRuleName,
  priceRuleSchema,
  serviceCategoryOptions,
  serviceSchema,
  type PriceRuleFormInput,
  type ServiceFormInput,
} from './schemas'
import type { PriceRule, Service, ServiceCategory } from './types'

const categoryLabel: Record<ServiceCategory, string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '指甲',
  SPA: 'SPA',
  OTHER: '其他',
}

const defaultServiceForm: ServiceFormInput = {
  name: '',
  category: 'BATH',
  description: '',
  basePrice: 0,
  estimatedMinutes: 60,
  sortOrder: 0,
  isActive: true,
}

function defaultRuleForm(serviceId: string): PriceRuleFormInput {
  return {
    serviceId,
    weightMin: '',
    weightMax: '',
    breed: '',
    priceAdjustment: 0,
    adjustmentType: 'FIXED',
    isActive: true,
  }
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString('zh-TW')}`
}

function fieldError(errors: Record<string, string>, name: string) {
  return errors[name] ? (
    <p className="mt-1 text-xs font-medium text-red-600">{errors[name]}</p>
  ) : null
}

function zodErrors(error: {
  errors: Array<{ path: Array<string | number>; message: string }>
}) {
  return error.errors.reduce<Record<string, string>>((acc, item) => {
    const key = String(item.path[0] ?? 'form')
    if (!acc[key]) acc[key] = item.message
    return acc
  }, {})
}

type ServiceModalState =
  | { mode: 'create'; service: null }
  | { mode: 'edit'; service: Service }

interface ServiceManagementClientProps {
  initialServices: Service[]
}

export function ServiceManagementClient({
  initialServices,
}: ServiceManagementClientProps) {
  const [services, setServices] = useState(initialServices)
  const [modalState, setModalState] = useState<ServiceModalState | null>(null)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(
    null,
  )
  const [notice, setNotice] = useState('')
  const sensors = useSensors(useSensor(PointerSensor))

  const activeCount = services.filter((service) => service.isActive).length
  const ruleCount = services.reduce(
    (sum, service) => sum + service.priceRules.length,
    0,
  )

  function replaceService(nextService: Service) {
    setServices((current) =>
      current
        .map((service) =>
          service.id === nextService.id ? nextService : service,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    )
  }

  async function handleToggle(service: Service) {
    const previous = services
    setNotice('')
    setServices((current) =>
      current.map((item) =>
        item.id === service.id ? { ...item, isActive: !item.isActive } : item,
      ),
    )

    try {
      const updated = await toggleServiceActive(service.id)
      replaceService(updated)
    } catch {
      setServices(previous)
      setNotice('切換啟用狀態失敗，已還原')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const previous = services
    const oldIndex = services.findIndex((service) => service.id === active.id)
    const newIndex = services.findIndex((service) => service.id === over.id)
    const reordered = arrayMove(services, oldIndex, newIndex).map(
      (service, index) => ({ ...service, sortOrder: index + 1 }),
    )

    setNotice('')
    setServices(reordered)

    try {
      await reorderServices(reordered.map((service) => service.id))
    } catch {
      setServices(previous)
      setNotice('排序儲存失敗，已還原')
    }
  }

  async function handleDeleteRule(rule: PriceRule) {
    const confirmed = window.confirm(`刪除定價規則「${rule.name}」？`)
    if (!confirmed) return

    const previous = services
    setServices((current) =>
      current.map((service) =>
        service.id === rule.serviceId
          ? {
              ...service,
              priceRules: service.priceRules.filter(
                (item) => item.id !== rule.id,
              ),
            }
          : service,
      ),
    )

    try {
      await deletePriceRule(rule.id)
    } catch {
      setServices(previous)
      setNotice('刪除定價規則失敗，已還原')
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-950 px-5 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-lg font-black">
              P
            </div>
            <div>
              <p className="text-sm text-slate-400">Pet Grooming</p>
              <p className="font-bold">後台管理</p>
            </div>
          </div>

          <nav className="mt-8 flex flex-col gap-1 text-sm">
            {['Dashboard', 'Appointments', 'Customers', 'Orders'].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-lg px-3 py-2 text-slate-400"
                >
                  {item}
                </span>
              ),
            )}
            <span className="rounded-lg bg-white px-3 py-2 font-semibold text-slate-950">
              Services
            </span>
            {['Members', 'Reports', 'Settings'].map((item) => (
              <span key={item} className="rounded-lg px-3 py-2 text-slate-400">
                {item}
              </span>
            ))}
          </nav>
        </aside>

        <section className="flex flex-col">
          <header className="border-b border-slate-200 bg-white px-8 py-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Service Catalog
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-normal">
                  服務項目管理
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  維護前台 POS 可選的美容服務、價格、時間與體重/品種定價規則。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalState({ mode: 'create', service: null })}
                className="min-h-[44px] rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white transition-colors active:bg-emerald-800"
              >
                新增服務
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Metric label="服務總數" value={services.length} />
              <Metric label="啟用中" value={activeCount} tone="green" />
              <Metric label="定價規則" value={ruleCount} />
            </div>
          </header>

          <div className="flex-1 px-8 py-6">
            {notice && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {notice}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">服務列表</p>
                  <p className="text-sm text-slate-500">
                    拖曳左側排序把手調整 POS 顯示順序
                  </p>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="w-12 px-4 py-3" />
                      <th className="px-4 py-3">名稱</th>
                      <th className="px-4 py-3">分類</th>
                      <th className="px-4 py-3 text-right">基礎價格</th>
                      <th className="px-4 py-3 text-right">預估時間</th>
                      <th className="px-4 py-3">啟用狀態</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={services.map((service) => service.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {services.map((service) => (
                        <SortableServiceRow
                          key={service.id}
                          service={service}
                          expanded={expandedServiceId === service.id}
                          onToggleActive={handleToggle}
                          onEdit={(target) =>
                            setModalState({ mode: 'edit', service: target })
                          }
                          onToggleRules={(id) =>
                            setExpandedServiceId((current) =>
                              current === id ? null : id,
                            )
                          }
                          onRuleCreated={replaceService}
                          onDeleteRule={handleDeleteRule}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </div>
        </section>
      </div>

      {modalState && (
        <ServiceModal
          state={modalState}
          nextSortOrder={services.length + 1}
          onClose={() => setModalState(null)}
          onSaved={(service) => {
            if (modalState.mode === 'create') {
              setServices((current) =>
                [...current, service].sort((a, b) => a.sortOrder - b.sortOrder),
              )
            } else {
              replaceService(service)
            }
            setModalState(null)
          }}
        />
      )}
    </main>
  )
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'green'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p
        className={[
          'mt-1 text-2xl font-black',
          tone === 'green' ? 'text-emerald-700' : 'text-slate-950',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function SortableServiceRow({
  service,
  expanded,
  onToggleActive,
  onEdit,
  onToggleRules,
  onRuleCreated,
  onDeleteRule,
}: {
  service: Service
  expanded: boolean
  onToggleActive: (service: Service) => void
  onEdit: (service: Service) => void
  onToggleRules: (serviceId: string) => void
  onRuleCreated: (service: Service) => void
  onDeleteRule: (rule: PriceRule) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={[
          'border-b border-slate-100 bg-white',
          isDragging ? 'relative z-10 shadow-lg' : '',
        ].join(' ')}
      >
        <td className="px-4 py-4 align-middle">
          <button
            type="button"
            className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg border border-slate-200 text-slate-400 active:cursor-grabbing"
            aria-label="拖曳排序"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        </td>
        <td className="px-4 py-4 align-middle">
          <div>
            <p className="font-bold text-slate-950">{service.name}</p>
            <p className="mt-1 line-clamp-1 max-w-xs text-xs text-slate-500">
              {service.description || '未填寫說明'}
            </p>
          </div>
        </td>
        <td className="px-4 py-4 align-middle">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {categoryLabel[service.category]}
          </span>
        </td>
        <td className="px-4 py-4 text-right font-semibold tabular-nums align-middle">
          {formatMoney(service.basePrice)}
        </td>
        <td className="px-4 py-4 text-right tabular-nums text-slate-700 align-middle">
          {service.estimatedMinutes} 分
        </td>
        <td className="px-4 py-4 align-middle">
          <button
            type="button"
            onClick={() => onToggleActive(service)}
            className={[
              'inline-flex min-h-[36px] w-24 items-center justify-center rounded-full text-xs font-bold transition-colors',
              service.isActive
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-500',
            ].join(' ')}
          >
            {service.isActive ? '啟用中' : '已停用'}
          </button>
        </td>
        <td className="px-4 py-4 align-middle">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onToggleRules(service.id)}
              className="min-h-[36px] rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 active:bg-slate-100"
            >
              規則 {service.priceRules.length}
            </button>
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="min-h-[36px] rounded-lg bg-slate-950 px-3 text-xs font-bold text-white active:bg-slate-800"
            >
              編輯
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td colSpan={7} className="px-6 py-5">
            <PriceRulesPanel
              service={service}
              onRuleCreated={onRuleCreated}
              onDeleteRule={onDeleteRule}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function ServiceModal({
  state,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  state: ServiceModalState
  nextSortOrder: number
  onClose: () => void
  onSaved: (service: Service) => void
}) {
  const initial =
    state.mode === 'edit'
      ? {
          name: state.service.name,
          category: state.service.category,
          description: state.service.description ?? '',
          basePrice: state.service.basePrice,
          estimatedMinutes: state.service.estimatedMinutes,
          sortOrder: state.service.sortOrder,
          isActive: state.service.isActive,
        }
      : { ...defaultServiceForm, sortOrder: nextSortOrder }

  const [form, setForm] = useState<ServiceFormInput>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const parsed = serviceSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error))
      return
    }

    setErrors({})
    setSaving(true)
    try {
      const service =
        state.mode === 'create'
          ? await createService(parsed.data)
          : await updateService(state.service.id, parsed.data)
      onSaved(service)
    } catch {
      setErrors({ form: '儲存服務失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-6 py-8">
      <div className="grid max-h-[90vh] w-full max-w-5xl grid-cols-[minmax(0,1fr)_320px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                {state.mode === 'create' ? 'New Service' : 'Edit Service'}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {state.mode === 'create' ? '新增服務' : '編輯服務'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-600"
            >
              關閉
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <label className="col-span-2">
              <span className="text-sm font-bold text-slate-700">服務名稱</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-emerald-600"
                placeholder="洗澡 SPA"
              />
              {fieldError(errors, 'name')}
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">分類</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as ServiceCategory,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-600"
              >
                {serviceCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel[category]}
                  </option>
                ))}
              </select>
              {fieldError(errors, 'category')}
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">排序</span>
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-600"
              />
              {fieldError(errors, 'sortOrder')}
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">基礎價格</span>
              <input
                type="number"
                min={0}
                value={form.basePrice}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    basePrice: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-600"
              />
              {fieldError(errors, 'basePrice')}
            </label>

            <label>
              <span className="text-sm font-bold text-slate-700">
                預估時間（分鐘）
              </span>
              <input
                type="number"
                min={1}
                value={form.estimatedMinutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    estimatedMinutes: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-600"
              />
              {fieldError(errors, 'estimatedMinutes')}
            </label>

            <label className="col-span-2">
              <span className="text-sm font-bold text-slate-700">服務說明</span>
              <textarea
                rows={4}
                value={form.description ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-emerald-600"
                placeholder="供前台辨識服務內容，可留空"
              />
              {fieldError(errors, 'description')}
            </label>

            <label className="col-span-2 flex min-h-[52px] items-center justify-between rounded-lg border border-slate-200 px-4">
              <span>
                <span className="block text-sm font-bold text-slate-700">
                  啟用狀態
                </span>
                <span className="text-xs text-slate-500">
                  停用後不會出現在 POS 服務選擇
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-emerald-700"
              />
            </label>
          </div>

          {errors.form && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errors.form}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-slate-300 px-5 text-sm font-bold text-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存服務'}
            </button>
          </div>
        </div>

        <aside className="border-l border-slate-200 bg-slate-50 px-5 py-6">
          <p className="text-sm font-bold text-slate-500">即時預覽</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black text-slate-950">
                  {form.name || '服務名稱'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {categoryLabel[form.category]}
                </p>
              </div>
              <span
                className={[
                  'rounded-full px-3 py-1 text-xs font-bold',
                  form.isActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-500',
                ].join(' ')}
              >
                {form.isActive ? '啟用' : '停用'}
              </span>
            </div>
            <p className="mt-6 text-3xl font-black text-emerald-800">
              {formatMoney(form.basePrice)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              約 {form.estimatedMinutes || 0} 分鐘 · 排序 {form.sortOrder}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {form.description || '尚無服務說明'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PriceRulesPanel({
  service,
  onRuleCreated,
  onDeleteRule,
}: {
  service: Service
  onRuleCreated: (service: Service) => void
  onDeleteRule: (rule: PriceRule) => void
}) {
  const [form, setForm] = useState(defaultRuleForm(service.id))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const generatedName = useMemo(() => generatePriceRuleName(form), [form])

  async function handleCreateRule() {
    const parsed = priceRuleSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error))
      return
    }

    setErrors({})
    setSaving(true)
    try {
      const rule = await createPriceRule(parsed.data)
      onRuleCreated({
        ...service,
        priceRules: [...service.priceRules, rule].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      })
      setForm(defaultRuleForm(service.id))
    } catch {
      setErrors({ form: '新增定價規則失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold text-slate-900">定價規則</p>
          <p className="text-xs text-slate-500">
            依體重與品種套用，POS 試算會自動計入
          </p>
        </div>

        {service.priceRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
            尚未建立定價規則
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {service.priceRules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="font-semibold text-slate-900">{rule.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    體重 {rule.weightMin || '不限'} - {rule.weightMax || '不限'}{' '}
                    kg
                    {rule.breed ? ` · 品種 ${rule.breed}` : ' · 不限品種'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRule(rule)}
                  className="min-h-[36px] rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 active:bg-red-50"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="font-bold text-slate-900">新增規則</p>
        <p className="mt-1 text-xs text-slate-500">{generatedName}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-bold text-slate-600">體重下限</span>
            <input
              type="number"
              step="0.1"
              value={form.weightMin ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  weightMin: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
              placeholder="10"
            />
            {fieldError(errors, 'weightMin')}
          </label>

          <label>
            <span className="text-xs font-bold text-slate-600">體重上限</span>
            <input
              type="number"
              step="0.1"
              value={form.weightMax ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  weightMax: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
              placeholder="20"
            />
            {fieldError(errors, 'weightMax')}
          </label>

          <label className="col-span-2">
            <span className="text-xs font-bold text-slate-600">品種</span>
            <input
              value={form.breed ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  breed: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
              placeholder="貴賓犬，可留空"
            />
            {fieldError(errors, 'breed')}
          </label>

          <label>
            <span className="text-xs font-bold text-slate-600">加減價</span>
            <input
              type="number"
              value={form.priceAdjustment}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priceAdjustment: Number(event.target.value),
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
            />
            {fieldError(errors, 'priceAdjustment')}
          </label>

          <label>
            <span className="text-xs font-bold text-slate-600">類型</span>
            <select
              value={form.adjustmentType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adjustmentType: event.target.value as 'FIXED' | 'PERCENTAGE',
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
            >
              <option value="FIXED">固定金額</option>
              <option value="PERCENTAGE">百分比</option>
            </select>
          </label>
        </div>

        {errors.form && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {errors.form}
          </p>
        )}

        <button
          type="button"
          onClick={handleCreateRule}
          disabled={saving}
          className="mt-4 min-h-[40px] w-full rounded-lg bg-slate-950 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? '新增中…' : '新增定價規則'}
        </button>
      </div>
    </div>
  )
}
