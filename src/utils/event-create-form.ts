/**
 * 建立活動的表單邏輯（純函式，供 `app/(auth)/new-event.tsx` 與測試共用）。
 *
 * 前端 counterpart：`LinkCard_Frontend/app/(event)/manage/events/page.tsx`
 * 的 `CreateEventModal`（`:44-263`）。
 *
 * ## 欄位為什麼是七個
 *
 * Web 的表單狀態（`page.tsx:50-58`）就是這七個：`name`、`slug`、
 * `description`、`startDate`、`endDate`、`timezone`、`eventType`。
 * 這一頁是**唯一**寫得到 `startDate` / `endDate` 的地方——Web 的「活動資料」
 * 頁（`manage/[eventId]/profile/page.tsx`）沒有時間欄位，App 的 `profile.tsx`
 * 也照此辦理。若在這裡少一個，活動就永遠建不出來；多一個，就等於多開一條
 * Web 沒有的寫入路徑。
 *
 * ## 時間為什麼不是照抄 Web
 *
 * Web 用 `<input type="datetime-local">`，`form.startDate` 是
 * `"YYYY-MM-DDTHH:mm"`（**瀏覽器本地時區的牆上時間**），送出時
 * `new Date(form.startDate).toISOString()`。這一組在瀏覽器上是自洽的。
 *
 * App 沒有 date picker（`@react-native-community/datetimepicker` 不在
 * `package.json`，本輪不加依賴），只能是文字輸入。若照抄 Web 的
 * `new Date(string)`，解析規則就取決於 JS 引擎——Hermes 對
 * `"2026-11-05 02:00"` 這種非 ISO 字串的處理沒有保證。
 *
 * 所以這裡用 `utils/local-date-time.parseLocalDateTime`：它明確拆欄位、
 * 以**本地時區**建構、並擋掉「2026-02-30」這種會被自動進位的日期。
 * 同一支函式原本只服務場次表單，`CR-D4` 的理由把它搬成了共用 util。
 *
 * ## `slug` 自動產生的那個小毛病，是照抄的
 *
 * Web 的 `handleNameChange`（`page.tsx:60-67`）用 `/[^\w\s-]/g` 過濾，
 * 而 JS 的 `\w` **包含底線**；它的 `validate()` 卻要求 `/^[a-z0-9-]+$/`，
 * 底線不合法。於是「Startup_Fest」會自動產生一個自己的驗證器不收的
 * `startup_fest`，使用者得手動改掉。
 *
 * 這是一個 Web 端的小毛病，但**照抄**才是對的：兩邊若要修，必須一起修；
 * App 自己「順手修好」會變成 App 放行一個 Web 擋住的值。`slugFromName`
 * 因此逐字保留 Web 的正規表達式，並由 `tests/event-create-form.test.mjs`
 * 把這個行為釘住——讓它是「已知且一致」，而不是「碰巧」。
 */
import type { CreateEventPayload, EventType } from "@/types/api.types";
import { parseLocalDateTime } from "@/utils/local-date-time";

/** Web `page.tsx:33` 的 `TIMEZONES`，順序與值都相同。 */
export const CREATE_EVENT_TIMEZONES = [
  "Asia/Macau",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Singapore",
] as const;

export type CreateEventTimezone = (typeof CREATE_EVENT_TIMEZONES)[number];

/** Web `page.tsx:34` 的 `EVENT_TYPES`。 */
export const CREATE_EVENT_TYPES: readonly EventType[] = [
  "EXHIBITION",
  "CONFERENCE",
  "WORKSHOP_SERIES",
  "MEETUP",
  "OTHER",
];

/** Web 的 `useState` 初始值：`timezone: 'Asia/Macau'`、`eventType: 'EXHIBITION'`。 */
export const CREATE_EVENT_DEFAULT_TIMEZONE: CreateEventTimezone = "Asia/Macau";
export const CREATE_EVENT_DEFAULT_TYPE: EventType = "EXHIBITION";

/** 後端 `CreateEventDto.name` 的 `@MaxLength(120)`。 */
export const CREATE_EVENT_NAME_MAX = 120;

/** 後端 `CreateEventDto.slug` 的 `@MaxLength(80)`。 */
export const CREATE_EVENT_SLUG_MAX = 80;

/** Web `<textarea maxLength={500}>`。 */
export const CREATE_EVENT_DESCRIPTION_MAX = 500;

