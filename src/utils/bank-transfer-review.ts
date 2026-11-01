import type {
  BankTransferApproval,
  BankTransferDecision,
} from "@/types/bankTransfer.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

import { formatBankTransferPersonName } from "./bank-transfer-display";

/**
 * 匯款覆核的**送出路徑**與**錯誤分類**（parity `bank-transfers`）。
 *
 * ## 這個檔案存在的理由：放行款項的兩道門
 *
 * 批准一筆匯款是這一整個 App 唯一會「把錢放行」的動作（`reviewBankTransfer`
 * 在同一個 transaction 內把報名推進到已付款、發放票種的 `initialTokens`，
 * 且**沒有反向操作**——後端對非 `PENDING` 一律回
 * `BANK_TRANSFER_ALREADY_REVIEWED`）。Web 對批准**沒有任何二次確認**：
 * 一按就送。App 要求確認，而「確認」如果不是一個**可被測試擋住的位置**，
 * 它就只是畫面上一顆好看的按鈕。
 *
 * 所以送出路徑收斂成唯一一支 `buildReviewRequest(intent, { confirmed })`：
 *
 * - `intent == null`（使用者還沒選任何一列） → `null`
 * - `confirmed === false`（只是按下「批准」、確認框還沒確認） → `null`
 * - `confirmed === true` → 才組出要送出的 body
 *
 * 畫面只在這支回非 `null` 時呼叫 service。`tests/bank-transfer-review-confirm.test.mjs`
 * 逐條釘住「確認前的狀態不會被送出」。
 *
 * ## 錯誤只呈現分類，不回顯後端 message
 *
 * 與 `utils/ticket-type-errors.ts` 同一條紀律：後端訊息可能帶內部路徑、
 * 別人的報名碼或 SQL 片段。這裡只讀 `code` / `status`，畫面對照文案。
 *
 * 後端實際會回的錯誤（`EventRegistrationController.handleError:1144-1155` 等）：
 *
 * | code / status | 什麼時候 |
 * | --- | --- |
 * | `403 INSUFFICIENT_PERMISSION` | 不是活動擁有者／協作者 |
 * | `404 BANK_TRANSFER_APPROVAL_NOT_FOUND` | 這筆審批不屬於這個活動（或已不存在） |
 * | `400 BANK_TRANSFER_ALREADY_REVIEWED` | 已經被別人審批過（`status !== PENDING`） |
 * | `404 EVENT_NOT_FOUND` | 活動不存在 |
 * | `400 VALIDATION_ERROR` | DTO 驗證失敗（`decision` 不在列舉內、`reviewNote` 不是字串） |
 * | `500` | 其他 |
 *
 * ## 為什麼沒有「網路錯誤」這一類
 *
 * 網路失敗（`isNetworkError`）在這裡落進 `failed`。對操作員來說，「連不上」
 * 與「後端說不行」在**行為**上沒有差別——兩種都要重新整理確認那筆錢的狀態，
 * 而這一頁的設計是：任何非成功都**重新載入清單**（見 `bank-transfers.tsx`
 * 的 `submitReview`）。這比假裝分辨得出來誠實。
 */

/** 一次覆核操作的使用者意圖（按下按鈕後、確認之前）。 */
export interface BankTransferReviewIntent {
  approval: BankTransferApproval;
  decision: BankTransferDecision;
  /**
   * 退回原因。
   *
   * 只有 `REJECTED` 會用到；`APPROVED` 一律忽略。空字串照 Web 的行為送出
   * （Web 的 `prompt` 按「確定」但沒打字時就是送 `""`）；**取消**不是空字串，
   * 取消＝不建立意圖（見畫面層）。
   */
  reason: string;
}

/** 要交給 `bankTransferService.review` 的參數。 */
export interface BankTransferReviewRequest {
  approvalId: string;
  decision: BankTransferDecision;
  reviewNote?: string;
}

/**
 * 把「意圖 + 是否已確認」轉成要送出的請求；**未確認一律回 `null`**。
 *
 * - 批准：不帶 `reviewNote`（Web 對批准也不帶）。
 * - 退回：帶上原因，空字串照送（與 Web 的 `prompt` 空輸入一致）；後端 DTO 的
 *   `reviewNote` 是 `@IsOptional() @IsString()`，空字串合法。
 */
export function buildReviewRequest(
  intent: BankTransferReviewIntent | null,
  options: { confirmed: boolean },
): BankTransferReviewRequest | null {
  if (intent == null) return null;
  if (!options.confirmed) return null;

  if (intent.decision === "APPROVED") {
    return { approvalId: intent.approval.id, decision: "APPROVED" };
  }

  return {
    approvalId: intent.approval.id,
    decision: "REJECTED",
    reviewNote: intent.reason,
  };
}

/** 確認框上要顯示的三件事：誰、多少錢、哪一筆。 */
export interface BankTransferReviewConfirmation {
  decision: BankTransferDecision;
  /** 誰（報名者姓名，缺姓名時退回 email——與列表同一支組法）。 */
  person: string;
  /** 多少錢：`幣別 + 後端重算後的金額字串`，不換算、不四捨五入。 */
  amount: string;
  /** 哪一筆：報名碼。 */
  registrationCode: string;
  /**
   * 退回原因那一行。
   *
   * - 批准 → `null`（沒有這一件事要顯示）
   * - 退回 → **原樣**的原因字串，可能是空字串。空字串不是「沒有資料」而是
   *   「操作員沒填」——畫面要把它顯示成「（未填寫）」才不會讓人以為那一行
   *   壞掉。placeholder 屬文案，留在畫面層，這裡不碰 `copy`。
   */
  reason: string | null;
}

/**
 * 確認框的內容。
 *
 * 為什麼要顯示這三件事而不是只問「確定嗎」：這是**放行款項**。
 * 「誰的、多少錢、哪一筆」正是按下確認前唯一能讓人發現「點錯列」的資訊。
 * 文案與欄位名放 copy，這裡只負責把資料擺好（可被測試）。
 */
export function buildReviewConfirmation(
  intent: BankTransferReviewIntent,
): BankTransferReviewConfirmation {
  const { approval, decision } = intent;

  return {
    decision,
    person: formatBankTransferPersonName(approval.registration),
    amount: `${approval.currency} ${approval.amount}`,
    registrationCode: approval.registration.registrationCode,
    reason: decision === "REJECTED" ? intent.reason : null,
  };
}

/** 覆核失敗的分類（畫面的輸入，不是結論）。 */
export type BankTransferReviewOutcome =
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "alreadyReviewed" }
  | { kind: "validation" }
  | { kind: "failed" };

/**
 * 失敗分類。
 *
 * 先看 `code`：後端把語意放在 code 裡，`status` 只是粗分類。認不得才退回
 * status（403 → 404 → 400）。
 */
export function classifyBankTransferReviewError(
  error: unknown,
): BankTransferReviewOutcome {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);

  if (code === "BANK_TRANSFER_ALREADY_REVIEWED")
    return { kind: "alreadyReviewed" };
  if (code === "BANK_TRANSFER_APPROVAL_NOT_FOUND") return { kind: "notFound" };
  if (code === "EVENT_NOT_FOUND") return { kind: "notFound" };
  if (code === "INSUFFICIENT_PERMISSION") return { kind: "forbidden" };
  if (code === "VALIDATION_ERROR") return { kind: "validation" };

  if (status === 403) return { kind: "forbidden" };
  if (status === 404) return { kind: "notFound" };
  if (status === 400) return { kind: "validation" };

  return { kind: "failed" };
}
