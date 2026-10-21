# 最終重驗（F16）

## 結論

**F16: STILL BROKEN**

原兩項 blocker 都已經修好（S-12 的 `:54/:70/:78` 三點全對；`02`、`08` 已無 `registrant/[id]`）。但依本 spec 的嚴格規則，12 列仍有 1 列不符：S-9 的 fixed `:44` 只是註解，`boundOnly` 參數在 `:45`。此外，S-2／S-4／S-7 的**內文**仍留著未標 `base` 的舊座標，且指向錯誤的現行碼（與 F16 同一病灶）。因此 F16 尚未完全關閉；產品與閘門本身全綠。

---

## S-1..S-12 對照表

座標皆對照現行工作樹 `/tmp/lc-parity-wt`。

| S-ID | claimed fixed coord                                                  | actual line content at that coord                                                                                                                                                                        | matches?                                        |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| S-1  | `registration.service.ts:43`（已移除）                               | `* ⛔ 已移除：POST …/registrations/checkin/override`（墓碑註解）。另：`grep -rn override src` 只剩註解／UI 文案，無實際 POST；`check-in.tsx:309` 也是「先前這裡會 POST…」的移除說明                      | yes                                             |
| S-2  | `registrant/[registrationId].tsx:207`；`registration.service.ts:104` | `:207` 為 ``value={`${tx.amount} · ${copy.roster.tokenBalanceLabel} ${tx.balanceAfter}`}``；`:104` 為 `async getWalletTransactions(`（`:107` 有 `params?: { page?; limit? }`，`:111` 轉發 `{ params }`） | yes                                             |
| S-3  | `types/api.types.ts:111-120`（已補）                                 | `:111 checkedInBy?`、`:113 archivedAt?`、`:115 depositRefundedAt?`、`:116 depositRefundedBy?`、`:118 depositRefundedAmount?`、`:119 depositRefundedReference?`、`:120 depositRefundedNote?`              | yes                                             |
| S-4  | `event.service.ts:93-106`（已補）                                    | `:93 async getRegistrations(`、`:106 depositRefunded?: "all" \| "refunded" \| "not_refunded"`                                                                                                            | yes                                             |
| S-5  | `registration.service.ts` 的 `createRegistration`（未修）            | `:60 async createRegistration(`；`:71-78` 回傳仍只有 `id / registrationCode / status / paymentMethod / stripeCheckoutUrl`（未含金額、幣別、明細、銀行指示）                                              | yes                                             |
| S-6  | `event.service.ts:85`                                                | `:85 async getMyAccess(eventId: string): Promise<EventAccess>`；`:87` 打 `/api/v1/events/:eventId/my-access`；`overview.tsx:201` 有實際呼叫                                                              | yes                                             |
| S-7  | `overview.tsx:187,201`                                               | `:187 const localTotal = event?.registrationCount ?? null;`；`:201 const access = await eventService.getMyAccess(eventId);`（原本的 `GET /registrations?limit=1` 已不在）                                | yes                                             |
| S-8  | `token.tsx:50`（改指名單）                                           | `:50 secondaryLabel={eventId ? copy.event.tokenOpenRoster : undefined}`；全檔 `grep openURL\|/wallet` 無命中                                                                                             | yes                                             |
| S-9  | `nfc.service.ts:44`（已補參數）                                      | `:44` 是 JSDoc：`/** 只回已綁定的卡片。後端 EventNfcBatchController.ts:88 讀此參數。 */`；真正的參數在 `:45 boundOnly?: boolean;`                                                                        | **no**（嚴格說差一行；`:44` 不含 changed code） |
| S-10 | `registrations.tsx:136,169,194`（未修）                              | 三行皆為 `visibility: "active",`（分別在 load / refresh / loadMore）                                                                                                                                     | yes                                             |
| S-11 | `utils/api-error.ts:30-31`                                           | `:30 const code = asApiError(error)?.response?.data?.error?.code;`；`:31 return typeof code === "string" && code !== "" ? code : null;`（仍只讀 `code`，未讀 normalized/compatibleCodes）                | yes（未修碼正確；但座標未標 base/fixed）        |
| S-12 | `registrant/[registrationId].tsx:54,70,78`（未修；base 為 45-50,72） | `:54 const { eventId, registrationId, code } = useLocalSearchParams<{`；`:70 if (!eventId \|\| !code) {`；`:78 const { registration: next } = await registrationService.getByCode(`                      | yes（三點全對）                                 |

---

## 無效路徑掃描

命令：

```bash
cd /tmp/lc-parity-wt/docs/analysis/adminapp-parity-20261022
grep -rn 'registrant/\[id\]' .
```

命中（全部在 appendix）：

