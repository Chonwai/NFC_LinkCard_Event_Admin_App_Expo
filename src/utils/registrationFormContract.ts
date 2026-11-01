import type { RegistrantType } from "@/types/ticketType.types";

/**
 * 報名表單契約（**mirror — canonical source = backend**）。
 *
 * Canonical：`LinkCard_ExpressJS_Backend/src/events/constants/registrationForm.ts`
 * Web mirror：`LinkCard_Frontend/lib/events/registrationFormContract.ts`
 * App mirror：本檔（第三份，逐字抄自上面那份 Web mirror）
 *
 * ## 為什麼 App 也要有一份
 *
 * 票種的 `formFieldsJson` 是**使用者可編輯的 JSON**。後端在 create/update 時
 * 有 save guard（`EventTicketTypeService.validateFormSchemaOrThrow`），所以
 * 就算 App 不驗，壞資料也進不了 DB。那為什麼還要驗？
 *
 * 因為不驗的話，使用者會看到「儲存 → 轉圈 → 一句『報名表單設定無效』」，
 * 而且**不知道是哪一條規則**。Web 的做法是在送出前逐條驗並指出原因，
 * App 照同一條路——這正是本輪的「拒絕 Web 拒絕的同一批表單」。
 *
 * ## 三份鏡像如何保持一致
 *
 * Web 有 `registrationFormContract.drift.test.ts` 直接讀後端 canonical 檔比對。
 * App 對應的是 `tests/ticket-type-form-schema.test.mjs`，同樣直接讀後端檔案
 * （後端 repo 不在旁邊時**大聲跳過**，不靜默通過）。
 *
 * ## 值域（與後端逐字相同）
 *
 * | 常數 | 值 |
 * | --- | --- |
 * | `REGISTRANT_SEMANTIC_KEYS` | email, firstName, lastName, phone, company, website |
 * | `PER_ROLE_REQUIRED_SEMANTICS` | 只有 `EXHIBITOR_REP` 需要 `company` |
 * | `DYNAMIC_FIELD_OTHER_SENTINEL` | `__other__` |
 * | `DYNAMIC_FIELD_OTHER_SUFFIX` | `__other` |
 * | `SEMANTIC_BINDING_ALLOWED_FIELD_TYPES` | `text`, `select` |
 */

// ── A2: 語義枚舉 ──────────────────────────────────────────────────────────
export const REGISTRANT_SEMANTIC_KEYS = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "company",
  "website",
] as const;

export type RegistrantSemanticKey = (typeof REGISTRANT_SEMANTIC_KEYS)[number];

/**
 * 對應 top-level 註冊基礎欄位。`email` 恆必填（identity anchor，PD-01）。
 *
 * App 目前沒有用到它（那是報名流程的事），但保留是為了讓三份 mirror 的
 * 差異只出現在「真的不需要」的地方——刪掉一個常數會讓未來的 drift 比對
 * 無法逐項對齊。
 */
export const IDENTITY_BASE_FIELDS: readonly string[] = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "company",
];

/**
 * 每個報名者類型「必須被某個欄位以 `required: true` 綁定」的語義。
 *
 * 只有 `EXHIBITOR_REP` 有要求（`company`）。這一條是票種存檔時最容易被
 * 絆倒的規則：替展商代表開票種、卻沒有把任何欄位綁成必填的 `company`，
 * 後端會回 400 `INVALID_FORM_SCHEMA`。
 */
export const PER_ROLE_REQUIRED_SEMANTICS: Record<
  RegistrantType,
  RegistrantSemanticKey[]
> = {
  EXHIBITOR_REP: ["company"],
  ATTENDEE: [],
  SPEAKER: [],
  SPONSOR: [],
  MEDIA: [],
  GUEST: [],
  VOLUNTEER: [],
};

/**
 * 取得欄位的有效語義 key。
 *
 * PD-05 相容：沒有 explicit `semanticKey` 時，`key` 為 `companyName` 或
 * `company` 視為 `company`。這條相容層是舊資料的逃生門，不要拿掉。
 */
export function getFieldSemanticKey(
  field?: { key?: string; semanticKey?: string } | null,
): RegistrantSemanticKey | null {
  if (!field) return null;
  if (field.semanticKey) return field.semanticKey as RegistrantSemanticKey;
  if (field.key === "companyName" || field.key === "company") return "company";
  return null;
}

/**
 * 判斷必填語義是否都被滿足（有欄位綁定該語義且 `required === true`）。
 *
 * 注意：票種頁的 `validate()` **沒有**用這個 helper，而是自己算出「缺哪些」
 * 好在錯誤訊息裡列出缺少的語義（見 `findMissingRequiredSemantics`）。
 * 這裡保留是為了與另兩份 mirror 逐項對得上。
 */
