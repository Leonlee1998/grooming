'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CustomFieldDef, StaffData, StaffInput } from './actions'
import {
  updateSettings,
  updateContractCustomFields,
  upsertStaff,
  toggleStaffActive,
} from './actions'
import { LOCKED_FIELDS } from './constants'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  '店家資訊',
  '線上預約',
  '契約欄位',
  '費用設定',
  '通知設定',
  '員工管理',
] as const
type Tab = (typeof TABS)[number]

const ROLE_LABELS: Record<string, string> = {
  GROOMER: '美容師',
  MANAGER: '店長',
  ADMIN: '管理員',
}

const TYPE_LABELS: Record<string, string> = {
  text: '單行文字',
  textarea: '多行文字',
  number: '數字',
  date: '日期',
  checkbox: '勾選框',
}

const SAMPLE_VALUES: Record<string, string> = {
  customer_name: '王小明',
  pet_name: '毛毛',
  service_items: '基礎美容（洗澡+剪毛）、指甲修剪',
  service_price: '1,200',
  groomer_name: '李美容師',
  health_notes: '健康狀況良好，無攻擊性',
  vet_clinic: '台北動物醫院',
}

// ─── Shared: SaveButton ───────────────────────────────────────────────────────

function SaveButton({
  pending,
  saved,
  onClick,
}: {
  pending: boolean
  saved: boolean
  onClick?: () => void
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
    >
      {saved ? '✓ 已儲存' : pending ? '儲存中...' : '儲存'}
    </button>
  )
}

// ─── Contract Preview Modal ───────────────────────────────────────────────────

