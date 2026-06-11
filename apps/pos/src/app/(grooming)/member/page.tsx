'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PosLayout } from '@/components/layout/PosLayout'
import { BigButton } from '@/components/ui/BigButton'
import {
  enrollMember,
  getActiveMemberPlans,
  getMemberInfo,
  searchMemberCustomerByPhone,
  topUpBalance,
  type CustomerSearchResult,
  type MemberPlanOption,
  type MemberWithPlan,
  type PointTransaction,
} from './actions'

function formatMoney(amount: number) {
  return `$${amount.toLocaleString('zh-TW')}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

function formatPercent(rate: number) {
  if (!rate) return '無折扣'
  return `${Math.round(rate * 100)}% 折扣`
}

function pointTypeLabel(type: PointTransaction['type']) {
  const labels = {
    EARN: '消費累點',
    REDEEM: '兌換扣點',
    ADJUST: '人工調整',
    EXPIRE: '點數到期',
  }
  return labels[type]
}

export default function MemberPage() {
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState<
    CustomerSearchResult | null | undefined
  >(undefined)
  const [member, setMember] = useState<MemberWithPlan | null>(null)
  const [plans, setPlans] = useState<MemberPlanOption[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [topUpAmount, setTopUpAmount] = useState('')
  const [showAllPoints, setShowAllPoints] = useState(false)
  const [loading, setLoading] = useState(false)
  const [memberLoading, setMemberLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      const result = await getActiveMemberPlans()
      if (cancelled) return
      setPlans(result)
      setSelectedPlanId((current) => current || result[0]?.id || '')
    }

    loadPlans()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    setMessage('')
    setError('')
    setShowAllPoints(false)

    if (digits.length !== 10) {
      setCustomer(undefined)
      setMember(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setMemberLoading(true)
      try {
        const found = await searchMemberCustomerByPhone(phone)
        setCustomer(found)
        if (found) {
          const info = await getMemberInfo(found.id)
          setMember(info)
        } else {
          setMember(null)
        }
      } catch {
        setCustomer(undefined)
        setMember(null)
        setError('查詢會員資料失敗，請稍後再試')
      } finally {
        setLoading(false)
        setMemberLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [phone])

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
  const topUpValue = Number(topUpAmount)
  const canTopUp =
    Boolean(member) && Number.isInteger(topUpValue) && topUpValue > 0
  const visiblePointTransactions = showAllPoints
    ? (member?.pointTransactions ?? [])
    : (member?.pointTransactions.slice(0, 10) ?? [])

  const planStats = useMemo(() => {
    if (!selectedPlan) return []
    return [
      { label: '月費', value: formatMoney(selectedPlan.monthlyFee) },
      { label: '點數倍率', value: `${selectedPlan.pointRate} 倍` },
      { label: '服務折扣', value: formatPercent(selectedPlan.discountRate) },
    ]
  }, [selectedPlan])

  async function refreshMember(customerId: string) {
    setMemberLoading(true)
    const info = await getMemberInfo(customerId)
    setMember(info)
    setMemberLoading(false)
  }

  async function handleTopUp() {
    if (!member || !canTopUp) return

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await topUpBalance(member.id, topUpValue)
      await refreshMember(member.customerId)
      setTopUpAmount('')
      setMessage(`已完成儲值 ${formatMoney(topUpValue)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲值失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEnroll() {
    if (!customer || !selectedPlanId) return

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await enrollMember(customer.id, selectedPlanId)
      await refreshMember(customer.id)
      setCustomer({ ...customer, isMember: true })
      setMessage('會員申辦完成')
    } catch (e) {
      setError(e instanceof Error ? e.message : '會員申辦失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const digits = phone.replace(/\D/g, '')

  return (
    <PosLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-stone-900">會員查詢</h1>
          <p className="text-stone-500">輸入客戶手機號碼管理點數與儲值金</p>
        </div>

        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              placeholder="09XX-XXX-XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl border-2 border-stone-300 bg-white px-6 py-5 font-mono text-3xl tracking-widest placeholder:text-stone-300 transition-colors focus:border-emerald-500 focus:outline-none"
            />
            {loading && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            )}
            {!loading && digits.length > 0 && digits.length < 10 && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-base tabular-nums text-stone-400">
                {digits.length}/10
              </div>
            )}
          </div>
          <BigButton
            variant="secondary"
            onClick={() => {
              setPhone('')
              setCustomer(undefined)
              setMember(null)
              setMessage('')
              setError('')
            }}
          >
            清除
          </BigButton>
        </section>

        {(message || error) && (
          <div
            className={[
              'rounded-2xl px-5 py-4 text-base font-semibold',
              error
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-800',
            ].join(' ')}
          >
            {error || message}
          </div>
        )}

        {customer === null && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-5">
            <p className="text-lg font-semibold text-amber-900">查無此客戶</p>
            <p className="mt-1 text-amber-700">
              請先至報到流程建立客戶資料後再申辦會員
            </p>
          </div>
        )}

        {customer && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="flex flex-col gap-5">
              {memberLoading ? (
                <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center text-stone-400">
                  載入會員資料中…
                </div>
              ) : member ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <div className="bg-stone-900 px-6 py-5 text-white">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-stone-300">會員資訊</p>
                          <h2 className="mt-1 text-3xl font-bold">
                            {member.customer.name}
                          </h2>
                        </div>
                        <span className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white">
                          {member.plan.name}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
                      <div className="rounded-xl bg-emerald-50 px-5 py-5">
                        <p className="text-sm font-semibold text-emerald-700">
                          點數餘額
                        </p>
                        <p className="mt-2 text-5xl font-bold tabular-nums text-emerald-900">
                          {member.points.toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <div className="rounded-xl bg-stone-50 px-5 py-5">
                        <p className="text-sm font-semibold text-stone-500">
                          儲值金餘額
                        </p>
                        <p className="mt-2 text-4xl font-bold tabular-nums text-stone-900">
                          {formatMoney(member.balance)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 px-5 py-4">
                        <p className="text-sm text-stone-500">本年度消費</p>
                        <p className="mt-1 text-2xl font-bold text-stone-900">
                          {formatMoney(member.annualSpend)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 px-5 py-4">
                        <p className="text-sm text-stone-500">加入日期</p>
                        <p className="mt-1 text-2xl font-bold text-stone-900">
                          {formatDate(member.joinedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-stone-900">
                          點數紀錄
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                          最近 10 筆，必要時可展開全部
                        </p>
                      </div>
                      {member.pointTransactions.length > 10 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPoints((value) => !value)}
                          className="min-h-[44px] rounded-xl border border-stone-300 px-4 font-semibold text-stone-700 active:bg-stone-100"
                        >
                          {showAllPoints ? '收合' : '看全部'}
                        </button>
                      )}
                    </div>

                    <div className="mt-5 flex flex-col divide-y divide-stone-100">
                      {visiblePointTransactions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-stone-400">
                          尚無點數紀錄
                        </div>
                      ) : (
                        visiblePointTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="grid grid-cols-[minmax(0,1fr)_120px] gap-4 py-4"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-stone-900">
                                {pointTypeLabel(tx.type)}
                              </p>
                              <p className="mt-0.5 text-sm text-stone-500">
                                {formatDate(tx.createdAt)}
                                {tx.note ? ` · ${tx.note}` : ''}
                              </p>
                            </div>
                            <p
                              className={[
                                'text-right text-2xl font-bold tabular-nums',
                                tx.amount >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600',
                              ].join(' ')}
                            >
                              {tx.amount >= 0 ? '+' : ''}
                              {tx.amount.toLocaleString('zh-TW')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-white px-6 py-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-stone-500">客戶資料</p>
                      <h2 className="mt-1 text-3xl font-bold text-stone-900">
                        {customer.name}
                      </h2>
                      <p className="mt-1 font-mono text-stone-500">
                        {customer.phone}
                      </p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-600">
                      非會員
                    </span>
                  </div>

                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
                    此客戶尚未申辦會員，可在右側選擇方案後立即建立會員資格。
                  </div>
                </div>
              )}
            </section>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white px-5 py-5 shadow-sm">
                {member ? (
                  <>
                    <div>
                      <h2 className="text-xl font-bold text-stone-900">
                        儲值功能
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        確認收款後建立儲值交易
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-600">
                        儲值金額
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        placeholder="1000"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-4 text-2xl font-bold tabular-nums text-stone-900 transition-colors focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl bg-stone-50 px-4 py-4">
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">目前餘額</span>
                        <span className="font-bold text-stone-900">
                          {formatMoney(member.balance)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">儲值後餘額</span>
                        <span className="font-bold text-emerald-800">
                          {formatMoney(
                            member.balance +
                              (Number.isFinite(topUpValue) ? topUpValue : 0),
                          )}
                        </span>
                      </div>
                    </div>

                    <BigButton
                      fullWidth
                      onClick={handleTopUp}
                      disabled={!canTopUp || submitting}
                    >
                      {submitting ? '處理中…' : '確認收款'}
                    </BigButton>
                  </>
                ) : (
                  <>
                    <div>
                      <h2 className="text-xl font-bold text-stone-900">
                        申辦會員
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        適用於已建立的非會員客戶
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {plans.map((plan) => (
                        <label
                          key={plan.id}
                          className={[
                            'flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 transition-colors',
                            selectedPlanId === plan.id
                              ? 'border-emerald-700 bg-emerald-50'
                              : 'border-stone-200 bg-white',
                          ].join(' ')}
                        >
                          <span>
                            <span className="block font-bold text-stone-900">
                              {plan.name}
                            </span>
                            <span className="mt-0.5 block text-sm text-stone-500">
                              {formatMoney(plan.monthlyFee)} · {plan.pointRate}{' '}
                              倍點數
                            </span>
                          </span>
                          <input
                            type="radio"
                            name="member-plan"
                            checked={selectedPlanId === plan.id}
                            onChange={() => setSelectedPlanId(plan.id)}
                            className="h-5 w-5 accent-emerald-700"
                          />
                        </label>
                      ))}
                    </div>

                    {selectedPlan && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="font-bold text-stone-900">方案預覽</p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {planStats.map((stat) => (
                            <div key={stat.label}>
                              <p className="text-xs text-stone-500">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-sm font-bold text-stone-900">
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <BigButton
                      fullWidth
                      onClick={handleEnroll}
                      disabled={!customer || !selectedPlanId || submitting}
                    >
                      {submitting ? '申辦中…' : '確認申辦'}
                    </BigButton>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </PosLayout>
  )
}
