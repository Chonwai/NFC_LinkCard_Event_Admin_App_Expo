# 07 — 獨立驗證（Independent Verification）

## 7.1 為什麼要有這一關

本輪所有產出都出自同一個 maker。**maker 自檢不會抓到自己不知道的東西**——這是
2026-10-15 那一輪最貴的教訓（獨立審查抓到 5 個 High，且全部讓情況「看起來比實際好」）。

所以本輪請一個**獨立 process** 重跑所有量測，只給它規格，不給它我的結論。
原始報告：`appendix/checker-report-raw.md`（612 行）。

- 執行方式：獨立 `opencode run` process（非本對話的 subagent）
- 規格：`/tmp/parity/checker-spec.md`（18 個量測項，含 2 個負向測試）
- 約束：三 repo 全程唯讀、不得 `git` 寫入、不得用 `view_image`

## 7.2 結果：**FAIL — 16/18**

| 項目                               | 結果        | 說明                                                                              |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| A1 後端路由計數                    | ❌ **FAIL** | 見 §7.3                                                                           |
| A2 `checkin/override` 不存在       | ✅ PASS     | grep 零命中                                                                       |
| A3 `/status` 存在且有 409 語意     | ✅ PASS     | 引用 `EventRegistrationService.ts:1490`                                           |
| A4 OPERATOR 看得到活動但讀不了名單 | ✅ PASS     | `my-managed` 無角色篩選；`getEventWriteAccess` 只有 owner/SUPER_ADMIN/COORDINATOR |
| B5 App 呼叫清單                    | ✅ PASS     | 15 條（13 events + 2 auth）                                                       |
| B6 無 override 呼叫                | ✅ PASS     |                                                                                   |
| B7 錢包型別四項                    | ✅ PASS     | 有分頁、有 `balanceAfter`/`sourceType`、無 `approvedBy`                           |
| B8 後端投影 vs App 型別            | ✅ PASS     | 一致                                                                              |
| B9 `my-access` 已接                | ✅ PASS     |                                                                                   |
| C10 死連結已除                     | ✅ PASS     | 但抓到**註解仍留著該字串**，見 §7.4                                               |
| D11 `tsc`                          | ✅ PASS     | exit 0                                                                            |
| D12 `eslint .`                     | ✅ PASS     |                                                                                   |
| D13 `npm test`                     | ✅ PASS     | 216 tests / 213 pass / 0 fail / 3 todo                                            |
| D14 `check:contract`               | ✅ PASS     |                                                                                   |
| E15 閘門鑑別力                     | ✅ PASS     | 死路由 → 1 violation；有效路由 → 0 violation                                      |
| F16 引用抽查                       | ❌ **FAIL** | 見 §7.5                                                                           |
| F17 badges 缺 4 項                 | ✅ PASS     |                                                                                   |
| F18 Web 無現場報名                 | ✅ PASS     |                                                                                   |

## 7.3 A1：我的路由計數是錯的（實質缺陷，已修）

| 項目          | 我的報告 | 實測            |
| ------------- | -------- | --------------- |
| events 路由數 | 111      | **121**         |
| path shape 數 | 92       | **102**         |
| 快照內容      | 113 條   | 應為 **121** 條 |

**根因**：漏了兩層巢狀掛載。

```
exhibitors.routes.ts:52     router.use('/import', exhibitorImportRoutes)
registrations.routes.ts:20  router.use('/import', registrationImportRoutes)
```

這兩個檔不是由 `index.ts` 掛的，而是由**同層路由檔**掛進去，所以我的
`EVENT_ROUTE_MOUNTS`（照抄 `index.ts`）看不到它們。合計 8 條 `/import` 路由。

**為什麼這是實質缺陷而不只是數字難看**：

漏收不會漏放，但會**製造假陽性**。未來 App 若改打
`POST /registrations/import/preview`，閘門會回報「這條路由不存在」——
而它明明存在。一個會說謊的閘門，很快就會被忽略。

**另一個更難看的細節**：我自己寫的兩支腳本給了不同的數字
（`extract_be.py` → 113、`groups.py` → 111），而我**在文件裡採用了 111 卻沒有解釋
差異**。這正是「引用自己沒重跑的命令」的老問題。

**處置**（commit `421ab7c`）：

- `EVENT_ROUTE_MOUNTS` 補上兩個巢狀前綴，並在註解寫明為什麼容易漏。
- 快照重新產生 → 121 條 / 102 形狀。
- 所有下游數字更正：FE 覆蓋 63/102 = 61.8%、App 13/121 = 10.7%。

## 7.4 C10 的附帶發現（已修）

Checker 通過了「死連結已移除」，但同時指出 `token.tsx` 的**註解裡仍原樣引用**那條
死 URL。影響：

1. 用 grep 找死連結時仍會命中，噪音。
2. 下一個人可能直接複製那段字串。

已改寫成描述性說明（commit `bc27abc`），不再複製該 URL。

> 這一條不在我的 18 項規格裡，是 checker 自己多做的一步。這正是獨立驗證的價值。

## 7.5 F16：引用座標不誠實（方法論缺陷，已修）

抽驗 6 個 file:line，只有 1 個對得上現行 HEAD。

| #   | 引用                                   | 現況                                                   | 相符 |
| --- | -------------------------------------- | ------------------------------------------------------ | ---- |
| 1   | S-1 `registration.service.ts:50`       | 已是別的內容（override 已移除）                        | ❌   |
| 2   | S-2 `registrant/…:186` 讀 `approvedBy` | 該欄位已移除                                           | ❌   |
| 3   | S-3 `api.types.ts:63-100`              | 欄位已補在 111-120                                     | ❌   |
| 4   | S-4 `event.service.ts:62-90`           | `getRegistrations` 已移到 93，且已含 `depositRefunded` | ❌   |
| 5   | S-8 `token.tsx:48-51`                  | `openURL` 已移除                                       | ❌   |
| 6   | S-10 `registrations.tsx:136,169,194`   | 三行都是 `visibility: "active"`                        | ✅   |

**這不是抄錯，是沒說清楚**：那些行號在**審計當時**是對的。問題是我在同一天內
既寫了「原本錯在哪」又修掉了它，卻沒有標示座標屬於哪個時間點。

**處置**（commit `421ab7c`）：

- 檔案開頭加座標圖例：`base 7d0fcf5` vs `fixed`。
- 表格每一列改為 `base X → fixed Y（已移除/已補/未修）`。
- 順手修掉檔名錯誤：`registrant/[id].tsx` → `registrant/[registrationId].tsx`
  （checker 指出 `[id].tsx` 根本不存在）。

## 7.6 修正後的完整閘門狀態

```
npx tsc --noEmit          → exit 0
npx eslint .              → exit 0
npm run check:contract    → ✓ 15 條 App 呼叫全部對得上後端路由快照（121 條）
npm test                  → 216 tests / 213 pass / 0 fail / 3 todo
```

## 7.7 這一關的結論

| 問題               | 嚴重度 | 是否影響產品行為                       |
| ------------------ | ------ | -------------------------------------- |
| A1 路由計數漏 8 條 | 中     | 否（App 沒打那些路由），但會讓閘門說謊 |
| F16 引用座標       | 中     | 否，但會讓讀者無法驗證                 |

**兩者都不是產品 bug，都是「報告品質」缺陷。** 這正是獨立驗證該抓的東西：
產品閘門全綠，但**證據鏈本身**有裂縫。

如果只跑 tsc/lint/test，這兩個問題一個都不會浮現。
