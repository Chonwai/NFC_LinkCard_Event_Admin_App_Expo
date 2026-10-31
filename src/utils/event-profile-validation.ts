import { copy } from "@/constants/copy.zh-TW";

/**
 * 「活動資料」表單的驗證——**逐條對齊 Web**。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/profile/page.tsx`。
 * 那一頁**沒有** validate 函式，它靠三個 HTML 屬性把關：
 *
 * | Web 屬性 | 位置 | 等效規則 |
 * | --- | --- | --- |
 * | `<input required>` | `page.tsx:214` | 名稱不得為空字串 |
 * | `<textarea maxLength={500}>` | `page.tsx:230` | 說明不得超過 500 字 |
 * | `<input type="url">` | `page.tsx:343` | 外部網址必須是絕對 URL |
 *
 * 這一支把同一組規則搬到 App，**不多加一條**。三種刻意不加的東西：
 *
 * - **不 trim 名稱**：HTML 的 `required` 只擋空字串，`"   "` 是合法值。加
 *   trim 會擋掉 Web 放行的輸入，那就是「增」。
 * - **不檢查名稱長度上限以外的事**：`MaxLength(120)` 是後端
 *   `UpdateEventDto` 的規則（`@MaxLength(120)`），Web 沒有前端對應屬性——
 *   但超出時後端必定 400，所以 App 提早用**同一句**後端文案擋下，不讓
 *   使用者白跑一趟。訊息文字刻意與後端完全一致（`活動名稱不能超過 120 個字符`）。
 * - **不驗 `eventType` / `status` / `landingPageMode`**：三者是晶片單選，
 *   值域由 `STATUS_OPTIONS` 等常數收斂，使用者不可能送出清單外的值。
 *
 * 為什麼是 pure function：表單驗證是最容易「只在 UI 裡正確」的一段邏輯。
 * 抽成純函式後，`tests/event-profile-validation.test.mjs` 可以直接斷言
 * 「哪些輸入被擋、哪些被放行」，不必渲染整個畫面。
 */

/** 後端 `UpdateEventDto.name` 的 `@MaxLength(120)`。 */
export const PROFILE_NAME_MAX = 120;

/** Web `<textarea maxLength={500}>`。 */
export const PROFILE_DESCRIPTION_MAX = 500;

export type EventProfileField = "name" | "description" | "externalLandingUrl";

export type EventProfileErrors = Partial<Record<EventProfileField, string>>;

export interface EventProfileValues {
  name: string;
  description: string;
  externalLandingUrl: string;
}

/**
 * 對齊 HTML `<input type="url">`：要求「scheme + host」的絕對 URL。
 *
 * 用瀏覽器自己的判定當基準，而不是後端 `@IsUrl()`（validator.js）：後者的
 * `require_protocol` 預設為 `false`，會放行 `example.com`，但 Web 的表單
 * **擋得住**那一個。以較嚴的那一邊為準，才不會出現「App 送得出去、Web 送不
 * 出去」的分岔；反過來（App 比 Web 寬）則會讓使用者撞到一個 Web 上不會發生的
 * 400。
 *
 * 不要求 TLD：`https://localhost` 在瀏覽器是合法的，這裡也放行。後端若真的
 * 擋下，伺服器訊息會原樣顯示給使用者（見 `save()` 的 `getApiErrorMessage`）。
 */
export function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i.test(value);
}

/**
 * 驗證活動資料表單；回傳「欄位 → 錯誤訊息」。
 *
 * 空物件＝通過。呼叫端只有在空物件時才送出 PATCH。
 */
export function validateEventProfile(
  values: EventProfileValues,
): EventProfileErrors {
  const errors: EventProfileErrors = {};

  if (values.name === "") {
    errors.name = copy.profile.nameRequired;
  } else if (values.name.length > PROFILE_NAME_MAX) {
    errors.name = copy.profile.nameTooLong;
  }

  if (values.description.length > PROFILE_DESCRIPTION_MAX) {
    errors.description = copy.profile.descriptionTooLong;
  }

  if (
    values.externalLandingUrl !== "" &&
    !isAbsoluteUrl(values.externalLandingUrl)
  ) {
    errors.externalLandingUrl = copy.profile.externalUrlInvalid;
  }

  return errors;
}

/** 是否有任何欄位未通過。 */
export function hasEventProfileErrors(errors: EventProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}
