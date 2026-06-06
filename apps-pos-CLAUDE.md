# apps/pos — CLAUDE.md

> 全域設定見根目錄 /CLAUDE.md，本檔僅記錄 pos app 專屬規範。

## 這個 App 的職責

寵物美容店 iPad 主操作介面。所有與客戶直接互動的流程都在這裡。
目標使用者：美容師 / 前台人員（非技術用戶）。

## 路由結構

```
app/
├── (grooming)/
│   ├── checkin/           ← 報到流程（多步驟）
│   │   ├── page.tsx       ← Step 1：客戶查詢
│   │   ├── pet/page.tsx   ← Step 2：寵物選擇 + 健康確認
│   │   ├── service/page.tsx ← Step 3：服務選擇 + 試算
│   │   ├── confirm/page.tsx ← Step 4：費用確認（法規揭露）
│   │   ├── sign/page.tsx   ← Step 5：契約閱讀 + 電子簽名
│   │   └── complete/page.tsx ← 完成頁
│   └── member/page.tsx    ← 會員查詢 / 儲值
├── (booking)/
│   └── schedule/page.tsx  ← 預約時間表
├── api/
│   └── cron/
│       ├── overtime-check/route.ts
│       └── pickup-reminder/route.ts
└── layout.tsx             ← POS 外層版型
```

## UI 設計原則

- 所有可點擊元素：min-height 56px（iPad 觸控友善）
- 主要操作文字：18px+；說明文字：14px
- 色調：溫暖中性（米白底 + 深棕字 + 綠色 CTA）
- 避免需要打字，盡量用大按鈕 / 卡片選擇
- 步驟流程頂部顯示步驟指示器（Step 3/5）

## 狀態管理

- Zustand (`src/stores/checkin.ts`)：報到流程的跨步驟狀態
  （customerId、petId、selectedServices、staffId 等）
- React Query：所有 server data 快取
- react-hook-form：頁面內表單

## 重要限制

- 不需要用戶登入（店內使用，iPad 固定在店內）
- Server Actions 使用 prismaAdmin（service_role，完整 DB 權限）
- 所有 Server Actions 必須有明確 try/catch，錯誤訊息回傳給前端顯示
- PDF 產出可能需要 3-5 秒，UI 要有明確 loading 狀態

## 常用元件（src/components/）

- `layout/PosLayout.tsx`：底部導覽 + 全螢幕容器
- `checkin/CustomerCard.tsx`：客戶資訊卡片
- `checkin/PetCard.tsx`：寵物資訊卡片
- `checkin/ServiceSelector.tsx`：服務選擇（左清單 + 右摘要）
- `signature/SignaturePad.tsx`：canvas 電子簽名
- `ui/StepIndicator.tsx`：步驟進度指示器
- `ui/BigButton.tsx`：大按鈕（iPad 觸控優化）
