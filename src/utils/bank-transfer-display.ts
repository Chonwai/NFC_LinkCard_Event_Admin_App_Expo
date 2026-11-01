import { copy } from "@/constants/copy.zh-TW";
import type { EventManageStats } from "@/types/api.types";
import type {
  BankTransferRegistrationSummary,
  BankTransferStatusFilter,
} from "@/types/bankTransfer.types";

/**
 * 匯款覆核畫面的**顯示推導**（parity `bank-transfers`）。
 *
 * ## 為什麼要在 util 層而不是寫在畫面裡
 *
 * 與 `manage-stats.ts` 同一個理由：AdminApp 沒有元件層測試（`node:test`，
 * 無 jsdom／RN renderer），畫面裡的推導只能靠「讀原始碼比對字串」驗收——
 * 抓得到整段被刪，抓不到等價重寫與邊界行為。把人名組法、狀態對照、頁籤計數
 * 搬到這裡，`tests/bank-transfer-display.test.mjs` 才能釘住。
 */

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 報名者顯示名稱。
 *
 * 逐字照 Web `lib/events/formSchema.ts:89` 的 `formatPersonName`：
 * `"${firstName} ${lastName}".trim()`，空的話退回 email，再空就回空字串。
 * 中間的空白由 `join` 保證是**一個**——`"小明"` + `""` 不會變成 `"小明 "`。
 *
 * ⚠️ 不沿用 `utils/registration-display.ts` 的 `getRegistrationDisplayName`：
 * 那一支吃的是 `Registration`（含 `profile.fullName`），而匯款審批的回應
 * （後端 `include.registration.select`）**沒有** `profile`。硬套型別就得造假
 * 欄位。
 */
export function formatBankTransferPersonName(
  registration: BankTransferRegistrationSummary,
): string {
  const name = [registration.firstName, registration.lastName]
    .map((part) => trimOrNull(part))
    .filter((part): part is string => part != null)
    .join(" ");

  return name || trimOrNull(registration.email) || "";
}

/**
 * 狀態 → 顯示文字。
 *
 * Web 的 `statusLabel()`（`page.tsx:78-84`）認不得的字串會**原樣印出**，這裡
 * 照做：`status` 在型別上是 `string`（見 `types/bankTransfer.types.ts` 檔頭），
 * 後端若多一個狀態，顯示原始值比顯示空白或「未知」更容易回報問題。
 */
export function bankTransferStatusLabel(status: string): string {
  if (status === "PENDING") return copy.bankTransfers.tabs.pending;
  if (status === "APPROVED") return copy.bankTransfers.tabs.approved;
  if (status === "REJECTED") return copy.bankTransfers.tabs.rejected;
  return status;
}

/**
 * 四個頁籤各自的筆數。
 *
 * 來源是 `GET /manage-stats` 的 `bankTransfers`（**一次請求**），不是「每個頁籤
 * 各打一次 `limit: 1` 讀 `pagination.total`」——那是 Web 在 QA EV-04 修掉的
 * 做法（`page.tsx:44-52` 的註解）。
 *
 * ## 缺 key 就是 0（與 `deriveRegistrationCounts` 相反，理由不同）
 *
 * `manage-stats` 的 `byStatus` 只列真的有的狀態（`EventService.getManageStats`
 * 的 `fold()` 不補 0）。在**這個**畫面缺 key 只有一個解釋：該狀態真的 0 筆
 * ——因為這四個狀態都不是「有值但查不到」，而是 groupBy 的結果。所以照 Web
 * 用 `?? 0`。
 *
 * `stats` 本身是 `null`（還沒載入／載入失敗）時回 `null`，呼叫端據此**不顯示**
 * 任何數字，而不是顯示 0。那是 `count-display.ts` 的既有紀律：讀不到 ≠ 是 0。
 */
export function bankTransferTabCounts(
  stats: EventManageStats | null | undefined,
): Record<BankTransferStatusFilter, number> | null {
  const bankTransfers = stats?.bankTransfers;
  if (bankTransfers == null) return null;

  const byStatus = bankTransfers.byStatus ?? {};

  return {
    "": bankTransfers.total ?? 0,
    PENDING: byStatus.PENDING ?? 0,
    APPROVED: byStatus.APPROVED ?? 0,
    REJECTED: byStatus.REJECTED ?? 0,
  };
}
