import {
  findMissingRequiredSemantics,
  hasInvalidAllowOtherType,
  hasInvalidSemanticBindingType,
  hasOtherSentinelCollision,
  hasOtherSiblingKeyCollision,
  type RegistrantSemanticKey,
} from "@/utils/registrationFormContract";
import type {
  AdminTicketType,
  CreateTicketTypePayload,
  EventPaymentMethod,
  RegistrantType,
  RegistrationDynamicField,
  RegistrationFormSchema,
  TicketCapability,
} from "@/types/ticketType.types";
import {
  DEFAULT_CAPABILITIES_BY_REGISTRANT,
  ENABLED_PAYMENT_METHODS,
  TICKET_CAPABILITIES,
} from "@/types/ticketType.types";

/**
 * 票種表單的**純函式**：輸入清洗、驗證、payload 組裝。
 *
 * 為什麼要抽成純函式（而不是留在畫面裡）：這個檔案承載三件「錯了不會有任何
 * 錯誤訊息」的事，全部必須被測試釘住，而測試跑不了 `.tsx`：
 *
 * 1. **`price` 的單位**。後端是 `Decimal(10, 2)`，單位是**幣別金額**（MOP），
 *    最多兩位小數——**不是分**。所以這裡從頭到尾**不做任何換算**：
 *    使用者輸入什麼、字串就原樣送出去。任何 `* 100` / `Math.round` 都會把
 *    一千五百元變成一萬五千元，而且後端照收、畫面照顯示。
 * 2. **payload 的鍵集合**。Web 送 13 個鍵（完整 payload，不是部分更新）。
 *    少一個鍵＝那個欄位存不進去；多一個鍵＝App 送得出 Web 從未送過的東西。
 * 3. **`accessCode` 的大寫正規化**。後端 `normalizeAccessCode` 會
 *    `toUpperCase()`，Web 在**輸入時**就大寫。若 App 兩邊都不做，使用者會
 *    看到自己打的小寫碼、卻必須打大寫才進得去。
 *
 * ## 與 Web 逐條對照（`ticket-types/page.tsx`）
 *
 * | 欄位 | Web 行為 | 這裡 |
 * | --- | --- | --- |
 * | `name` / `displayName` | 必填 | 同 |
 * | `price` | 必填；`Number()` 後不可 `NaN`、不可 < 0 | 同（不驗小數位數，交給後端） |
 * | `capacity` | 空 → `null`；否則 `Number(值)` | 同 |
 * | `initialTokens` | `Number(值)`（空 → 0） | 同（但先驗整數，見下） |
 * | `accessCode` | 輸入時 `toUpperCase()`；空 → `null` | 送出前 `trim().toUpperCase()` |
 * | `description` | `值 || undefined`（空 → 省略該鍵） | 同 |
 * | `allowedPaymentMethods` | `normalizeAllowedPaymentMethods` | 同（逐字照抄） |
 * | `isHidden` | 勾選框 | 同 |
 * | `capabilities` | `editing?.capabilitiesOverride ?? null` | 同（由 context 帶入） |
 * | `formFieldsJson` | `JSON.parse(文字框)` | 同（由 context 帶入） |
 *
 * ## 兩處「照抄會壞，所以不照抄」的地方
 *
 * 1. **`initialTokens`**：Web 是 `Number(e.target.value)`，打「abc」會得到
 *    `NaN`，序列化成 JSON 就是 `null`，後端 `@IsInt()` 直接 400——而畫面上
 *    完全看不出為什麼。這裡改成「非整數字串就當場擋下」。
 *    這是**收緊**（Web 會送出去的壞值，App 不送），不是新增能力。
 * 2. **`price` 的小數位數**：Web 不驗，所以打 `1.234` 會送到後端才 400。
 *    這裡**維持不驗**——見 `validateTicketTypeForm` 的說明：這一條刻意對齊
 *    Web，讓「Web 擋下的 App 也擋、Web 放行的 App 也放行」成立。
 */

// ---------------------------------------------------------------------------
// 表單狀態
// ---------------------------------------------------------------------------

/**
 * 表單狀態。**所有數字欄位都是字串**。
 *
 * 為什麼不用 `number`：`TextInput` 給的是字串，中途狀態（例如只打了 `-`、
 * 或正在打 `1.`）不是合法數字。提早 `Number()` 會讓使用者打字時游標亂跳、
 * 而且把「還沒打完」誤判成 0。轉換集中在 `buildTicketTypePayload` 一次做完。
 */
