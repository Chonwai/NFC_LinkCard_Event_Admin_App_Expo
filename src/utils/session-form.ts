/**
 * 建立／編輯場次的表單邏輯（純函式，供 `sessions.tsx` 與測試共用）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/[eventId]/sessions/page.tsx`
 * 的 `SessionModal.handleSubmit`（`:63-100`）。
 *
 * ## 時間欄位為什麼不是照抄 Web
 *
 * Web 用 `<input type="datetime-local">`，`form.startDate` 是
 * `"YYYY-MM-DDTHH:mm"`（**瀏覽器本地時區的牆上時間**），送出時
 * `new Date(form.startDate).toISOString()`。這一組在瀏覽器上是自洽的。
 *
 * App 沒有 date picker（`@react-native-community/datetimepicker` 不在
 * `package.json`，而本輪不加依賴），只能是文字輸入。若照抄 Web 的
 * `new Date(string)`，解析規則就取決於 JS 引擎——Hermes 對
 * `"2026-11-05 02:00"` 這種非 ISO 字串的處理沒有保證。所以這裡
 * **自己解析**：`parseLocalDateTime` 只接受明確的格式，並用
 * `new Date(y, mo-1, d, h, mi)` 以**本地時區**建構，不經過字串解析。
 *
 * 好處是可測（`tests/session-form.test.mjs` 釘住每一個邊界），
 * 而且「使用者打的是本地時間」這件事變成明示的，不是碰巧。
 *
 * ## 為什麼多了 Web 沒有的數字驗證
 *
 * Web 只擋「標題空」與「時間空」，其餘交給後端。但後端
 * `CreateSessionDto`（`EventSessionController.ts:21-33`）有
 * `capacity @Min(1)`、`tokenCost @Min(0)`——Web 允許使用者填
 * `capacity = 0`（`<input type="number" min="0">`），送出後拿到
 * `400 VALIDATION_ERROR`，而畫面只顯示一句 `errors.general`（「操作失敗」）。
 *
 * App 在送出前就擋下來並說出原因。**這不是新增能力**（那筆資料在 Web 也存不進去），
 * 是把一個必然失敗的請求換成一句看得懂的話——與 `polls.tsx` 把
 * 「載入失敗」與「查無資料」分開是同一個立場。
 *
 * 反過來，**Web 允許的，App 不擋**：例如「結束時間早於開始時間」後端沒有檢查，
 * App 也不檢查。若哪天要加，必須兩邊一起加，否則就是 App 比 Web 嚴格。
 */
import type {
  EventSessionType,
  SessionCreatePayload,
} from "@/types/session.types";

/** 表單狀態。數字一律存成字串（`TextInput` 給的就是字串）。 */
export interface SessionFormInput {
  title: string;
  description: string;
  sessionType: EventSessionType;
  /** 本地牆上時間，格式 `YYYY-MM-DD HH:mm`（見檔頭）。 */
  startDate: string;
  endDate: string;
  location: string;
  speakerName: string;
  capacity: string;
  price: string;
  tokenCost: string;
}

/** 表單錯誤鍵——畫面據此挑 `copy.sessions.errors.*` 的字串。 */
export type SessionFormErrorKey =
  | "titleRequired"
  | "timeRequired"
  | "timeInvalid"
  | "capacityInvalid"
  | "priceInvalid"
  | "tokenCostInvalid";

/**
 * 空白表單。
 *
 * 預設值逐字照 Web：`sessionType: 'WORKSHOP'`、`price: '0'`、`tokenCost: '0'`。
 * 為什麼要有函式而不是常數：常數會被呼叫端共用同一個物件，改一格就改到全部
 * （React 的 state 雖然會換物件，但初始值共用仍然是個陷阱）。
 */
export function emptySessionForm(): SessionFormInput {
  return {
    title: "",
    description: "",
    sessionType: "WORKSHOP",
    startDate: "",
    endDate: "",
    location: "",
    speakerName: "",
    capacity: "",
    price: "0",
    tokenCost: "0",
  };
}

/** `YYYY-MM-DD HH:mm`（容許 `T` 分隔、不容許秒與時區）。 */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

