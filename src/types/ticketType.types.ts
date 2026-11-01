/**
 * 票種（`EventTicketType`）型別 — parity `ticket-types`。
 *
 * 前端 counterpart：
 * - `LinkCard_Frontend/lib/events/types.ts:434` 的 `TicketType`
 * - `LinkCard_Frontend/lib/events/ticket-types.ts:23` 的 `AdminTicketType`
 * - `LinkCard_Frontend/lib/events/ticket-types.ts:37` 的 `CreateTicketTypePayload`
 *
 * **逐字照 Web 建模，不多也不少**——少一個欄位就讀不到後端回的資料，
 * 多一個欄位就會有人「順手補齊」送進 PATCH。
 *
 * ## 為什麼獨立成一個檔案而不是塞回 `api.types.ts`
 *
 * 這裡有三件必須寫在型別旁邊的事，塞進 800 行的宿主檔會沒有人看到：
 *
 * 1. **`price` 的單位**（見下）。
 * 2. **`capabilities` 與 `capabilitiesOverride` 不是同一件事**（見下）。
 * 3. **`formFieldsJson` 是使用者可編輯的 JSON，不是後端算出來的**。
 *
 * 同 `poll.types.ts` 的分檔理由：`api.types.ts` 是匯入宿主，不是方法論所在。
 *
 * ## `price` 的單位（查證結果，不是猜的）
 *
 * 後端 `prisma/schema.prisma:736` 是 `price Decimal @db.Decimal(10, 2)`，
 * DTO（`dtos/event-ticket-type.dto.ts:35-39`）是
 * `@IsNumber({ maxDecimalPlaces: 2 }) @Min(0)`。
 *
 * 結論：**`price` 是「幣別單位金額」，不是「分」**，允許小數最多兩位，
 * 幣別由 `currency` 決定（DB 預設 `MOP`）。因此：
 *
 * - **不做「元 → 分」換算**。把 `1500` 換成 `150000` 再送出去，後端會照收，
 *   但那是一萬五千元——這正是「自己把它改成整數」的災難。
 * - `Decimal` 經 JSON 序列化後是**字串**（Web 的 `TicketType.price: string`
 *   就是這個原因），所以型別是 `string`，不是 `number`。
 * - 送出去的時候也維持字串：後端 `@Type(() => Number)` 會轉，Web 送的也是
 *   字串。App 改成送 `number` 會是「多送了一種 Web 沒送過的 wire 形狀」。
 *
 * ## `capabilities` vs `capabilitiesOverride`
 *
 * 後端 `EventTicketTypeService.withResolvedCapabilities()`（`:216-237`）會把
 * 兩個都回傳：
 *
 * - `capabilities`＝**實際生效**的權益（後端已解析完：覆寫 ?? 依
 *   `registrantType` 的預設）。
 * - `capabilitiesOverride`＝**原始覆寫值**；`null` 代表「繼承」，管理端編輯器
 *   要回填的是這一個。
 *
 * 編輯器若拿 `capabilities` 回填，任何一次存檔都會把「繼承」變成「明確覆寫」
 * ——之後後端調整預設值時，這張票不會跟著動，而且畫面上完全看不出來。
 */

// ---------------------------------------------------------------------------
// 封閉值集（照後端 enum／常數逐字抄，順序也照抄）
// ---------------------------------------------------------------------------

/** 後端 `prisma/schema.prisma:343` 的 `enum RegistrantType`。 */
export const REGISTRANT_TYPES = [
  "ATTENDEE",
  "EXHIBITOR_REP",
  "SPEAKER",
  "SPONSOR",
  "MEDIA",
  "GUEST",
  "VOLUNTEER",
] as const;

export type RegistrantType = (typeof REGISTRANT_TYPES)[number];

/**
 * 後端 `prisma/schema.prisma:353` 的 `enum EventPaymentMethod`。
 *
 * Web 的票種頁只開放 `FREE` 與 `BANK_TRANSFER` 兩個可選
 * （`ticket-types/page.tsx:53` 的 `ENABLED_PAYMENT_METHODS`）；其餘三個是
 * 後端支援、但主辦端在這一頁不提供。App 照抄同一份可選清單，不自行放寬。
 */
export const EVENT_PAYMENT_METHODS = [
  "STRIPE",
  "BANK_TRANSFER",
  "FREE",
  "TOKEN",
  "OFFLINE_CASH",
] as const;

export type EventPaymentMethod = (typeof EVENT_PAYMENT_METHODS)[number];