export interface TicketTypeFormInput {
  name: string;
  displayName: string;
  /** 使用者輸入的**幣別金額**字串（不是分）。 */
  price: string;
  currency: string;
  registrantType: RegistrantType;
  description: string;
  /** 空字串＝無限制。 */
  capacity: string;
  isHidden: boolean;
  accessCode: string;
  initialTokens: string;
  allowedPaymentMethods: EventPaymentMethod[];
  /**
   * 票種權益**覆寫值**。`null` ＝ 繼承 `registrantType` 的預設。
   *
   * ⚠️ 回填時必須用後端的 `capabilitiesOverride`，**不是** `capabilities`。
   * 後者已經解析過（覆寫 ?? 預設），寫回去會把「繼承」固化成「明確覆寫」。
   */
  capabilities: TicketCapability[] | null;
  /**
   * `formFieldsJson` 的**原始 JSON 文字**。
   *
   * 為什麼是文字而不是解析後的物件：使用者打字打到一半必然是壞 JSON
   * （例如只打了 `{"fields": [`）。若把它存成物件，每次按鍵都要嘗試解析、
   * 失敗就丟掉使用者正在打的內容。Web 也是這樣存的（`formFieldsJsonText`
   * 與 `formFieldsJson` 兩個狀態並存，物件那份由文字派生）。
   */
  formFieldsJsonText: string;
}

/**
 * 組 payload 時需要的「表單以外的狀態」。
 *
 * `formFieldsJson` 不在表單上（本輪改以 JSON 文字入口編輯，值仍從這裡傳），
 * 但**必須原值帶回去**：傳 `{ fields: [] }` 會把主辦方辛苦設定的報名表欄位
 * **整組清空**——這是本輪唯一真正會造成資料遺失的風險點，所以它不是 optional、
 * 沒有預設值，呼叫端必須明確給。
 */
export interface TicketTypePayloadContext {
  formFieldsJson: RegistrationFormSchema;
}

/** 新票種的起始值。逐字對齊 Web `page.tsx:523-542` 的 `useState` 初值。 */
export function emptyTicketTypeForm(): TicketTypeFormInput {
  return {
    name: "",
    displayName: "",
    price: "0",
    currency: "MOP",
    registrantType: "ATTENDEE",
    description: "",
    capacity: "",
    isHidden: false,
    accessCode: "",
    initialTokens: "0",
    allowedPaymentMethods: ["FREE"],
    // null ＝ 繼承 registrantType 的預設權益（後端語意）。
    capabilities: null,
    formFieldsJsonText: JSON.stringify({ fields: [] }, null, 2),
  };
}

/** 由既有票種回填表單。 */
export function ticketTypeFormFrom(
  existing: AdminTicketType,
): TicketTypeFormInput {
  return {
    name: existing.name ?? "",
    displayName: existing.displayName ?? "",
    // 後端回的是 Decimal 字串，原樣放到輸入框；不 `Number()`（會掉尾零）。
    price: existing.price ?? "0",
    currency: existing.currency ?? "MOP",
    registrantType: existing.registrantType,
    description: existing.description ?? "",
    capacity: existing.capacity == null ? "" : String(existing.capacity),
    isHidden: existing.isHidden ?? false,
    accessCode: existing.accessCode ?? "",
    initialTokens: String(existing.initialTokens ?? 0),
    allowedPaymentMethods: normalizeAllowedPaymentMethods(
      existing.allowedPaymentMethods,
    ),
    // 用 **override**，不要用解析後的 capabilities（見型別上的警告）。
    capabilities: existing.capabilitiesOverride ?? null,
    // 原樣 pretty-print：不化縮排的語意，只改變顯示。使用者的設定不會因為
    // 「App 幫他排版」而變成別的值（值域仍是同一個 JSON）。
    formFieldsJsonText: JSON.stringify(
      existing.formFieldsJson ?? { fields: [] },
      null,
      2,
    ),
  };
}

// ---------------------------------------------------------------------------
// 付款方式
// ---------------------------------------------------------------------------

