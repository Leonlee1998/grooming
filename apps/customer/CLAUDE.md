# apps/customer — CLAUDE.md

> 全域設定見根目錄 /CLAUDE.md，本檔僅記錄 customer app 專屬規範。

## 這個 App 的職責

面向客戶的手機優先網頁應用程式。
讓客戶自助完成：線上預約、查詢預約紀錄、管理寵物資料、查看會員積點。

## 路由結構

```
app/
├── page.tsx                          ← 根路由（導向 /login）
├── layout.tsx                        ← 全站版型（手機容器、PWA meta）
├── globals.css
├── book/[storeSlug]/page.tsx         ← 公開預約頁（不需登入）
├── (auth)/
│   └── login/page.tsx               ← 登入（LINE LIFF / 手機 OTP）
└── (member)/
    ├── layout.tsx                    ← 需登入版型（底部 nav、session guard）
    ├── appointments/page.tsx         ← 我的預約
    ├── pets/page.tsx                 ← 我的寵物
    └── member/page.tsx              ← 會員資訊 / 積點 / 儲值
```

## 安全性原則（務必遵守）

- **永遠使用 anon key**（`NEXT_PUBLIC_SUPABASE_ANON_KEY`），絕不使用 service_role
- 所有資料存取依賴 **Supabase RLS（Row Level Security）**，確保客戶只能看自己的資料
- Server Actions 若需讀取 DB 資料，必須透過 supabase client（anon key + session cookie）
- 禁止在此 app 匯入 `prismaAdmin`（service_role 繞過 RLS）
- 例外 1：`book/[storeSlug]/page.tsx` 使用 `prismaAdmin` 僅讀取店家公開資訊（name、slug、address 等非敏感欄位）
- 例外 2：`book/[storeSlug]/sign/page.tsx` 使用 `prismaAdmin` 讀取店家資訊與契約模板（均為公開唯讀）
- 例外 3：`book/[storeSlug]/sign/actions.ts` 使用 `prismaAdmin` 建立 Customer、Pet、Appointment、Order、Contract（線上簽約需 service_role 寫入權限；RLS 不適用於此 Server Action）
- 例外 4：`book/[storeSlug]/sign/complete/page.tsx` 使用 `prismaAdmin` 讀取預約摘要（以 appointmentId query param 直接取得）

## 手機優先設計規範

- 所有頁面在 `<div class="mobile-container">` 內渲染（max-width: 480px，桌機居中）
- 可點擊元素：min-height 48px（手指觸控友善）
- 底部固定導覽列（(member) 路由群組）
- 字體大小：主要內容 15-16px；說明文字 13-14px
- 色調沿用 POS 系統：米白底（#FAF7F2）+ 深棕字（#3B2F2A）+ 品牌棕（#78573A）

## Supabase Client 使用方式

```typescript
// src/lib/supabase.ts — 客戶端使用（anon key）
import { supabase } from '@/lib/supabase'

// Server Component / Server Action — 帶 cookie session
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
const client = createClient(url, anonKey, {
  global: { headers: { cookie: cookieStore.toString() } },
})
```

## 狀態管理

- Zustand：跨步驟的預約流程狀態（選服務 → 選時段 → 確認 → 簽約）
- React Query：已登入後的伺服器資料（預約列表、寵物列表、會員資訊）
- react-hook-form：頁面內表單（新增寵物、填寫基本資料）

## 開發指令

```bash
pnpm dev:customer     # 啟動 customer app（port 3001）
```

## 注意事項

- Port：3002（POS 使用 3000、line-bot 使用 3001 避免衝突）
- LINE LIFF 整合：設定 `LINE_LIFF_ID` env，LIFF endpoint 指向此 app 的 /login
- PWA：`display: standalone`、`orientation: portrait`（手機豎向）
- 預約頁（`/book/[storeSlug]`）不需登入，URL 可公開分享
