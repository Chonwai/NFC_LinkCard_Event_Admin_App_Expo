import { WEB_BASE_URL } from "@/constants/config";
import type { ActivationLinkInfo } from "@/types/api.types";
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";

/**
 * 啟用連結（activation link）的**規則**（純函式）。
 *
 * 這一段在 App 先前被當成「政策問題」擱置，只做了唯讀探針。使用者已裁示
 * 「照 Web 做」，所以這裡把 Web `RegistrationDetailDrawer.tsx:429-477` 的行為
 * 逐條搬過來，並且把它拆成可單測的判定——因為這條路徑**有副作用**：
 * 簽發會鑄出一顆可啟用帳號的 token。判錯不會報錯，只會讓不該存在的連結存在。
 *
 * ## 兩個動作不可互換
 * - **查看**（`GET …/activation-link?readonly=1`）：純讀。既有 token 有效就回它，
 *   沒有就回 `null`。**不鑄新 token**。
 * - **簽發**（`GET …/activation-link?issue=1`）：沒有有效 token 時**當場鑄一顆**。
 *
 * BE 的簽發條件（`EventRegistrationController.getActivationLink`）是
 * `!readOnly && !activeToken && status.userId && !status.isActivated`——
 * 這正是下面 `canIssueActivation` 的來源，不是猜的。
 */

/** 簽發結果的分類（回應層面；錯誤另有 `classifyIssueError`）。 */
export type IssueActivationResult =
  "issued" | "reused" | "already_active" | "no_account" | "empty";

/**
 * 這個人**能**被簽發一條連結嗎。
 *
 * 條件與 BE 的簽發分支逐條相同：
 * - 帳號已啟用 ⇒ 不需要連結（簽發也不會鑄，BE 直接跳過）；
 * - 沒有 `userId` ⇒ 後端沒有對象可以綁 token。
 *
 * 兩者任一成立時，畫面**不該**給出「簽發」按鈕——給一顆必定什麼都不做的按鈕，
 * 比不給更糟：操作員會以為按了就有連結，然後把空字串貼給貴賓。
 */
export function canIssueActivation(
  info: ActivationLinkInfo | null | undefined,
): boolean {
  if (!info) return false;
  return info.userId !== null && !info.isActivated;
}

/**
 * 絕對 URL。
 *
 * BE 回的是**相對路徑**（`/events/activation/claim?token=…`），Web 用
 * `window.location.origin` 補前綴。App 沒有 `window`，用同源的
 * `WEB_BASE_URL`——與 `buildRegistrationPaymentUrl` 同一組設定，兩個端指到
 * 同一個前台。
 *
 * 已經是 `http(s)://` 的值原樣回傳：後端若哪天改成絕對路徑，這裡不該把它串成
 * `https://linkcard.xyzhttps://…`。
 */
export function absoluteActivationUrl(
  info: ActivationLinkInfo | null | undefined,
): string | null {
  const url = info?.activationUrl;
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${WEB_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * 簽發回應的分類。
 *
 * 順序有講究：先看「有沒有拿到 url」，再看「是不是這次鑄的」。
 * `issued === false` 且 url 有值＝**沿用既有 token**（BE 只在沒有有效 token 時
 * 才鑄），畫面必須說「這條連結原本就有效」而不是「已產生新連結」——否則操作員
 * 會以為自己剛剛讓對方舊連結失效了。
 */
export function describeIssueResult(
  info: ActivationLinkInfo,
): IssueActivationResult {
  if (info.isActivated) return "already_active";
  if (info.userId === null) return "no_account";
  if (!info.activationUrl) return "empty";
  return info.issued ? "issued" : "reused";
}

/** 簽發失敗的分類（與 `classifySendError` 同一個風格：只讀 `code` / `status`）。 */
export type IssueActivationError =
  "claimed" | "forbidden" | "not_found" | "failed";

/**
 * 後端錯誤 → 使用者可見分類。
 *
 * 與 `classifySendError` 同一條紀律：**不回顯**任何後端 `error.message`。
 * 那些字串沒有經過審核，可能夾帶內部路徑或收件人資訊。
 */
export function classifyIssueError(error: unknown): IssueActivationError {
  const code = getApiErrorCode(error);
  const status = getApiErrorStatus(error);
  if (code === "TOKEN_ALREADY_CLAIMED" || status === 409) return "claimed";
  if (code === "INSUFFICIENT_PERMISSION" || status === 403) return "forbidden";
  if (code === "REGISTRATION_NOT_FOUND" || status === 404) return "not_found";
  return "failed";
}
