# WP-A7 — 簽到三態

> 狀態：🟡 **工程完成 / 真機截圖待補**（2026-09-19；Phase 7 複掃）

## Phase 7 結案

| 項 | 說明 |
| --- | --- |
| 已上線可用 | VALID / DUPLICATE / INVALID UI；震動 + 音效；頂部簽到計數 |
| 骨架待接 | 覆核按鈕 + BLOCKED Banner（**B-2**） |
| 解鎖後補驗收 | 覆核成功放行錄影；三態截圖入本目錄 |

## 已交付

| Step | 內容 | 結果 |
| --- | --- | --- |
| 2.1 | 先查 by-code 再 checkin；VALID / DUPLICATE / INVALID | ✅ |
| 2.2 | 成功大字綠畫面 + 身分欄位 | ✅ |
| 2.3 | `Vibration` + `expo-audio`（`assets/sounds/*.wav`） | ✅ Web 降級 |
| 2.4 | 重複態 + 覆核按鈕 + BLOCKED Banner（B-2 未就緒算階段完成） | ✅ |
| 2.5 | 無效態 + 現場補報名 placeholder（`walk-in`） | ✅ |
| 2.6 | 頂部「總簽到」（非今日）fallback 計數 | ✅ |
| 品質 | `tsc` / `lint` | ✅ |

## 待補（真機／瀏覽器）

- [ ] VALID / DUPLICATE / INVALID 三態截圖
- [ ] 震動／音效錄影或說明
- [ ] 覆核骨架 + BLOCKED Banner 截圖

## 主要檔案

- `src/app/(auth)/[eventId]/check-in.tsx`
- `src/app/(auth)/[eventId]/walk-in.tsx`
- `src/utils/check-in-feedback.ts`
- `src/utils/registration-display.ts`
- `src/types/check-in.types.ts`
- `assets/sounds/checkin-*.wav`
