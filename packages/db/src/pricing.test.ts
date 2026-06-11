import { describe, it, expect } from 'vitest'
import { calculatePrice } from './pricing.js'
import type { ServiceInput, PromotionInput } from './pricing.js'

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeService(overrides: Partial<ServiceInput> = {}): ServiceInput {
  return {
    serviceId: 'svc-1',
    serviceName: '基礎洗澡',
    basePrice: 500,
    quantity: 1,
    priceRules: [],
    ...overrides,
  }
}

function makeWeightRule(
  weightMin: number | null,
  weightMax: number | null,
  adjustment: number,
  adjustmentType: 'FIXED' | 'PERCENTAGE' = 'FIXED',
) {
  return {
    id: `rule-${weightMin}-${weightMax}`,
    name: `體重 ${weightMin ?? '0'}–${weightMax ?? '∞'} kg`,
    weightMin,
    weightMax,
    breed: null,
    priceAdjustment: adjustment,
    adjustmentType,
  }
}

function makeBreedRule(breed: string, adjustment: number) {
  return {
    id: `rule-breed-${breed}`,
    name: `品種 ${breed} 加價`,
    weightMin: null,
    weightMax: null,
    breed,
    priceAdjustment: adjustment,
    adjustmentType: 'FIXED' as const,
  }
}

const poodleRule = makeBreedRule('貴賓犬', 100)
const smallDogRule = makeWeightRule(null, 5, 0) // ≤ 5kg：不加價
const mediumDogRule = makeWeightRule(5.01, 10, 200) // 5.01–10kg：+200
const largeDogRule = makeWeightRule(10.01, null, 400) // >10kg：+400
const tenPercentRule = makeWeightRule(8, null, 10, 'PERCENTAGE')

const percentPromo: PromotionInput = {
  code: 'SUMMER10',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  minOrderAmount: 0,
  maxDiscountAmount: null,
}