/**
 * 付款方式正規化。**逐字照抄** Web `page.tsx:63-75`。
 *
 * 後端 `normalizeAllowedPaymentMethods` 是同一套規則（`:289-`）：空 → `FREE`、
 * 去重、只有一個就回那一個、含 `BANK_TRANSFER` 優先、含 `FREE` 次之。
 * 使用者只會選一個（UI 是單選），所以這裡實際上是「去掉不合法的值、
 * 空的話補 `FREE`」。
 *
 * 不在 `ENABLED_PAYMENT_METHODS` 裡的值會被濾掉：Web 的勾選框對其餘三個
 * 方法是 `disabled`，若資料裡有（舊資料、或後端新增）也不能讓它被送出去。
 */
export function normalizeAllowedPaymentMethods(
  methods?: readonly EventPaymentMethod[] | null,
): EventPaymentMethod[] {
  if (!methods?.length) return ["FREE"];

  const allowed = ENABLED_PAYMENT_METHODS as readonly EventPaymentMethod[];
  const unique = Array.from(new Set(methods.filter(Boolean))).filter(
    (method): method is EventPaymentMethod => allowed.includes(method),
  );

  if (unique.length === 0) return ["FREE"];
  if (unique.length === 1) return unique;
  if (unique.includes("BANK_TRANSFER")) return ["BANK_TRANSFER"];
  if (unique.includes("FREE")) return ["FREE"];

  return [unique[0] ?? "FREE"];
}

// ---------------------------------------------------------------------------
// 票種權益（capability）
// ---------------------------------------------------------------------------

/**
 * 解析某張票**實際生效**的權益。鏡像後端
 * `constants/ticketCapabilities.ts:122` 的 `resolveTicketCapabilities`。
 *
 * 語義是 **null-inherit，不做聯集**：
 * - `capabilities === null` ⇒ 用 `DEFAULT_CAPABILITIES_BY_REGISTRANT[registrantType]`
 * - `capabilities === []`   ⇒ **明確不給任何權益**（不是「繼承」）
 *
 * 這兩者的差別是這一整個功能最容易搞錯的地方：把空陣列當成「沒設定」，
 * 就會讓「這張票不該有商業配對」變成「這張票跟 ATTENDEE 一樣」。
 *
 * 這裡只用於**顯示**（編輯器要說「目前是繼承，繼承值長這樣」）。
 * 真正的權益判斷永遠在後端，App 不自行據此開放／封閉功能。
 */
export function resolveTicketCapabilities(args: {
  registrantType: RegistrantType;
  capabilities: readonly TicketCapability[] | null;
}): TicketCapability[] {
  if (args.capabilities !== null) return [...args.capabilities];
  return [...(DEFAULT_CAPABILITIES_BY_REGISTRANT[args.registrantType] ?? [])];
}

/**
 * 勾選／取消一項權益。鏡像 Web `page.tsx:578-595` 的 `toggleCapability`。
 *
 * 兩個行為必須一起成立：
 * 1. **第一次勾選會把「繼承」實體化成「明確覆寫」**。基準值是「目前實際生效
 *    的那一組」，所以使用者看到什麼就從什麼開始加減——不會出現「我只取消了一
 *    項，其他五項卻跟著消失」。
 * 2. **回傳值依 `TICKET_CAPABILITIES` 的順序排序**。後端
 *    `normalizeCapabilities` 也這樣排；不排的話每次存檔陣列順序都可能不同，
 *    在 diff 裡看起來像「改了什麼」但其實沒有。
 */
