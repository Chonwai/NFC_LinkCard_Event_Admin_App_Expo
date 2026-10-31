import type {
  Registration,
  RegistrationStatusCorrectionTarget,
} from "@/types/api.types";

/**
 * 名單管理可執行的動作。對應 Web `registrations/page.tsx` 的
 * `RegistrationActionsMenu`：狀態修正、隱藏／取消隱藏、封存／取消封存。
 */
export type ManageAction =
  "hide" | "unhide" | "archive" | "unarchive" | "correct";

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
  const actions: ManageAction[] = [
    reg.isHidden ? "unhide" : "hide",
    reg.status === "ARCHIVED" ? "unarchive" : "archive",
  ];
  if (correctionTargetFor(reg) !== null) {
    actions.unshift("correct");
  }
  return actions;
}