/**
 * 把 `YYYY-MM-DD HH:mm` 解析成**本地時區**的 `Date`；不合法回 `null`。
 *
 * 為什麼不用 `new Date(string)`：非 ISO 字串的解析規則不是規格保證的
 * （見檔頭）。這裡明確拆欄位再用建構子，並用回讀比對擋掉
 * 「2026-02-30」這種會被自動進位的日期——否則 2 月 30 日會靜默變成 3 月 2 日。
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
 * 選填整數的解析結果。
 *
 * 為什麼用判別式而不是「回 `null` 代表不限、回 `undefined` 代表錯誤」：
 * 那種雙重哨兵值要靠 `undefined as never` 之類的斷言才寫得出來，
 * 而斷言正好會讓 `tsc` 對這個最需要檢查的地方閉嘴。
 */
type OptionalIntResult = { ok: true; value: number | null } | { ok: false };

/** 空字串視為「不限」→ `{ ok: true, value: null }`；其餘必須是整數且 ≥ `min`。 */
function parseOptionalInt(value: string, min: number): OptionalIntResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };

  // 只接受純整數字串：`Number("1e3")`、`"12.5"`、`" 12 "` 一律不接受，
  // 因為後端 `@IsInt()` 對小數也會擋。
  if (!/^-?\d+$/.test(trimmed)) return { ok: false };

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < min) return { ok: false };
  return { ok: true, value: parsed };
}

/**
 * 表單的第一個錯誤；合法回 `null`。
 *
 * 順序與 Web 一致（標題 → 時間），後面才是 App 補的數字檢查。
 */
export function sessionFormError(
  form: SessionFormInput,
): SessionFormErrorKey | null {
  if (form.title.trim().length === 0) return "titleRequired";
  if (form.startDate.trim().length === 0) return "timeRequired";
  if (form.endDate.trim().length === 0) return "timeRequired";

  if (parseLocalDateTime(form.startDate) == null) return "timeInvalid";
  if (parseLocalDateTime(form.endDate) == null) return "timeInvalid";

  if (!parseOptionalInt(form.capacity, 1).ok) return "capacityInvalid";

  const price = form.price.trim();
  if (price.length > 0) {
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return "priceInvalid";
  }

  if (!parseOptionalInt(form.tokenCost, 0).ok) return "tokenCostInvalid";

  return null;
}

/**
 * 表單 → `POST`／`PATCH` 的 body；不合法回 `null`（呼叫端據此不送出）。
 *
 * ## 空字串一律送 `null`，不是省略
 *
 * 後端 `updateSession` 是 `input.x !== undefined` 語意：送 `null` ＝**清空**，
 * 不送 ＝**原封不動**。Web 也是送 `null`（`form.location || null`）。
 * 若這裡改成省略，「把主講人清掉」就永遠做不到，而且不會報錯。
 *
 * ## `capacity`／`price` 的空字串
 *
 * 兩者送到後端都是 `null`（＝不限／未設定），與 Web 的
 * `form.capacity ? Number(form.capacity) : null` 同一個結果。
 * 差別只在 App 會先擋掉 `0` 與小數（見檔頭）。
 */
export function toSessionPayload(
  form: SessionFormInput,
): SessionCreatePayload | null {
  if (sessionFormError(form) != null) return null;

  const start = parseLocalDateTime(form.startDate);
  const end = parseLocalDateTime(form.endDate);
  // 上面已驗過，這裡只是型別收斂。
  if (start == null || end == null) return null;

  const capacity = parseOptionalInt(form.capacity, 1);
  const tokenCost = parseOptionalInt(form.tokenCost, 0);
  if (!capacity.ok) return null;
  if (!tokenCost.ok) return null;

  const priceText = form.price.trim();

  return {
    title: form.title.trim(),
    description: form.description.trim().length > 0 ? form.description : null,
    sessionType: form.sessionType,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    location: form.location.trim().length > 0 ? form.location : null,
    speakerName: form.speakerName.trim().length > 0 ? form.speakerName : null,
    capacity: capacity.value,
    price: priceText.length > 0 ? Number(priceText) : null,
    tokenCost: tokenCost.value ?? 0,
  };
}
