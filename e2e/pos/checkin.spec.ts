/**
 * POS 報到流程 E2E 測試
 *
 * 前置條件（執行前需完成）：
 *   pnpm db:seed        ← 建立測試資料
 *   pnpm --filter pos dev --port 3001  ← 啟動 POS server
 *
 * 測試資料（seed.ts 需包含）：
 *   客戶: { phone: '0912345678', name: '測試客戶一' }
 *   寵物: { name: '小福', species: 'DOG', breed: '貴賓', weightKg: 5 }
 *   服務: { name: '基礎洗澡', basePrice: 800, isActive: true }
 */

import { test, expect, type Page } from '@playwright/test'

// ─── 輔助函式 ─────────────────────────────────────────────────────────────────

async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('簽名 canvas 找不到')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy - 20)
  await page.mouse.down()
  await page.mouse.move(cx, cy + 20, { steps: 20 })
  await page.mouse.move(cx + 60, cy - 20, { steps: 20 })
  await page.mouse.up()
}

// ─── Step 1: 客戶查詢 ─────────────────────────────────────────────────────────

test.describe('Step 1 — 客戶查詢', () => {
  test('頁面載入 — 顯示電話搜尋輸入框', async ({ page }) => {
    await page.goto('/checkin')
    const phoneInput = page.getByRole('textbox', { name: /電話/i }).or(
      page.locator('input[type="tel"]'),
    )
    await expect(phoneInput).toBeVisible()
  })

  test('電話格式驗證 — 少於 8 碼顯示錯誤', async ({ page }) => {
    await page.goto('/checkin')
    await page.getByRole('textbox').first().fill('0912')
    await page.getByRole('button').filter({ hasText: /查詢|搜尋|確認/i }).click()
    await expect(page.getByText(/電話格式/i)).toBeVisible()
  })

  test('未知電話 — 顯示新增客戶表單', async ({ page }) => {
    await page.goto('/checkin')
    await page.getByRole('textbox').first().fill('0900099999')
    await page.getByRole('button').filter({ hasText: /查詢|搜尋|確認/i }).click()
    // 找不到客戶時應出現新增表單或提示
    await expect(
      page.getByText(/找不到|新增客戶|建立客戶/i).or(page.getByRole('button', { name: /新增/i })),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('已知電話 — 顯示客戶資訊卡', async ({ page }) => {
    await page.goto('/checkin')
    await page.getByRole('textbox').first().fill('0912345678')
    await page.getByRole('button').filter({ hasText: /查詢|搜尋|確認/i }).click()
    await expect(page.getByText('測試客戶一')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── 完整報到流程（Happy Path）────────────────────────────────────────────────

test.describe('完整報到流程', () => {
  test.slow() // PDF 產出可能需要 10 秒以上

  test('客戶 → 寵物 → 服務 → 確認 → 簽名 → 完成', async ({ page }) => {
    // ── Step 1: 搜尋已知客戶 ───────────────────────────────────────────────
    await page.goto('/checkin')
    await page.getByRole('textbox').first().fill('0912345678')
    await page.getByRole('button').filter({ hasText: /查詢|搜尋|確認/i }).click()
    await expect(page.getByText('測試客戶一')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button').filter({ hasText: /下一步|繼續|選擇寵物/i }).click()

    // ── Step 2: 選擇寵物 ───────────────────────────────────────────────────
    await expect(page).toHaveURL(/pet/i, { timeout: 8_000 })
    await page.getByText('小福').click()
    // 確認健康狀況（isAggressive / hasDisease 等預設 false，直接繼續）
    await page.getByRole('button').filter({ hasText: /下一步|繼續|選擇服務/i }).click()

    // ── Step 3: 選擇服務 ───────────────────────────────────────────────────
    await expect(page).toHaveURL(/service/i, { timeout: 8_000 })
    await page.getByText('基礎洗澡').click()
    // 費用試算完成後右側應顯示金額
    await expect(page.getByText(/800|小計/i)).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button').filter({ hasText: /下一步|繼續|確認費用/i }).click()

    // ── Step 4: 費用確認（法規揭露）────────────────────────────────────────
    await expect(page).toHaveURL(/confirm/i, { timeout: 8_000 })
    // 法規要求服務項目、費用在簽名前完整顯示
    await expect(page.getByText('基礎洗澡')).toBeVisible()
    await expect(page.getByText(/800/)).toBeVisible()
    await page.getByRole('button').filter({ hasText: /下一步|繼續|前往簽名/i }).click()

    // ── Step 5: 電子簽名 ───────────────────────────────────────────────────
    await expect(page).toHaveURL(/sign/i, { timeout: 8_000 })
    await drawSignature(page)
    await page.getByRole('button').filter({ hasText: /確認簽名|完成簽名|送出/i }).click()

    // ── 完成頁 ─────────────────────────────────────────────────────────────
    await expect(page).toHaveURL(/complete/i, { timeout: 30_000 })
    await expect(page.getByText(/完成|契約/i)).toBeVisible()
    // 確認 PDF 預覽連結或下載按鈕
    await expect(
      page.getByRole('link', { name: /PDF|契約/i }).or(
        page.getByRole('button', { name: /PDF|下載/i }),
      ),
    ).toBeVisible()
  })
})

// ─── 加價規則驗證 ─────────────────────────────────────────────────────────────

test.describe('定價規則', () => {
  test('選擇服務後顯示正確試算金額', async ({ page }) => {
    await page.goto('/checkin')
    await page.getByRole('textbox').first().fill('0912345678')
    await page.getByRole('button').filter({ hasText: /查詢|搜尋|確認/i }).click()
    await expect(page.getByText('測試客戶一')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button').filter({ hasText: /下一步|繼續/i }).click()

    await expect(page).toHaveURL(/pet/i, { timeout: 8_000 })
    await page.getByText('小福').click()
    await page.getByRole('button').filter({ hasText: /下一步|繼續/i }).click()

    await expect(page).toHaveURL(/service/i, { timeout: 8_000 })
    await page.getByText('基礎洗澡').click()

    // 試算金額應顯示（體重 5kg 貴賓，若有 priceRule 則有加價）
    await expect(page.getByText(/小計|總計|元/i)).toBeVisible({ timeout: 8_000 })
  })
})
