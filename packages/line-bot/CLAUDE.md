# packages/line-bot — CLAUDE.md

> 全域設定見根目錄 /CLAUDE.md，本檔僅記錄 line-bot 專屬規範。

## 這個 Package 的職責

LINE Messaging API Webhook Server。
讓客戶可以透過 LINE 自助預約，並接收推播通知。

## 技術架構

- Web Framework：Hono.js（輕量、Edge-compatible）
- LINE SDK：@line/bot-sdk
- 部署：Railway（獨立 server，非 Next.js）
- Port：3002

## 重要限制

- 這個 server 是**獨立的 Node.js server**，不是 Next.js
- 不可使用 Next.js 的 Server Actions / App Router
- 資料庫直接用 @repo/db 的 prismaAdmin

## 對話流程狀態機

```
idle
  ↓ 點「我要預約」
select_services
  ↓ 選完服務
select_date
  ↓ 選日期
select_slot
  ↓ 選時段
confirm_booking
  ↓ 確認 / 取消
done / idle
```

## Session 儲存

- table: line_sessions
- key: line_user_id
- value: JSON（目前步驟 + 累積的選擇）
- TTL: 30 分鐘（超時清除，重新開始）

## LINE 訊息類型使用規範

- QuickReply：選項 ≤ 13 個的單選
- Flex Message Bubble：確認卡片、預約摘要
- Flex Message Carousel：多個時段選擇
- 純文字：錯誤訊息、簡單回覆

## 推播通知函式（notify.ts）

```typescript
sendPickupReminder(lineUserId, { petName, pickupTime, storeName })
sendOvertimeNotice(lineUserId, { petName, overtimeMinutes, fee })
sendBookingConfirmation(lineUserId, { appointmentId, scheduledAt, services })
sendBookingReminder(lineUserId, { scheduledAt, petName }) // 預約前一天推播
```

## 本地開發

```bash
pnpm dev          # 啟動 server on port 3002
pnpm dev:tunnel   # ngrok 將 3002 expose 到外部（供 LINE webhook 使用）
```

LINE Channel Webhook URL 設定為：https://xxxx.ngrok.io/webhook
