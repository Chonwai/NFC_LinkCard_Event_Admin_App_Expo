import type {
  RegistrationEmailState,
  RegistrationEmailStatus,
} from "@/types/api.types";
import { copy } from "@/constants/copy.zh-TW";

/**
 * 報名 email 狀態的**呈現邏輯**（純函式）。
 *
 * 為什麼要獨立成檔：這三條規則（色調、文案、錯誤摘要）必須可單測，而且必須與
 * Web 逐字對齊——那份在 `LinkCard_Frontend/lib/events/emailStatus.ts`，BE 語意
 * 在 `src/events/services/registrationEmailStatus.ts`。畫面只負責把 tone 映射成
 * `semantic.status.*`。
 *
 * 註：這裡刻意**不** import `@/constants/theme`。色調回傳的是語意角色，
 * 對應哪一組顏色是畫面的事——少了這層依賴，這個模組才能在 Node 測試裡直接載入
 * （畫面的 `react-native` 依賴載不進來）。
 */
export type EmailStatusTone =
  "neutral" | "info" | "success" | "warning" | "danger";

/**
 * 狀態 → 視覺色調。**逐字鏡射** Web 的 `emailStatusTone`（含 `info` 這一格）：
 * 兩邊若對同一個狀態給出不同顏色，操作者在兩個端上會以為看到的是不同狀態。
 */
export function emailStatusTone(
  state: RegistrationEmailState,
): EmailStatusTone {
  switch (state) {
    case "CLAIMED":
      return "success";
    case "SENT_NOT_OPENED":
      return "info";
    case "NOT_REQUIRED":
    case "AWAITING_PAYMENT":
      return "neutral";
    case "SEND_FAILED":
      return "danger";
    case "NOT_SENT":
    case "NO_ACCOUNT":
      return "warning";
    default:
      return "neutral";
  }
}

/** 已知的七態；同時也是「這個字串到底有沒有被建模」的判準。 */
const KNOWN_STATES: readonly RegistrationEmailState[] = [
  "AWAITING_PAYMENT",
  "NO_ACCOUNT",
  "CLAIMED",
  "NOT_REQUIRED",
  "SEND_FAILED",
  "SENT_NOT_OPENED",
  "NOT_SENT",
] as const;

export function isKnownEmailState(
  state: string,
): state is RegistrationEmailState {
  return (KNOWN_STATES as readonly string[]).includes(state);
}

/**
 * 狀態 → 顯示文字。
 *
 * ## `null`／缺失**不等於**任何一種狀態
 * BE 是 `emailStatusByRegistration.get(id) ?? null`，湊不出狀態時就是 `null`。
 * 這時顯示「未知」——**不要**退回任何看起來像事實的標籤（例如「未寄出」）。
 * 把「不知道」畫成「沒寄」，會讓操作員去重寄一封其實已經寄出的信。
 *
 * 未知的 `state` 字串同理：原樣顯示，讓新的後端狀態**看得見**而不是被吞成
 * 某個舊標籤。
 */
export function emailStatusLabel(
  status: RegistrationEmailStatus | null | undefined,
): string {
  if (!status) return copy.roster.emailStatus.unknown;
  const state = status.state;
  if (!isKnownEmailState(state)) return state;
  return copy.roster.emailStatus.states[state];
}

/**
 * 徽章要掛的錯誤摘要（Web 用 `title` 提示，App 用無障礙標籤）。
 *
 * 取用順序與 Web 一致：先看 claim 信的錯誤，再看 outbox 通知的 `lastError`。
 * 都沒有就回 `null`——不回空字串，呼叫端才分得出「沒有錯誤」與「有空字串」。
 */
export function emailStatusDetail(
  status: RegistrationEmailStatus | null | undefined,
): string | null {
  if (!status) return null;
  const claimError = status.claimEmail?.error;
  if (claimError) return claimError;
  const notificationError = status.notifications?.find(
    (item) => item.lastError,
  )?.lastError;
  return notificationError ?? null;
}

