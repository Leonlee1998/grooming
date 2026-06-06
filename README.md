# 寵物美容 POS — 開發快速說明

## 檔案清單

| 檔案                          | 用途                                            |
| ----------------------------- | ----------------------------------------------- |
| `CLAUDE.md`                   | 根目錄全域設定，每個 session 開始時 Claude 會讀 |
| `PLAN.md`                     | 全部任務 checklist，完成一項打勾                |
| `PROMPTS.md`                  | 所有 Claude Code prompts，照順序執行            |
| `apps-pos-CLAUDE.md`          | → 複製到 `apps/pos/CLAUDE.md`                   |
| `apps-admin-CLAUDE.md`        | → 複製到 `apps/admin/CLAUDE.md`                 |
| `packages-line-bot-CLAUDE.md` | → 複製到 `packages/line-bot/CLAUDE.md`          |

## 開始之前

1. 建立 Supabase 帳號，新增一個專案
2. 建立 LINE Developers 帳號，新增 Messaging API channel
3. 安裝 pnpm：`npm install -g pnpm`
4. 安裝 Claude Code：照官方文件操作

## 使用 PROMPTS.md 的方式

### 方法 A（推薦）：在 Claude Code 裡直接貼

```bash
# 在專案目錄開啟 Claude Code
claude

# 把 PROMPTS.md 裡對應的 prompt 貼進去
# 每個 prompt 對應一個小任務（約 30-60 分鐘）
```

### 方法 B：一次跑多步

```bash
# 如果對系統夠熟，可以一次貼 2-3 個連續 prompt
# 但注意：單一 session 超過 ~4000 tokens 建議 /clear 後繼續
```

## 每個 Prompt 完成後

1. 確認功能可跑（不要跳過驗證步驟）
2. `git add . && git commit -m "feat: ..."`
3. 在 PLAN.md 打勾
4. 如果是 Phase 結尾，merge 到 develop

## 常見 Claude Code 指令

| 指令           | 用途                               |
| -------------- | ---------------------------------- |
| `/clear`       | 清除 context，開新任務前用         |
| `@CLAUDE.md`   | 讓 Claude 讀設定檔                 |
| `@PLAN.md`     | 讓 Claude 看目前進度               |
| `/plan`        | 讓 Claude 先規劃再執行（複雜任務） |
| `Shift+Tab` x2 | 進入 Plan Mode（輸出計劃前先確認） |

## 預估時程

| Phase    | 內容          | 預估時間        |
| -------- | ------------- | --------------- |
| 0        | 初始化        | 半天            |
| 1        | 資料層        | 1天             |
| 2        | 定型化契約    | 1.5天           |
| 3        | iPad POS 報到 | 2天             |
| 4        | 服務管理      | 1天             |
| 5        | 預約排程      | 1天             |
| 6        | LINE Bot      | 1.5天           |
| 7        | 會員制        | 1天             |
| 8        | 後台管理      | 1.5天           |
| 9        | 部署測試      | 1天             |
| **合計** |               | **約 12-13 天** |
