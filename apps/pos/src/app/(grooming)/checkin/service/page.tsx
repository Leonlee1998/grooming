'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { useCheckinStore } from '@/stores/checkin'
import { useShallow } from 'zustand/react/shallow'
import {
  calculateOrderPrice,
  getActiveServices,
  getActiveStaff,
  type OrderItemInput,
  type PriceCalculation,
} from '../actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

const CATEGORY_LABEL: Record<string, string> = {
  BATH: '洗澡',
  HAIRCUT: '剪毛',
  NAIL: '指甲',
  SPA: 'SPA',
  OTHER: '其他',
}

type Service = {
  id: string
  name: string
  category: string
  basePrice: number
  estimatedMinutes: number
}

type Staff = { id: string; name: string; surcharge: number }

const emptyCalculation: PriceCalculation = {
  items: [],
  subtotalAmount: 0,
  discountAmount: 0,
  totalAmount: 0,
  staffSurcharge: 0,
  estimatedMinutes: 0,
  memberDiscountRate: 0,
  memberName: null,
  memberId: null,
  memberBalance: null,
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString('zh-TW')}`
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小時 ${rest} 分鐘` : `${hours} 小時`
}

export default function ServicePage() {
  const router = useRouter()
  const {
    petId,
    petName,
    selectedServices,
    storedStaffId,
    onlineContractId,
    onlineContractServiceIds,
    setServices,
    setStaff,
    setPriceQuote,
    setNeedsSupplementary,
  } = useCheckinStore(
    useShallow((s) => ({
      petId: s.petId,
      petName: s.petName,
      selectedServices: s.selectedServices,
      storedStaffId: s.staffId,
      onlineContractId: s.onlineContractId,
      onlineContractServiceIds: s.onlineContractServiceIds,
      setServices: s.setServices,
      setStaff: s.setStaff,
      setPriceQuote: s.setPriceQuote,
      setNeedsSupplementary: s.setNeedsSupplementary,
    })),
  )

  const [services, setServicesList] = useState<Service[]>([])
  const [staff, setStaffList] = useState<Staff[]>([])
  const [cartItems, setCartItems] = useState<OrderItemInput[]>(
    selectedServices.map((service) => ({
      serviceId: service.serviceId,
      quantity: service.quantity,
    })),
  )
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    storedStaffId,
  )
  const [calculation, setCalculation] =
    useState<PriceCalculation>(emptyCalculation)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSupplementaryModal, setShowSupplementaryModal] = useState(false)
  const [pendingConfirmData, setPendingConfirmData] = useState<{
    newServiceNames: string[]
  } | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)

  useEffect(() => {
    if (!petId) {
      router.replace('/checkin/pet')
      return
    }

    let cancelled = false

    async function loadOptions() {
      setLoading(true)
      const [serviceData, staffResult] = await Promise.all([
        getActiveServices(),
        getActiveStaff(),
      ])
      if (cancelled) return
      setServicesList(serviceData)
      if (staffResult.ok) setStaffList(staffResult.data)
      else setError(staffResult.error)
      setLoading(false)
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [petId, router])

  useEffect(() => {
    if (!petId || cartItems.length === 0) {
      setCalculation(emptyCalculation)
      setPricingLoading(false)
      return
    }

    let cancelled = false
    const currentPetId = petId

    async function calculate() {
      setPricingLoading(true)
      const result = await calculateOrderPrice(
        cartItems,
        currentPetId,
        selectedStaffId ?? undefined,
      )
      if (cancelled) return
      setCalculation(result)
      setPricingLoading(false)
    }

    calculate()

    return () => {
      cancelled = true
    }
  }, [cartItems, petId, selectedStaffId])

  const groupedServices = useMemo(
    () =>
      services.reduce<Record<string, Service[]>>((groups, service) => {
        if (!groups[service.category]) groups[service.category] = []
        groups[service.category].push(service)
        return groups
      }, {}),
    [services],
  )

  const cartServiceIds = useMemo(
    () => new Set(cartItems.map((item) => item.serviceId)),
    [cartItems],
  )

  const selectedStaff = staff.find((item) => item.id === selectedStaffId)
  const selectedCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const canContinue =
    cartItems.length > 0 &&
    !pricingLoading &&
    !calculation.error &&
    calculation.items.length > 0

  function toggleService(service: Service) {
    setError('')
    setCartItems((current) => {
      const exists = current.some((item) => item.serviceId === service.id)
      if (exists) return current.filter((item) => item.serviceId !== service.id)
      return [...current, { serviceId: service.id, quantity: 1 }]
    })
  }

  function updateQuantity(serviceId: string, quantity: number) {
    setCartItems((current) =>
      current.map((item) =>
        item.serviceId === serviceId
          ? { ...item, quantity: Math.max(1, Math.min(20, quantity)) }
          : item,
      ),
    )
  }

  function removeItem(serviceId: string) {
    setCartItems((current) =>
      current.filter((item) => item.serviceId !== serviceId),
    )
  }

  function commitAndProceed(isSupplementary: boolean) {
    setServices(
      calculation.items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        basePrice: item.basePrice,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        estimatedMinutes: item.estimatedMinutes,
        priceAdjustments: item.priceAdjustments.map((rule) => ({
          ruleName: rule.ruleName,
          amount: rule.amount,
        })),
      })),
    )
    setStaff({
      staffId: selectedStaff?.id ?? null,
      staffName: selectedStaff?.name ?? '',
      staffSurcharge: calculation.staffSurcharge,
    })
    setPriceQuote({
      estimatedDuration: calculation.estimatedMinutes || 60,
      subtotalAmount: calculation.subtotalAmount,
      discountAmount: calculation.discountAmount,
      totalAmount: calculation.totalAmount,
      memberId: calculation.memberId,
      memberBalance: calculation.memberBalance,
    })
    setNeedsSupplementary(isSupplementary)
    router.push('/checkin/confirm')
  }

  function handleConfirm() {
    if (!canContinue) {
      setError('請至少選擇一項服務，並等待金額試算完成')
      return
    }

    // 偵測是否有線上簽約且加購新服務
    if (onlineContractId) {
      const originalIds = new Set(onlineContractServiceIds)
      const newItems = calculation.items.filter(
        (item) => !originalIds.has(item.serviceId),
      )
      if (newItems.length > 0) {
        setPendingConfirmData({
          newServiceNames: newItems.map((i) => i.serviceName),
        })
        setShowSupplementaryModal(true)
        return
      }
    }

    commitAndProceed(false)
  }

  return (
    <PosLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <StepIndicator current={3} total={5} labels={STEPS} />

        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-stone-900">選擇服務</h1>
          <p className="text-base text-stone-500">
            {petName} 的服務與費用會在簽約前完整揭露
          </p>
        </div>

        {/* 線上已簽約提示 */}
        {onlineContractId && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 flex items-start gap-3">
            <span className="text-xl mt-0.5">⚡</span>
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                此客戶已線上簽約
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                若選擇原契約以外的服務，將自動產生補充契約，需請客戶補簽。
                {onlineContractServiceIds.length > 0 && (
                  <span className="ml-1">
                    原訂服務：
                    {onlineContractServiceIds
                      .map(
                        (id) => services.find((s) => s.id === id)?.name ?? id,
                      )
                      .join('、')}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="flex flex-col gap-5">
            {loading ? (
              <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center text-stone-400">
                載入服務項目中…
              </div>
            ) : (
              <>
                {Object.entries(groupedServices).map(([category, items]) => (
                  <div key={category} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold uppercase text-stone-500">
                        {CATEGORY_LABEL[category] ?? category}
                      </h2>
                      <span className="text-xs text-stone-400">
                        {items.length} 項
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {items.map((service) => {
                        const isSelected = cartServiceIds.has(service.id)
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service)}
                            className={[
                              'min-h-[132px] rounded-2xl border-2 bg-white px-5 py-4 text-left transition-colors',
                              isSelected
                                ? 'border-emerald-700 bg-emerald-50 shadow-sm'
                                : 'border-stone-200 hover:border-emerald-300 active:bg-stone-50',
                            ].join(' ')}
                          >
                            <div className="flex h-full flex-col justify-between gap-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xl font-bold text-stone-900">
                                    {service.name}
                                  </p>
                                  <p className="mt-1 text-sm text-stone-500">
                                    約 {formatMinutes(service.estimatedMinutes)}
                                  </p>
                                </div>
                                <span
                                  className={[
                                    'flex h-8 w-8 items-center justify-center rounded-full border text-lg font-bold',
                                    isSelected
                                      ? 'border-emerald-700 bg-emerald-700 text-white'
                                      : 'border-stone-300 text-stone-300',
                                  ].join(' ')}
                                >
                                  {isSelected ? '✓' : '+'}
                                </span>
                              </div>

                              <div className="flex items-end justify-between gap-3">
                                <p className="text-sm text-stone-400">
                                  基礎價格
                                </p>
                                <p className="text-2xl font-bold text-emerald-800">
                                  {formatMoney(service.basePrice)}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-200 bg-stone-900 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold">已選服務摘要</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                    {selectedCount} 次
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-300">
                  法規 §3：費用、服務人員與次數需先揭露
                </p>
              </div>

              <div className="flex max-h-[calc(100vh-260px)] flex-col gap-5 overflow-y-auto px-5 py-5">
                {cartItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-stone-400">
                    從左側點選服務加入
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {calculation.items.map((item) => (
                      <div
                        key={item.serviceId}
                        className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-stone-900">
                              {item.serviceName}
                            </p>
                            <p className="mt-0.5 text-sm text-stone-500">
                              單價 {formatMoney(item.unitPrice)} ·{' '}
                              {formatMinutes(item.estimatedMinutes)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.serviceId)}
                            className="min-h-[40px] rounded-lg px-2 text-sm text-stone-400 active:bg-stone-200"
                          >
                            移除
                          </button>
                        </div>

                        {item.priceAdjustments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-stone-200 pt-2">
                            {item.priceAdjustments.map((rule) => (
                              <div
                                key={rule.ruleId}
                                className="flex justify-between text-xs text-amber-700"
                              >
                                <span>{rule.ruleName}</span>
                                <span>+{formatMoney(rule.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-xl border border-stone-300 bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.serviceId,
                                  item.quantity - 1,
                                )
                              }
                              className="min-h-[44px] w-12 text-xl font-bold text-stone-600 disabled:opacity-30"
                              disabled={item.quantity <= 1}
                            >
                              −
                            </button>
                            <span className="w-10 text-center text-lg font-bold text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.serviceId,
                                  item.quantity + 1,
                                )
                              }
                              className="min-h-[44px] w-12 text-xl font-bold text-stone-600"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-xl font-bold text-stone-900">
                            {formatMoney(item.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-stone-500">指定美容師</p>
                  <label
                    className={[
                      'flex min-h-[56px] cursor-pointer items-center justify-between rounded-xl border-2 px-4 transition-colors',
                      selectedStaffId === null
                        ? 'border-emerald-700 bg-emerald-50'
                        : 'border-stone-200 bg-white',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-stone-800">不指定</span>
                    <span className="flex items-center gap-3 text-sm text-stone-500">
                      +$0
                      <input
                        type="radio"
                        name="staff"
                        checked={selectedStaffId === null}
                        onChange={() => setSelectedStaffId(null)}
                        className="h-5 w-5 accent-emerald-700"
                      />
                    </span>
                  </label>

                  {staff.map((item) => (
                    <label
                      key={item.id}
                      className={[
                        'flex min-h-[56px] cursor-pointer items-center justify-between rounded-xl border-2 px-4 transition-colors',
                        selectedStaffId === item.id
                          ? 'border-emerald-700 bg-emerald-50'
                          : 'border-stone-200 bg-white',
                      ].join(' ')}
                    >
                      <span className="font-semibold text-stone-800">
                        {item.name}
                      </span>
                      <span className="flex items-center gap-3 text-sm text-stone-500">
                        +{formatMoney(item.surcharge)}
                        <input
                          type="radio"
                          name="staff"
                          checked={selectedStaffId === item.id}
                          onChange={() => setSelectedStaffId(item.id)}
                          className="h-5 w-5 accent-emerald-700"
                        />
                      </span>
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                  <div className="flex justify-between border-b border-stone-100 py-2">
                    <span className="text-stone-500">預計時間</span>
                    <span className="font-bold text-stone-900">
                      {pricingLoading
                        ? '試算中…'
                        : formatMinutes(calculation.estimatedMinutes)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 py-2">
                    <span className="text-stone-500">小計</span>
                    <span className="font-bold text-stone-900">
                      {formatMoney(calculation.subtotalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 py-2">
                    <span className="text-stone-500">
                      會員折扣
                      {calculation.memberName
                        ? `（${calculation.memberName}）`
                        : ''}
                    </span>
                    <span className="font-bold text-red-600">
                      −{formatMoney(calculation.discountAmount)}
                    </span>
                  </div>
                  <div className="flex items-end justify-between pt-3">
                    <span className="text-base font-bold text-stone-700">
                      總計
                    </span>
                    <span className="text-3xl font-bold text-emerald-800">
                      {formatMoney(calculation.totalAmount)}
                    </span>
                  </div>
                </div>

                {(error || calculation.error) && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error || calculation.error}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-[104px_minmax(0,1fr)_128px] gap-3 border-t border-stone-200 bg-white px-5 py-4">
                <BigButton
                  variant="secondary"
                  onClick={() => router.push('/checkin/pet')}
                >
                  返回
                </BigButton>
                <BigButton
                  fullWidth
                  onClick={handleConfirm}
                  disabled={!canContinue}
                >
                  {pricingLoading ? '試算中…' : '確認費用並繼續'}
                </BigButton>
                <CancelCheckinButton />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* 補充契約確認 Modal */}
      {showSupplementaryModal && pendingConfirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSupplementaryModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">
                ⚡
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900">
                  加購項目需補簽
                </h2>
                <p className="text-stone-500 text-sm mt-1">
                  客戶已線上簽約，以下為新增的服務項目，需請客戶補簽補充契約：
                </p>
              </div>
            </div>

            <ul className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col gap-1.5">
              {pendingConfirmData.newServiceNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 text-amber-900 font-semibold text-sm"
                >
                  <span className="text-amber-500">+</span>
                  {name}
                </li>
              ))}
            </ul>

            <p className="text-xs text-stone-400 leading-relaxed">
              系統將自動產生補充契約，僅列示加購服務與差額費用，並標註原契約編號。
            </p>

            <div className="grid grid-cols-2 gap-3">
              <BigButton
                variant="secondary"
                onClick={() => setShowSupplementaryModal(false)}
              >
                返回修改
              </BigButton>
              <BigButton
                onClick={() => {
                  setShowSupplementaryModal(false)
                  commitAndProceed(true)
                }}
              >
                確認，繼續補簽
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </PosLayout>
  )
}
