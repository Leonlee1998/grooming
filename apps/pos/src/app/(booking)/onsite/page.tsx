'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { BigButton } from '@/components/ui/BigButton'
import {
  Step1Content,
  Step2Content,
  Step3Content,
  getTaipeiDate,
  buildIso,
  type CustomerInfo,
} from '@/components/booking/BookingSteps'
import {
  getBookingFormData,
  createAppointment,
} from '@/app/(booking)/schedule/actions'
import type { BookingFormData } from '@/app/(booking)/schedule/actions'
import { upsertCustomer } from '@/app/(grooming)/checkin/actions'

const STEP_LABELS = ['客戶與寵物', '服務與時間', '確認預約']

const INITIAL_FORM = {
  name: '',
  email: '',
  emergencyContact: '',
  emergencyPhone: '',
}

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {([1, 2, 3] as const).map((s) => (
        <div key={s} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
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
                'text-sm',
                s === step
                  ? 'font-semibold text-stone-800'
                  : s < step
                    ? 'text-emerald-600'
                    : 'text-stone-400',
              ].join(' ')}
            >
              {STEP_LABELS[s - 1]}
            </span>
          </div>
          {s < 3 && <div className="mx-3 h-px w-6 bg-stone-200 shrink-0" />}
        </div>
      ))}
    </div>
  )
}

// ─── Success view ─────────────────────────────────────────────────────────────

