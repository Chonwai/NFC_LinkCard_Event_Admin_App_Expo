/**
 * 名單篩選條件的**收斂**（What the screen holds → What the API gets）。
 *
 * 為什麼要一個純函式：畫面上的選單值域與後端查詢參數的值域**不一樣**。
 *   - 票種選單：`all` ＋ 各票種 id；後端只認 `ticketTypeId=<id>`
 *   - 押金退款選單：`all | refunded | not_refunded`；後端雖然接受 `all`
 *     （`EventRegistrationController.ts:130-146`），但 Web 的做法是
 *     **不送**——送 `all` 等於把「不篩」寫成一條實際條件，日後後端收緊
 *     值域就會 400。
 *   - 狀態選單：`''` 代表全部，不能送空字串。
 *   - 可見性：**一定**要送（預設 `active`），因為「不送」在後端等於
 *     預設那條分支，但把它寫明才看得出來這一頁在排除 hidden/archived。
 *
 * 這些規則放在畫面裡就只能靠人記住；拉出來之後，`tests/registration-filters`
 * 可以逐條斷言。
 */

/** 可見性選單值域（與後端 `visibility` 同一個集合）。 */
export type RegistrationVisibility = "all" | "active" | "hidden" | "archived";

/** 押金退款選單值域。 */
export type DepositRefundFilter = "all" | "refunded" | "not_refunded";

/** 畫面持有的篩選狀態。`all` / 空字串代表「不篩」。 */
export interface RegistrationFilterState {
  status: string;
  ticketTypeId: string;
  visibility: RegistrationVisibility;
  depositRefunded: DepositRefundFilter;
}

/** 送給 `GET /registrations` 的查詢參數。 */
export interface RegistrationListQuery {
  status?: string;
  ticketTypeId?: string;
  visibility?: RegistrationVisibility;
  depositRefunded?: Exclude<DepositRefundFilter, "all">;
}

export const DEFAULT_REGISTRATION_FILTERS: RegistrationFilterState = {
  status: "",
  ticketTypeId: "all",
  visibility: "active",
  depositRefunded: "all",
};

/** 篩選狀態 → 查詢參數。省略所有「不篩」的值，可見性永遠送出。 */
export function buildRegistrationListQuery(
  filters: RegistrationFilterState,
): RegistrationListQuery {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.ticketTypeId !== "all"
      ? { ticketTypeId: filters.ticketTypeId }
      : {}),
    visibility: filters.visibility,
    ...(filters.depositRefunded !== "all"
      ? { depositRefunded: filters.depositRefunded }
      : {}),
  };
}
