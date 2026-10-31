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