export function toggleTicketCapability(args: {
  registrantType: RegistrantType;
  current: readonly TicketCapability[] | null;
  capability: TicketCapability;
}): TicketCapability[] {
  const base = resolveTicketCapabilities({
    registrantType: args.registrantType,
    capabilities: args.current,
  });

  const next = base.includes(args.capability)
    ? base.filter((item) => item !== args.capability)
    : [...base, args.capability];

  return TICKET_CAPABILITIES.filter((item) => next.includes(item));
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

/** 表單欄位（＝畫面要顯示錯誤的位置）。 */
export type TicketTypeFormField =
  | "name"
  | "displayName"
  | "price"
  | "capacity"
  | "accessCode"
  | "initialTokens"
  | "paymentMethod";

/** 錯誤碼。畫面負責把碼翻成文案（`copy.zh-TW.ts`），util 不持有任何字串。 */
export type TicketTypeFormErrorCode =
  | "name_required"
  | "display_name_required"
  | "price_required"
  | "price_invalid"
  | "capacity_invalid"
  | "tokens_invalid"
  | "access_code_required"
  | "payment_method_required";

/** 錯誤碼 → 該顯示在哪個欄位。 */
export const TICKET_TYPE_ERROR_FIELD: Record<
  TicketTypeFormErrorCode,
  TicketTypeFormField
> = {
  name_required: "name",
  display_name_required: "displayName",
  price_required: "price",
  price_invalid: "price",
  capacity_invalid: "capacity",
  tokens_invalid: "initialTokens",
  access_code_required: "accessCode",
  payment_method_required: "paymentMethod",
};

/**
 * 驗證的順序與條件，逐條對齊 Web `page.tsx:690-758` 的 `validate()`。
 *
 * 刻意**不對齊**的兩條（都是「Web 會擋、App 不擋」的反向情形，沒有）：
 * - `price` 的小數位數：Web 不驗，這裡也不驗。打 `1.234` 兩邊都送到後端，
 *   後端 `@IsNumber({ maxDecimalPlaces: 2 })` 回 400 `VALIDATION_ERROR`。
 *   若 App 搶先擋，就變成「Web 放行的東西 App 不放行」——那是限制，不是對等。
 * - `capacity = 0`：Web 的 `<input min="0">` 允許 0，後端 `@Min(1)` 會 400。
 *   這裡照樣允許 0，讓兩邊在同一個地方失敗、用同一句話說明。
 *
 * 刻意**收緊**的一條：
 * - `initialTokens` 必須是整數字串。Web 送 `NaN`（JSON 序列化成 `null`）
 *   會得到一個完全沒有線索的 400。這一條在 `buildTicketTypePayload` 與
 *   驗證兩邊都擋，理由見檔頭。
 */
export function validateTicketTypeForm(
  form: TicketTypeFormInput,
): TicketTypeFormErrorCode[] {
  const errors: TicketTypeFormErrorCode[] = [];

  if (form.name.trim() === "") errors.push("name_required");
  if (form.displayName.trim() === "") errors.push("display_name_required");

  const price = form.price.trim();
  if (price === "") {
    errors.push("price_required");
  } else if (Number.isNaN(Number(price)) || Number(price) < 0) {
    errors.push("price_invalid");
  }

  const capacity = form.capacity.trim();
  if (capacity !== "" && !/^\d+$/.test(capacity)) {
    errors.push("capacity_invalid");
  }

  const tokens = form.initialTokens.trim();
  if (tokens !== "" && !/^\d+$/.test(tokens)) {
    errors.push("tokens_invalid");
  }

  // 隱藏票必須有訪問碼，否則沒有人進得去（Web 同一條）。
  if (form.isHidden && form.accessCode.trim() === "") {
    errors.push("access_code_required");
  }

  if (form.allowedPaymentMethods.length === 0) {
    errors.push("payment_method_required");
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 報名表 JSON 的語意驗證（逐條對齊 Web `validate()`）
// ---------------------------------------------------------------------------

/** `formFieldsJson` 的驗證錯誤。 */
export type FormSchemaError =
  /** 不是合法 JSON，或不是物件，或是陣列。 */
  | { code: "form_schema_invalid" }
  /** 欄位 key 重複。 */
  | { code: "form_schema_duplicate_keys" }
  /** 欄位 key 不合法（只允許 `[a-zA-Z0-9_-]`）。 */
  | { code: "form_schema_invalid_key" }
  /** `pricing-select` 的 price／deposit 有非數字值。 */
  | { code: "form_schema_bad_price" }
  /** 缺少該報名者類型的必填語義。 */
  | { code: "form_schema_missing_semantic"; missing: RegistrantSemanticKey[] }
  /** `allowOther` 用在 select / multi-select 以外的型別。 */
  | { code: "form_schema_invalid_allow_other_type" }
  /** `allowOther` 欄位的選項用了哨兵值 `__other__`。 */
  | { code: "form_schema_invalid_other_collision" }
  /** 欄位 key 撞到某個 `allowOther` 欄位的 sibling key。 */
  | { code: "form_schema_invalid_sibling_collision" }
  /** `semanticKey` 綁在不允許的型別（只允許 text / select）。 */
  | { code: "form_schema_invalid_semantic_type" };

export type FormSchemaParseResult =
  | { ok: true; schema: RegistrationFormSchema }
  | { ok: false; error: FormSchemaError };

/** 欄位 key 的合法字元集（與 Web／後端同一個 regex）。 */
const FIELD_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * 解析並驗證 `formFieldsJsonText`。
 *
 * 逐條對齊 Web `ticket-types/page.tsx:606-758` 的 `validate()`；順序也相同
 * （**先失敗的先回報**，因為 Web 也是一連串 `else if` / `if (!errs.x)`）：
 *
 * 1. 能 `JSON.parse`、不是 null、不是陣列
 * 2. key 不重複
 * 3. key 符合 `^[a-zA-Z0-9_-]+$`
 * 4. `pricing-select` 的 price／deposit 若是非空值必須是數字
 * 5. 該 `registrantType` 的必填語義都要被某個 `required: true` 的欄位綁定
 * 6. `allowOther` 只能用於 select / multi-select
 * 7. `allowOther` 的選項不得含哨兵值 `__other__`
 * 8. 任何 key 不得等於某個 `allowOther` 欄位的 sibling key
 * 9. `semanticKey` 只能綁 text / select
 *
 * ## 為什麼 `fields` 不是陣列時**不算錯**
 *
 * Web 是 `Array.isArray(parsed.fields) ? parsed.fields : []`——`fields` 不見了
 * 就當空表，然後繼續往下驗。照抄這個行為：後端 `parseDynamicFormSchema` 也
 * 容忍缺 `fields`。若這裡改成報錯，App 就會拒繪 Web 願意存的東西。
 */
export function validateFormFieldsJson(
  text: string,
  registrantType: RegistrantType,
): FormSchemaParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "form_schema_invalid" } };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: { code: "form_schema_invalid" } };
  }

  const record = parsed as { fields?: unknown; style?: unknown };
  const fields = Array.isArray(record.fields)
    ? (record.fields as RegistrationDynamicField[])
    : [];

  // 2. key 重複
  const keys = fields.map((field) => String(field.key ?? "")).filter(Boolean);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: { code: "form_schema_duplicate_keys" } };
  }

  // 3. key 格式
  if (
    fields.some(
      (field) => !field.key || !FIELD_KEY_PATTERN.test(String(field.key)),
    )
  ) {
    return { ok: false, error: { code: "form_schema_invalid_key" } };
  }

  // 4. pricing-select 的價格／按金
  const hasBadPricingOption = fields.some(
    (field) =>
      field.type === "pricing-select" &&
      Array.isArray(field.options) &&
      field.options.some(
        (option) =>
          (option.price !== undefined &&
            option.price !== null &&
            (option.price as unknown) !== "" &&
            Number.isNaN(Number(option.price))) ||
          (option.deposit !== undefined &&
            option.deposit !== null &&
            (option.deposit as unknown) !== "" &&
            Number.isNaN(Number(option.deposit))),
      ),
  );
  if (hasBadPricingOption) {
    return { ok: false, error: { code: "form_schema_bad_price" } };
  }

  // 5. 必填語義
  const missing = findMissingRequiredSemantics(fields, registrantType);
  if (missing.length > 0) {
    return {
      ok: false,
      error: { code: "form_schema_missing_semantic", missing },
    };
  }

  // 6-9. Other 選項與語義綁定
  if (hasInvalidAllowOtherType(fields)) {
    return {
      ok: false,
      error: { code: "form_schema_invalid_allow_other_type" },
    };
  }
  if (hasOtherSentinelCollision(fields)) {
    return {
      ok: false,
      error: { code: "form_schema_invalid_other_collision" },
    };
  }
  if (hasOtherSiblingKeyCollision(fields)) {
    return {
      ok: false,
      error: { code: "form_schema_invalid_sibling_collision" },
    };
  }
  if (hasInvalidSemanticBindingType(fields)) {
    return {
      ok: false,
      error: { code: "form_schema_invalid_semantic_type" },
    };
  }

  // 原樣回傳解析結果（含 `style`），不做任何清洗——後端存的就是這份。
  return {
    ok: true,
    schema: {
      ...(record.style === undefined
        ? {}
        : { style: record.style as Record<string, unknown> }),
      fields,
    },
  };
}

