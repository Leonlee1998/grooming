'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { useCheckinStore } from '@/stores/checkin'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

// ─── Helpers ──────────────────────────────────────────────────────────────

function now30() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return d.toISOString().slice(0, 16)
}

function addMinutes(base: string, mins: number) {
  const d = new Date(base)
  d.setMinutes(d.getMinutes() + mins)
  return d.toISOString().slice(0, 16)
}

function fmtDatetime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

function fmtMins(mins: number) {
  if (mins < 60) return `${mins} 分鐘`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`
}

// ─── Local Components ─────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  dark,
  children,
}: {
  title: string
  subtitle?: string
  dark?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div
        className={
          dark
            ? 'bg-stone-900 px-5 py-3'
            : 'bg-stone-50 px-5 py-3 border-b border-stone-100'
        }
      >
        <p
          className={`font-semibold text-sm ${dark ? 'text-white' : 'text-stone-700'}`}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className={`text-xs mt-0.5 ${dark ? 'text-stone-400' : 'text-stone-400'}`}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-500 text-sm shrink-0">{label}</span>
      <span className="text-stone-900 font-medium text-sm text-right">
        {value}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ConfirmPage() {
  const router = useRouter()
  const store = useCheckinStore()

  const [scheduledAt, setScheduledAt] = useState(now30)

  useEffect(() => {
    if (
      !store.customerId ||
      !store.petId ||
      store.selectedServices.length === 0
    ) {
      router.replace('/checkin')
    }
  }, [store.customerId, store.petId, store.selectedServices.length, router])

  const estimatedDuration = store.estimatedDuration || 60
  const pickupDeadline = addMinutes(scheduledAt, estimatedDuration)

  // 費用直接來自 calculateOrderPrice 結果（唯讀）
  const subtotal = store.subtotalAmount
  const discountAmount = store.discountAmount
  const total = store.totalAmount

  function handleConfirm() {
    if (!store.customerId || !store.petId) {
      router.replace('/checkin')
      return
    }
    store.setSchedule({
      scheduledAt: new Date(scheduledAt).toISOString(),
      estimatedDuration,
      pickupDeadlineAt: new Date(pickupDeadline).toISOString(),
    })
    router.push('/checkin/sign')
  }

  return (
    <PosLayout>
      <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-8">
        <StepIndicator current={4} total={5} labels={STEPS} />

        {/* 頁首 */}
        <div>
          <h1 className="text-3xl font-bold text-stone-900">費用確認</h1>
          <p className="mt-1.5 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            法規 §3｜以下費用在客戶簽名前須完整揭露，已列明費用以外不得另行收取
          </p>
        </div>

        {/* ── 1. 客戶資訊 ─────────────────────────────── */}
        <SectionCard title="客戶資訊">
          <InfoRow label="姓名" value={store.customerName} />
          <InfoRow label="手機" value={store.customerPhone} />
          {store.emergencyContact && (
            <InfoRow
              label="緊急聯絡人"
              value={`${store.emergencyContact}${store.emergencyPhone ? ` ${store.emergencyPhone}` : ''}`}
            />
          )}
        </SectionCard>

        {/* ── 2. 寵物資訊 ─────────────────────────────── */}
        <SectionCard title="寵物資訊">
          <InfoRow label="名字" value={store.petName} />
          <InfoRow
            label="品種"
            value={`${store.petSpecies}${store.petBreed ? ` · ${store.petBreed}` : ''}`}
          />
          {store.petWeight && <InfoRow label="體重" value={store.petWeight} />}

          {/* 健康狀況標籤 */}
          <div className="py-3 border-b border-stone-100">
            <p className="text-sm text-stone-500 mb-2">健康狀況</p>
            <div className="flex flex-wrap gap-2">
              {store.isAggressive ? (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2.5 py-1 font-semibold">
                  ⚠ 有攻擊性
                </span>
              ) : (
                <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                  無攻擊性
                </span>
              )}
              {store.hasDisease ? (
                <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-1 font-semibold">
                  有疾病
                </span>
              ) : (
                <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                  無疾病
                </span>
              )}
              {store.isVaccinated ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                  ✓ 已接種疫苗
                </span>
              ) : (
                <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1">
                  疫苗不明
                </span>
              )}
              {store.isDewormed ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                  ✓ 已驅蟲
                </span>
              ) : (
                <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2.5 py-1">
                  驅蟲不明
                </span>
              )}
            </div>
          </div>

          {store.hasDisease && store.diseaseNotes && (
            <InfoRow label="疾病說明" value={store.diseaseNotes} />
          )}
          {store.preferredVetName && (
            <InfoRow
              label="指定獸醫院"
              value={`${store.preferredVetName}${store.preferredVetPhone ? ` · ${store.preferredVetPhone}` : ''}`}
            />
          )}
        </SectionCard>

        {/* ── 3. 服務明細（法規§3核心） ───────────────── */}
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="bg-stone-900 px-5 py-3">
            <p className="font-semibold text-white text-sm">服務明細</p>
            <p className="text-stone-400 text-xs mt-0.5">
              法規 §3 揭露｜未列明費用不得收取
            </p>
          </div>

          {/* 表頭 */}
          <div className="grid grid-cols-[1fr_72px_48px_80px] gap-x-2 px-5 py-2 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-400 uppercase tracking-wide">
            <span>服務項目</span>
            <span className="text-right">單價</span>
            <span className="text-center">數量</span>
            <span className="text-right">小計</span>
          </div>

          {/* 服務行 */}
          <div className="divide-y divide-stone-100">
            {store.selectedServices.map((s) => (
              <div key={s.serviceId} className="px-5 py-3">
                <div className="grid grid-cols-[1fr_72px_48px_80px] gap-x-2 items-baseline">
                  <div>
                    <p className="font-medium text-stone-900 text-sm leading-snug">
                      {s.serviceName}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      約 {fmtMins(s.estimatedMinutes)}
                    </p>
                    {s.priceAdjustments.map((rule) => (
                      <p
                        key={rule.ruleName}
                        className="text-xs text-amber-700 mt-0.5"
                      >
                        {rule.ruleName}：+${rule.amount}
                      </p>
                    ))}
                  </div>
                  <p className="text-right text-stone-600 text-sm">
                    ${s.unitPrice}
                  </p>
                  <p className="text-center text-stone-700 font-medium text-sm">
                    {s.quantity}
                  </p>
                  <p className="text-right font-semibold text-stone-900 text-sm">
                    ${s.unitPrice * s.quantity}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 費用合計 */}
          <div className="px-5 py-4 bg-stone-50 border-t border-stone-200 flex flex-col gap-2.5">
            {store.staffName && (
              <div className="flex justify-between text-sm text-stone-600">
                <span>
                  指定美容師：{store.staffName}
                  {store.staffSurcharge > 0 ? '' : '（不加價）'}
                </span>
                {store.staffSurcharge > 0 && (
                  <span className="font-medium">+${store.staffSurcharge}</span>
                )}
              </div>
            )}
            <div className="flex justify-between text-sm text-stone-700">
              <span>服務小計</span>
              <span className="font-semibold">${subtotal}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>會員折扣</span>
                <span className="font-semibold">−${discountAmount}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2.5 border-t border-stone-200">
              <span className="text-base font-bold text-stone-800">總計</span>
              <span className="text-3xl font-bold text-emerald-700">
                ${total}
              </span>
            </div>
          </div>
        </div>

        {/* ── 4. 服務時間 ──────────────────────────────── */}
        <SectionCard title="服務時間">
          <div className="py-3 border-b border-stone-100">
            <label className="block text-sm text-stone-500 mb-2">
              約定服務開始時間
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <InfoRow label="預估服務時間" value={fmtMins(estimatedDuration)} />
          <div className="flex justify-between gap-4 py-3">
            <span className="text-stone-500 text-sm">約定接回時間</span>
            <span className="font-bold text-stone-900 text-sm text-right">
              {fmtDatetime(pickupDeadline)}
            </span>
          </div>
        </SectionCard>

        {/* ── 5. 逾時費說明（法規固定文字） ───────────── */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            逾時費規則（依法規規定）
          </p>
          <ul className="text-sm text-amber-800 space-y-1.5">
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>寵物美容完成後，自約定接回時間起算</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>
                逾時 <strong>30 分鐘以內</strong>，不收取任何逾時費用
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>超過 30 分鐘後，方可依契約所載金額收取逾時費</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>逾時費須於本契約中事先列明，未列明者一律不得收取</span>
            </li>
          </ul>
        </div>

        {/* ── 6. 重要聲明（法規固定文字） ─────────────── */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
          <p className="text-sm font-semibold text-stone-700 mb-2">
            業者照護義務聲明
          </p>
          <ul className="text-sm text-stone-600 space-y-1.5">
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>
                業者應依本契約提供服務，並對寵物盡善良管理人之注意義務
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>
                美容過程中，寵物如出現異常狀況，業者應立即通知客戶，
                並優先送往客戶指定獸醫院（
                {store.preferredVetName || '未填寫，請返回設定'}）
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>
                本契約費用已完整揭露，客戶簽名確認後始生效，其後費用不得變動
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">·</span>
              <span>
                客戶得於簽約後 <strong>3 日內</strong>無理由解除契約，
                退費手續費不逾服務費 5%，且不超過新台幣 1,000 元
              </span>
            </li>
          </ul>
        </div>

        {/* 今日備注 */}
        {store.orderNotes && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3">
            <p className="text-xs font-semibold text-sky-600 mb-1">今日備注</p>
            <p className="text-sm text-sky-900">{store.orderNotes}</p>
          </div>
        )}

        {/* 底部按鈕 */}
        <div className="grid grid-cols-[104px_minmax(0,1fr)_128px] gap-3 pt-1">
          <BigButton
            variant="secondary"
            onClick={() => router.push('/checkin/service')}
          >
            返回修改
          </BigButton>
          <BigButton fullWidth onClick={handleConfirm}>
            確認，前往簽名
          </BigButton>
          <CancelCheckinButton />
        </div>
      </div>
    </PosLayout>
  )
}
