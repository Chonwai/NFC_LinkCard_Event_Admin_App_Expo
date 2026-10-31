import type {
  EventBankDetails,
  EventConfig,
  EventTheme,
  LocalizedText,
} from "@/types/api.types";

/**
 * 「活動設定」的 `configJson` 讀寫——**pure function**，不碰 React。
 *
 * ## 為什麼要抽出來
 * `configJson` 是後端一個 `@IsObject()` 的黑箱（`UpdateEventDto`）。這裡有兩個
 * 很容易靜默出錯、而且 TypeScript 完全看不到的地方：
 *
 * 1. **整包覆蓋**：`PATCH` 送什麼 `configJson`，後端就存什麼。只送
 *    `{ bankDetails }` 會把 `theme` 整個刪掉，而且**不會報錯**——活動的品牌色
 *    就這樣沒了。每一支 `build*` 因此都必須 `{ ...existing }` 起手。
 * 2. **`instructions` 有兩種形狀**：後端 `LocalizedCopy` 是
 *    `string | Record<string, string>`，`pickLocalizedCopy`
 *    （`EventRegistrationService.ts:3681`）兩種都吃。
 *
 * 抽成純函式後，`tests/event-settings-bank-details.test.mjs` 可以直接斷言
 * 「存 bank 時 theme 還在不在」，不必渲染整個畫面。
 */

/** 收款帳戶表單的五個欄位（＝Web `BankDetailsFormState`）。 */
export interface BankDetailsForm {
  accountName: string;
  bankName: string;
  accountNumber: string;
  /** 中文付款指示 */
  instructionsZh: string;
  /** 英文付款指示 */
  instructionsEn: string;
}

/**
 * 從本地化文字取出中文。
 *
 * 優先序與 Web `settings/page.tsx` 一字不差：`zh` → `zh-Hant`；另外多認一個
 * `zh-Hans`（後端 `pickLocalizedCopy` 不認它，但資料裡真的可能出現，與其讓它
 * 變成空白後被存成 `null`，不如讀出來）。
 *
 * **純字串形式刻意回傳字串本身**——見下方 `toBankDetailsForm` 的說明。
 */
function readLocalizedZh(text: LocalizedText | null | undefined): string {
  if (text == null) return "";
  if (typeof text === "string") return text;
  return text.zh ?? text["zh-Hant"] ?? text["zh-Hans"] ?? "";
}

/** 從本地化文字取出英文；純字串形式沒有語系資訊，歸給中文那一格。 */
function readLocalizedEn(text: LocalizedText | null | undefined): string {
  if (text == null || typeof text === "string") return "";
  return text.en ?? "";
}

/**
 * `configJson` → 表單值。
 *
 * ⚠️ **與 Web 的一處刻意差異（Web 的缺陷）**：Web 在
 * `settings/page.tsx:55-60` 是這樣讀的——
 *
 * ```ts
 * typeof instructions === 'object' && instructions
 *   ? (instructions.zh ?? instructions['zh-Hant'] ?? '')
 *   : ''            // ← 純字串形式被丟掉
 * ```
 *
 * 純字串形式的 `instructions` 會被讀成空字串，接著存檔時因為「兩個指示都是
 * 空的」而寫成 `instructions: null`——**使用者只要按一次儲存，原有的付款指示
 * 就消失了**，而且沒有任何提示。後端 `pickLocalizedCopy` 明明支援字串形式。
 *
 * App 不複製這個資料遺失行為：字串會落在中文那一格，存回去時升格成
 * `{ zh, en }`，語意（後端取 `zh` 優先）完全不變。這是修缺陷，不是加功能。
 */
export function toBankDetailsForm(
  config?: EventConfig | null,
): BankDetailsForm {
  const details: EventBankDetails | null | undefined = config?.bankDetails;
  const instructions = details?.instructions;
  return {
    accountName: details?.accountName ?? "",
    bankName: details?.bankName ?? "",
    accountNumber: details?.accountNumber ?? "",
    instructionsZh: readLocalizedZh(instructions),
    instructionsEn: readLocalizedEn(instructions),
  };
}