// ---------------------------------------------------------------------------
// payload
// ---------------------------------------------------------------------------

/** 空的選填數字輸入 → `null`（＝無限制）；其餘轉整數。 */
function toOptionalInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/**
 * 組出 POST／PATCH 的 body。
 *
 * 鍵集合固定為 **13 個**（`description` 為空時省略，理由見下），順序也固定，
 * 由 `tests/ticket-type-payload.test.mjs` 釘住。
 *
 * ### 為什麼 `description` 空的時候要**省略整個鍵**
 *
 * Web 是 `description: e.target.value || undefined`（`page.tsx:996-998`），
 * `JSON.stringify` 會把值為 `undefined` 的鍵整個拿掉。後端 update 用
 * `dto.description !== undefined` 判斷，所以「省略」＝**不動**。
 *
 * 後果（照抄，未修）：**已存在的說明無法被清空**——清空後存檔，舊字還在。
 * 這不是資料遺失，也沒有金錢風險，所以本輪照 Web 的行為，記在交付的
 * 「已知 Web 缺陷」裡，不自行改成送 `null`（那會是 App 送得出、Web 從未
 * 送過的值）。
 *
 * ### 為什麼 `capacity` 是 `null` 而不是省略
 *
 * Web 的表單初值就是 `capacity: null`，送出去也是 `null`。後端
 * `dto.capacity !== undefined` 為真、`@IsOptional()` 跳過 `null` 驗證，
 * 於是寫入 DB 的 `capacity` 是 `null`（無限制）。省略的話則變成「不動」，
 * 意思是**清空上限這個動作會失效**。所以這裡必須顯式送 `null`。
 */
