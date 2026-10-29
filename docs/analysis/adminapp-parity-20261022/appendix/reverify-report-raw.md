# 重驗報告

## 結論

```
A1:   FIXED          # 後端路由計數 121 / 102，與快照逐條集合相等；8 條 import 路徑全在
F16:  STILL BROKEN   # 12 列中 S-12 的座標指向 Row 元件，不是它宣稱的 useLocalSearchParams
GATE: PASS           # check:contract 15/15、override 負測 1 violation、import 負測 0、npm test 213 pass / 0 fail
```

一句話：**A1 的「121」這次是真的；F16 只修好了總表的大部分，S-12 仍是舊座標，且 02/08 還留著不存在的 `registrant/[id]`。產品閘門本身是誠實的。**

---

## R-A1 明細

### 1. 獨立提取器（未沿用作者的 extract_be.py）

自寫腳本：`/tmp/reverify-parity/extract_routes.py`
做法：

1. regex 抓每個路由檔的 `router.get/post/patch/put/delete('<literal>'...)`（含跨行）。
2. 套 `index.ts` 的 8 個掛載。
3. 額外掃描路由檔內的 `router.use('<sub>', <router>)`，遞迴展開。
4. 以 `(method, 完整 path)` 去重。

**結果：**

- 總 distinct `(method, path)` under `/api/v1/events` = **121**
- distinct path shape（參數名一律正規化） = **102**
- 重複宣告 = **0**
- 逐檔計數（排除 `exhibitor-invites.routes.ts`）：
  `connection-requests 7 + engagement 10 + event-ops 14 + events 23 + exhibitor-import 4 + exhibitors 18 + index 2 + premium 11 + registration-import 4 + registrations 14 + sessions-polls 14 = 121`
- 交叉檢查：這些檔案沒有任何 `router.route()` / `router.all()` / 陣列式註冊，所以 literal 掃描不會漏。

### 2. 路由檔內找到的 nested `router.use`

只有 2 個（與作者宣稱一致）：

| 檔案                      | 行  | 掛載                                              |
| ------------------------- | --- | ------------------------------------------------- |
| `exhibitors.routes.ts`    | 52  | `router.use('/import', exhibitorImportRoutes)`    |
| `registrations.routes.ts` | 20  | `router.use('/import', registrationImportRoutes)` |

補充：`exhibitor-invites.routes.ts` **不在** `/api/v1/events` 之下（`src/app.ts:220` 掛 `/api/v1/exhibitor-invites`），本輪正確排除；它的 2 條路由不計入 121。

### 3. 與 `scripts/backend-routes.snapshot.json` 比對

- `eventRoutes` 筆數 = **121**
- `nonEventRoutes` = 2
- 我的 121 條與快照的 121 條：**完全相等**（`mine - snap = ∅`、`snap - mine = ∅`）
- 快照內 `index.ts` 直掛的 2 條（`POST /webhooks/stripe`、`POST /activation/claim`）也在
- 快照的 literal distinct path = 104；參數名正規化後 = **102**（104→102 的碰撞只有兩組：`/:eventId` vs `/:eventSlug`、`/:exhibitorId` vs `/:exhibitorSlug`），與文件「102 shapes」一致

### 4. 八條 import 路徑 presence

| 路徑                                      | 方法 | 快照        |
| ----------------------------------------- | ---- | ----------- |
| `/:eventId/exhibitors/import/template`    | GET  | **PRESENT** |
| `/:eventId/exhibitors/import/preview`     | POST | **PRESENT** |
| `/:eventId/exhibitors/import/confirm`     | POST | **PRESENT** |
| `/:eventId/exhibitors/import/notify`      | POST | **PRESENT** |
| `/:eventId/registrations/import/template` | GET  | **PRESENT** |
| `/:eventId/registrations/import/preview`  | POST | **PRESENT** |
| `/:eventId/registrations/import/confirm`  | POST | **PRESENT** |
| `/:eventId/registrations/import/notify`   | POST | **PRESENT** |

8/8 全在。A1 的原始缺陷（漏 8 條）確實已修。