/** Web 票種頁實際開放勾選的付款方式（`page.tsx:53`，逐字照抄）。 */
export const ENABLED_PAYMENT_METHODS = ["FREE", "BANK_TRANSFER"] as const;

/**
 * Web 票種頁的幣別 `<select>`（`page.tsx:896-900`，逐字照抄四個值）。
 *
 * App 用自由輸入就比 Web 多了一种能力（可以打 TWD），那是「增」。
 * 後端 `currency` 只是一偏 `String @MaxLength(8)`，沒有任何限制——
 * 這裡的限制是為了對齊 Web，不是後端要求。
 */
export const TICKET_CURRENCIES = ["MOP", "HKD", "USD", "CNY"] as const;

/** 上面的元素型別。刻意保留字面型別：UI 的 `labelFor` 要用它去索引標籤表，
 * 放寬成 `EventPaymentMethod` 就索引不到 `STRIPE` 等三個沒有中文名的值。 */
export type EnabledPaymentMethod = (typeof ENABLED_PAYMENT_METHODS)[number];

/**
 * 後端 `src/events/constants/ticketCapabilities.ts:28` 的 `TICKET_CAPABILITIES`。
 *
 * 這是封閉集合，由程式碼擁有、不開放主辦方自訂。順序也是契約的一部分：
 * 後端 `normalizeCapabilities()` 會依這個順序排序後才存檔。
 */
export const TICKET_CAPABILITIES = [
  "NETWORKING",
  "EXHIBITOR_DIRECTORY",
  "LEADS",
  "WALLET",
  "SESSIONS",
  "POLLS",
] as const;

export type TicketCapability = (typeof TICKET_CAPABILITIES)[number];

/**
 * 後端 `DEFAULT_CAPABILITIES_BY_REGISTRANT`（`ticketCapabilities.ts:63`）
 * 的鏡像。
 *
 * 只在**顯示**時用到：編輯器要能說「目前這張票的權益是繼承來的，繼承的值是
 * 這些」。真正存進 DB 的值由後端決定，App 不重算也不回寫。
 *
 * ⚠️ 與後端漂移時會說謊（畫面顯示的繼承值與實際生效值不同）。所以
 * `tests/ticket-type-capabilities.test.mjs` 直接讀後端常數檔比對，
 * 不靠人記得同步。
 */
export const DEFAULT_CAPABILITIES_BY_REGISTRANT: Record<
  RegistrantType,
  readonly TicketCapability[]
