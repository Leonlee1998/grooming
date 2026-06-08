'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { CancelCheckinButton } from '@/components/checkin/CancelCheckinButton'
import { useCheckinStore } from '@/stores/checkin'
import { getPetsByCustomer, createPet, updatePetHealthInfo } from '../actions'

const STEPS = ['客戶', '寵物', '服務', '確認', '簽名']

type Pet = {
  id: string
  name: string
  species: string
  breed: string | null
  weightKg: string | null
  gender: string
  birthDate: string | null
  isAggressive: boolean
  hasDisease: boolean
  diseaseNotes: string | null
  isVaccinated: boolean
  isDewormed: boolean
  preferredVetName: string | null
  preferredVetPhone: string | null
  lastGroomedAt: string | null
}

const SPECIES_LABEL: Record<string, string> = { DOG: '狗', CAT: '貓' }
const SPECIES_ICON: Record<string, string> = { DOG: '🐶', CAT: '🐱' }
const GENDER_LABEL: Record<string, string> = {
  MALE: '公',
  FEMALE: '母',
  UNKNOWN: '未知',
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  })
}

// ─── 大型是/否按鈕 ─────────────────────────────────────────────────────────

interface YesNoProps {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
  yesVariant?: 'red' | 'green'
}

function YesNo({
  label,
  hint,
  value,
  onChange,
  yesVariant = 'green',
}: YesNoProps) {
  const yesClass =
    yesVariant === 'red'
      ? value
        ? 'bg-red-600 text-white border-red-600'
        : 'bg-white text-stone-600 border-stone-200 hover:border-red-300'
      : value
        ? 'bg-emerald-600 text-white border-emerald-600'
        : 'bg-white text-stone-600 border-stone-200 hover:border-emerald-300'

  const noClass = !value
    ? 'bg-stone-700 text-white border-stone-700'
    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'

  return (
    <div>
      <div className="mb-2">
        <p className="text-base font-semibold text-stone-800">{label}</p>
        {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-h-[56px] rounded-xl border-2 text-lg font-semibold transition-colors ${yesClass}`}
        >
          是
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-h-[56px] rounded-xl border-2 text-lg font-semibold transition-colors ${noClass}`}
        >
          否
        </button>
      </div>
    </div>
  )
}

// ─── 主頁面 ────────────────────────────────────────────────────────────────

type PageView = 'select' | 'add' | 'health'

const ADD_FORM_INIT = {
  name: '',
  species: 'DOG' as 'DOG' | 'CAT',
  breed: '',
  birthDate: '',
  weightKg: '',
  gender: 'UNKNOWN' as 'MALE' | 'FEMALE' | 'UNKNOWN',
}