/**
 * 「確認信沒送出」—— 決定要不要提供「重寄確認信」。
 *
 * **逐字鏡射** Web `RegistrationDetailDrawer.tsx:133-139` 的
 * `confirmationNotDelivered`：
 *
 * - 狀態必須是 `NOT_REQUIRED`（帳號已驗證，設計上走確認信而非領取信）；
 * - 且 outbox 查無成功投遞：沒有任何意圖列，或**任一**列為 `FAILED`。
 *
 * `PENDING` **不算失敗**——relay 每 5 分鐘跑一輪，剛排入佇列的列本來就該是
 * `PENDING`。把它當失敗，會讓操作員在等待視窗裡重複按重寄。
 *
 * 其餘狀態一概不提供：那代表當事人不走確認信這條路（`NO_ACCOUNT`／
 * `SENT_NOT_OPENED` 走領取信），給一顆必定回
 * `CONFIRMATION_EMAIL_NOT_APPLICABLE` 的按鈕比不給更糟。
 */
export function isConfirmationNotDelivered(
  status: RegistrationEmailStatus | null | undefined,
): boolean {
  if (!status) return false;
  if (status.state !== "NOT_REQUIRED") return false;
  const notifications = status.notifications ?? [];
  return (
    notifications.length === 0 ||
    notifications.some((item) => item.status === "FAILED")
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * 篩選（client-side，作用於**已載入**的名單）
 *
 * 以下四個匯出**逐字鏡射** Web `lib/events/emailStatus.ts` 的同名函式／常數。
 * 它們不是查詢參數——後端 `GET /registrations` 沒有 email 狀態這個維度，
 * Web 也是拿回整頁後在前端篩。所以這裡刻意不進 `registration-filters.ts`：
 * 那個檔處理的是「畫面值域 → 查詢參數」，而這裡篩的是已經在手上的列。
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * 需要操作員介入的狀態（與 BE `ACTIONABLE_EMAIL_STATES` 逐字對齊）。
 *
 * 用途：名單「待處理」篩選、批次補發的預設選取。三者共通點是「這封信應該
 * 要能送出去，但目前沒送成」——`AWAITING_PAYMENT` 依設計不寄、
 * `NOT_REQUIRED` 走確認信、`SENT_NOT_OPENED`／`CLAIMED` 已經寄出，都不算。
 */
export const ACTIONABLE_EMAIL_STATES: readonly RegistrationEmailState[] = [
  "NO_ACCOUNT",
  "SEND_FAILED",
  "NOT_SENT",
] as const;

export function isActionableEmailState(state: RegistrationEmailState): boolean {
  return ACTIONABLE_EMAIL_STATES.includes(state);
}

/**
 * 確認信（outbox 通知）是否有投遞問題：
 * - `FAILED`：relay 已放棄（超過重試上限）
 * - `PENDING` 且 `attempts > 0`：曾失敗、正在重試中（值得關注但不必然失敗）
 *
 * 與 `isConfirmationNotDelivered` 的差別：那條判斷「要不要提供重寄按鈕」，
 * 只看 `NOT_REQUIRED` 且只看 `FAILED`；這條是「寄送失敗」篩選的判準，涵蓋
 * 所有狀態，且把「重試中」也算進來——操作員想找的就是「有問題的信」。
 */
export function hasNotificationDeliveryIssue(
  status: RegistrationEmailStatus | null | undefined,
): boolean {
  if (!status) return false;
  return status.notifications.some(
    (n) => n.status === "FAILED" || (n.status === "PENDING" && n.attempts > 0),
  );
}

/** 名單上「待處理」的列數（供篩選 chip 顯示計數）。 */
export function countActionable(
  registrations: { emailStatus?: RegistrationEmailStatus | null }[],
): number {
  return registrations.filter(
    (reg) => reg.emailStatus && isActionableEmailState(reg.emailStatus.state),
  ).length;
}

/**
 * 名單 email 狀態篩選值域（與 Web `EmailStatusFilter` 同一個集合）。
 * `all` ＝ 不篩。
 */
export type EmailStatusFilter = "all" | "actionable" | "claimed" | "failed";

/**
 * 名單篩選（client-side）。
 *
 * `null`／缺失的狀態**只在 `all` 時通過**：`emailStatus` 為 `null` 代表後端
 * 湊不出狀態（＝不知道），把它塞進「待處理」會讓操作員去追一封可能根本沒問題
 * 的信，塞進「已領取」則是憑空斷言。與 Web 同一個判斷。
 */
export function matchesEmailStatusFilter(
  status: RegistrationEmailStatus | null | undefined,
  filter: EmailStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (!status) return false;

  switch (filter) {
    case "actionable":
      return isActionableEmailState(status.state);
    case "claimed":
      return status.state === "CLAIMED";
    case "failed":
      return (
        status.state === "SEND_FAILED" || hasNotificationDeliveryIssue(status)
      );
    default:
      return true;
  }
}
