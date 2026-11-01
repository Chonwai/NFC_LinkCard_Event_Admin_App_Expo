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
 * 驗證（哪一格錯、錯在哪句話）在 `createEventFormError`；這裡只回答
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
