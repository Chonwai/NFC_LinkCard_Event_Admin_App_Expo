import type { ApiResponse } from "@/types/api.types";
import type {
  BankTransferApproval,
  BankTransferDecision,
  BankTransferListParams,
  BankTransferPagination,
} from "@/types/bankTransfer.types";

import { apiClient } from "./api";

/**
 * 匯款覆核後台的**兩支**呼叫（parity `bank-transfers`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/registrations.ts:360`
 * （`listBankTransferApprovals`）與 `:376`（`reviewBankTransfer`）。
 *
 * ## 為什麼只有兩支
 *
 * 後端 `bank-transfers` 底下有三條路由（`event-ops.routes.ts:62-74`）：
 *
 * | 路由 | 誰用 | App |
 * | --- | --- | --- |
 * | `GET  …/bank-transfers` | 後台清單 | ✅ 本檔 |
 * | `PATCH …/bank-transfers/:approvalId/review` | 後台覆核 | ✅ 本檔 |
 * | `POST …/bank-transfers/submit` | **參加者**送匯款證明 | ❌ 刻意不接 |
 *
 * 第三條是報名流程的一環（`lib/events/registrations.ts:343`），它需要
 * `multipart/form-data` 的憑證圖檔，屬報名者動作；把它接進後台 App 等於多出
 * 一條 Web 後台沒有的寫入路徑。`tests/bank-transfer-contract.test.mjs` 把
 * 「恰好兩條」釘住。
 *
 * ## 為什麼清單照 Web 只送 `status`
 *
 * 後端有分頁（預設 `limit=20`），但 Web 的頁面只送 `{ status }`，沒有下一頁
 * 也沒有「載入更多」。App 這裡**原樣透傳**`page` / `limit`（型別留著，讓
 * service 與 Web 的 lib 同構），但畫面不送——多送一個後端會讀、Web 卻沒送的
 * 參數，就是「App 做得到 Web 做不到的事」。
 *
 * ## 錯誤不回顯後端訊息
 *
 * 兩支都可能回 `403 INSUFFICIENT_PERMISSION`、
 * `404 BANK_TRANSFER_APPROVAL_NOT_FOUND`、
 * `400 BANK_TRANSFER_ALREADY_REVIEWED`。分類在
 * `utils/bank-transfer-review.ts`，這裡只負責把錯誤往上丟。
 *
 * ## 路徑寫成行內模板字串的理由
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，往後抓
 * **第一個字串字面**」。若先把路徑組成變數再傳進去，它抓到的會是**下一條**
 * 呼叫的字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `ticket-type.service.ts`、`poll.service.ts` 也都是行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 */

/**
 * 把查詢參數組成 `URLSearchParams` 字串（空物件 → 空字串）。
 *
 * 逐字照 Web：`Object.entries(params).filter(v !== undefined)` 後再
 * `String(v)`。**`null` 不濾掉**（Web 也沒有），但這一支的呼叫端只會送
 * `string | number | undefined`。
 */
function buildQueryString(params?: BankTransferListParams): string {
  if (params == null) return "";

  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export const bankTransferService = {
  /**
   * GET /v1/events/:eventId/bank-transfers
   *
   * 後端 `authMiddleware` ＋ `getEventWriteAccess === 'ALLOWED'`
   * （`EventRegistrationController.listBankTransfers:426-437`）：非擁有者／
   * 協作者回 `403 INSUFFICIENT_PERMISSION`，不是靜默回空陣列。
   *
   * 回應 `{ approvals, pagination }`。`approvals[].amount` 是**重算後**的字串
   * （見 `types/bankTransfer.types.ts` 檔頭），畫面直接顯示，不要再換算。
   *
   * 查詢字串一律接在 `?` 之後（沒有參數時就是一個空查詢），與 Web 的
   * `/${eventId}/bank-transfers?${query}` 同一個形狀——含空字串的情形。
   */
  async listApprovals(
    eventId: string,
    params?: BankTransferListParams,
  ): Promise<{
    approvals: BankTransferApproval[];
    pagination: BankTransferPagination;
  }> {
    const res = await apiClient.get<
      ApiResponse<{
        approvals: BankTransferApproval[];
        pagination: BankTransferPagination;
      }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/bank-transfers?${buildQueryString(params)}`,
    );
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId/bank-transfers/:approvalId/review
   *
   * 放行或退回一筆匯款。**這是會動到錢的一支**：核可會把報名從待付款推進到
   * 已付款（並發放票種的 `initialTokens`），退回則讓那筆報名維持／變成
   * `REJECTED`。後端在同一個 transaction 內同時改 approval 與 registration，
   * 並用 `status: PENDING` 的條件式 update 關掉 TOCTOU 競態
   * （`EventRegistrationService.reviewBankTransfer:1155-1160`）——所以兩個人同時
   * 按核可，只有一個會成功，另一個收到 `BANK_TRANSFER_ALREADY_REVIEWED`。
   *
   * `reviewNote` 的規則照後端 DTO（`ReviewBankTransferDto:119-126`）：
   * **optional**。Web 對「退回」會 `prompt` 要原因，但 `prompt` 回 `null`
   * 時它把 `null` 併成 `undefined` 就送出了——也就是「取消」等於「無理由退回」。
   * App 在 UI 層修掉那件事（取消＝中止），但這一層仍照後端契約：`undefined`
   * → **整個欄位不送**（不是送 `null`），與 Web 的
   * `JSON.stringify({ decision, reviewNote })` 在 `reviewNote` 為 `undefined`
   * 時的行為一致。
   */
  async review(
    eventId: string,
    approvalId: string,
    decision: BankTransferDecision,
    reviewNote?: string,
  ): Promise<{ approval: BankTransferApproval }> {
    const payload =
      reviewNote === undefined ? { decision } : { decision, reviewNote };

    const res = await apiClient.patch<
      ApiResponse<{ approval: BankTransferApproval }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/bank-transfers/${encodeURIComponent(approvalId)}/review`,
      payload,
    );
    return res.data.data;
  },
};
