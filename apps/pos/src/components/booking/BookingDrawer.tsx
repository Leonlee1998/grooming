'use client'

import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getBookingFormData,
  createAppointment,
} from '@/app/(booking)/schedule/actions'
import type { BookingFormData } from '@/app/(booking)/schedule/actions'
import {
  buildIso,
  Step1Content,
  Step2Content,
  Step3Content,
  type CustomerInfo,
} from './BookingSteps'

// ─── Drawer-private step indicator ───────────────────────────────────────────

const STEP_LABELS = ['選客戶與寵物', '選服務與時間', '確認 & 備注']

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {([1, 2, 3] as const).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={[
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              s === step
                ? 'bg-emerald-700 text-white'
                : s < step
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-400',
            ].join(' ')}
          >
            {s < step ? '✓' : s}
          </div>
          <span
            className={[
              'hidden text-xs sm:inline',
              s === step ? 'font-semibold text-stone-800' : 'text-stone-400',
            ].join(' ')}
          >
            {STEP_LABELS[s - 1]}
          </span>
          {s < 3 && <div className="h-px w-4 bg-stone-200" />}
        </div>
      ))}
    </div>
  )
}

// ─── Main BookingDrawer ───────────────────────────────────────────────────────

interface BookingDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialDate: string
  onCreated?: () => void
}

export function BookingDrawer({
  isOpen,
  onClose,
  initialDate,
  onCreated,
}: BookingDrawerProps) {
  const queryClient = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<BookingFormData | null>(null)

  // Step 1 state
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [petId, setPetId] = useState('')
  const [petName, setPetName] = useState('')
  const [petSpecies, setPetSpecies] = useState('')

  // Step 2 state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')

  // Step 3 state
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const estimatedMinutes =
    formData?.services
      .filter((s) => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0

  useEffect(() => {
    if (isOpen && !formData) {
      getBookingFormData().then(setFormData)
    }
  }, [isOpen, formData])

  useEffect(() => {
    if (isOpen) setDate(initialDate)
  }, [isOpen, initialDate])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    if (isOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  function reset() {
    setStep(1)
    setCustomer(null)
    setPetId('')
    setPetName('')
    setPetSpecies('')
    setSelectedServiceIds([])
    setStaffId('')
    setTime('')
    setPickupTime('')
    setNotes('')
    setSubmitError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleToggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    setTime('')
    setPickupTime('')
  }

  const canGoToStep2 = !!customer && !!petId
  const canGoToStep3 = selectedServiceIds.length > 0 && !!time

  async function handleSubmit() {
    if (!customer) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await createAppointment({
        customerId: customer.id,
        petId,
        staffId: staffId || null,
        serviceIds: selectedServiceIds,
        scheduledAt: buildIso(date, time),
        pickupDeadlineAt: pickupTime ? buildIso(date, pickupTime) : null,
        notes: notes.trim() || null,
        source: 'WALK_IN',
      })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      onCreated?.()
      handleClose()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : '建立預約失敗，請稍後再試',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">新增預約</h2>
            <p className="mt-0.5 text-xs text-stone-400">
              Step {step}/3 · {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 transition-colors"
            aria-label="關閉"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="border-b border-stone-100 px-5 py-3">
          <StepIndicator step={step} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 1 && (
            <Step1Content
              customer={customer}
              petId={petId}
              onCustomerChange={(c) => {
                setCustomer(c)
                setPetId('')
                setPetName('')
                setPetSpecies('')
              }}
              onPetChange={(id, name, species) => {
                setPetId(id)
                setPetName(name)
                setPetSpecies(species)
              }}
            />
          )}
          {step === 2 && formData && (
            <Step2Content
              formData={formData}
              selectedServiceIds={selectedServiceIds}
              staffId={staffId}
              date={date}
              time={time}
              pickupTime={pickupTime}
              estimatedMinutes={estimatedMinutes}
              onToggleService={handleToggleService}
              onStaffChange={(id) => {
                setStaffId(id)
                setTime('')
                setPickupTime('')
              }}
              onDateChange={(d) => {
                setDate(d)
                setTime('')
                setPickupTime('')
              }}
              onTimeChange={setTime}
              onPickupTimeChange={setPickupTime}
            />
          )}
          {step === 3 && formData && customer && (
            <Step3Content
              customer={customer}
              petName={petName}
              petSpecies={petSpecies || 'DOG'}
              selectedServiceIds={selectedServiceIds}
              formData={formData}
              staffId={staffId}
              date={date}
              time={time}
              pickupTime={pickupTime}
              estimatedMinutes={estimatedMinutes}
              notes={notes}
              onNotesChange={setNotes}
            />
          )}
          {step === 2 && !formData && (
            <p className="text-stone-400">載入服務資料中…</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-stone-200 px-5 py-4">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              上一步
            </button>
          )}

          <div className="flex-1" />

          {submitError && <p className="text-xs text-red-600">{submitError}</p>}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 1 ? !canGoToStep2 : !canGoToStep3}
              className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              下一步 →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? '建立中…' : '確認新增預約'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