function ContractPreviewModal({
  fields,
  onClose,
}: {
  fields: CustomFieldDef[]
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h3 className="font-semibold text-slate-900">
            契約預覽（假資料示意）
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            關閉
          </button>
        </div>
        <div className="p-8">
          <h2 className="mb-1 text-center text-xl font-bold text-slate-900">
            犬、貓美容服務契約
          </h2>
          <p className="mb-6 text-center text-xs text-slate-400">
            農業部 114 年 5 月 12 日公告定型化契約
          </p>
          <div className="space-y-3">
            {fields.map((field) => {
              const sample =
                SAMPLE_VALUES[field.key] ??
                (field.type === 'checkbox' ? '□ 已確認' : '（填寫區）')
              return (
                <div
                  key={field.key}
                  className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-3"
                >
                  <div className="text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                    {field.locked && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                        必填
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 whitespace-pre-line rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {sample}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6">
            <div>
              <p className="mb-6 text-sm font-medium text-slate-700">
                客戶簽名：
              </p>
              <div className="border-b border-slate-400" />
              <p className="mt-1 text-xs text-slate-400">
                日期：_____ 年 _____ 月 _____ 日
              </p>
            </div>
            <div>
              <p className="mb-6 text-sm font-medium text-slate-700">
                業者蓋章：
              </p>
              <div className="border-b border-slate-400" />
              <p className="mt-1 text-xs text-slate-400">
                日期：_____ 年 _____ 月 _____ 日
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable Field Row ───────────────────────────────────────────────────────

function SortableFieldRow({
  field,
  onDelete,
}: {
  field: CustomFieldDef
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.key,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 ${
        isDragging
          ? 'border-slate-400 shadow-lg opacity-90'
          : 'border-slate-200'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none select-none text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        ⣿
      </button>
      <span className="flex-1 text-sm font-medium text-slate-900">
        {field.label}
      </span>
      <span className="w-24 text-xs text-slate-500">
        {TYPE_LABELS[field.type] ?? field.type}
      </span>
      <span
        className={`w-12 text-xs ${field.required ? 'text-slate-700' : 'text-slate-400'}`}
      >
        {field.required ? '必填' : '選填'}
      </span>
      <button
        onClick={onDelete}
        className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
      >
        刪除
      </button>
    </div>
  )
}

// ─── Staff Modal ──────────────────────────────────────────────────────────────

function StaffModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: StaffData | null
  onClose: () => void
  onSaved: (staff: StaffData) => void
}) {
  const [form, setForm] = useState<StaffInput>({
    name: editing?.name ?? '',
    role: editing?.role ?? 'GROOMER',
    phone: editing?.phone ?? '',
    surcharge: editing?.surcharge ?? 0,
    isActive: editing?.isActive ?? true,
  })
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('姓名必填')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        const saved = await upsertStaff(editing?.id ?? null, form)
        onSaved(saved)
        onClose()
      } catch {
        setError('儲存失敗，請重試')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">
            {editing ? '編輯員工' : '新增員工'}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="美容師姓名"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              職位
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as StaffInput['role'],
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="GROOMER">美容師</option>
              <option value="MANAGER">店長</option>
              <option value="ADMIN">管理員</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              電話
            </label>
            <input
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value || null }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="0912345678"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              附加費（元）
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={form.surcharge}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  surcharge: parseInt(e.target.value, 10) || 0,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
              由該員工服務時額外加收的費用
            </p>
          </div>
          {editing && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">
                啟用狀態
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, isActive: !f.isActive }))
                }
                className={`relative h-6 w-11 rounded-full transition ${form.isActive ? 'bg-slate-900' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Section: Store Info ──────────────────────────────────────────────────────

function StoreInfoSection({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState({
    'store.name': initial['store.name'] ?? '',
    'store.address': initial['store.address'] ?? '',
    'store.phone': initial['store.phone'] ?? '',
    'store.email': initial['store.email'] ?? '',
    'store.owner': initial['store.owner'] ?? '',
  })
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateSettings(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <p className="text-sm text-slate-500">
        這些資訊將顯示在客戶契約的業者欄位
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          店名
        </label>
        <input
          type="text"
          value={values['store.name']}
          onChange={(e) =>
            setValues((v) => ({ ...v, 'store.name': e.target.value }))
          }
          className={inputCls}
          placeholder="毛孩美容工作室"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          地址
        </label>
        <input
          type="text"
          value={values['store.address']}
          onChange={(e) =>
            setValues((v) => ({ ...v, 'store.address': e.target.value }))
          }
          className={inputCls}
          placeholder="台北市信義區信義路一段 1 號"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          電話
        </label>
        <input
          type="tel"
          value={values['store.phone']}
          onChange={(e) =>
            setValues((v) => ({ ...v, 'store.phone': e.target.value }))
          }
          className={inputCls}
          placeholder="02-12345678"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          value={values['store.email']}
          onChange={(e) =>
            setValues((v) => ({ ...v, 'store.email': e.target.value }))
          }
          className={inputCls}
          placeholder="hello@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          店長姓名
        </label>
        <input
          type="text"
          value={values['store.owner']}
          onChange={(e) =>
            setValues((v) => ({ ...v, 'store.owner': e.target.value }))
          }
          className={inputCls}
          placeholder="王大美"
        />
      </div>
      <div className="pt-2">
        <SaveButton pending={pending} saved={saved} />
      </div>
    </form>
  )
}

// ─── Section: Contract Fields ─────────────────────────────────────────────────

function ContractFieldsSection({
  initialFields,
}: {
  initialFields: CustomFieldDef[]
}) {
  const lockedFields = LOCKED_FIELDS
  const [customFields, setCustomFields] = useState(
    initialFields.filter((f) => !f.locked),
  )
  const [addingField, setAddingField] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newType, setNewType] = useState<CustomFieldDef['type']>('text')
  const [newRequired, setNewRequired] = useState(false)
  const [addError, setAddError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = customFields.findIndex((f) => f.key === active.id)
    const newIdx = customFields.findIndex((f) => f.key === over.id)
    setCustomFields((prev) =>
      arrayMove(prev, oldIdx, newIdx).map((f, i) => ({
        ...f,
        sortOrder: lockedFields.length + i,
      })),
    )
  }

  function handleAddField() {
    setAddError('')
    const label = newLabel.trim()
    if (!label) {
      setAddError('欄位名稱必填')
      return
    }
    const key =
      newKey.trim() ||
      label
        .toLowerCase()
        .replace(/[一-鿿\s]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^[0-9_]/, 'f_')
        .slice(0, 30)
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      setAddError('欄位 key 需以小寫英文開頭，只含英數和底線')
      return
    }
    const usedKeys = new Set([
      ...lockedFields.map((f) => f.key),
      ...customFields.map((f) => f.key),
    ])
    if (usedKeys.has(key)) {
      setAddError(`欄位 key「${key}」已存在`)
      return
    }
    setCustomFields((prev) => [
      ...prev,
      {
        key,
        label,
        type: newType,
        required: newRequired,
        sortOrder: lockedFields.length + prev.length,
      },
    ])
    setNewLabel('')
    setNewKey('')
    setNewType('text')
    setNewRequired(false)
    setAddingField(false)
  }

  function handleSave() {
    startTransition(async () => {
      await updateContractCustomFields([...lockedFields, ...customFields])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const allFields = [...lockedFields, ...customFields]

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          鎖定欄位為法規必填，不可刪除；可新增自訂欄位並拖曳排序
        </p>
        <button
          onClick={() => setPreviewOpen(true)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          預覽契約
        </button>
      </div>

      {/* Locked fields */}
      <div className="mb-2 space-y-1.5">
        {lockedFields.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <span className="text-amber-400">🔒</span>
            <span className="flex-1 text-sm font-medium text-slate-900">
              {field.label}
            </span>
            <span className="w-24 text-xs text-slate-500">
              {TYPE_LABELS[field.type] ?? field.type}
            </span>
            <span className="w-12 text-xs font-medium text-amber-700">
              必填
            </span>
            <span className="w-12 text-xs text-slate-400">鎖定</span>
          </div>
        ))}
      </div>

      {/* Draggable custom fields */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={customFields.map((f) => f.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {customFields.map((field) => (
              <SortableFieldRow
                key={field.key}
                field={field}
                onDelete={() =>
                  setCustomFields((prev) =>
                    prev
                      .filter((f) => f.key !== field.key)
                      .map((f, i) => ({
                        ...f,
                        sortOrder: lockedFields.length + i,
                      })),
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add field form */}
      {addingField ? (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                欄位名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="例：過敏史"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddField()
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Key（選填，自動生成）
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="allergy_history"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                欄位類型
              </label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as CustomFieldDef['type'])
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded"
                />
                必填欄位
              </label>
            </div>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddField}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              新增
            </button>
            <button
              onClick={() => {
                setAddingField(false)
                setAddError('')
                setNewLabel('')
                setNewKey('')
              }}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingField(true)}
          className="mt-3 flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + 新增自訂欄位
        </button>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        <SaveButton pending={pending} saved={saved} onClick={handleSave} />
      </div>

      {previewOpen && (
        <ContractPreviewModal
          fields={allFields}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Section: Online Booking ──────────────────────────────────────────────────

function OnlineBookingSection({
  initial,
}: {
  initial: Record<string, string>
}) {
  const [slug, setSlug] = useState(initial['store.slug'] ?? '')
  const [oaName, setOaName] = useState(initial['line.oaName'] ?? '')
  const [oaId, setOaId] = useState(initial['line.oaId'] ?? '')
  const [enabled, setEnabled] = useState(
    initial['online.booking.enabled'] !== 'false',
  )
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const slugClean = slug.trim().replace(/[^a-z0-9-]/g, '')
  const previewUrl = slugClean
    ? `https://book.yourstore.com/${slugClean}`
    : '（請先設定網址代碼）'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateSettings({
        'store.slug': slugClean,
        'line.oaName': oaName.trim(),
        'line.oaId': oaId.trim(),
        'online.booking.enabled': String(enabled),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      {/* Online booking toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">開放線上預約</p>
          <p className="text-xs text-slate-500">
            關閉後顧客無法透過線上連結自行預約
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${enabled ? 'bg-slate-900' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Store slug */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          公開預約頁網址代碼
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">book.yourstore.com /</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="my-pet-salon"
          />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
          預覽：
          <span className={slugClean ? 'text-blue-600' : 'text-slate-400'}>
            {previewUrl}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          只允許小寫英文、數字和連字號
        </p>
      </div>

      {/* LINE OA */}
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700">
          LINE 官方帳號綁定
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            官方帳號名稱
          </label>
          <input
            type="text"
            value={oaName}
            onChange={(e) => setOaName(e.target.value)}
            className={inputCls}
            placeholder="毛孩美容工作室"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            官方帳號 ID（@xxxxx）
          </label>
          <input
            type="text"
            value={oaId}
            onChange={(e) => setOaId(e.target.value)}
            className={inputCls}
            placeholder="@mygrooming"
          />
        </div>
        <p className="text-xs text-slate-400">
          LINE 官方帳號 ID 可在 LINE Official Account Manager → 帳號設定中查詢
        </p>
      </div>

      <div className="pt-2">
        <SaveButton pending={pending} saved={saved} />
      </div>
    </form>
  )
}

// ─── Section: Fee Settings ────────────────────────────────────────────────────

function FeeSection({ initial }: { initial: Record<string, string> }) {
  const [rate, setRate] = useState(
    parseInt(initial['overtime.rate'] ?? '200', 10),
  )
  const [grace, setGrace] = useState(
    parseInt(initial['overtime.grace'] ?? '30', 10),
  )
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const safeGrace = Math.max(30, grace)
    startTransition(async () => {
      await updateSettings({
        'overtime.rate': String(rate),
        'overtime.grace': String(safeGrace),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const inputCls =
    'w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        法規（§ 逾時費）：寵物逾預定接回時間 30 分鐘以內，不得計收逾時費
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          每小時逾時費率
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={50}
            value={rate}
            onChange={(e) => setRate(parseInt(e.target.value, 10) || 0)}
            className={inputCls}
          />
          <span className="text-sm text-slate-500">元 / 小時</span>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          免費寬限時間
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={30}
            step={5}
            value={grace}
            onChange={(e) => setGrace(parseInt(e.target.value, 10) || 30)}
            className={inputCls}
          />
          <span className="text-sm text-slate-500">分鐘</span>
        </div>
        {grace < 30 ? (
          <p className="mt-1 text-xs text-red-500">
            依法規不得低於 30 分鐘，儲存時將自動調整為 30
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">法規規定最低 30 分鐘</p>
        )}
      </div>
      <SaveButton pending={pending} saved={saved} />
    </form>
  )
}

// ─── Section: Notification Settings ──────────────────────────────────────────

function NotifySection({ initial }: { initial: Record<string, string> }) {
  const [pickupMinutes, setPickupMinutes] = useState(
    parseInt(initial['notification.pickup.minutes'] ?? '30', 10),
  )
  const [lineEnabled, setLineEnabled] = useState(
    initial['notification.line.enabled'] !== 'false',
  )
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateSettings({
        'notification.pickup.minutes': String(pickupMinutes),
        'notification.line.enabled': String(lineEnabled),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          接回提醒提前推播時間
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={120}
            step={5}
            value={pickupMinutes}
            onChange={(e) =>
              setPickupMinutes(parseInt(e.target.value, 10) || 30)
            }
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <span className="text-sm text-slate-500">分鐘前推播</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          預計完成前 N 分鐘，推播 LINE 提醒客戶前來接寵物
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">LINE 推播通知</p>
          <p className="text-xs text-slate-500">
            預約確認、完成通知、接回提醒均透過 LINE 發送
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLineEnabled((v) => !v)}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${lineEnabled ? 'bg-slate-900' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              lineEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <SaveButton pending={pending} saved={saved} />
    </form>
  )
}

// ─── Section: Staff Management ────────────────────────────────────────────────

function StaffSection({ initialStaff }: { initialStaff: StaffData[] }) {
  const [staffList, setStaffList] = useState(initialStaff)
  const [modal, setModal] = useState<{
    open: boolean
    editing: StaffData | null
  }>({
    open: false,
    editing: null,
  })
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleToggle(id: string) {
    setTogglingId(id)
    try {
      await toggleStaffActive(id)
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)),
      )
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          停用員工不會出現在預約排程中，資料仍會保留
        </p>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + 新增員工
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                姓名
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                職位
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                電話
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">
                附加費
              </th>
              <th className="px-4 py-3 text-center font-medium text-slate-600">
                啟用
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {staffList.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  尚未新增任何員工
                </td>
              </tr>
            ) : (
              staffList.map((staff) => (
                <tr
                  key={staff.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {staff.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {ROLE_LABELS[staff.role] ?? staff.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {staff.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {staff.surcharge > 0 ? `+$${staff.surcharge}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(staff.id)}
                      disabled={togglingId === staff.id}
                      className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${
                        staff.isActive ? 'bg-slate-900' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          staff.isActive ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setModal({ open: true, editing: staff })}
                      className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      編輯
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <StaffModal
          editing={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={(saved) => {
            setStaffList((prev) => {
              const idx = prev.findIndex((s) => s.id === saved.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = saved
                return next
              }
              return [...prev, saved]
            })
          }}
        />
      )}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function SettingsClient({
  initialSettings,
  initialFields,
  initialStaff,
}: {
  initialSettings: Record<string, string>
  initialFields: CustomFieldDef[]
  initialStaff: StaffData[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('店家資訊')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">系統設定</h1>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 pb-3 text-sm font-medium transition ${
                activeTab === tab
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === '店家資訊' && (
        <StoreInfoSection initial={initialSettings} />
      )}
      {activeTab === '線上預約' && (
        <OnlineBookingSection initial={initialSettings} />
      )}
      {activeTab === '契約欄位' && (
        <ContractFieldsSection initialFields={initialFields} />
      )}
      {activeTab === '費用設定' && <FeeSection initial={initialSettings} />}
      {activeTab === '通知設定' && <NotifySection initial={initialSettings} />}
      {activeTab === '員工管理' && <StaffSection initialStaff={initialStaff} />}
    </div>
  )
}