/**
 * 表單值 → 新的 `configJson`（保留其他區塊，例如 `theme`）。
 *
 * 產出的形狀與 Web `handleSaveBankDetails`（`settings/page.tsx:86-105`）逐欄
 * 對應：三個文字欄位 `trim()` 後空值轉 `null`；兩個指示都空時整個
 * `instructions` 為 `null`，否則成 `{ zh, en }`。
 *
 * `trim()` 在這裡是**對齊 Web**，不是我們自己加嚴——Web 這支確實有 trim
 * （活動資料頁的 `name` 反而沒有，那邊刻意不 trim）。
 */
export function buildConfigWithBankDetails(
  config: EventConfig | null | undefined,
  form: BankDetailsForm,
): EventConfig {
  const zh = form.instructionsZh.trim();
  const en = form.instructionsEn.trim();
  return {
    ...(config ?? {}),
    bankDetails: {
      accountName: form.accountName.trim() || null,
      bankName: form.bankName.trim() || null,
      accountNumber: form.accountNumber.trim() || null,
      instructions: zh || en ? { zh, en } : null,
    } satisfies EventBankDetails,
  };
}

// ---------------------------------------------------------------------------
// 品牌主題（configJson.theme）
// ---------------------------------------------------------------------------

/** Web `settings/page.tsx:39` 的預設主色。 */
export const THEME_DEFAULT_PRIMARY = "#7c3aed";

/** Web `settings/page.tsx:40` 的預設 hover 色。 */
export const THEME_DEFAULT_HOVER = "#6d28d9";

/** 主題表單的三個欄位（＝Web `ThemeFormState`）。 */
export interface ThemeForm {
  primaryColor: string;
  primaryHoverColor: string;
  darkMode: boolean;
}

/**
 * 這個字串能不能安全地當 `backgroundColor` 用。
 *
 * 只認 `#rgb` / `#rrggbb`。用途是**預覽色塊的護欄**，不是存檔閘門：
 * React Native 遇到它認不得的顏色字串會丟 `Invalid color`／開發期警告，
 * 而使用者打的字是自由的。存檔一律不看這個判斷——Web 也不驗，後端
 * `configJson` 只是 `@IsObject()`，`EventThemeProvider` 自己會用
 * `isValidCssColor` 決定要不要套用。
 */
export function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/**
 * `configJson` → 主題表單值。
 *
 * 沒有 `theme` 時填 Web 的預設值（`#7c3aed` / `#6d28d9` / 不開暗色），
 * 而不是留空白——空白的主色在畫面上等於「沒設定」，但後端其實有預設。
 */
export function toThemeForm(config?: EventConfig | null): ThemeForm {
  const theme: EventTheme | null | undefined = config?.theme;
  return {
    primaryColor: theme?.primaryColor ?? THEME_DEFAULT_PRIMARY,
    primaryHoverColor: theme?.primaryHoverColor ?? THEME_DEFAULT_HOVER,
    darkMode: theme?.darkMode ?? false,
  };
}

/**
 * 表單值 → 新的 `configJson`（保留其他區塊，並保留 `theme` 內本頁不編輯的鍵）。
 *
 * ⚠️ **第二處與 Web 的刻意差異**：Web `handleSaveTheme`
 * （`settings/page.tsx:109-124`）是整個 `theme` 換掉——
 *
 * ```ts
 * theme: { primaryColor, primaryHoverColor, darkMode }
 * ```
 *
 * 但 `EventTheme` 還有 `backgroundColor` 與 `textColor`，而
 * `EventThemeProvider.tsx:26,35` **真的在用**（`--brand-bg` 與品牌文字色，
 * 直接影響公開報名頁的外觀）。Web 這樣寫等於「在設定頁按一次儲存，
 * 這兩個值就沒了」。App 改成 `{ ...existingTheme, ... }`：不新增可編輯欄位，
 * 只是不把已經存在的資料刪掉。
 *
 * `primaryColor || undefined` 維持 Web 的語意：清空欄位＝把該鍵移除，
 * 讓 `EventThemeProvider` 回到推導值。
 */
export function buildConfigWithTheme(
  config: EventConfig | null | undefined,
  form: ThemeForm,
): EventConfig {
  return {
    ...(config ?? {}),
    theme: {
      ...(config?.theme ?? {}),
      primaryColor: form.primaryColor || undefined,
      primaryHoverColor: form.primaryHoverColor || undefined,
      darkMode: form.darkMode,
    } satisfies EventTheme,
  };
}
