# 寵物美容 POS — CLAUDE.md（全域）

## 專案概述

寵物美容店 iPad POS 系統，整合農業部 114/05/12 公告「犬、貓美容服務定型化契約」合規要求。
核心功能：報到簽約、服務試算、預約排程、LINE Bot 接單、會員制、後台管理。

## Monorepo 結構

```
pet-grooming-pos/
├── apps/
│   ├── pos/          ← iPad 主操作介面（Next.js PWA）
│   └── admin/        ← 後台管理（Next.js）
├── packages/
│   ├── db/           ← Prisma schema + seed（唯一資料來源）
│   ├── contract/     ← 定型化契約模板 + PDF 產出
│   ├── line-bot/     ← LINE Messaging API webhook server
│   └── ui/           ← 共用 shadcn/ui 元件
├── supabase/
│   └── migrations/
├── CLAUDE.md         ← 本檔案（全域）
└── package.json      ← pnpm workspace
```

## 技術棧

- **Package Manager**: pnpm (workspace)
- **Frontend**: Next.js 14 App Router + TypeScript strict
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL) + Prisma ORM
- **Auth**: Supabase Auth
- **PDF**: Puppeteer（HTML 模板轉 PDF）
- **LINE**: LINE Messaging API + @line/bot-sdk
- **Validation**: Zod（所有 input 必過 Zod）
- **State**: Zustand（client state）+ React Query（server state）
- **Testing**: Vitest + React Testing Library

## 常用指令

```bash
pnpm dev                          # 啟動所有 apps
pnpm --filter pos dev             # 只啟動 iPad POS
pnpm --filter admin dev           # 只啟動後台
pnpm --filter line-bot dev        # 啟動 LINE Bot server
pnpm db:generate                  # Prisma generate
pnpm db:migrate                   # 執行 migration
pnpm db:studio                    # 開啟 Prisma Studio
pnpm db:seed                      # 執行 seed data
pnpm build                        # 全部 build
pnpm lint                         # ESLint 全域
pnpm test                         # Vitest 全域
```

## Code Style 規範

- TypeScript strict mode，禁用 `any`
- ES modules only（禁用 `require`）
- Functional components + hooks（禁用 class components）
- Server Actions 處理 form submissions（不用 API routes，除非 LINE Bot）
- 所有 API 輸入必須通過 Zod schema 驗證
- 元件命名：PascalCase；hooks：`use` 前綴；utils：camelCase
- 每支新 feature 開新 git branch，完成後 PR merge 到 main

## 資料夾慣例

- `packages/db/schema.prisma` — 唯一資料模型來源
- `packages/contract/templates/` — 契約 HTML 模板（勿直接改 PDF）
- `apps/pos/app/(grooming)/` — iPad 主流程頁面群組
- `apps/pos/app/(booking)/` — 預約流程
- `apps/admin/app/(dashboard)/` — 後台頁面群組
- `packages/ui/components/` — 共用元件

## 法規合規（不可修改的硬性規定）

> 來源：農業部 114 年 5 月 12 日農業部農護字第 1140072281 號公告

1. **訂約前揭露**：服務項目、費用、人員、次數必須在客戶簽名前完整顯示（§3）
2. **未列明費用不得收取**：費用欄位清空 = 不可收費
3. **服務紀錄 PDF 必須提供客戶留存**：每筆訂單完成後自動產 PDF 並可發送（§12）
4. **美容前詢問寵物狀況**：健康狀況、攻擊性、疾病為必填欄位（§4）
5. **逾時費規則**：逾 30 分鐘才可計收，30 分鐘內免費（§依約）
6. **解約退費**：3 日內退費，手續費上限 5% 且不逾 1,000 元
7. **審閱期**：單次美容可即簽；套餐方案審閱期不得少於 1 日
8. **緊急就醫**：系統須記錄客戶指定獸醫院，異常時優先送往

## 環境變數（.env 範例在 .env.example）

```
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_LIFF_ID=
PUPPETEER_EXECUTABLE_PATH=
```

## 注意事項

- iPad POS 必須支援離線基本操作（預約查詢、進行中訂單）
- 所有金額以新台幣整數儲存（元，無小數）
- 日期時間統一使用 Asia/Taipei timezone
- 寵物圖片上傳至 Supabase Storage，路徑：`pets/{pet_id}/avatar`
- 契約 PDF 上傳至 Supabase Storage，路徑：`contracts/{order_id}/signed.pdf`