/**
 * Web `handleNameChange` 的 `slice(0, 60)`。
 *
 * 刻意比後端上限（80）小：Web 自己留了 20 個字元給使用者手動補，
 * App 不該在這個數字上和它分岔。
 */
const SLUG_AUTO_MAX = 60;

/** 表單狀態。所有欄位都是字串（`TextInput` 給的就是字串）。 */
export interface CreateEventFormInput {
  name: string;
  slug: string;
  description: string;
  /** 本地牆上時間，格式 `YYYY-MM-DD HH:mm` 或 `YYYY-MM-DDTHH:mm`。 */
  startDate: string;
  endDate: string;
  timezone: CreateEventTimezone;
  eventType: EventType;
}

/**
 * 空白表單。
 *
 * 為什麼是函式而不是常數：常數會被呼叫端共用同一個物件，改一格就改到全部。
 * 預設值逐字照 Web：`timezone: 'Asia/Macau'`、`eventType: 'EXHIBITION'`，
 * 其餘空字串。
 */
export function emptyCreateEventForm(): CreateEventFormInput {
  return {
    name: "",
    slug: "",
    description: "",
    startDate: "",
    endDate: "",
    timezone: CREATE_EVENT_DEFAULT_TIMEZONE,
    eventType: CREATE_EVENT_DEFAULT_TYPE,
  };
}

/**
 * 由活動名稱推出 slug——**逐字照抄** Web `handleNameChange`
 * （`manage/events/page.tsx:60-67`）。
 *
 * 保留 `\w` 的底線行為是刻意的，理由見檔頭「`slug` 自動產生的那個小毛病」。
 *
 * 第二個同樣是照抄的現象：`\w` 不含中文，所以「活動 StartupFest」的「活動」
 * 整段被刪掉、開頭那個空白接著被換成 `-`，得到 `-startupfest`。它**過得了**
 * `/^[a-z0-9-]+$/`（單一個前導 `-` 合法），因此不會被擋，只是不漂亮。
 */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, SLUG_AUTO_MAX);
}

/**
 * 表單 → `POST /api/v1/events` 的 body。
 *
 * 兩個時間欄位解析不了就回 `null`（呼叫端據此不送出）。這不是「驗證」——
 * 驗證（哪一格錯、錯在哪句話）在 `createEventFormErrors`；這裡只回答
 * 「這個表單現在能不能組出一個合法 body」。
 *
 * 欄位順序與 Web 的 `createEvent({...})` 呼叫（`page.tsx:79-87`）一致，
 * 空白的 `description` 轉 `undefined`（照抄 Web 的 `form.description || undefined`）
 * ——後端 `description` 是 `@IsOptional()`，送空字串會存成空字串而不是 null。
 */
export function toCreateEventPayload(
  form: CreateEventFormInput,
): CreateEventPayload | null {
  const startDate = parseLocalDateTime(form.startDate);
  const endDate = parseLocalDateTime(form.endDate);
  if (startDate == null || endDate == null) return null;

  return {
    name: form.name,
    slug: form.slug,
    description: form.description || undefined,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    timezone: form.timezone,
    eventType: form.eventType,
  };
}

// ---------------------------------------------------------------------------
// 驗證（逐條對齊 Web `CreateEventModal.validate`，`page.tsx:64-75`）
// ---------------------------------------------------------------------------

/** 有錯誤時要標紅的欄位。`description` / `timezone` / `eventType` 不在其中。 */
export type CreateEventField = "name" | "slug" | "startDate" | "endDate";

/**
 * 錯誤鍵 → `copy.createEvent.errors.*`。
 *
 * `slugConflict` 不是前端驗證產生的（那只可能來自後端 409），但 Web 也把它
 * 打在 slug 欄位上，所以共用同一張表。
 */
export type CreateEventErrorKey =
  | "nameMin"
  | "nameMax"
  | "slugRequired"
  | "slugFormat"
  | "startDateRequired"
  | "endDateRequired"
  | "endDateBeforeStart"
  | "dateFormat"
  | "slugConflict";

/** 欄位 → 錯誤鍵。空物件＝通過。 */
export type CreateEventFormErrors = Partial<
  Record<CreateEventField, CreateEventErrorKey>
>;

