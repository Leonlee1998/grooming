# 寵物美容 POS — PLAN.md

> 每個 Phase 對應一組 Claude Code prompts（見 PROMPTS.md）
> 完成一個 task 後打勾，開新 session 前更新本檔案

---

## Phase 0 — 專案初始化與環境設定

> 目標：monorepo 跑起來、Supabase 連通、CI 基礎

- [ ] P0-1：建立 pnpm monorepo 骨架（workspace + 子 package）
- [ ] P0-2：設定 TypeScript、ESLint、Prettier 全域設定
- [x] P0-3：建立 Supabase 專案、連接 Prisma
- [x] P0-4：建立 `.env.example`，設定 git hooks（husky + lint-staged）
- [ ] P0-5：驗證：`pnpm dev` 全部 apps 可啟動，Prisma Studio 可連線

---

## Phase 1 — 資料層（Prisma Schema）

> 目標：所有資料表設計完成，migration 跑通，seed 資料可用

- [x] P1-1：設計核心資料表（Customer、Pet、Staff）
- [x] P1-2：設計預約與訂單資料表（Appointment、Order、OrderItem）
- [x] P1-3：設計服務項目與定價資料表（Service、PriceRule）
- [x] P1-4：設計會員與優惠資料表（Member、MemberPlan、Promotion）
- [x] P1-5：設計契約紀錄資料表（Contract、ContractTemplate）
- [x] P1-6：設定 Supabase Row Level Security（RLS）policies
- [x] P1-7：撰寫 seed 資料（範例服務項目、員工、會員方案）
- [ ] P1-8：驗證：`pnpm db:seed` 成功，Prisma Studio 資料正確

---

## Phase 2 — 定型化契約模組（packages/contract）

> 目標：可輸入客戶 + 服務資料 → 產出合規 PDF

- [ ] P2-1：建立契約 HTML 模板（符合農業部公告必填事項）
- [ ] P2-2：實作模板引擎（將資料注入 HTML 模板）
- [ ] P2-3：設定 Puppeteer，實作 HTML → PDF 轉換函式
- [ ] P2-4：實作「可自訂欄位」機制（店家可加欄位，必填欄位鎖定不可刪）
- [ ] P2-5：實作 PDF 上傳至 Supabase Storage
- [ ] P2-6：撰寫單元測試（模板填入、PDF 產出）
- [ ] P2-7：驗證：傳入假資料 → 下載 PDF → 人工確認內容正確

---

## Phase 3 — iPad POS 報到流程（apps/pos）

> 目標：客戶到店 → 填資料 → 簽名 → 完成契約 完整流程可跑

- [ ] P3-1：建立 Next.js PWA 設定（manifest、service worker、全螢幕）
- [ ] P3-2：建立 iPad 版型（底部導覽、鎖定橫向）
- [ ] P3-3：客戶查詢 / 新增頁面（搜尋手機號碼、建立新客戶）
- [ ] P3-4：寵物資料頁面（選擇 / 新增寵物，填健康狀況、攻擊性等）
- [ ] P3-5：服務選擇頁面（選擇服務項目、美容師、加購）
- [ ] P3-6：費用確認頁面（明細試算、合規揭露）
- [ ] P3-7：電子簽名元件（canvas 手寫簽名）
- [ ] P3-8：契約預覽頁面（顯示完整契約 + 簽名預覽）
- [ ] P3-9：產出 PDF + 上傳 Storage + 建立訂單紀錄
- [ ] P3-10：完成頁面（可發 LINE / 列印 / 顯示 QR code 下載 PDF）
- [ ] P3-11：驗證：完整跑一遍流程，下載 PDF 確認合規內容

---

## Phase 4 — 服務項目管理與金額試算

> 目標：後台可設定服務、定價；iPad 前台可即時試算

- [ ] P4-1：後台服務項目 CRUD（建立、編輯、停用）
- [ ] P4-2：定價規則設定（依體重區間、品種、是否打結等）
- [ ] P4-3：前台金額試算引擎（依規則即時計算）
- [ ] P4-4：套餐 / 組合優惠設定
- [ ] P4-5：驗證：後台新增服務 → 前台立即反映 → 試算正確

---

## Phase 5 — 預約排程系統

> 目標：可查看時間表、新增/修改預約、觸發提醒

- [ ] P5-1：預約時間表頁面（日視圖 / 週視圖，依美容師分欄）
- [ ] P5-2：新增預約（選客戶、寵物、服務、美容師、時段）
- [ ] P5-3：現場預約（報到時直接建立當日訂單）
- [ ] P5-4：逾時提醒邏輯（cron job 檢查、推播 LINE 通知）
- [ ] P5-5：接送提醒（預約完成前 N 分鐘自動推播）
- [ ] P5-6：驗證：建立預約 → 確認時間表正確 → 模擬逾時觸發通知

---

## Phase 6 — LINE Bot 串接（packages/line-bot）

> 目標：客戶用 LINE 可完成預約，系統自動接單

- [ ] P6-1：建立 LINE Messaging API webhook server（Hono.js）
- [ ] P6-2：實作預約對話流程（Rich Menu → 選日期 → 選服務 → 確認）
- [ ] P6-3：連接預約系統（LINE 預約寫入同一個 Appointment table）
- [ ] P6-4：推播通知（預約確認、接送提醒、逾時通知）
- [ ] P6-5：本地開發設定（ngrok tunnel script）
- [ ] P6-6：驗證：LINE 完整預約流程 → 後台看到新預約

---

## Phase 7 — 會員制與優惠活動

> 目標：會員卡、點數累積、儲值、活動設定

- [ ] P7-1：會員方案設定（後台 CRUD）
- [ ] P7-2：點數累積 / 兌換邏輯
- [ ] P7-3：次數型方案（買 N 送 M）
- [ ] P7-4：儲值金功能
- [ ] P7-5：優惠活動管理（折扣碼、期間優惠）
- [ ] P7-6：驗證：結帳時套用會員優惠，點數正確更新

---

## Phase 8 — 後台管理（apps/admin）

> 目標：完整後台可供店長管理所有資料

- [ ] P8-1：儀表板（今日預約、營收、待接寵物）
- [ ] P8-2：客戶 / 寵物管理（搜尋、查看歷史）
- [ ] P8-3：訂單管理（查詢、退款、下載契約 PDF）
- [ ] P8-4：員工班表管理
- [ ] P8-5：報表（日 / 週 / 月營收、服務統計）
- [ ] P8-6：系統設定（店家資料、契約自訂欄位、通知設定）
- [ ] P8-7：驗證：所有後台功能可正常操作

---

## Phase 9 — 整合測試與部署

- [ ] P9-1：E2E 測試（Playwright，跑完整報到流程）
- [ ] P9-2：Supabase 生產環境設定
- [ ] P9-3：Vercel 部署（pos + admin）
- [ ] P9-4：LINE Bot 部署（Railway / Fly.io）
- [ ] P9-5：效能測試（iPad 上實際操作測試）
- [ ] P9-6：使用者驗收測試

---

## 備注

- 每個 Phase 完成後更新 git tag，例如 `v0.1.0-phase0`
- 發現 schema 需要修改時，回 Phase 1 開新 migration，不要直接改資料庫
- LINE Bot 開發需要正式 LINE OA 帳號，Phase 6 前先準備好