### 5. 00 / 01 的每個數字

| 數字                     | 出處                      | 可重現？            | 我的結果／備註                                                                                                                                                              |
| ------------------------ | ------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **121 routes**           | 00 §規模、01 §1.3         | **YES**             | 獨立 121；快照 121；集合完全相等                                                                                                                                            |
| **102 shapes**           | 00 §規模、01 §1.3（分母） | **YES**             | 參數名正規化後 102（literal 路徑是 104，兩組參數名碰撞）                                                                                                                    |
| **78 frontend literals** | 00 §規模                  | **有條件 YES**      | 用作者 `coverage.py` 的口徑（`lib/events`、只收 backtick）＝78；但同一集合只有 **87** 個呼叫點                                                                              |
| **93 呼叫點**            | 00 §規模                  | **YES（另一口徑）** | 用作者 `extract_fe.py` 的口徑（`lib/events` + `app`、三種引號）＝93，但該集合有 **82** 個 unique literal。**78 與 93 不是同一個集合**，並列成「78 個（93 個呼叫點）」不成立 |
| **63 / 102**             | 00 §規模                  | **YES**             | 用 78-literal 集合比對修正後的 102 BE shapes＝63（61.8% ≈ 62%）                                                                                                             |
| **13 app endpoints**     | 00 §規模、01 §1.1         | **YES（有效數）**   | `src/services` 共 15 個 apiClient 呼叫＝13 event + 2 auth；13 條 event 全部存在                                                                                             |
| **10.7%**                | 00 §規模、01 §1.3         | **YES**             | 13 / 121 = 10.744% → 10.7%                                                                                                                                                  |

**但 01 有一段 prose 不可重現**（見「仍未解決」）：01 第 5 行仍說「13 條，其中 1 條後端不存在，其餘 12 條正確」，且表列 #7 仍是死路由；現行 App 已無該呼叫（`registration.service.ts:43` 是「已移除」註解、`check-in.tsx` 也只剩說明），所以現況是 **13 條全部有效、0 條死**。01 §1.3 的「13 有效」反而才是對的——同一份文件自相矛盾。

---

## R-F16 明細（12 列表格）

### 座標圖例

文件現在**有**說明 `base` / `fixed`，原文（`03-semantic-drift.md:7-8`）：

> `base` — **審計當時**（commit `7d0fcf5`）的位置，用來說明「原本錯在哪」。
> `fixed` — **本輪修完後**的位置，用來讓讀者驗證修正確實落地。

⚠️ 同一段圖例在檔案開頭**重複了兩次**（`:3-12` 與 `:14-23`，內容幾乎逐字相同），是編輯殘留。

### 12 列驗證（對現行 `/tmp/lc-parity-wt` 工作樹）

| S-ID | fixed / 引用                                                               | actual line content（現行）                                                                                                          | matches?               |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| S-1  | fixed `registration.service.ts:43`（已移除）                               | `* ⛔ 已移除：POST …/registrations/checkin/override`                                                                                 | ✅ 指向移除證據        |
| S-2  | fixed `registrant/[registrationId].tsx:207`；`registration.service.ts:104` | `value={\`${tx.amount} · … ${tx.balanceAfter}\`}`；`async getWalletTransactions(`                                                    | ✅                     |
| S-3  | fixed `types/api.types.ts:111-120`（已補）                                 | `:111 checkedInBy?` … `:120 depositRefundedNote?`                                                                                    | ✅ 六個欄位都在        |
| S-4  | fixed `event.service.ts:93-106`（已補）                                    | `:93 async getRegistrations(` … `:106 depositRefunded?: "all" \| "refunded" \| "not_refunded"`                                       | ✅                     |
| S-5  | `registration.service.ts` 的 `createRegistration`（未修）                  | `:60 async createRegistration(`；`:71-90` 回傳仍只有 `id/registrationCode/status/paymentMethod/stripeCheckoutUrl`                    | ✅ 指向未修碼          |
| S-6  | fixed `event.service.ts:85`                                                | `async getMyAccess(eventId: string): Promise<EventAccess>`                                                                           | ✅                     |
| S-7  | fixed `overview.tsx:187,201`                                               | `:187 const localTotal = event?.registrationCount ?? null;`；`:201 const access = await eventService.getMyAccess(eventId);`          | ✅ 已不再打受限端點    |
| S-8  | fixed `token.tsx:50`（改指名單）                                           | `secondaryLabel={eventId ? copy.event.tokenOpenRoster : undefined}`                                                                  | ✅                     |
| S-9  | fixed `nfc.service.ts:44`（已補參數）                                      | `:44 /** 只回已綁定的卡片… */`；真正的參數在 `:45 boundOnly?: boolean;`                                                              | ⚠️ 大致對，座標差 1 行 |
| S-10 | `registrations.tsx:136,169,194`（未修）                                    | 三行皆為 `visibility: "active",`                                                                                                     | ✅ 指向未修碼          |
| S-11 | `utils/api-error.ts:30-31`                                                 | `:30 const code = …error?.code;`；`:31 return typeof code === "string" …`                                                            | ✅ 指向未修碼          |
| S-12 | `registrant/[registrationId].tsx:45-50,72`（未修）                         | `:45-50` 是 `Row` 元件（`<View style={styles.row}>` … `}`）；`useLocalSearchParams` 實際在 **`:54-58`**，`getByCode` 在 **`:78-80`** | ❌ **不符**            |

