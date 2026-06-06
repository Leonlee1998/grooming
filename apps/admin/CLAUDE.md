# apps/admin — CLAUDE.md

> 全域設定見根目錄 /CLAUDE.md，本檔僅記錄 admin app 專屬規範。

## 這個 App 的職責

後台管理介面，供店長 / 管理員使用。桌機 / 筆電瀏覽器訪問。
功能：報表、客戶管理、服務設定、員工管理、契約查詢。

## 路由結構

```
app/
├── login/page.tsx          ← Supabase Auth 登入頁
├── (dashboard)/
│   ├── layout.tsx          ← 側邊導覽版型（需登入）
│   ├── dashboard/page.tsx  ← 今日總覽
│   ├── appointments/       ← 預約管理
│   ├── customers/          ← 客戶 / 寵物資料
│   ├── orders/             ← 訂單查詢
│   ├── services/           ← 服務項目 + 定價規則
│   ├── members/            ← 會員管理
│   ├── promotions/         ← 優惠活動
│   ├── reports/            ← 營收報表
│   └── settings/           ← 系統設定
└── middleware.ts            ← Auth 保護
```

## UI 設計原則

- 使用 shadcn/ui 作為基礎元件
- 資料表格使用 TanStack Table
- 圖表使用 recharts
- 響應式設計（桌機優先，平板可用）
- 側邊導覽：固定寬度 240px

## 身份驗證

- 使用 Supabase Auth（Email + Password）
- middleware.ts 保護所有 (dashboard) 路由
- Session 由 Supabase 管理
- 角色：ADMIN（全權限）、MANAGER（不可改設定）

## Server Actions 注意

- 後台 Server Actions 使用 prismaAdmin（service_role）
- 所有寫入操作記錄 audit log（誰、何時、改了什麼）
- 刪除操作改為軟刪除（isActive: false），不物理刪除

## 常用查詢模式

- 列表頁：Prisma + pagination（take/skip）+ 搜尋（where）
- 報表：Prisma groupBy + \_sum/\_count aggregation
- 即時更新：Supabase Realtime（訂閱 appointments 變更）