> = {
  ATTENDEE: ["EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
  EXHIBITOR_REP: [
    "NETWORKING",
    "EXHIBITOR_DIRECTORY",
    "LEADS",
    "WALLET",
    "SESSIONS",
    "POLLS",
  ],
  SPEAKER: ["NETWORKING", "EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
  SPONSOR: [
    "NETWORKING",
    "EXHIBITOR_DIRECTORY",
    "LEADS",
    "WALLET",
    "SESSIONS",
    "POLLS",
  ],
  MEDIA: ["NETWORKING", "EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
  GUEST: ["NETWORKING", "EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
  VOLUNTEER: ["EXHIBITOR_DIRECTORY", "WALLET", "SESSIONS", "POLLS"],
};

// ---------------------------------------------------------------------------
// 報名表單 schema（只建模到「驗證語意綁定」所需的欄位）
// ---------------------------------------------------------------------------

/** Web `types.ts:172`，逐字照抄。 */
export type LocalizedText = string | Record<string, string>;

/** Web `types.ts:174` 的 `RegistrationFieldType`。 */
export type RegistrationFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi-select"
  | "file"
  | "checkbox"
  | "date"
  | "pricing-select"
  | "section-title";

/** Web `types.ts:185` 的 `RegistrationFieldOption`。 */
export interface RegistrationFieldOption {
  value: string;
  label?: LocalizedText;
  price?: number | string;
  deposit?: number | string;
  currency?: string;
  badge?: LocalizedText;
  description?: LocalizedText;
}

/** Web `types.ts:195` 的 `RegistrationDynamicField`。 */
export interface RegistrationDynamicField {
  key: string;
  type: RegistrationFieldType;
  required?: boolean;
  label?: LocalizedText;
  description?: LocalizedText;
  placeholder?: LocalizedText;
  text?: LocalizedText;
  options?: RegistrationFieldOption[];
  priceField?: boolean;
  accept?: string;
  maxLength?: number;
  /** A2 語義綁定：這個欄位承載哪一種身分語義。 */
  semanticKey?: string;
  /** Other 選項支援（Google Forms `hasOtherOption` 藍本）。 */
  allowOther?: boolean;
  otherLabel?: LocalizedText;
  otherPlaceholder?: LocalizedText;
}

/**
 * Web `types.ts:236` 的 `RegistrationFormSchema`。
 *
 * `style` 是報名表外觀（`FormAppearance`）。這裡刻意用
 * `Record<string, unknown>` 而不是逐字建模：App 這一頁**不編輯外觀**，
 * 只需要在存檔時把原值原樣帶回去（見 `ticket-types.tsx` 的說明）。
 * 逐字建模會讓人以為 App 支援編輯外觀。
 */
export interface RegistrationFormSchema {
  style?: Record<string, unknown>;
  fields: RegistrationDynamicField[];
}

// ---------------------------------------------------------------------------
// 票種本體
// ---------------------------------------------------------------------------

/**
 * `GET …/ticket-types` 的 `ticketTypes[]` 元素。對應 Web `TicketType`。
 *
 * 後端 select 是 `EventTicketTypeService.adminSelect`（`:40-56`，＝
 * `publicSelect` ＋ `accessCode`）再加 `capabilities` / `capabilitiesOverride`
 * 兩個解析後欄位。這裡的欄位集合與它一一對應。
 */
export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  displayName: string;
  description?: string | null;
  /** `Decimal` 序列化成字串。單位是幣別金額（可含兩位小數），**不是分**。 */
  price: string;
  currency: string;
  capacity?: number | null;
  soldCount: number;
  registrantType: RegistrantType;
  formFieldsJson?: RegistrationFormSchema | null;
  isHidden: boolean;
  initialTokens: number;
  allowedPaymentMethods: EventPaymentMethod[];
  isActive: boolean;
  /**
   * 實際生效的權益（後端已解析）。
   *
   * 舊版後端可能不回傳 ⇒ 呼叫端要容忍 `undefined`（Web 的註解也是這樣寫）。
   */
  capabilities?: TicketCapability[];
  /** 原始覆寫值；`null` ＝ 依 `registrantType` 繼承預設。編輯器回填用這一個。 */
  capabilitiesOverride?: TicketCapability[] | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 管理端列表的元素＝`TicketType` ＋ `accessCode`。
 *
 * `accessCode` **只在管理端 select 裡**（`adminSelect`）。公開端點
 * （`listPublicTicketTypes`）不會回傳它——所以型別只在這裡加。
 */
export interface AdminTicketType extends TicketType {
  accessCode?: string | null;
}

/**
 * `POST …/ticket-types` 與 `PATCH …/ticket-types/:id` 的 body。
 *
 * 逐字照 Web `CreateTicketTypePayload`（`lib/events/ticket-types.ts:37-56`）。
 *
 * ⚠️ **Web 的 PATCH 送的是完整 payload，不是部分更新。**
 * `page.tsx:752` 是 `{ ...form, allowedPaymentMethods, formFieldsJson }`——
 * 12 個鍵一次送齊。App 照同一形狀送，理由：
 *
 * - 後端 update 用 `dto.x !== undefined` 判斷（不是 `hasOwn`），沒送＝不動。
 *   所以「只送改動的欄位」技術上可行。
 * - 但 Web 沒這樣做。App 若改成部分更新，就會出現「App 送得出的欄位組合，
 *   Web 從未送過」——漂移的來源。
 * - 完整 payload 也讓「取消勾選 `isHidden`」這類「把值改回預設」的動作
 *   不需要靠 `null` 語意猜測。
 *
 * `tests/ticket-type-payload.test.mjs` 釘住確切的鍵集合。
 */
export interface CreateTicketTypePayload {
  name: string;
  displayName: string;
  /** 幣別金額字串（可含兩位小數）。**不換算成最小單位**。 */
  price: string;
  currency?: string;
  registrantType: RegistrantType;
  description?: string;
  capacity?: number | null;
  isHidden?: boolean;
  accessCode?: string | null;
  initialTokens?: number;
  allowedPaymentMethods?: EventPaymentMethod[];
  formFieldsJson?: RegistrationFormSchema | null;
  /**
   * 票種權益覆寫（後端 `capabilities`）。
   * - `null`（或省略）＝ 依 `registrantType` 繼承預設
   * - 陣列（含空陣列）＝ 明確覆寫（完全取代，非聯集）
   */
  capabilities?: TicketCapability[] | null;
}

/** PATCH 用的型別。Web 送完整 payload，這裡保留 `Partial` 只是為了語意誠實。 */
export type UpdateTicketTypePayload = Partial<CreateTicketTypePayload>;