/** Web `validate()` 的 `/^[a-z0-9-]+$/`。 */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * 驗證建立表單；回傳「欄位 → 錯誤鍵」。空物件＝通過。
 *
 * ## 與 Web 的對應（逐條）
 *
 * | Web `validate()`（`page.tsx:64-75`） | 這裡 |
 * | --- | --- |
 * | `!form.name \|\| name.length < 2` → `nameMin` | 同 |
 * | `name.length > 120` → `nameMax` | 同 |
 * | `!form.slug` → `slugRequired` | 同 |
 * | `!/^[a-z0-9-]+$/.test(slug)` → `slugFormat` | 同 |
 * | `!form.startDate` → `startDateRequired` | 同 |
 * | `!form.endDate` → `endDateRequired` | 同 |
 * | `endDate < startDate` → `endDateBeforeStart` | 同（見下） |
 *
 * **沒有增減任何一條會擋人的規則。**
 *
 * ## 三個刻意保留的 Web 行為
 *
 * 1. **`nameMin` 與 `nameMax` 是兩個獨立 `if`，不是 `else if`**。所以 121 字的
 *    名稱會先被判 `nameMin` 不了（長度 ≥ 2），再被 `nameMax` 蓋掉——結果是
 *    `nameMax`。照抄，不改成 `else if`。
 * 2. **`slugRequired` 在 Web 是走不到的分支**。slug 為空時兩個 `if` 都成立，
 *    後面的 `slugFormat` 覆蓋前面的 `slugRequired`。這裡**照樣保留這個覆蓋**
 *    （也因此保留一條走不到的鍵），理由：若 App 單邊改成 `else if`，同一個
 *    輸入在兩邊會顯示不同句子，對等審查時就是一條新的分岔。要修必須兩邊一起修。
 * 3. **順序比較用解析後的時間，不是字串比較**。Web 比的是
 *    `form.endDate < form.startDate`（兩個 `datetime-local` 的字串），
 *    那種字典序只在 `YYYY-MM-DDTHH:mm` 這個格式下才會剛好等於時間順序。
 *    App 的輸入允許空白分隔（`YYYY-MM-DD HH:mm`），`T`（0x54）與空白（0x20）
 *    混用時字典序會錯，所以先解析再比 `getTime()`。**擋下來的輸入集合相同**
 *    （`<` 而非 `<=`，所以「同時結束」仍然放行，與 Web 一致）。
 *
 * ## 一條 App 專屬、Web 不可能產生的規則
 *
 * `dateFormat`：時間字串解析不了。Web 用 `<input type="datetime-local">`，
 * 瀏覽器保證值一定是合法時間，所以 Web 沒有、也不需要這條。App 是文字輸入，
 * 使用者可以打 `2026-13-45`。這種值後端 `@IsDateString()` 必定 400，
 * 提前擋下來不是「App 比 Web 嚴」，而是把一個必然失敗的請求換成一句看得懂的話
 * （與 `session-form.ts` 的 `timeInvalid` 同一個立場）。
 */
export function createEventFormErrors(
  form: CreateEventFormInput,
): CreateEventFormErrors {
  const errors: CreateEventFormErrors = {};

  // 名稱：兩個獨立 if，順序決定覆蓋（照 Web）。
  if (form.name === "" || form.name.length < 2) errors.name = "nameMin";
  if (form.name.length > CREATE_EVENT_NAME_MAX) errors.name = "nameMax";

  // slug：同上。空字串會被下一行覆蓋成 slugFormat，這是 Web 的既有行為。
  if (form.slug === "") errors.slug = "slugRequired";
  if (!SLUG_PATTERN.test(form.slug)) errors.slug = "slugFormat";

  // 兩個時間欄位的必填（照 Web 的兩條獨立 if）。
  if (form.startDate === "") errors.startDate = "startDateRequired";
  if (form.endDate === "") errors.endDate = "endDateRequired";

  // App 專屬：有填但解析不了。
  const start =
    form.startDate === "" ? null : parseLocalDateTime(form.startDate);
  const end = form.endDate === "" ? null : parseLocalDateTime(form.endDate);
  if (form.startDate !== "" && start == null) errors.startDate = "dateFormat";
  if (form.endDate !== "" && end == null) errors.endDate = "dateFormat";

  // 先後順序：兩邊都解析得出來才比。嚴格小於——同時結束是合法的。
  if (start != null && end != null && end.getTime() < start.getTime()) {
    errors.endDate = "endDateBeforeStart";
  }

  return errors;
}

/** 是否有任何欄位未通過。 */
export function hasCreateEventErrors(errors: CreateEventFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