function SuccessView({
  customer,
  petName,
  date,
  time,
  serviceNames,
  onDone,
  onAnother,
}: {
  customer: CustomerInfo
  petName: string
  date: string
  time: string
  serviceNames: string[]
  onDone: () => void
  onAnother: () => void
}) {
  const dateDisplay = new Date(`${date}T12:00:00+08:00`).toLocaleDateString(
    'zh-TW',
    {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  )

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center gap-6 pt-6 pb-10">
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

      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">預約已建立！</h1>
        <p className="mt-2 text-stone-500 text-lg">
          已為 {customer.name} 的 {petName} 完成預約
        </p>
      </div>

      <div className="w-full rounded-xl bg-white border border-stone-200 divide-y divide-stone-100">
        <div className="flex justify-between items-center px-5 py-4">
          <span className="text-stone-500 text-sm">客戶</span>
          <span className="font-medium text-stone-900">
            {customer.name}（{customer.phone}）
          </span>
        </div>
        <div className="flex justify-between items-center px-5 py-4">
          <span className="text-stone-500 text-sm">寵物</span>
          <span className="font-medium text-stone-900">{petName}</span>
        </div>
        <div className="flex justify-between items-center px-5 py-4">
          <span className="text-stone-500 text-sm">預約日期</span>
          <span className="font-medium text-stone-900">{dateDisplay}</span>
        </div>
        <div className="flex justify-between items-center px-5 py-4">
          <span className="text-stone-500 text-sm">時間</span>
          <span className="font-medium text-stone-900">{time}</span>
        </div>
        <div className="flex justify-between items-start px-5 py-4">
          <span className="text-stone-500 text-sm">服務</span>
          <span className="font-medium text-stone-900 text-right">
            {serviceNames.join('、')}
          </span>
        </div>
      </div>

      <div className="w-full rounded-xl bg-blue-50 border border-blue-200 px-5 py-4">
        <p className="text-sm text-blue-800 font-medium">提醒</p>
        <p className="text-sm text-blue-700 mt-1">
          客戶到店後，請至「報到簽約」流程完成電子簽名
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <BigButton fullWidth onClick={onAnother}>
          繼續新增預約
        </BigButton>
        <BigButton variant="secondary" fullWidth onClick={onDone}>
          返回首頁
        </BigButton>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnsiteBookingPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [formData, setFormData] = useState<BookingFormData | null>(null)
  const [done, setDone] = useState(false)

  // Step 1
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [petId, setPetId] = useState('')
  const [petName, setPetName] = useState('')
  const [petSpecies, setPetSpecies] = useState('')

  // "建立新客戶" modal state
  const [notFoundPhone, setNotFoundPhone] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(INITIAL_FORM)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Step 2
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(getTaipeiDate())
  const [time, setTime] = useState('')
  const [pickupTime, setPickupTime] = useState('')

  // Step 3
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Success
  const [successData, setSuccessData] = useState<{
    serviceNames: string[]
  } | null>(null)

  const estimatedMinutes =
    formData?.services
      .filter((s) => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0

  useEffect(() => {
    if (!formData) {
      getBookingFormData().then(setFormData)
    }
  }, [formData])

  function resetForm() {
    setStep(1)
    setCustomer(null)
    setPetId('')
    setPetName('')
    setPetSpecies('')
    setSelectedServiceIds([])
    setStaffId('')
    setDate(getTaipeiDate())
    setTime('')
    setPickupTime('')
    setNotes('')
    setSubmitError(null)
    setSuccessData(null)
    setDone(false)
  }

  async function handleCreateCustomer() {
    setCreateError('')
    if (!createForm.name.trim()) {
      setCreateError('請填寫姓名')
      return
    }
    setCreating(true)
    const result = await upsertCustomer({ phone: notFoundPhone, ...createForm })
    setCreating(false)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    setCustomer({
      id: result.data.id,
      name: result.data.name,
      phone: result.data.phone,
    })
    setShowCreateModal(false)
    setCreateForm(INITIAL_FORM)
  }

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
        source: 'POS_ONSITE',
      })
      const serviceNames =
        formData?.services
          .filter((s) => selectedServiceIds.includes(s.id))
          .map((s) => s.name) ?? []
      setSuccessData({ serviceNames })
      setDone(true)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : '建立預約失敗，請稍後再試',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canGoToStep2 = !!customer && !!petId
  const canGoToStep3 = selectedServiceIds.length > 0 && !!time

  if (done && successData && customer) {
    return (
      <PosLayout>
        <SuccessView
          customer={customer}
          petName={petName}
          date={date}
          time={time}
          serviceNames={successData.serviceNames}
          onDone={() => router.push('/')}
          onAnother={resetForm}
        />
      </PosLayout>
    )
  }

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto pb-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-700">現場預約</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">
            為客戶安排預約
          </h1>
          <p className="mt-1 text-stone-500">
            預約完成後，客戶到店時再至報到流程簽約
          </p>
        </div>

        <StepBar step={step} />

        {/* Step content */}
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
            onNotFound={(phone) => {
              setNotFoundPhone(phone)
              setCreateForm(INITIAL_FORM)
              setCreateError('')
              setShowCreateModal(true)
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
            onToggleService={(id) => {
              setSelectedServiceIds((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
              )
              setTime('')
              setPickupTime('')
            }}
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

        {step === 2 && !formData && (
          <p className="text-stone-400 py-8 text-center">載入服務資料中…</p>
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

        {/* Navigation */}
        {submitError && (
          <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex gap-3">
          {step > 1 ? (
            <BigButton
              variant="secondary"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            >
              上一步
            </BigButton>
          ) : (
            <BigButton variant="secondary" onClick={() => router.push('/')}>
              返回首頁
            </BigButton>
          )}

          <div className="flex-1" />

          {step < 3 ? (
            <BigButton
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 1 ? !canGoToStep2 : !canGoToStep3}
            >
              下一步 →
            </BigButton>
          ) : (
            <BigButton onClick={handleSubmit} disabled={submitting}>
              {submitting ? '建立中…' : '確認建立預約'}
            </BigButton>
          )}
        </div>
      </div>

      {/* 建立新客戶 Bottom Sheet */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-t-3xl shadow-2xl px-6 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 rounded-full bg-stone-300 mx-auto mb-6" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  建立新客戶
                </h2>
                <p className="text-stone-500 mt-0.5">
                  查無此號碼，建立後繼續預約
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  手機號碼
                </label>
                <div className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-lg font-mono text-stone-500">
                  {notFoundPhone}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="王小明"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  Email{' '}
                  <span className="text-stone-400 font-normal">（選填）</span>
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    緊急聯絡人{' '}
                    <span className="text-stone-400 font-normal">（選填）</span>
                  </label>
                  <input
                    type="text"
                    placeholder="王大明"
                    value={createForm.emergencyContact}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        emergencyContact: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-600 mb-2">
                    緊急聯絡電話{' '}
                    <span className="text-stone-400 font-normal">（選填）</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={createForm.emergencyPhone}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        emergencyPhone: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {createError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
                  {createError}
                </p>
              )}

              <BigButton
                fullWidth
                onClick={handleCreateCustomer}
                disabled={creating || !createForm.name.trim()}
                className="mt-2"
              >
                {creating ? '建立中…' : '建立並繼續'}
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </PosLayout>
  )
}
