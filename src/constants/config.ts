/**
 * LinkCard Event Admin App — 環境設定（單一真相來源）
 *
 * 與 Promoter App 的 config.ts 對齊：production 預設指向 linkcard.xyz API。
 * 本地開發可用 EXPO_PUBLIC_API_URL 覆寫（expo 內建 env 注入）。
 */
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

/** Production API origin（與 Web Frontend / MiniProgram 共用同一個 backend） */
export const API_BASE_URL = EXPO_PUBLIC_API_URL || "https://linkcard.xyz/api";

/** Axios 全域逾時（毫秒） */
export const API_TIMEOUT_MS = 15000;

/**
 * 依報名編號查詢（QR 掃描第一步）的逾時。
 *
 * 刻意短於全域逾時：這支是**閘口的人機互動**。現場人員在十幾秒的等待中
 * 會重複掃描或改走人工，等待本身反而製造更多失敗；超過 3 秒不如早點讓他
 * 改道。**只覆寫 `getByCode`**，不動全域 `API_TIMEOUT_MS`。
 */
export const LOOKUP_TIMEOUT_MS = 3000;

/**
 * 用戶端網頁 origin。NFC 寫入 `${WEB_BASE_URL}/u/:registrationId`。
 * 與 API origin 分開：staging API 與 staging Web 不是同一台。
 * 未設定時預設 production，確認頁會顯示實際網址，避免靜默寫錯環境。
 */
const EXPO_PUBLIC_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim();
export const WEB_BASE_URL = (
  EXPO_PUBLIC_WEB_URL || "https://linkcard.xyz"
).replace(/\/$/, "");

/** SecureStore 儲存 key（與 Promoter App 分離，避免 token 互相覆寫） */
export const TOKEN_STORAGE_KEY = "lc_event_admin_token";
