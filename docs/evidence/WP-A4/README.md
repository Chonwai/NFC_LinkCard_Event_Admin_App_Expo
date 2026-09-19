# WP-A4 — Token 櫃台

> 狀態：🟡 **BLOCKED + 骨架**（2026-09-19；Phase 7 複掃）  
> 主交付在 `NFC_LinkCard_NextJS`（計畫裡的 `LinkCard_Frontend`）。  
> Admin App 只保留入口，並深鏈到 Web 櫃台。

## Phase 7 結案

| 項 | 說明 |
| --- | --- |
| 已上線可用 | 無（不可對真實餘額做 top-up/deduct） |
| 骨架待接 | Web 櫃台全 UI；確認 Modal **不送出**；App「在網頁打開櫃台」 |
| 缺失前置 | **B-1a**：`idempotencyKey` + 發起人欄（現僅 `approvedBy`） |
| 解鎖後補驗收 | 快捷增值不雙記；deduct；流水含操作員；用戶端同步錄影 |

## B-1a Gate（未綠，因此不做 Step 5.3–5.5）

| 檢查 | 結果 |
| --- | --- |
| `idempotencyKey` | ❌ `EventWalletController.topUp` / `deduct` 的 body 沒有這個欄位 |
| `initiatedBy` | ❌ `EventWalletTransaction` 只有 `approvedBy`，top-up 把操作員寫進 `approvedBy` |
| 因此 | 不呼叫 top-up / deduct，避免沒有冪等與發起人時雙記、也無法對帳 |

## 已交付（Step 5.2）

| 項 | 結果 |
| --- | --- |
| Web `/manage/[eventId]/wallet`：查詢、掃碼提示、餘額「—」、增值、扣減清單、流水表、確認 Modal | ✅ 不送出 |
| 側邊欄與總覽卡片入口 | ✅ |
| Admin App Token 卡：placeholder +「在網頁打開櫃台」 | ✅ |
| `eslint`（Web 三檔）/ Admin App `tsc` | ✅ |

## 待補（B-1a 之後）

- [ ] 快捷 +10/+50/+100 真正 top-up，且重複提交不雙記
- [ ] deduct（禁止 redeem），餘額不足不可提交
- [ ] 流水含操作員；用戶端餘額同步錄影

## 主要檔案

- `NFC_LinkCard_NextJS/app/(event)/manage/[eventId]/wallet/page.tsx`
- `NFC_LinkCard_NextJS/app/(event)/manage/[eventId]/layout.tsx`
- `NFC_LinkCard_Event_Admin_App_Expo/src/app/(auth)/[eventId]/token.tsx`
