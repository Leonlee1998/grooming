export type ServiceCategory = 'BATH' | 'HAIRCUT' | 'NAIL' | 'SPA' | 'OTHER'

export type AdjustmentType = 'FIXED' | 'PERCENTAGE'

export type PriceRule = {
  id: string
  serviceId: string
  name: string
  weightMin: string | null
  weightMax: string | null
  breed: string | null
  priceAdjustment: number
  adjustmentType: AdjustmentType
  isActive: boolean
}

export type Service = {
  id: string
  name: string
  category: ServiceCategory
  description: string | null
  basePrice: number
  estimatedMinutes: number
  sortOrder: number
  isActive: boolean
  priceRules: PriceRule[]
}
