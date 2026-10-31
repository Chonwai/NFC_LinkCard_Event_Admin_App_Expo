import type {
  EventBankDetails,
  EventConfig,
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
