/**
 * 報名者顯示名稱——**全 repo 唯一定義**。
 *
 * ## 為什麼要有這個檔案
 *
 * 同一條式子（`firstName + " " + lastName`，空的話退回 email）在這個 repo
 * 原本有兩份：
 *
 * - `utils/bank-transfer-display.ts` 的 `formatBankTransferPersonName`
 * - 其他畫面各自拼（`registration-display.ts` 走的是另一條：它吃
 *   `Registration` 且有 `profile.fullName`）
 *
 * 場次名冊（`session-roster`）需要第三份。三份同樣的規則一定會分岔
 * （`CR-D4` 的典型訊號），所以這裡收成一份，參數改用**純量**
 * （`firstName` / `lastName` / `email`）而不是某個 `Registration` 型別——
 * 因為名冊、匯款審批、報名詳情三邊的回應形狀互不相同，硬套型別就得造假欄位。
 *
 * ## 行為（逐字照 Web `lib/events/formSchema.ts:89` 的 `formatPersonName`）
 *
 * 1. `firstName` 與 `lastName` 各自 trim，空字串視為沒有值
 * 2. 用**一個**空白接起來（`"小明"` + `""` 不會變成 `"小明 "`）
 * 3. 都沒有值 ⇒ 退回 `email`
 * 4. 連 email 都沒有 ⇒ 空字串（不是 `null`，呼叫端不必再判空）
 */

/** `null`／`undefined`／純空白 ⇒ `null`。 */
function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 組出顯示名稱。
 *
 * 回傳的**永遠是字串**（可能是空字串），呼叫端可以直接放進 `Text`。
 */
export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = [firstName, lastName]
    .map((part) => trimOrNull(part))
    .filter((part): part is string => part != null)
    .join(" ");

  return name || trimOrNull(email) || "";
}