| 檔案:行                               | 內容摘要                                                                                            | 分類                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| `appendix/checker-report-raw.md:471`  | 歷史 checker 指出「總表寫 `registrant/[id].tsx:186`，實際檔名是 `registrant/[registrationId].tsx`」 | appendix（歷史紀錄，可接受） |
| `appendix/reverify-report-raw.md:11`  | 歷史結論句引用了不存在的 `registrant/[id]`                                                          | appendix（可接受）           |
| `appendix/reverify-report-raw.md:127` | 標題 `registrant/[id].tsx` 全目錄 grep                                                              | appendix（可接受）           |
| `appendix/reverify-report-raw.md:129` | 精確字串 `registrant/[id].tsx`                                                                      | appendix（可接受）           |
| `appendix/reverify-report-raw.md:132` | 說明不存在的路徑 `registrant/[id]`                                                                  | appendix（可接受）           |
| `appendix/reverify-report-raw.md:133` | 引用 `02-screen-parity.md:20` 的舊寫法                                                              | appendix（可接受，但已過時） |
| `appendix/reverify-report-raw.md:134` | 引用 `08-intentional-differences.md:179` 的舊寫法                                                   | appendix（可接受，但已過時） |
| `appendix/reverify-report-raw.md:216` | 歷史待辦「死路徑仍在 02 / 08」                                                                      | appendix（可接受，但已過時） |

非 appendix：**0 筆**。`02-screen-parity.md:20` 現為 `registrant/[registrationId]`；`08-intentional-differences.md:179` 現為 `registrant/[registrationId]`。

真實檔名驗證：

```text
test -f 'src/app/(auth)/[eventId]/registrant/[registrationId].tsx' -> exists
test -f 'src/app/(auth)/[eventId]/registrant/[id].tsx'           -> absent
```

---

## 圖例

`03-semantic-drift.md` 檔頭（`:3-8`）原文：

```text
> **引用座標說明（重要）**
>
> 本檔的 file:line 有兩種，混用會誤導讀者：
>
> - `base` — **審計當時**（commit `7d0fcf5`）的位置，用來說明「原本錯在哪」。
> - `fixed` — **本輪修完後**的位置，用來讓讀者驗證修正確實落地。
```

注意：同一段圖例在 `:14-23` 又重複了一次（內容幾乎逐字相同），屬編輯殘留。

---

## 閘門

```text
cd /tmp/lc-parity-wt && npm run check:contract
> node scripts/check-backend-contract.mjs
✓ 15 條 App 呼叫全部對得上後端路由快照
exit 0

cd /tmp/lc-parity-wt && npm test
# tests 216 / pass 213 / fail 0 / todo 3
exit 0
```

測試穩定性備註：第一次完整 `npm test` 為 0 fail；第二次在機器負載下出現 2 個 `NFC write timed out after 1000ms` 的 timing flake（`tests/journeys/j-nfc-write-queue.test.mjs` T-ANQ-E2、T-ANQ-S3）；單獨重跑該 journey 檔 0 fail，第三次完整重跑亦為 0 fail。閘門可視為綠，但此測試對时序敏感。

---

## 任何新發現

1. **S-9 fixed 座標差一行**（strict blocker）：`:44` 是參數的 JSDoc，`:45` 才是 `boundOnly?: boolean;`。實質已修，但不符合「該行必須含 changed code」的嚴格規則。
2. **內文仍有未標 `base` 的舊座標，且指向錯誤現行碼**（與 F16 同型）：
   - `03-semantic-drift.md:104`（S-2 內文）：「App 的型別（`registration.service.ts:98-126`）宣告 `approvedBy?`」——現行 `:98-126` 是修好的 `getWalletTransactions`，且 `api.types.ts:145` 明寫「這裡沒有 `approvedBy`」。
   - `03-semantic-drift.md:143`（S-4 內文）：「App 的 `getRegistrations`（`event.service.ts:62-90`）」——現行 `:62-90` 是 `getMyAccess`；`getRegistrations` 在 `:93`。
   - `03-semantic-drift.md:208`（S-7 內文）：「`overview.tsx:133-142` 打兩次 `GET /registrations?limit=1`」——現行 `:133-142` 是 checkedIn／attendance 的 `StatItem`，舊呼叫已不存在。
3. **圖例重複**：`:3-12` 與 `:14-23` 兩段幾乎逐字相同，建議刪掉一段。
4. **S-11 未標 base/fixed**：圖例宣稱本檔 file:line 只有兩種，但 `:48` 的 `utils/api-error.ts:30-31` 兩者都沒標；S-5 亦只有函式名、無座標。
5. **NFC 測試 flake**：`timeoutMs = 1000` 在完整套件並行負載下會偶發 timeout；建議拉高 timeout 或標記為序列執行，以免閘門偶紅。
6. **appendix 歷史文字已過時**：`appendix/reverify-report-raw.md:133-134,216` 仍寫「02 / 08 有不存在的 `registrant/[id]`」，但兩檔已修。歷史附錄可保留，唯讀者可能誤以為現況仍壞。
7. S-1 的墓碑註解讓 `grep` 仍會命中字串 `checkin/override`（`:43` 與 `check-in.tsx:309`）；這是刻意的移除說明，不是 live call。