export function hasSatisfyingRequiredSemantic(
  schema:
    | {
        fields?: {
          key?: string;
          semanticKey?: string;
          required?: boolean;
        }[];
      }
    | null
    | undefined,
  registrantType: RegistrantType,
): boolean {
  const requiredSemantics = new Set<string>(
    PER_ROLE_REQUIRED_SEMANTICS[registrantType] ?? [],
  );
  return (schema?.fields ?? []).some((field) => {
    const semantic = getFieldSemanticKey(field);
    return (
      semantic != null &&
      requiredSemantics.has(semantic) &&
      field.required === true
    );
  });
}

// ── Other 選項支援（Google Forms `hasOtherOption` 藍本）────────────────────

/** 主欄位儲存的哨兵值（select / multi-select 選「其他」時）。 */
export const DYNAMIC_FIELD_OTHER_SENTINEL = "__other__";
/** sibling key 後綴。 */
export const DYNAMIC_FIELD_OTHER_SUFFIX = "__other";

/** 取得某欄位在選「其他」時的 sibling key，例如 `industry__other`。 */
export function getOtherSiblingKey(key: string): string {
  return `${key}${DYNAMIC_FIELD_OTHER_SUFFIX}`;
}

// ── 語義綁定型別契約 ──────────────────────────────────────────────────────

/**
 * `semanticKey` 只允許綁在「單值字串」型別上。
 *
 * multi-select（陣列）/ file / checkbox / date / pricing-select / section-title
 * 綁語義會造成執行時未定義行為（EXHIBITOR_REP 配 multi-select 綁 `company`
 * 恆 400）。後端在票種 create/update 有 save guard；這裡是同一條規則的前端版。
 */
export const SEMANTIC_BINDING_ALLOWED_FIELD_TYPES = ["text", "select"] as const;

export function isSemanticBindingAllowedType(
  type: string | undefined,
): boolean {
  return (SEMANTIC_BINDING_ALLOWED_FIELD_TYPES as readonly string[]).includes(
    String(type ?? ""),
  );
}

/** 是否有欄位綁了 `semanticKey` 但型別不合法。 */
export function hasInvalidSemanticBindingType(
  fields: readonly { type?: string; semanticKey?: string }[],
): boolean {
  return fields.some(
    (field) => !!field.semanticKey && !isSemanticBindingAllowedType(field.type),
  );
}

/**
 * 是否有 sibling-key 碰撞。
 *
 * 任何欄位（除產生該 sibling 的 `allowOther` 欄位本身，因其 key 不可能等於
 * 自身 sibling）的 key 不得等於任一 `allowOther` 欄位的 sibling key。
 *
 * M-1：**不豁免** `allowOther` 欄位——`industry`（allowOther）與
 * `industry__other`（allowOther）並存時，後者也要被攔，否則 stored formData
 * 的 key 會碰撞、資料污染。
 */
export function hasOtherSiblingKeyCollision(
  fields: readonly { key?: string | null; allowOther?: boolean }[],
): boolean {
  const siblingKeys = new Set(
    fields
      .filter((field) => field.allowOther === true)
      .map((field) => getOtherSiblingKey(String(field.key ?? ""))),
  );
  return fields.some((field) => siblingKeys.has(String(field.key)));
}

/**
 * `allowOther: true` 的欄位型別必須是 `select` 或 `multi-select`。
 *
 * AC-01 型別限制。
 */
export function hasInvalidAllowOtherType(
  fields: readonly { type?: string; allowOther?: boolean }[],
): boolean {
  return fields.some(
    (field) =>
      field.allowOther === true &&
      field.type !== "select" &&
      field.type !== "multi-select",
  );
}

/**
 * `allowOther: true` 的欄位 options 不得含哨兵值。
 *
 * AC-01 哨兵碰撞防護：若某個選項的 `value` 就是 `__other__`，報名者選了它
 * 之後，後端無法分辨那是「選了名為 __other__ 的選項」還是「選了其他」。
 */
export function hasOtherSentinelCollision(
  fields: readonly {
    allowOther?: boolean;
    options?: { value?: unknown }[];
  }[],
): boolean {
  return fields.some(
    (field) =>
      field.allowOther === true &&
      (field.options ?? []).some(
        (option) => option.value === DYNAMIC_FIELD_OTHER_SENTINEL,
      ),
  );
}

/**
 * 缺少的必填語義（依 `REGISTRANT_SEMANTIC_KEYS` 的順序）。
 *
 * 回傳空陣列＝全部滿足。Web 的 `validate()` 用同一條式子，只是它直接內聯在
 * 元件裡；抽出來是為了能測。
 */
export function findMissingRequiredSemantics(
  fields: readonly {
    key?: unknown;
    semanticKey?: unknown;
    required?: boolean;
  }[],
  registrantType: RegistrantType,
): RegistrantSemanticKey[] {
  const required = PER_ROLE_REQUIRED_SEMANTICS[registrantType] ?? [];

  return required.filter((semantic) => {
    const bound = fields.some((field) => {
      // PD-05 相容，與 `getFieldSemanticKey` 同一個判斷。
      const effective =
        (field.semanticKey as string | undefined) ??
        (field.key === "companyName" || field.key === "company"
          ? "company"
          : null);
      return effective === semantic && field.required === true;
    });
    return !bound;
  });
}