export default function PetPage() {
  const router = useRouter()
  const { customerId, customerName, setPet, setOrderNotes } = useCheckinStore(
    (s) => ({
      customerId: s.customerId,
      customerName: s.customerName,
      setPet: s.setPet,
      setOrderNotes: s.setOrderNotes,
    }),
  )

  const [view, setView] = useState<PageView>('select')
  const [pets, setPets] = useState<Pet[]>([])
  const [activePet, setActivePet] = useState<Pet | null>(null)

  // 新增寵物表單
  const [addForm, setAddForm] = useState(ADD_FORM_INIT)
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // 健康確認表單（每次來店重新確認）
  const [health, setHealth] = useState({
    isAggressive: false,
    hasDisease: false,
    diseaseNotes: '',
    isVaccinated: false,
    isDewormed: false,
    preferredVetName: '',
    preferredVetPhone: '',
  })
  const [orderNotes, setOrderNotesLocal] = useState('')
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')

  const loadPets = useCallback(async () => {
    if (!customerId) return
    const result = await getPetsByCustomer(customerId)
    if (result.ok) setPets(result.data)
  }, [customerId])

  useEffect(() => {
    if (!customerId) {
      router.replace('/checkin')
      return
    }
    loadPets()
  }, [customerId, router, loadPets])

  function enterHealth(pet: Pet) {
    setActivePet(pet)
    setHealth({
      isAggressive: pet.isAggressive,
      hasDisease: pet.hasDisease,
      diseaseNotes: pet.diseaseNotes ?? '',
      isVaccinated: pet.isVaccinated,
      isDewormed: pet.isDewormed,
      preferredVetName: pet.preferredVetName ?? '',
      preferredVetPhone: pet.preferredVetPhone ?? '',
    })
    setOrderNotesLocal('')
    setHealthError('')
    setView('health')
  }

  async function handleAddPet() {
    if (!customerId) return
    setAddError('')
    setAddLoading(true)
    const result = await createPet({
      ...addForm,
      customerId,
      isAggressive: false,
      hasDisease: false,
      isVaccinated: false,
      isDewormed: false,
      preferredVetName: '',
    })
    setAddLoading(false)
    if (!result.ok) {
      setAddError(result.error)
      return
    }
    await loadPets()
    // 建完後進健康確認
    const fresh = await getPetsByCustomer(customerId)
    if (fresh.ok) {
      setPets(fresh.data)
      const newPet = fresh.data.find((p) => p.id === result.data.id)
      if (newPet) enterHealth(newPet)
    }
  }

  async function handleHealthConfirm() {
    if (!activePet || !customerId) return
    setHealthError('')
    setHealthLoading(true)
    const result = await updatePetHealthInfo({ petId: activePet.id, ...health })
    setHealthLoading(false)
    if (!result.ok) {
      setHealthError(result.error)
      return
    }

    setPet({
      petId: activePet.id,
      petName: activePet.name,
      petSpecies: SPECIES_LABEL[activePet.species] ?? activePet.species,
      petBreed: activePet.breed ?? '',
      petWeight: activePet.weightKg ? `${activePet.weightKg}kg` : '',
      petGender: GENDER_LABEL[activePet.gender] ?? activePet.gender,
      petBirthDate: activePet.birthDate ?? '',
      isAggressive: health.isAggressive,
      hasDisease: health.hasDisease,
      diseaseNotes: health.diseaseNotes,
      isVaccinated: health.isVaccinated,
      isDewormed: health.isDewormed,
      preferredVetName: health.preferredVetName,
      preferredVetPhone: health.preferredVetPhone,
    })
    setOrderNotes(orderNotes)
    router.push('/checkin/service')
  }

  // ── 選擇寵物 view ───────────────────────────────────────────────────────

  if (view === 'select') {
    return (
      <PosLayout>
        <div className="max-w-xl mx-auto flex flex-col gap-6">
          <StepIndicator current={2} total={5} labels={STEPS} />
          <div>
            <h1 className="text-3xl font-bold text-stone-900">選擇寵物</h1>
            <p className="mt-1 text-stone-500">{customerName} 的寵物</p>
          </div>

          <div className="flex flex-col gap-3">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => enterHealth(pet)}
                className="w-full text-left rounded-2xl border-2 border-stone-200 bg-white px-5 py-4 hover:border-emerald-400 active:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-3xl flex-shrink-0">
                    {SPECIES_ICON[pet.species] ?? '🐾'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-900 text-xl">
                        {pet.name}
                      </p>
                      {pet.isAggressive && (
                        <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">
                          ⚠ 攻擊性
                        </span>
                      )}
                      {pet.hasDisease && (
                        <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                          疾病
                        </span>
                      )}
                    </div>
                    <p className="text-stone-500 text-sm mt-0.5">
                      {SPECIES_LABEL[pet.species]} · {pet.breed || '混種'} ·{' '}
                      {GENDER_LABEL[pet.gender]}
                      {pet.weightKg ? ` · ${pet.weightKg}kg` : ''}
                    </p>
                    <p className="text-stone-400 text-xs mt-1">
                      {pet.lastGroomedAt
                        ? `上次美容：${fmtDate(pet.lastGroomedAt)}`
                        : '尚無美容紀錄'}
                    </p>
                  </div>
                  <span className="text-stone-300 text-2xl flex-shrink-0">
                    ›
                  </span>
                </div>
              </button>
            ))}

            {pets.length === 0 && (
              <div className="text-center py-12 text-stone-400 text-lg">
                尚無寵物紀錄，請新增
              </div>
            )}
          </div>

          <div className="grid grid-cols-[104px_minmax(0,1fr)_128px] gap-3">
            <BigButton
              variant="secondary"
              onClick={() => router.push('/checkin')}
            >
              返回
            </BigButton>
            <BigButton
              fullWidth
              variant="secondary"
              onClick={() => {
                setAddForm(ADD_FORM_INIT)
                setAddError('')
                setView('add')
              }}
            >
              ＋ 新增寵物
            </BigButton>
            <CancelCheckinButton />
          </div>
        </div>
      </PosLayout>
    )
  }

  // ── 新增寵物 view ───────────────────────────────────────────────────────

  if (view === 'add') {
    const f = addForm
    const set = (k: keyof typeof ADD_FORM_INIT, v: string) =>
      setAddForm((prev) => ({ ...prev, [k]: v }))

    return (
      <PosLayout>
        <div className="max-w-xl mx-auto flex flex-col gap-6">
          <StepIndicator current={2} total={5} labels={STEPS} />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('select')}
              className="text-stone-400 text-2xl"
            >
              ‹
            </button>
            <div>
              <h1 className="text-3xl font-bold text-stone-900">新增寵物</h1>
              <p className="mt-0.5 text-stone-500">{customerName}</p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* 名字 */}
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">
                寵物名字 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="小白"
                value={f.name}
                onChange={(e) => set('name', e.target.value)}
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-xl focus:outline-none focus:border-emerald-500 transition-colors"
                autoFocus
              />
            </div>

            {/* 種類 Radio */}
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">
                種類
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['DOG', 'CAT'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('species', s)}
                    className={[
                      'min-h-[64px] rounded-xl border-2 text-xl font-semibold transition-colors flex items-center justify-center gap-2',
                      f.species === s
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-600',
                    ].join(' ')}
                  >
                    {SPECIES_ICON[s]} {SPECIES_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 性別 */}
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">
                性別
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['MALE', '公'],
                    ['FEMALE', '母'],
                    ['UNKNOWN', '不明'],
                  ] as const
                ).map(([v, lbl]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('gender', v)}
                    className={[
                      'min-h-[56px] rounded-xl border-2 text-lg font-medium transition-colors',
                      f.gender === v
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-600',
                    ].join(' ')}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* 品種 + 體重 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  品種
                </label>
                <input
                  type="text"
                  placeholder="黃金獵犬"
                  value={f.breed}
                  onChange={(e) => set('breed', e.target.value)}
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-600 mb-2">
                  體重 (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="5.2"
                  value={f.weightKg}
                  onChange={(e) => set('weightKg', e.target.value)}
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* 出生日期 */}
            <div>
              <label className="block text-sm font-semibold text-stone-600 mb-2">
                出生日期{' '}
                <span className="text-stone-400 font-normal">（選填）</span>
              </label>
              <input
                type="date"
                value={f.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {addError && (
              <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
                {addError}
              </p>
            )}

            <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3">
              <CancelCheckinButton />
              <BigButton
                fullWidth
                onClick={handleAddPet}
                disabled={addLoading || !f.name.trim()}
              >
                {addLoading ? '儲存中…' : '儲存，進行健康確認'}
              </BigButton>
            </div>
          </div>
        </div>
      </PosLayout>
    )
  }

  // ── 健康確認 view ───────────────────────────────────────────────────────

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <StepIndicator current={2} total={5} labels={STEPS} />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('select')}
            className="text-stone-400 text-2xl"
          >
            ‹
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">
                {SPECIES_ICON[activePet?.species ?? ''] ?? '🐾'}
              </span>
              <h1 className="text-3xl font-bold text-stone-900">
                {activePet?.name}
              </h1>
            </div>
            <p className="mt-0.5 text-stone-500 text-sm">
              法規 §4：每次美容前健康確認
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <YesNo
            label="今日是否有攻擊性行為？"
            hint="包含咬人、過度抵抗等行為"
            value={health.isAggressive}
            onChange={(v) => setHealth((h) => ({ ...h, isAggressive: v }))}
            yesVariant="red"
          />

          <div>
            <YesNo
              label="是否有疾病或不適？"
              value={health.hasDisease}
              onChange={(v) =>
                setHealth((h) => ({
                  ...h,
                  hasDisease: v,
                  diseaseNotes: v ? h.diseaseNotes : '',
                }))
              }
            />
            {health.hasDisease && (
              <textarea
                rows={3}
                placeholder="請描述疾病或特殊狀況…"
                value={health.diseaseNotes}
                onChange={(e) =>
                  setHealth((h) => ({ ...h, diseaseNotes: e.target.value }))
                }
                className="mt-3 w-full rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            )}
          </div>

          <YesNo
            label="是否已接種疫苗？"
            value={health.isVaccinated}
            onChange={(v) => setHealth((h) => ({ ...h, isVaccinated: v }))}
          />

          <YesNo
            label="是否已驅蟲？"
            value={health.isDewormed}
            onChange={(v) => setHealth((h) => ({ ...h, isDewormed: v }))}
          />

          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">
              指定獸醫院{' '}
              <span className="text-stone-400 font-normal">
                （異常時優先送往）
              </span>
            </label>
            <input
              type="text"
              placeholder="XX動物醫院"
              value={health.preferredVetName}
              onChange={(e) =>
                setHealth((h) => ({ ...h, preferredVetName: e.target.value }))
              }
              className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-600 mb-2">
              今日備注{' '}
              <span className="text-stone-400 font-normal">
                （選填，例：最近剛洗完澡）
              </span>
            </label>
            <textarea
              rows={3}
              placeholder="任何需要告知美容師的事項…"
              value={orderNotes}
              onChange={(e) => setOrderNotesLocal(e.target.value)}
              className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>
        </div>

        {healthError && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
            {healthError}
          </p>
        )}

        <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3">
          <CancelCheckinButton />
          <BigButton
            fullWidth
            onClick={handleHealthConfirm}
            disabled={healthLoading}
          >
            {healthLoading ? '儲存中…' : '確認，選擇服務'}
          </BigButton>
        </div>
      </div>
    </PosLayout>
  )
}
