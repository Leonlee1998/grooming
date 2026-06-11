import { z } from 'zod'

export const serviceCategoryOptions = [
  'BATH',
  'HAIRCUT',
  'NAIL',
  'SPA',
  'OTHER',
] as const

export const adjustmentTypeOptions = ['FIXED', 'PERCENTAGE'] as const

export const serviceSchema = z.object({
  name: z.string().trim().min(1, '服務名稱必填').max(80, '服務名稱過長'),
  category: z.enum(serviceCategoryOptions),
  description: z.string().trim().max(500, '說明不可超過 500 字').optional(),
  basePrice: z.number().int('基礎價格需為整數').min(0, '基礎價格不可小於 0'),
  estimatedMinutes: z
    .number()
    .int('預估時間需為整數')
    .min(1, '預估時間至少 1 分鐘')
    .max(1440, '預估時間不可超過 24 小時'),
  sortOrder: z.number().int('排序需為整數').min(0, '排序不可小於 0'),
  isActive: z.boolean(),
})

export const priceRuleSchema = z
  .object({
    serviceId: z.string().min(1, '缺少服務 ID'),
    weightMin: z.string().trim().optional(),
    weightMax: z.string().trim().optional(),
    breed: z.string().trim().max(80, '品種名稱過長').optional(),
    priceAdjustment: z
      .number()
      .int('加減價需為整數')
      .min(-100000, '加減價過低')
      .max(100000, '加減價過高'),
    adjustmentType: z.enum(adjustmentTypeOptions),
    isActive: z.boolean(),
  })
  .refine(
    (data) =>
      !data.weightMin ||
      !data.weightMax ||
      Number(data.weightMin) <= Number(data.weightMax),
    {
      message: '體重下限不可大於上限',
      path: ['weightMax'],
    },
  )

export type ServiceFormInput = z.infer<typeof serviceSchema>
export type PriceRuleFormInput = z.infer<typeof priceRuleSchema>

export function generatePriceRuleName(input: {
  weightMin?: string
  weightMax?: string
  breed?: string
  priceAdjustment: number
  adjustmentType: 'FIXED' | 'PERCENTAGE'
}) {
  const conditions: string[] = []
  const min = input.weightMin?.trim()
  const max = input.weightMax?.trim()
  const breed = input.breed?.trim()

  if (min && max) conditions.push(`${min}-${max}kg`)
  else if (min) conditions.push(`${min}kg 以上`)
  else if (max) conditions.push(`${max}kg 以下`)

  if (breed) conditions.push(breed)

  const scope = conditions.length > 0 ? conditions.join(' / ') : '所有寵物'
  const amount = Math.abs(input.priceAdjustment)
  const direction = input.priceAdjustment >= 0 ? '加' : '減'
  const unit = input.adjustmentType === 'PERCENTAGE' ? '%' : '元'

  return `${scope} ${direction} ${amount}${unit}`
}
