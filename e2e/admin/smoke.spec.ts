/**
 * Admin 後台 Smoke 測試
 *
 * 前置條件：
 *   pnpm --filter admin dev --port 3000  ← 啟動 Admin server
 *   設定好 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 管理員帳號：在 Supabase Auth 建立測試帳號
 *   Email: test-admin@example.com
 *   Password: TestAdmin1234!
 */

import { test, expect, type BrowserContext } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'test-admin@example.com'
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'TestAdmin1234!'

// ─── 未登入重導向 ─────────────────────────────────────────────────────────────

test.describe('Auth 保護', () => {
  test('未登入存取 /dashboard 重導向至 /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })

  test('未登入存取 /orders 重導向至 /login', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })

  test('未登入存取 /customers 重導向至 /login', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })
})

// ─── 登入頁面 ─────────────────────────────────────────────────────────────────

test.describe('Login 頁面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('顯示 Email 與 Password 輸入欄', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /登入/i })).toBeVisible()
  })

  test('空白表單提交顯示驗證錯誤', async ({ page }) => {
    await page.getByRole('button', { name: /登入/i }).click()
    await expect(page.getByText(/email|password|請填/i)).toBeVisible()
  })

  test('錯誤密碼顯示登入失敗訊息', async ({ page }) => {
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.getByRole('button', { name: /登入/i }).click()
    await expect(page.getByText(/錯誤|失敗|Invalid/i)).toBeVisible({ timeout: 8_000 })
  })
})

// ─── 登入後各頁面 Smoke ───────────────────────────────────────────────────────

// 登入 session fixture
async function loginAs(context: BrowserContext, email: string, password: string) {
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /登入/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
  await page.close()
}

test.describe('登入後頁面 Smoke', () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, TEST_EMAIL, TEST_PASSWORD)
  })

  test('Dashboard — 顯示今日摘要', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/今日|本日|訂單/i)).toBeVisible({ timeout: 8_000 })
  })

  test('Appointments — 顯示預約列表', async ({ page }) => {
    await page.goto('/appointments')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /預約/i })).toBeVisible({ timeout: 8_000 })
  })

  test('Orders — 顯示訂單列表', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /訂單/i })).toBeVisible({ timeout: 8_000 })
  })

  test('Customers — 顯示客戶列表', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /客戶/i })).toBeVisible({ timeout: 8_000 })
  })

  test('Members — 顯示會員列表', async ({ page }) => {
    await page.goto('/members')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /會員/i })).toBeVisible({ timeout: 8_000 })
  })

  test('Settings — 顯示設定頁', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).not.toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /設定/i })).toBeVisible({ timeout: 8_000 })
  })

  test('已登入存取 /login 重導向至 /dashboard', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 })
  })
})
