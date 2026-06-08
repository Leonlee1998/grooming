'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
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
import type { ServiceData } from '@/app/(dashboard)/services/actions'
import {
  toggleServiceActive,
  reorderServices,
} from '@/app/(dashboard)/services/actions'
import { ServiceModal } from './ServiceModal'

const CATEGORY_LABELS: Record<ServiceData['category'], string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '美甲',
  SPA: 'SPA',
  OTHER: '其他',
}

function formatMoney(n: number) {
  return `NT$${n.toLocaleString()}`
}

interface RowProps {
  service: ServiceData
  onToggle: (id: string) => void
  onEdit: (service: ServiceData) => void
  toggling: boolean
}

function SortableRow({ service, onToggle, onEdit, toggling }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: service.id,
  })

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: isDragging ? 'relative' : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="border-b border-slate-100 bg-white transition-colors hover:bg-slate-50"
    >
      <td className="w-10 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-lg leading-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="拖曳排序"
        >
          ⠿
        </button>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{service.name}</p>
        {service.description && (
          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
            {service.description}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {CATEGORY_LABELS[service.category]}
      </td>
      <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
        {formatMoney(service.basePrice)}
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-600">
        {service.estimatedMinutes} 分
      </td>
      <td className="px-4 py-3 text-slate-500">
        {service.priceRules.length} 條
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(service.id)}
          disabled={toggling}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            service.isActive ? 'bg-emerald-600' : 'bg-slate-200',
          ].join(' ')}
          aria-label={service.isActive ? '停用' : '啟用'}
        >
          <span
            className={[
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform',
              service.isActive ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onEdit(service)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          編輯
        </button>
      </td>
    </tr>
  )
}

interface ServicesClientProps {
  initialServices: ServiceData[]
}

export function ServicesClient({ initialServices }: ServicesClientProps) {
  const [services, setServices] = useState(initialServices)
  const [editingService, setEditingService] = useState<ServiceData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = services.findIndex((s) => s.id === active.id)
    const newIndex = services.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(services, oldIndex, newIndex)
    setServices(reordered)
    startTransition(() => {
      reorderServices(reordered.map((s) => s.id))
    })
  }

  function handleToggle(id: string) {
    setTogglingIds((prev) => new Set(prev).add(id))
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)),
    )
    toggleServiceActive(id)
      .then((updated) => {
        setServices((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        )
      })
      .catch(() => {
        setServices((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)),
        )
      })
      .finally(() => {
        setTogglingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
  }

  function handleModalSave(saved: ServiceData) {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === saved.id)
      return exists
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved]
    })
    setEditingService(null)
    setIsCreating(false)
  }

  const modalOpen = isCreating || editingService !== null

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">{services.length} 項服務</p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            <span className="text-base leading-none">+</span>
            新增服務
          </button>
        </div>

        {services.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            尚無服務項目，點擊「新增服務」開始建立
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={services.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3">服務名稱</th>
                    <th className="px-4 py-3">分類</th>
                    <th className="px-4 py-3">基礎價格</th>
                    <th className="px-4 py-3">預估時間</th>
                    <th className="px-4 py-3">定價規則</th>
                    <th className="px-4 py-3">啟用</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <SortableRow
                      key={service.id}
                      service={service}
                      onToggle={handleToggle}
                      onEdit={setEditingService}
                      toggling={togglingIds.has(service.id)}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {modalOpen && (
        <ServiceModal
          service={editingService}
          onClose={() => {
            setIsCreating(false)
            setEditingService(null)
          }}
          onSave={handleModalSave}
        />
      )}
    </>
  )
}