export function buildTicketTypePayload(
  form: TicketTypeFormInput,
  context: TicketTypePayloadContext,
): CreateTicketTypePayload {
  const description = form.description.trim();
  const accessCode = form.accessCode.trim().toUpperCase();

  return {
    name: form.name.trim(),
    displayName: form.displayName.trim(),
    // 原樣送出，不換算、不 `Number()`、不去尾零。
    price: form.price.trim(),
    currency: form.currency.trim().toUpperCase(),
    registrantType: form.registrantType,
    ...(description === "" ? {} : { description }),
    capacity: toOptionalInteger(form.capacity),
    isHidden: form.isHidden,
    // 空字串 → null（Web 是 `toUpperCase() || null`，同一件事）。
    accessCode: accessCode === "" ? null : accessCode,
    initialTokens: toOptionalInteger(form.initialTokens) ?? 0,
    allowedPaymentMethods: normalizeAllowedPaymentMethods(
      form.allowedPaymentMethods,
    ),
    formFieldsJson: context.formFieldsJson,
    capabilities: form.capabilities,
  };
}

/**
 * 「這次存檔改了哪些欄位」——二次確認框要顯示的事實。
 *
 * 只比對**會花到錢或改到名額**的三項。其餘欄位（名稱、說明、付款方式…）
 * 不算「需要再次確認」的風險，確認框不列它們，避免變成一路按「確定」的
 * 儀式性彈窗。
 */
export interface TicketTypeChangeSummary {
  /** 價格是否變了（新建時 `from` 為 `null`）。 */
  priceChanged: boolean;
  priceFrom: string | null;
  priceTo: string;
  /** 名額是否變了（`null` ＝ 無限制）。 */
  capacityChanged: boolean;
  capacityFrom: number | null;
  capacityTo: number | null;
}

export function summarizeTicketTypeChanges(
  form: TicketTypeFormInput,
  existing: AdminTicketType | null,
): TicketTypeChangeSummary {
  const priceTo = form.price.trim();
  const capacityTo = toOptionalInteger(form.capacity);

  if (existing == null) {
    return {
      priceChanged: true,
      priceFrom: null,
      priceTo,
      capacityChanged: true,
      capacityFrom: null,
      capacityTo,
    };
  }

  const priceFrom = existing.price ?? null;
  return {
    // 字串比較，不做數值比較：`"1500.50"` 與 `"1500.5"` 在數值上相等，
    // 但送出的是不同字串。用字串比較會多問一次「沒改價格」的情況——
    // 寧可多問一次，也不要漏問一次真的改了價格的情形。
    priceChanged: priceFrom == null || priceFrom !== priceTo,
    priceFrom,
    priceTo,
    capacityChanged: (existing.capacity ?? null) !== capacityTo,
    capacityFrom: existing.capacity ?? null,
    capacityTo,
  };
}
