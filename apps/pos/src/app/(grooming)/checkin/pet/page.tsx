'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PosLayout } from '@/components/layout/PosLayout'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { BigButton } from '@/components/ui/BigButton'
import { useCheckinStore } from '@/stores/checkin'
import { getPetsByCustomer, createPet } from '../actions'

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
}

const SPECIES_LABEL: Record<string, string> = { DOG: '狗', CAT: '貓' }
const GENDER_LABEL: Record<string, string> = {
  MALE: '公',
  FEMALE: '母',
  UNKNOWN: '未知',
}

export default function PetPage() {
  const router = useRouter()
  const { customerId, customerName, setPet } = useCheckinStore((s) => ({
    customerId: s.customerId,
    customerName: s.customerName,
    setPet: s.setPet,
  }))

  const [pets, setPets] = useState<Pet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    species: 'DOG' as 'DOG' | 'CAT',
    breed: '',
    weightKg: '',
    gender: 'UNKNOWN' as 'MALE' | 'FEMALE' | 'UNKNOWN',
    birthDate: '',
    isAggressive: false,
    hasDisease: false,
    diseaseNotes: '',
    isVaccinated: false,
    isDewormed: false,
    preferredVetName: '',
    preferredVetPhone: '',
  })

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

  function selectPet(pet: Pet) {
    setPet({
      petId: pet.id,
      petName: pet.name,
      petSpecies: SPECIES_LABEL[pet.species] ?? pet.species,
      petBreed: pet.breed ?? '',
      petWeight: pet.weightKg ? `${pet.weightKg}kg` : '',
      petGender: GENDER_LABEL[pet.gender] ?? pet.gender,
      petBirthDate: pet.birthDate ?? '',
      isAggressive: pet.isAggressive,
      hasDisease: pet.hasDisease,
      diseaseNotes: pet.diseaseNotes ?? '',
      isVaccinated: pet.isVaccinated,
      isDewormed: pet.isDewormed,
      preferredVetName: pet.preferredVetName ?? '',
      preferredVetPhone: pet.preferredVetPhone ?? '',
    })
    router.push('/checkin/service')
  }

  async function handleCreatePet() {
    if (!customerId) return
    setError('')
    setLoading(true)
    const result = await createPet({ ...form, customerId })
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await loadPets()
    setShowForm(false)
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type = 'text',
    required = false,
  ) => (
    <div key={key}>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
      />
    </div>
  )

  const toggle = (label: string, key: keyof typeof form, note?: string) => (
    <div
      key={key}
      className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 border border-stone-200"
    >
      <div>
        <p className="text-base text-stone-800">{label}</p>
        {note && <p className="text-xs text-stone-400">{note}</p>}
      </div>
      <button
        type="button"
        onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
        className={[
          'w-14 h-8 rounded-full transition-colors relative',
          form[key] ? 'bg-emerald-600' : 'bg-stone-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all',
            form[key] ? 'left-7' : 'left-1',
          ].join(' ')}
        />
      </button>
    </div>
  )

  return (
    <PosLayout>
      <div className="max-w-xl mx-auto flex flex-col gap-6">
        <StepIndicator current={2} total={5} labels={STEPS} />

        <div>
          <h1 className="text-2xl font-bold text-stone-900">選擇寵物</h1>
          <p className="mt-1 text-stone-500">{customerName} 的寵物</p>
        </div>

        {!showForm ? (
          <>
            <div className="flex flex-col gap-3">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => selectPet(pet)}
                  className="w-full text-left rounded-xl border-2 border-stone-200 bg-white px-4 py-4 hover:border-emerald-500 active:bg-emerald-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                      {pet.species === 'DOG' ? '🐶' : '🐱'}
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900 text-lg">
                        {pet.name}
                      </p>
                      <p className="text-stone-500 text-sm">
                        {SPECIES_LABEL[pet.species]} · {pet.breed || '混種'} ·{' '}
                        {GENDER_LABEL[pet.gender]}
                        {pet.weightKg ? ` · ${pet.weightKg}kg` : ''}
                      </p>
                    </div>
                    {(pet.isAggressive || pet.hasDisease) && (
                      <div className="ml-auto flex gap-1">
                        {pet.isAggressive && (
                          <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                            攻擊性
                          </span>
                        )}
                        {pet.hasDisease && (
                          <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                            疾病
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {pets.length === 0 && (
                <div className="text-center py-8 text-stone-400">
                  尚無寵物紀錄
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <BigButton
                variant="secondary"
                onClick={() => router.push('/checkin')}
                className="w-28"
              >
                返回
              </BigButton>
              <BigButton
                fullWidth
                variant="secondary"
                onClick={() => setShowForm(true)}
              >
                ＋ 新增寵物
              </BigButton>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-stone-800 text-lg">新增寵物</h2>

            {field('寵物名稱', 'name', 'text', true)}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  種類 *
                </label>
                <select
                  value={form.species}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      species: e.target.value as 'DOG' | 'CAT',
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="DOG">狗</option>
                  <option value="CAT">貓</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  性別
                </label>
                <select
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      gender: e.target.value as 'MALE' | 'FEMALE' | 'UNKNOWN',
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="UNKNOWN">未知</option>
                  <option value="MALE">公</option>
                  <option value="FEMALE">母</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field('品種', 'breed')}
              {field('體重 (kg)', 'weightKg', 'number')}
            </div>

            {field('出生日期', 'birthDate', 'date')}

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-semibold text-stone-700 mb-3">
                健康聲明（法規 §4 必填）
              </p>
              <div className="flex flex-col gap-2">
                {toggle('有無攻擊性', 'isAggressive')}
                {toggle('有無疾病', 'hasDisease')}
                {form.hasDisease && field('疾病說明', 'diseaseNotes')}
                {toggle('是否接種疫苗', 'isVaccinated')}
                {toggle('是否驅蟲', 'isDewormed')}
              </div>
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-semibold text-stone-700 mb-3">
                緊急就醫（法規 §4 必填）
              </p>
              {field('指定獸醫院', 'preferredVetName', 'text', true)}
              {field('獸醫院電話', 'preferredVetPhone', 'tel')}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <BigButton
                variant="secondary"
                onClick={() => setShowForm(false)}
                className="w-28"
              >
                取消
              </BigButton>
              <BigButton
                fullWidth
                onClick={handleCreatePet}
                disabled={loading || !form.name || !form.preferredVetName}
              >
                {loading ? '儲存中…' : '儲存寵物'}
              </BigButton>
            </div>
          </div>
        )}
      </div>
    </PosLayout>
  )
}
