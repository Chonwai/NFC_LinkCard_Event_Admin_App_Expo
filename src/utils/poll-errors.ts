import { copy } from "@/constants/copy.zh-TW";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/api-error";

/**
 * 投票後台（建立／啟用／關閉）的錯誤碼 → 可否原樣顯示後端訊息。
 *
 * 消費端：`app/(auth)/[eventId]/polls.tsx`。
 *
 * ## 為什麼不能一律顯示後端 `error.message`
 *
 * 後端只有**幾條**錯誤是寫給操作員看的中文；其餘是給工程師看的英文
 * （`Failed to create poll`、`Internal Server Error`）。把後者原樣貼到畫面
 * 上，操作員得到的是一句他無法行動的英文，而且會以為是自己按錯。
 * 所以改成**白名單**：認得的碼才轉發原文，其餘落回 `copy.polls.actionError`
 * （「操作失敗，請重試」）——那句話不精確，但它至少是可行動的。
 *
 * ## 白名單的來源
 *
 * 逐條對過 `LinkCard_ExpressJS_Backend/src/events/controllers/EventPollController.ts`
 * （三支寫入端點 `createPoll`／`activatePoll`／`closePoll` 實際會回的碼）：
 *
 * | 碼 | HTTP | 後端訊息 | 操作員要做什麼 |
 * | --- | --- | --- | --- |
 * | `VALIDATION_ERROR` | 400 | 「問題和至少兩個選項是必填的」 | 補欄位 |
 * | `INSUFFICIENT_PERMISSION` | 403 | 「你沒有權限啟動投票」等 | 找有權限的人 |
 * | `POLL_NOT_FOUND` | 404 | 「投票不存在」 | 重新整理 |
 *
 * 刻意**不含** `INTERNAL_SERVER_ERROR`（`ApiResponse.serverError` 的預設碼）：
 * 5xx 的訊息是英文，而且對操作員不可行動。也刻意不含投票端的
 * `POLL_NOT_ACTIVE`／`ALREADY_VOTED` 等——那些是訪客投票路徑，後台碰不到，
 * 收進來只會變成一張永遠對不上的表。
 */
export const KNOWN_POLL_ERROR_CODES: ReadonlySet<string> = new Set([
  "VALIDATION_ERROR",
  "INSUFFICIENT_PERMISSION",
  "POLL_NOT_FOUND",
]);

/**
 * 投票寫入失敗的單一文案解析。
 *
 * 只有**已知的碼**才轉發後端訊息；沒有碼（網路層錯誤、逾時）或未知碼一律回
 * `copy.polls.actionError`。
 *
 * 不判斷 HTTP 狀態碼：後端在這三支上的狀態碼與碼是一對一的，多一層狀態碼
 * 比對只是多一個會走歪的分支。
 */
export function resolvePollActionErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error);
  if (code != null && KNOWN_POLL_ERROR_CODES.has(code)) {
    return getApiErrorMessage(error, copy.polls.actionError);
  }
  return copy.polls.actionError;
}
