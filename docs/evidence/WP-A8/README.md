# WP-A8 — 降級儀表板 + Admin App check-in 入口

> 狀態：🟡 **工程完成 / 截圖待補**（2026-09-19；Phase 7 複掃）  
> 本輪僅 Admin App；`LinkCard_Frontend` 遷移 DEFERRED。

## Phase 7 結案

| 項 | 說明 |
| --- | --- |
| 已上線可用 | 四大快速操作；到場率；Token「—」；簽到入口 ≤ 2 點 |
| 延後 | Web manage check-in 導覽（**DEFERRED**） |
| 待補證據 | 儀表板與導覽截圖 |

## 已交付

| Step | 內容 | 結果 |
| --- | --- | --- |
| 3.1 | 概覽快速操作：掃碼簽到 / Token / 名單 / NFC（另保留 Badge） | ✅ |
| 3.1 | Token、名單進 placeholder，點入不崩潰 | ✅ |
| 3.1 | home → 活動 → 掃碼簽到 ≤ 2 次點擊 | ✅ 路由已接（實測截圖待補） |
| 3.2 | 報名人數 / 已報到 / 參展商保留；到場率 = 已簽到 ÷ 報名數 | ✅ |
| 3.2 | Token 總發放 / 已消耗顯示「—」（無 WAL-10 / checkin-stats） | ✅ 不造假 |
| 3.3 | Web manage check-in 導覽 | ⏸️ DEFERRED |
| 品質 | `tsc` / `lint` | ✅ |

> **Token「—」的裁定來源（2026-09-21，`DEFAULT-APPLIED`）**
>
> 本表原先就寫「Token 顯示『—』」，但 `overview.tsx` 的 Token 卡實際硬編 `0`，
> 且 `accessibilityLabel` 亦為 `：0` → 文件與程式不一致（`CRA-V1-003`／`006`）。
> 依 loop `audit-remediation` 的 default-decision 政策，**採文件既定值**：
> 可見值與讀屏標籤統一為 `copy.event.dash`（`"—"`）。
>
> 推翻成本：`overview.tsx` 兩處改回數值 ＝ 2 行，並反轉本註記一行。
> 數值來源：`WP-ADM-04`。

## 待補

- [ ] 儀表板截圖（含到場率與 Token「—」）
- [ ] home → overview → check-in 導覽實測
- [ ] Token / 名單 placeholder 截圖

## 主要檔案

- `src/app/(auth)/[eventId]/overview.tsx`
- `src/app/(auth)/[eventId]/token.tsx`
- `src/app/(auth)/[eventId]/registrations.tsx`
- `src/app/(auth)/[eventId]/_layout.tsx`
- `src/constants/copy.zh-TW.ts`
