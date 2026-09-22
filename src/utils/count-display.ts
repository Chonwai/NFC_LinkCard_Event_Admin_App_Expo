import { copy } from "@/constants/copy.zh-TW";

/**
 * 數量類欄位的顯示轉換：`null`／`undefined` 代表「未知」，顯示破折號。
 *
 * `0` 與「不知道」在現場是兩件不同的事：前者是真的沒有參展商，後者只是這支
 * 回應沒帶這個欄位（`ManagedEventItem.registrationCount` / `exhibitorCount`
 * 都是 optional）。寫成 `value ?? 0` 會把後者講成前者，操作者無法分辨
 * 「真的掛零」與「我們沒拿到資料」（`NEW-D2-03`）。
 *
 * 與活動概覽 Token 卡「未知 ≠ 零」是同一套慣例（`CRA-V1-015`），故共用
 * `copy.event.dash`。抽為共用模組的原因：活動列表與活動概覽要顯示同一個
 * 欄位，先前兩邊各寫一次推導。若日後有非活動類畫面要用，再為它開對應
 * namespace 的 dash 鍵，不要在此改字串。
 */
export function formatCount(value: number | null | undefined): string {
  return value == null ? copy.event.dash : String(value);
}

/**
 * 破折號的說明文字（`CRA-V1-002`）。
 *
 * `formatCount` 把「未知」畫成破折號，但破折號本身讀不出原因：操作者分不出
 * 「真的掛零」與「這個數字沒拿到」。`check-in.tsx` 的總簽到計數已經有這條規則
 * （`getCheckInCounterHint`），活動列表與活動概覽卻還是裸的破折號——同一條慣例
 * 在三個畫面上只落實了一個。
 *
 * 回傳 `null` 代表這一屏不會出現破折號，呼叫端據此不渲染說明行；全部已知時
 * 多一行說明只是雜訊。真值 `0` 不算未知，與 `formatCount` 同一條判準。
 */
export function getCountUnavailableHint(
  ...values: (number | null | undefined)[]
): string | null {
  return values.some((value) => value == null)
    ? copy.event.countUnavailableHint
    : null;
}
