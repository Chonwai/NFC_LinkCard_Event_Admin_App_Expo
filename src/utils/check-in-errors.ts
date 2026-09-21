import { copy } from "@/constants/copy.zh-TW";
import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  isNetworkError,
  isServerError,
} from "@/utils/api-error";

/**
 * 報到流程的後端錯誤碼 → 現場文案。
 * 消費端：`app/(auth)/[eventId]/check-in.tsx`。
 */
export const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  REGISTRATION_NOT_FOUND: copy.checkIn.registrationNotFound,
  REGISTRATION_NOT_CONFIRMED: copy.checkIn.notConfirmed,
  REGISTRATION_LOOKUP_RATE_LIMITED: copy.checkIn.rateLimited,
  INSUFFICIENT_PERMISSION: copy.checkIn.notEnoughPermission,
  ALREADY_CHECKED_IN: copy.checkIn.alreadyCheckedIn,
};

/**
 * 查詢／報到失敗的單一文案解析。
 *
 * **判定順序即語義，不可對調**：
 *
 * 1. **網路層錯誤優先**（CRA-V1-002）。連不上伺服器時 axios 不帶 `response`，
 *    也沒有後端錯誤碼；若先去比對錯誤碼／狀態碼，最終會落回
 *    `copy.checkIn.registrationNotFound`——把「連不上」講成「這張票不存在」，
 *    現場人員會據此把有效票當廢票處理。
 * 2. 後端錯誤碼（`CHECK_IN_ERROR_MESSAGES`）。
 * 3. HTTP 404：後端**確實有回應**且明示沒有這筆報名 →「找不到此報名」。
 * 4. HTTP 5xx（`F-02`）：伺服器有回應但自己壞了（含閘道回 HTML，因此既無 code
 *    也無 message）→ **伺服器文案**。少了這一步，它會落到第 5 步拿到
 *    「找不到此報名」——把「後端壞了」講成「這張票不存在」，與 CRA-V1-002 同型。
 *    5xx 的後端 message（例如 `Bad Gateway`）對現場不可行動，故不採用。
 * 5. 其他：優先用後端 message，否則回「找不到此報名」。
 *
 * 第 3 步是本函式的風險控制點：網路分支必須只吃「沒有 response」的錯誤，
 * 否則真正的 404 會被誤報成連線問題。第 4 步同理只能吃 5xx，
 * **真正的 404 仍然要說「找不到此報名」**。
 */
export function resolveCheckInErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return copy.checkIn.networkError;
  }

  const code = getApiErrorCode(error);
  const mapped = code != null ? CHECK_IN_ERROR_MESSAGES[code] : undefined;
  // 只接受字串：後端若回傳 `constructor`／`toString` 之類的鍵名，
  // 直接索引 Record 會取到 Object.prototype 上的成員而非文案。
  if (typeof mapped === "string") {
    return mapped;
  }

  if (getApiErrorStatus(error) === 404) {
    return copy.checkIn.registrationNotFound;
  }

  if (isServerError(error)) {
    return copy.checkIn.serverError;
  }

  return getApiErrorMessage(error, copy.checkIn.registrationNotFound);
}
