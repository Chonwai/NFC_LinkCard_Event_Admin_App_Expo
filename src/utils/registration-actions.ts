import type {
  Registration,
  RegistrationStatusCorrectionTarget,
} from "@/types/api.types";
import { isConfirmationNotDelivered } from "@/utils/registration-email-status";

/**
 * 名單管理可執行的動作。對應 Web `registrations/page.tsx` 的
 * `RegistrationActionsMenu`：狀態修正、隱藏／取消隱藏、封存／取消封存。
 *
 * 這裡比 Web 的 row menu **多一項** `resendConfirmation`：Web 把「重寄確認信」
 * 放在詳情抽屜的 email 區塊（`RegistrationDetailDrawer.tsx:530`），App 沒有
 * 那個抽屜，所以把它收進同一個管理面板——**能力相同，入口不同**。
 */
export type ManageAction =
  | "hide"
  | "unhide"
  | "archive"
  | "unarchive"
  | "correct"
  | "refund"
  | "resendConfirmation";

/** 只有可見性／封存四項有「呼叫相反端點」的復原路徑；狀態修正沒有。 */
export const REVERSE_ACTION: Partial<Record<ManageAction, ManageAction>> = {
  hide: "unhide",
  unhide: "hide",
  archive: "unarchive",
  unarchive: "archive",
};

/**
 * 狀態修正的目標：已報到 → 撤銷回 `CONFIRMED`；已確認 → 標記為 `CHECKED_IN`。
 *
 * 其餘狀態回 `null`，也就**不提供**這個動作。Web 的 row menu 同樣只給這兩種
 * 狀態出口——給其他狀態一顆必定 `409 STATUS_TRANSITION_NOT_ALLOWED` 的按鈕，
 * 比不給更糟。
 *
 * 這一條刻意放在純函式裡：它是「畫面該不該出現這顆按鈕」的唯一判準，而畫面
 * 本身（`registrations.tsx`）拉的 `react-native` 讓它在 Node 測試裡載不進來。
 */
export function correctionTargetFor(
  reg: Registration,
): RegistrationStatusCorrectionTarget | null {
  if (reg.status === "CHECKED_IN") return "CONFIRMED";
  if (reg.status === "CONFIRMED") return "CHECKED_IN";
  return null;
}

/**
 * 一筆報名在管理面板中可做的動作，依目前狀態推導。
 *
 * 順序與 Web 一致：狀態修正在最上方（「更正錯誤」與下面的資料品質操作不是
 * 同一層級），接著才是隱藏與封存。
 */
export function manageActionsFor(reg: Registration): ManageAction[] {
  const actions: ManageAction[] = [];

  // Web 把「更正錯誤」語意排在最上方（`RegistrationActionsMenu` 的註解）。
  if (correctionTargetFor(reg) !== null) {
    actions.push("correct");
  }

  // 押金退款登記：Web 的抽屜 footer 只在 CONFIRMED / CHECKED_IN 提供
  // （`RegistrationDetailDrawer.tsx:628`）。未確認的報名收不到押金，記一筆
  // 退款只會在稽核裡留下一筆沒有對應收款的痕跡。
  if (reg.status === "CONFIRMED" || reg.status === "CHECKED_IN") {
    actions.push("refund");
  }

  // 重寄確認信：只在「確認信應該寄、而且沒寄成」時提供（見
  // `isConfirmationNotDelivered` 的註解）。刻意排在可見性動作**之前**：
  // 隱藏／封存改的是資料，這一項是寄信，兩者不是同一層級的動作。
  if (isConfirmationNotDelivered(reg.emailStatus)) {
    actions.push("resendConfirmation");
  }

  actions.push(reg.isHidden ? "unhide" : "hide");
  actions.push(reg.status === "ARCHIVED" ? "unarchive" : "archive");
  return actions;
}
