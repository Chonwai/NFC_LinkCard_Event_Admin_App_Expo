import type { EventManageStats } from "@/types/api.types";

/** 活動概覽要顯示的兩個報名數字。 */
export interface RegistrationCounts {
  total: number | null;
  checkedIn: number | null;
}

/**
 * `manage-stats` 回應 → 活動概覽的「報名總數 / 已報到」。
 *
 * ## 為什麼獨立成模組
 *
 * 這段推導原本長在 `app/(auth)/[eventId]/overview.tsx` 的 `useEffect` 裡，而
 * AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），驗收只能靠
 * 「讀原始碼比對字串」——抓得到整段被刪，抓不到等價重寫與邊界行為。與
 * `desk-handoff.ts` 同一個理由搬到 util 層。
 *
 * ## 計數判準：「缺 key」不等於「0」
 *
 * - `registrations.total` 缺 → 退回呼叫端手上已知的總數（`my-managed` 的
 *   `_meta.registrationCount`，見 `event.service.getMyManagedEvents`）；那個也沒有
 *   就是 `null`（顯示破折號 + 原因）。
 * - `byStatus.CHECKED_IN` 缺 → **`null`，不是 `0`**。
 *
 * 第二條看似與 Web 相反（`FE:app/(event)/manage/[eventId]/page.tsx` 用
 * `?? 0`），但不衝突：Web 那裡 `stats === null`（未載入／失敗）才畫 `—`，
 * 已載入時缺 key 確實等於 0 筆。這裡的輸入**只有**「已載入的回應」，缺 key 的
 * 可能原因有兩種——「該狀態真的 0 筆」與「後端回應形狀不合預期」——在這個位置
 * 分不出來。顯示破折號並附上「未取得」說明，比謊報 0 誠實；這也是
 * `count-display.ts` 與 `CRA-V1-002` 的既有慣例。
 *
 * ## 為什麼 total 不用 byStatus 加總
 *
 * BE 已經給 `total`（`EventService.getManageStats` 直接加總 groupBy 結果），
 * 前端再加總一次只會多一個可能算錯的地方。
 */
export function deriveRegistrationCounts(
  stats: EventManageStats | null | undefined,
  fallbackTotal: number | null,
): RegistrationCounts {
  const registrations = stats?.registrations;

  return {
    total: registrations?.total ?? fallbackTotal ?? null,
    checkedIn: registrations?.byStatus?.CHECKED_IN ?? null,
  };
}
