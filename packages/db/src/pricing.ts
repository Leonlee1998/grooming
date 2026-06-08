// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceRuleData {
  id: string
  name: string
  weightMin: number | null // kg，null = 無下限
  weightMax: number | null // kg，null = 無上限
  breed: string | null // null / '' = 不限品種
  priceAdjustment: number // FIXED = 元；PERCENTAGE = 百分比點數（e.g. 10 = +10%）
  adjustmentType: 'FIXED' | 'PERCENTAGE'
}

/** 呼叫者需預先從 DB 取得服務資料後傳入 */
export interface ServiceInput {
  serviceId: string
  serviceName: string
  basePrice: number
  quantity: number
  priceRules: PriceRuleData[]
}

/**
 * 呼叫者需預先驗證優惠碼有效性（有效期、使用次數等），
 * 僅將已驗證的資料傳入；validation 屬於 DB 層職責，不在此函式內。
 */
export interface PromotionInput {
  code: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
  /** PERCENTAGE: 百分比點數 (e.g. 10 = 10% off)；FIXED_AMOUNT: 折扣金額（元）*/
  discountValue: number
  minOrderAmount: number // 訂單門檻（subtotal + staffSurcharge）
  maxDiscountAmount: number | null // null = 無上限
}

export interface PriceInput {
  services: ServiceInput[]
  petWeightKg?: number // undefined / null 代表未知體重
  petBreed?: string // undefined / '' 代表未知品種
  staffSurcharge?: number // 指定美容師加價
  memberDiscountRate?: number // 0.05 = 5折扣（折數），作用在 subtotal
  promotion?: PromotionInput // 已驗證的優惠碼資料
}

export interface AppliedRule {
  ruleId: string
  ruleName: string
  adjustment: number // 實際調整金額（元），正數加價、負數減價
}

export interface PriceItemResult {
  serviceId: string
  serviceName: string
  basePrice: number
  unitPrice: number // basePrice + all rule adjustments
  quantity: number
  amount: number // unitPrice * quantity
  appliedRules: AppliedRule[]
}

export interface PriceResult {
  items: PriceItemResult[]
  subtotal: number // Σ item.amount（服務小計，不含加價）
  staffSurcharge: number
  memberDiscount: number // floor(subtotal * memberDiscountRate)
  promotionDiscount: number // 優惠碼折扣金額
  discountAmount: number // max(memberDiscount, promotionDiscount)
  total: number // max(0, subtotal + staffSurcharge - discountAmount)
  appliedPromotionCode?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ruleMatchesPet(
  rule: PriceRuleData,
  petWeightKg: number | undefined,
  petBreed: string | undefined,
): boolean {
  const hasWeightConstraint = rule.weightMin !== null || rule.weightMax !== null
  if (hasWeightConstraint) {
    if (petWeightKg == null) return false // 體重未知，無法確認是否符合
    if (rule.weightMin !== null && petWeightKg < rule.weightMin) return false
    if (rule.weightMax !== null && petWeightKg > rule.weightMax) return false
  }

  const ruleBreed = (rule.breed ?? '').trim().toLowerCase()
  if (ruleBreed) {
    const petBreedNorm = (petBreed ?? '').trim().toLowerCase()
    if (petBreedNorm !== ruleBreed) return false
  }

  return true
}

function calcRuleAdjustment(rule: PriceRuleData, basePrice: number): number {
  if (rule.adjustmentType === 'PERCENTAGE') {
    return Math.round((basePrice * rule.priceAdjustment) / 100)
  }
  return rule.priceAdjustment
}

function calcPromoDiscount(
  promotion: PromotionInput,
  subtotal: number,
  staffSurcharge: number,
): number {
  const orderTotal = subtotal + staffSurcharge
  if (orderTotal < promotion.minOrderAmount) return 0

  let discount: number
  if (promotion.discountType === 'PERCENTAGE') {
    discount = Math.floor((subtotal * promotion.discountValue) / 100)
  } else {
    discount = promotion.discountValue
  }

  // 不超過 maxDiscountAmount 上限
  if (promotion.maxDiscountAmount !== null) {
    discount = Math.min(discount, promotion.maxDiscountAmount)
  }
  // 不超過服務小計（折扣不能大於可折扣的金額）
  return Math.min(discount, subtotal)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculatePrice(input: PriceInput): PriceResult {
  const surcharge = input.staffSurcharge ?? 0

  // ── Step 1–3: 計算每項服務的調整後單價 ──────────────────────────────────
  const items: PriceItemResult[] = input.services.map((svc) => {
    const appliedRules: AppliedRule[] = []
    let unitPrice = svc.basePrice

    for (const rule of svc.priceRules) {
      if (!ruleMatchesPet(rule, input.petWeightKg, input.petBreed)) continue
      const adj = calcRuleAdjustment(rule, svc.basePrice)
      unitPrice += adj
      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        adjustment: adj,
      })
    }

    return {
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
      basePrice: svc.basePrice,
      unitPrice,
      quantity: svc.quantity,
      amount: unitPrice * svc.quantity,
      appliedRules,
    }
  })

  // ── Step 4: subtotal ─────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)

  // ── Step 6: 會員折扣（base = subtotal）──────────────────────────────────
  const memberDiscount =
    input.memberDiscountRate && input.memberDiscountRate > 0
      ? Math.floor(subtotal * input.memberDiscountRate)
      : 0

  // ── Step 7: 優惠碼折扣，取較大值 ────────────────────────────────────────
  const promotionDiscount = input.promotion
    ? calcPromoDiscount(input.promotion, subtotal, surcharge)
    : 0

  const discountAmount = Math.max(memberDiscount, promotionDiscount)

  // ── Step 8: total ────────────────────────────────────────────────────────
  const total = Math.max(0, subtotal + surcharge - discountAmount)

  return {
    items,
    subtotal,
    staffSurcharge: surcharge,
    memberDiscount,
    promotionDiscount,
    discountAmount,
    total,
    ...(input.promotion ? { appliedPromotionCode: input.promotion.code } : {}),
  }
}
