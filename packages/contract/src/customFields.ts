export interface CustomFieldDef {
  key: string
  label: string
  type: 'text' | 'boolean' | 'number' | 'select'
  options?: string[]
  required: boolean
  locked: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// 法規 §4 / §8 強制欄位，UI 上不顯示刪除按鈕
export const LOCKED_FIELDS: CustomFieldDef[] = [
  {
    key: 'isAggressive',
    label: '有無攻擊性',
    type: 'boolean',
    required: true,
    locked: true,
  },
  {
    key: 'hasDisease',
    label: '有無疾病',
    type: 'boolean',
    required: true,
    locked: true,
  },
  {
    key: 'isVaccinated',
    label: '是否接種疫苗',
    type: 'boolean',
    required: true,
    locked: true,
  },
  {
    key: 'preferredVetName',
    label: '指定獸醫院',
    type: 'text',
    required: true,
    locked: true,
  },
]

export function validateCustomFields(
  fields: CustomFieldDef[],
): ValidationResult {
  const errors: string[] = []

  // 確認所有 locked 欄位都存在
  const fieldKeys = new Set(fields.map((f) => f.key))
  for (const locked of LOCKED_FIELDS) {
    if (!fieldKeys.has(locked.key)) {
      errors.push(`法規必填欄位缺少：${locked.key}（${locked.label}）`)
    }
  }

  // 確認 key 不重複
  const seen = new Set<string>()
  for (const field of fields) {
    if (seen.has(field.key)) {
      errors.push(`欄位 key 重複：${field.key}`)
    }
    seen.add(field.key)
  }

  return { valid: errors.length === 0, errors }
}