const fixedPromo: PromotionInput = {
  code: 'FLAT100',
  discountType: 'FIXED_AMOUNT',
  discountValue: 100,
  minOrderAmount: 0,
  maxDiscountAmount: null,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculatePrice', () => {
  // ─── 基礎計算 ──────────────────────────────────────────────────────────

  it('單一服務、無規則、無折扣', () => {
    const result = calculatePrice({ services: [makeService()] })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].unitPrice).toBe(500)
    expect(result.items[0].amount).toBe(500)
    expect(result.subtotal).toBe(500)
    expect(result.staffSurcharge).toBe(0)
    expect(result.discountAmount).toBe(0)
    expect(result.total).toBe(500)
    expect(result.memberDiscount).toBe(0)
    expect(result.promotionDiscount).toBe(0)
  })

  it('多服務加總', () => {
    const result = calculatePrice({
      services: [
        makeService({ serviceId: 'svc-1', basePrice: 500, quantity: 1 }),
        makeService({
          serviceId: 'svc-2',
          serviceName: '美毛',
          basePrice: 300,
          quantity: 2,
        }),
      ],
    })
    // 500 + 300*2 = 1100
    expect(result.subtotal).toBe(1100)
    expect(result.total).toBe(1100)
    expect(result.items[1].amount).toBe(600)
  })

  it('quantity > 1 正確計算', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 200, quantity: 3 })],
    })
    expect(result.items[0].amount).toBe(600)
    expect(result.subtotal).toBe(600)
  })

  // ─── Staff 加價 ────────────────────────────────────────────────────────

  it('staffSurcharge 加到 total 但不影響折扣基準', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 500 })],
      staffSurcharge: 200,
      memberDiscountRate: 0.1, // 10% off subtotal (500)
    })
    expect(result.staffSurcharge).toBe(200)
    expect(result.memberDiscount).toBe(50) // floor(500 * 0.1)
    expect(result.total).toBe(650) // 500 + 200 - 50
  })

  // ─── PriceRule：體重（FIXED）──────────────────────────────────────────

  it('體重在規則範圍內套用 FIXED 加價', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule] })],
      petWeightKg: 7,
    })
    expect(result.items[0].unitPrice).toBe(700) // 500 + 200
    expect(result.items[0].appliedRules).toHaveLength(1)
    expect(result.items[0].appliedRules[0].adjustment).toBe(200)
    expect(result.total).toBe(700)
  })

  it('體重超出規則上限，規則不套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule] })],
      petWeightKg: 12, // mediumDogRule 最大 10kg
    })
    expect(result.items[0].unitPrice).toBe(500)
    expect(result.items[0].appliedRules).toHaveLength(0)
  })

  it('體重低於規則下限，規則不套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule] })],
      petWeightKg: 3,
    })
    expect(result.items[0].unitPrice).toBe(500)
  })

  it('無上限規則（weightMax: null）對大型犬套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [largeDogRule] })],
      petWeightKg: 25,
    })
    expect(result.items[0].unitPrice).toBe(900) // 500 + 400
  })

  it('無下限規則（weightMin: null）對任意體重套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [smallDogRule] })],
      petWeightKg: 3,
    })
    expect(result.items[0].appliedRules).toHaveLength(1)
    expect(result.items[0].unitPrice).toBe(500) // +0 加價
  })

  // ─── PriceRule：體重（PERCENTAGE）────────────────────────────────────

  it('PERCENTAGE 規則正確計算', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 500, priceRules: [tenPercentRule] })],
      petWeightKg: 10,
    })
    // 10% of 500 = 50，unit = 550
    expect(result.items[0].unitPrice).toBe(550)
    expect(result.items[0].appliedRules[0].adjustment).toBe(50)
  })

  it('PERCENTAGE 規則使用 round（非 floor）計算加價', () => {
    const rule = makeWeightRule(null, null, 15, 'PERCENTAGE') // 15%
    const result = calculatePrice({
      services: [makeService({ basePrice: 300, priceRules: [rule] })],
    })
    // 15% of 300 = 45.0 → 45
    expect(result.items[0].unitPrice).toBe(345)
  })

  it('PERCENTAGE 規則 round 到最近整數', () => {
    const rule = makeWeightRule(null, null, 15, 'PERCENTAGE') // 15%
    const result = calculatePrice({
      services: [makeService({ basePrice: 333, priceRules: [rule] })],
    })
    // 15% of 333 = 49.95 → 50
    expect(result.items[0].unitPrice).toBe(383)
  })

  // ─── PriceRule：品種 ──────────────────────────────────────────────────

  it('品種完全符合時套用規則', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [poodleRule] })],
      petBreed: '貴賓犬',
    })
    expect(result.items[0].unitPrice).toBe(600)
  })

  it('品種不符時規則不套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [poodleRule] })],
      petBreed: '柴犬',
    })
    expect(result.items[0].unitPrice).toBe(500)
  })

  it('品種比對不區分大小寫', () => {
    const rule = makeBreedRule('poodle', 100)
    const result = calculatePrice({
      services: [makeService({ priceRules: [rule] })],
      petBreed: 'POODLE',
    })
    expect(result.items[0].unitPrice).toBe(600)
  })

  it('petBreed 未提供時，有品種限制的規則不套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [poodleRule] })],
      // petBreed: undefined
    })
    expect(result.items[0].unitPrice).toBe(500)
    expect(result.items[0].appliedRules).toHaveLength(0)
  })

  it('規則 breed 為 null 時匹配所有品種', () => {
    const noBreedRule = { ...makeWeightRule(null, null, 50), breed: null }
    const result = calculatePrice({
      services: [makeService({ priceRules: [noBreedRule] })],
      petBreed: '任意品種',
    })
    expect(result.items[0].unitPrice).toBe(550)
  })

  // ─── PriceRule：多規則累加 ────────────────────────────────────────────

  it('多個匹配規則全部累加', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule, poodleRule] })],
      petWeightKg: 7,
      petBreed: '貴賓犬',
    })
    // 500 + 200(體重) + 100(品種) = 800
    expect(result.items[0].unitPrice).toBe(800)
    expect(result.items[0].appliedRules).toHaveLength(2)
  })

  it('部分規則匹配時只累加符合的', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule, poodleRule] })],
      petWeightKg: 7,
      petBreed: '柴犬', // poodleRule 不匹配
    })
    expect(result.items[0].unitPrice).toBe(700)
    expect(result.items[0].appliedRules).toHaveLength(1)
  })

  // ─── 邊界值：體重未知 ─────────────────────────────────────────────────

  it('petWeightKg 未提供時，有體重限制的規則不套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [mediumDogRule] })],
      // petWeightKg: undefined
    })
    expect(result.items[0].unitPrice).toBe(500)
    expect(result.items[0].appliedRules).toHaveLength(0)
  })

  it('petWeightKg 未提供時，品種規則仍可套用', () => {
    const result = calculatePrice({
      services: [makeService({ priceRules: [poodleRule] })],
      petBreed: '貴賓犬',
      // petWeightKg: undefined
    })
    expect(result.items[0].unitPrice).toBe(600)
  })

  it('rules 陣列空白時直接用 basePrice', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 0, priceRules: [] })],
    })
    expect(result.items[0].unitPrice).toBe(0)
    expect(result.subtotal).toBe(0)
    expect(result.total).toBe(0)
  })

  // ─── 邊界值：0 元服務 ─────────────────────────────────────────────────

  it('basePrice = 0，PERCENTAGE 規則加價也是 0', () => {
    const pctRule = makeWeightRule(null, null, 20, 'PERCENTAGE')
    const result = calculatePrice({
      services: [makeService({ basePrice: 0, priceRules: [pctRule] })],
    })
    expect(result.items[0].unitPrice).toBe(0)
    expect(result.total).toBe(0)
  })

  // ─── 會員折扣 ──────────────────────────────────────────────────────────

  it('memberDiscountRate 0.05 = 5% 折扣', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 600 })],
      memberDiscountRate: 0.05,
    })
    // floor(600 * 0.05) = 30
    expect(result.memberDiscount).toBe(30)
    expect(result.discountAmount).toBe(30)
    expect(result.total).toBe(570)
  })

  it('memberDiscountRate 0 不折扣', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 500 })],
      memberDiscountRate: 0,
    })
    expect(result.memberDiscount).toBe(0)
    expect(result.discountAmount).toBe(0)
  })

  it('memberDiscount 使用 floor（無條件捨去）', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 999 })],
      memberDiscountRate: 0.1,
    })
    // floor(999 * 0.1) = floor(99.9) = 99
    expect(result.memberDiscount).toBe(99)
  })

  it('memberDiscount 不超過 subtotal', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 100 })],
      memberDiscountRate: 1.5, // 150% — 極端值測試
    })
    // floor(100 * 1.5) = 150，但 total 不可為負
    expect(result.total).toBe(0)
  })

  // ─── 優惠碼（PERCENTAGE）──────────────────────────────────────────────

  it('PERCENTAGE 優惠碼 10% off', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 800 })],
      promotion: percentPromo, // SUMMER10 = 10%
    })
    // floor(800 * 10 / 100) = 80
    expect(result.promotionDiscount).toBe(80)
    expect(result.discountAmount).toBe(80)
    expect(result.total).toBe(720)
    expect(result.appliedPromotionCode).toBe('SUMMER10')
  })

  it('PERCENTAGE 優惠碼不超過 maxDiscountAmount 上限', () => {
    const cappedPromo: PromotionInput = {
      ...percentPromo,
      maxDiscountAmount: 50,
    }
    const result = calculatePrice({
      services: [makeService({ basePrice: 1000 })],
      promotion: cappedPromo,
    })
    // 10% of 1000 = 100，但上限 50
    expect(result.promotionDiscount).toBe(50)
    expect(result.total).toBe(950)
  })

  // ─── 優惠碼（FIXED_AMOUNT）────────────────────────────────────────────

  it('FIXED_AMOUNT 優惠碼扣固定金額', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 600 })],
      promotion: fixedPromo, // FLAT100 = -100
    })
    expect(result.promotionDiscount).toBe(100)
    expect(result.total).toBe(500)
  })

  it('FIXED_AMOUNT 優惠碼不超過 subtotal', () => {
    const bigFixed: PromotionInput = {
      ...fixedPromo,
      discountValue: 999,
    }
    const result = calculatePrice({
      services: [makeService({ basePrice: 200 })],
      promotion: bigFixed,
    })
    // 999 > 200，折扣上限為 subtotal
    expect(result.promotionDiscount).toBe(200)
    expect(result.total).toBe(0) // 200 + 0 surcharge - 200 = 0
  })

  // ─── 優惠碼：minOrderAmount 門檻 ─────────────────────────────────────

  it('未達 minOrderAmount 不套用優惠', () => {
    const minPromo: PromotionInput = {
      ...percentPromo,
      minOrderAmount: 1000,
    }
    const result = calculatePrice({
      services: [makeService({ basePrice: 500 })],
      promotion: minPromo,
    })
    expect(result.promotionDiscount).toBe(0)
    expect(result.discountAmount).toBe(0)
    expect(result.appliedPromotionCode).toBe('SUMMER10') // code 仍記錄但不套用
  })

  it('剛好達到 minOrderAmount 時套用優惠', () => {
    const minPromo: PromotionInput = {
      ...percentPromo,
      minOrderAmount: 500,
    }
    const result = calculatePrice({
      services: [makeService({ basePrice: 500 })],
      promotion: minPromo,
    })
    expect(result.promotionDiscount).toBe(50) // 10% of 500
  })

  it('staffSurcharge 計入 minOrderAmount 判斷', () => {
    const minPromo: PromotionInput = {
      ...percentPromo,
      minOrderAmount: 600,
    }
    // subtotal = 500，加上 surcharge 100 = 600 ≥ 600 → 套用
    const result = calculatePrice({
      services: [makeService({ basePrice: 500 })],
      staffSurcharge: 100,
      promotion: minPromo,
    })
    expect(result.promotionDiscount).toBe(50) // 10% of subtotal (500)
  })

  // ─── 優惠碼 vs 會員折扣：取較大值 ───────────────────────────────────

  it('優惠碼折扣 > 會員折扣時取優惠碼', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 1000 })],
      memberDiscountRate: 0.05, // 50元
      promotion: percentPromo, // 10% = 100元
    })
    expect(result.memberDiscount).toBe(50)
    expect(result.promotionDiscount).toBe(100)
    expect(result.discountAmount).toBe(100)
    expect(result.total).toBe(900)
  })

  it('會員折扣 > 優惠碼時取會員折扣', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 1000 })],
      memberDiscountRate: 0.15, // 150元
      promotion: percentPromo, // 10% = 100元
    })
    expect(result.memberDiscount).toBe(150)
    expect(result.promotionDiscount).toBe(100)
    expect(result.discountAmount).toBe(150)
    expect(result.total).toBe(850)
  })

  it('兩者相等時結果一致', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 1000 })],
      memberDiscountRate: 0.1, // 100元
      promotion: percentPromo, // 10% = 100元
    })
    expect(result.discountAmount).toBe(100)
  })

  // ─── appliedPromotionCode 輸出 ────────────────────────────────────────

  it('無優惠碼時 appliedPromotionCode 為 undefined', () => {
    const result = calculatePrice({ services: [makeService()] })
    expect(result.appliedPromotionCode).toBeUndefined()
  })

  it('有優惠碼（即使未達門檻）仍輸出 appliedPromotionCode', () => {
    const result = calculatePrice({
      services: [makeService({ basePrice: 100 })],
      promotion: { ...percentPromo, minOrderAmount: 9999 },
    })
    expect(result.promotionDiscount).toBe(0)
    expect(result.appliedPromotionCode).toBe('SUMMER10')
  })

  // ─── 完整整合案例 ─────────────────────────────────────────────────────

  it('多服務 + 體重規則 + 品種規則 + 指定師 + 會員 + 優惠碼', () => {
    // 服務 A：洗澡 500 + 體重 7kg 加 200 = 700
    // 服務 B：剪毛 800（無規則）× 2 = 1600
    // subtotal = 700 + 1600 = 2300
    // staffSurcharge = 200
    // memberDiscount = floor(2300 * 0.1) = 230
    // promoDiscount = floor(2300 * 0.1) = 230  ← 相等取任一
    // discountAmount = 230
    // total = 2300 + 200 - 230 = 2270
    const result = calculatePrice({
      services: [
        {
          serviceId: 'bath',
          serviceName: '洗澡',
          basePrice: 500,
          quantity: 1,
          priceRules: [mediumDogRule], // +200 for 5.01–10kg
        },
        {
          serviceId: 'cut',
          serviceName: '剪毛',
          basePrice: 800,
          quantity: 2,
          priceRules: [],
        },
      ],
      petWeightKg: 7,
      petBreed: '拉布拉多',
      staffSurcharge: 200,
      memberDiscountRate: 0.1,
      promotion: percentPromo,
    })

    expect(result.subtotal).toBe(2300)
    expect(result.staffSurcharge).toBe(200)
    expect(result.memberDiscount).toBe(230)
    expect(result.promotionDiscount).toBe(230)
    expect(result.discountAmount).toBe(230)
    expect(result.total).toBe(2270)
    expect(result.appliedPromotionCode).toBe('SUMMER10')
  })
})
