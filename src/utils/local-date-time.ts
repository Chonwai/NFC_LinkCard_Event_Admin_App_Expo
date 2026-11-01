/**
 * 本地牆上時間 ↔ `Date` 的轉換（純函式）。
 *
 * ## 為什麼這兩個函式從 `session-form.ts` 搬出來
 *
 * `parseLocalDateTime` 原本只服務「場次」表單。建立活動的表單同樣有兩個
 * 時間欄位，而 Web 在兩邊用的都是 `<input type="datetime-local">`；App 沒有
 * date picker（`@react-native-community/datetimepicker` 不在 `package.json`），
 * 只能是文字輸入，因此需要**同一套**解析規則。
 *
 * 這支函式裡的每一條規則都是踩過才知道要寫的：不存在的日期不得靜默進位
 * （`2026-02-30` 會被 JS 自動變成 3 月 2 日）、`T` 與空白兩種分隔都要接受
 * （Web 的 `datetime-local` 給的是 `T`，使用者手打通常是空白）、一律以
 * **本地時區**建構而不是交給字串解析。複製一份到活動表單會讓這組規則有兩個
 * 副本，日後只有一邊被修——那正是 `CR-D4`（平行模組不一致）要擋的事。
 *
 * 搬遷是**純移動**：`session-form.ts` 原樣 re-export 這兩個名字，
 * `tests/session-form.test.mjs` 與 `sessions.tsx` 的 import 都不用改，
 * 既有測試因此可以直接當成「搬家沒搬壞」的證據。
 */

/** `YYYY-MM-DD HH:mm`（容許 `T` 分隔、不容許秒與時區）。 */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/**
 * 把 `YYYY-MM-DD HH:mm` 解析成**本地時區**的 `Date`；不合法回 `null`。
 *
 * 為什麼不用 `new Date(string)`：非 ISO 字串的解析規則不是規格保證的
 * （Hermes 對 `"2026-11-05 02:00"` 的處理沒有保證）。這裡明確拆欄位再用
 * 建構子，並用回讀比對擋掉「2026-02-30」這種會被自動進位的日期——否則
 * 2 月 30 日會靜默變成 3 月 2 日。
 */
export function parseLocalDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (match == null) return null;

  const [, year, month, day, hour, minute] = match;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);

  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (h > 23) return null;
  if (mi > 59) return null;

  const parsed = new Date(y, mo - 1, d, h, mi, 0, 0);

  // 自動進位偵測（2/30 → 3/2）：任何一個欄位回讀不一致就不是使用者打的那天。
  if (parsed.getFullYear() !== y) return null;
  if (parsed.getMonth() !== mo - 1) return null;
  if (parsed.getDate() !== d) return null;

  return parsed;
}

/**
 * `Date` → `YYYY-MM-DD HH:mm`（本地時區）。
 *
 * 為什麼需要它：編輯表單要把後端回的 ISO 字串**還原成使用者當初打的那個
 * 牆上時間**。若照 Web 的 `session.startDate.slice(0, 16)`
 * （`sessions/page.tsx:57-58`），得到的是 **UTC** 的前 16 個字元——
 * 在 UTC+8 的活動上，編輯一個 10:00 的場次會看到 02:00。
 * Web 因為 `datetime-local` 會把那個字串當**本地時間**再解析，
 * 所以「顯示 02:00、存回 02:00 本地」等於整體位移 8 小時。
 * App 沒有 `datetime-local`，所以必須自己走正確的路：先 `Date`，再取本地欄位。
 */
export function formatLocalDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(" ");
}
