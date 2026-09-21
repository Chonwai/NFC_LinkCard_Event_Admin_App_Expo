/**
 * 活動列表的顯示階段（`F-02`）。
 *
 * `useEventStore.loadEvents()` **不 rethrow**——它把失敗收進 `state.error`，
 * `events` 留在空陣列。因此「先判空、後判錯誤」會讓載入失敗與真的沒有活動
 * 顯示成同一句話（`docs/evidence/UI-REVIEW/32-home-error.txt` 對 `31-home-empty`），
 * 而 `copy.home.loadFailed` 這個字串在畫面上永遠不可達。
 *
 * **判定順序即語義**：這裡把順序寫成程式碼，讓「先錯誤、後空」變成可測的性質，
 * 而不是散落在 JSX 三元運算式裡的隱含假設。
 */
export type EventListPhase = "loading" | "error" | "empty" | "list";

export function getEventListPhase(input: {
  loading: boolean;
  error: string | null;
  count: number;
}): EventListPhase {
  /**
   * 已經有資料就先畫資料。重新整理失敗時舊清單仍然有效，此時把清單換成
   * 錯誤畫面反而是退步——失敗由橫幅另外表達（呼叫端判斷 `error != null`）。
   */
  if (input.count > 0) {
    return "list";
  }

  /** 載入中不得顯示空狀態（既有凍結規則：載入一律 Skeleton）。 */
  if (input.loading) {
    return "loading";
  }

  return input.error != null ? "error" : "empty";
}
