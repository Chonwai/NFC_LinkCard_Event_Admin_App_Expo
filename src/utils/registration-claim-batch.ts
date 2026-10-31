import type { ActivationLinkInfo, Registration } from "@/types/api.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/**
 * 批次寄送 claim email 的**規則**（純函式）。
 *
 * 為什麼要抽出來：這幾條規則決定「預設勾誰」「為什麼不能寄」「失敗是哪一種」，
 * 全都要能單測。畫面的 `react-native` 依賴讓它在 Node 測試裡載不進來，
 * 而這些規則錯了**不會有任何錯誤訊息**——只會寄錯人，或該寄的人沒寄。
 *
 * 逐字鏡射 Web
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/registrations/page.tsx:712-770`。
 */

/** 單筆寄送的結果分類（`S-4`：逐筆呈現，**不得**自動重試整批）。 */
export type BatchSendOutcome =
  | { status: "sent"; sentAt: string }
  | { status: "claimed" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "send_failed" }
  | { status: "account_missing" }
  | { status: "failed" };

/** 一列為什麼「不是預設收件人」。 */
export type ClaimReason =
  "pending_claim" | "activated" | "has_token" | "no_account";

/**
 * 只有 `CONFIRMED` 的報名是候選。
 *
 * 未確認的人沒有「已確認」這件事可以寄——`PENDING_PAYMENT` 依設計根本還沒觸發
 * 任何信（與 email 狀態的 `AWAITING_PAYMENT`「依設計不寄」同一個原則）。
 */
export function batchClaimCandidates(
  registrations: Registration[],
): Registration[] {
  return registrations.filter(
    (reg) => (reg.status ?? "").toUpperCase() === "CONFIRMED",
  );
}

/**
 * `S-5` 的**預設收件人**述詞 ＝ 已有帳號、尚未 claim、且沒有有效 token。
 *
 * `userId === null`（尚未建立 LinkCard 帳號）**不列入預設勾選**：補發會建帳號
 * ＋寄信，屬較重且具副作用的動作，需要操作員逐一 opt-in（`P2-2`）。
 * 該列**仍可**勾選——後端會先補建帳號再寄；補建失敗回
 * `422 REGISTRATION_ACCOUNT_MISSING`（可重試）。
 */
export function isDefaultClaimRecipient(info: ActivationLinkInfo): boolean {
  return info.userId !== null && !info.isActivated && !info.activationToken;
}

/** 一列的分類（給畫面解釋「為什麼沒被預設勾」）。 */
export function claimReason(info: ActivationLinkInfo): ClaimReason {
  if (info.userId === null) return "no_account";
  if (info.isActivated) return "activated";
  if (info.activationToken) return "has_token";
  return "pending_claim";
}

/**
 * 後端錯誤 → 使用者可見分類。
 *
 * 只讀 `code` / `status`，**不回顯**任何後端 `error.message` 或
 * `activationEmailError` 全文——那些字串沒有經過任何審核，可能包含內部路徑
 * 或收件人資訊。畫面只說「哪一類失敗」。
 */
export function classifySendError(error: unknown): BatchSendOutcome {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);
  // 409：已 claim（BE `EventRegistrationService.resendActivationEmail`）⇒ 專屬訊息
  if (code === "TOKEN_ALREADY_CLAIMED" || status === 409) {
    return { status: "claimed" };
  }
  if (code === "INSUFFICIENT_PERMISSION" || status === 403) {
    return { status: "forbidden" };
  }
  if (code === "REGISTRATION_NOT_FOUND" || status === 404) {
    return { status: "not_found" };
  }
  // `P2-2`：報名存在但補建帳號失敗（BE 422）⇒ 專屬訊息，不是一般錯誤
  if (code === "REGISTRATION_ACCOUNT_MISSING" || status === 422) {
    return { status: "account_missing" };
  }
  if (code === "ACTIVATION_EMAIL_SEND_FAILED" || status === 502) {
    return { status: "send_failed" };
  }
  return { status: "failed" };
}

/**
 * 結果摘要。`failed` 用「已選 − 成功」算，不是數 `outcomes` 裡有幾筆——
 * 寄送途中被中斷時，沒寄到的那些根本不會有 outcome，數 outcomes 會少報失敗。
 */
export function batchSummary(
  selectedIds: readonly string[],
  outcomes: Record<string, BatchSendOutcome>,
): { success: number; failed: number } {
  const success = selectedIds.filter(
    (id) => outcomes[id]?.status === "sent",
  ).length;
  return { success, failed: selectedIds.length - success };
}