**F16 判定：STILL BROKEN。** 12 列中 11 列成立（S-9 有 1 行偏移），但 S-12 的 `45-50` 完全指錯地方；「未修」不等於可以留舊座標。

### 額外的 body-level 舊座標（不在總表，但同一個病灶）

| 位置             | 文件寫的                                                             | 現行實際                                                                         |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| S-2 內文 `:104`  | 「App 的型別（`registration.service.ts:98-126`）宣告 `approvedBy?`」 | `:98-126` 已是修好的 `getWalletTransactions`，**沒有** `approvedBy`              |
| S-4 內文 `:143`  | 「App 的 `getRegistrations`（`event.service.ts:62-90`）」            | `:62-90` 是 `getMyAccess`；`getRegistrations` 在 `:93`，且已含 `depositRefunded` |
| S-7 內文 `:208`  | 「`overview.tsx:133-142` 打兩次 `GET /registrations?limit=1`」       | `:133-142` 現在是 checkedIn / attendance 的 StatItem；舊呼叫已不存在             |
| S-12 內文 `:266` | 「`registrant/[registrationId].tsx:41-50`」                          | destructuring 在 `:54-58`                                                        |

這些內文引用沒有標 `base`，讀者會當成現行座標——和 F16 原本的問題同型。

### `registrant/[id].tsx` 全目錄 grep

- 精確字串 `registrant/[id].tsx`：
  - `07-verification.md:104-105`（說明「已改名」的 meta 敘述）
  - `appendix/checker-report-raw.md:471`（引用上一輪 checker 的歷史紀錄）
- **但同一個不存在的路徑 `registrant/[id]`（省略 `.tsx`）仍以「現行引用」形式存在：**
  - `02-screen-parity.md:20`：`registrations.tsx` + `registrant/[id]`
  - `08-intentional-differences.md:179`：`有（registrant/[id]）`
- `03-semantic-drift.md` 本身已全部改成 `[registrationId]`。

⇒ 檔名修正**只修了 03**；02 與 08 仍是死路徑。

---

## R-GATE 明細

### 1. `npm run check:contract`

```
> linkcard_event_admin_app_expo@1.0.0 check:contract
> node scripts/check-backend-contract.mjs

✓ 15 條 App 呼叫全部對得上後端路由快照
EXIT_CODE=0
```

（15 = 13 event + 2 auth。）

### 2. 負測 A：注入不存在的 override

暫存 app root：`/tmp/reverify-parity/neg1/src/services/probe.ts`

```ts
return apiClient.post(
  `/api/v1/events/${id}/registrations/checkin/override`,
  {},
);
```

`checkContract(neg1, 真快照)` 結果：

