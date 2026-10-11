# ADM Follow-up — Walk-in 動態表單欄位支援（L-3 完整修復）

> **狀態**：Open（本釋出已先落最小安全修復 `ea56f71`）
> **來源**：2026-10-11 BUG-REG-001 獨立審查 finding L-3
> **優先級**：P2（視活動現場是否需為「含 required 動態欄位」票種補報名而定）

---

## 1. 問題

`buildWalkInRegistrationBody`（`src/utils/walk-in-payload.ts`）只送
`ticketTypeId / email / firstName / lastName / phone / company / consent`，**不含 `formData`**。
對「schema 含 required 動態欄位」的票種（例如 Startup Fest 觀眾票的 3 個同意 checkbox、
多選目的、出席日期），後端 `validateDynamicFormData` 的 required 閘門必回
`400 INVALID_FORM_DATA`——現場補報名**不可能成功**（修復前後一致，屬既有功能缺口，非回歸）。

## 2. 本釋出已落的最小安全修復

- `walk-in-error-map.ts` 新增 `INVALID_FORM_DATA` → `copy.checkIn.walkInTicketNeedsDynamicFields`：
  「此票種需填寫報名表單欄位，App 現場補報名暫不支援——請改用網頁報名連結。」
- 現場人員得到**可執行指令**（改用網頁），不再面對泛用「補報名失敗」。
- 測試：`tests/journeys/j-walkin-register.test.mjs` 新增映射斷言（與 fallback 可分辨）。

## 3. 完整修復範圍（本 ticket）

1. **Schema 取得**：walk-in 票種選擇處已有 admin ticket list（含 `formFieldsJson`）→ 傳入表單區塊。
2. **RN 動態欄位渲染（子集）**：text / select / multi-select（checkbox 群組）/
   checkbox / section-title。file 與 pricing-select 顯示「請改用網頁報名」（不在 App 範圍）。
3. **Payload 形狀**（對齊 FE wire 契約，見 BE `registrationForm.ts` MULTI-SELECT WIRE SHAPE）：
   - multi-select 一律 `string[]`（**單選項也必須是陣列**——RHF 陷阱不在 RN 端，但契約相同）；
   - 未勾選 optional → `[]`；`allowOther` 哨兵 + sibling 文字。
4. **本地守衛**：required 動態欄位未填 → 送出前擋下（與 `validateWalkInConsent` 同層）。
5. **測試**：`buildWalkInRegistrationBody` 形狀鎖（陣列契約）＋ wiring 鎖（畫面真的渲染動態欄位）。

## 4. 為何本釋出不做

- AdminApp 無元件層測試（node:test、無 jsdom/RN renderer）→ 全量動態表單渲染器上線前
  無法以自動化守門，現場（活動日）風險高於收益。
- 最小修復已把「失敗」變成「可執行的替代路徑」，不阻塞任何既有流程。
- 需要先確認活動運營需求（是否真的要在 desk 為此類票種補報名）；若否，本 ticket 可長期擱置。