```
checked: 1  violations: 1  unknownBase: 0
VIOLATION POST /api/v1/events/${id}/registrations/checkin/override => POST */registrations/checkin/override
```

✅ **恰好 1 條 violation**，符合預期。

### 3. 負測 B（新）：注入存在的 import/preview

暫存 app root：`/tmp/reverify-parity/neg2/src/services/probe.ts`

```ts
return apiClient.post(`/api/v1/events/${id}/registrations/import/preview`, {});
```

結果：

```
checked: 1  violations: 0  unknownBase: 0
```

✅ **0 violations**。快照修正完整，不再把真實存在的 import 路由誤報成死路徑。

### 4. `npm test`

```
# tests 216
# suites 6
# pass 213
# fail 0
# cancelled 0
# skipped 0
# todo 3
EXIT_CODE=0
```

**GATE 判定：PASS。** 閘門在正反兩方向都誠實：真死的會抓（1 條），真活的會放（0 條），且全套測試綠。

---

## 仍未解決 or 新發現的問題

1. **F16 / S-12 座標錯誤（主要未修項）**
   `03-semantic-drift.md:49` 的 `registrant/[registrationId].tsx:45-50,72` 指向 `Row` 元件；真正的 `useLocalSearchParams` 在 `:54-58`、`getByCode` 在 `:78-80`。應改為 `:54-58,70-74,78-80`（或只寫 `:54-58`）。

2. **03 內文仍有多個未標 `base` 的舊座標**
   見上表（S-2 `:98-126`、S-4 `:62-90`、S-7 `:133-142`、S-12 `:41-50`）。總表修了雙座標，內文沒同步，讀者仍會被誤導。

3. **`registrant/[id]` 死路徑仍在 02 / 08**
   `02-screen-parity.md:20`、`08-intentional-differences.md:179` 仍以現行引用形式出現。檔名修正不完整。

4. **01 的死路由敘述已過期，且與自身 §1.3 矛盾**
   - `01:5`：「13 條，其中 1 條不存在，其餘 12 條正確」
   - `01:18` 表列 #7 `POST …/checkin/override`，`01:31` 仍寫「App 呼叫端 `registration.service.ts:50`」、`01:32` 寫「`check-in.tsx:303-330（onRequestOverride）`」
   - 現行：`registration.service.ts:43` 是「已移除」註解，`check-in.tsx:309` 也只是說明註解，`src` 內已無 `onRequestOverride` 或實際 override 呼叫
   - 同一份 `01:73` 卻寫「13 有效（10.7%）」
     ⇒ 01 應改成「13 條全部有效、override 已移除」，並刪掉 #7 與 §1.2 的現行式描述（或標成 base）。

5. **03「漂移的方向統計」也過期**
   `03:291` 仍把 S-1 算進「App 接了但接錯 4」，但 S-1 已移除；此表未隨修復更新。

6. **00 的取證 commit 與快照不一致（低風險）**
   `00:25` 寫 BE `206b1483`，快照 `generatedFrom.commit` 是 `64be09e`（= 現行 HEAD）。已用 `git diff 206b1483 64be09e -- src/events/routes` 驗證：**路由檔 0 差異**，所以 121 不受影響；但座標敘述已過期。

7. **78 / 93 是兩個不同口徑的數字，被寫成同一組**
   `78` 來自 `coverage.py`（`lib/events`、只收 backtick；實際 87 呼叫點），`93` 來自 `extract_fe.py`（`lib/events + app`、三種引號；實際 82 unique）。建議統一成一個 extractor 再寫「N 個 literal / M 個呼叫點」。

8. **（次要）00 說「11 支領域路由 + index.ts」**
   11 個檔案中包含 `exhibitor-invites.routes.ts`，它實際掛在 `/api/v1/exhibitor-invites`、不貢獻 121。若語意是「events 路由檔」應說明；若只是檔案數則無誤。

9. **（次要）07-verification 引用的輸出多了一段**
   `07:112` 寫 `✓ 15 條 App 呼叫全部對得上後端路由快照（121 條）`，實際 CLI 輸出不帶「（121 條）」。不影響結論，但引用非逐字。
