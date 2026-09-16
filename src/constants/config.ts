/**
 * LinkCard Event Admin App — 環境設定（單一真相來源）
 *
 * `EXPO_PUBLIC_API_URL` = 後端 API 的 **origin**（不含 `/api` 或任何路徑後綴）。
 * 所有 service 路徑本身已帶 `/api/...`（例：`/api/auth/login`、
 * `/api/v1/events/my-managed`），因此 origin 與路徑串接後才不會出現 `/api/api/...`。
 *
 * 與 Promoter App 的 config.ts 對齊：production 預設指向 linkcard.xyz，
 * 本地開發可用 EXPO_PUBLIC_API_URL 覆寫（expo 內建 env 注入）。
 */
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const EXPO_PUBLIC_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim();

// Fail closed outside local dev: native preview/production builds must provide
// an explicit API origin instead of silently pointing the device at a default.
if (!EXPO_PUBLIC_API_URL && typeof __DEV__ !== 'undefined' && !__DEV__) {
    throw new Error('EXPO_PUBLIC_API_URL is required for non-development builds');
}

/**
 * 後端 API origin（**不含** `/api`；與 Web Frontend / MiniProgram 共用同一個 backend）。
 *
 * ⚠️ 此值只能是 origin：service 層路徑已含 `/api/...`，若此處再帶 `/api`，
 * axios `combineURLs()` 會串成 `/api/api/...` → 所有請求 404。
 */
export const API_BASE_URL = EXPO_PUBLIC_API_URL || 'https://linkcard.xyz';

/**
 * 用戶端網頁 origin（NFC 寫卡時寫入卡片的 URI 前綴：`/u/:registrationId`）。
 *
 * ⚠️ 與 `API_BASE_URL` 是**不同部署**（API 可能位於 api.* 子網域），
 * **不可**由 `API_BASE_URL` 推導。
 *
 * 未設定時預設 production 網頁 origin；在 staging 測試寫卡時必須以
 * `EXPO_PUBLIC_WEB_URL` 覆寫，否則寫出的卡片會指向 production。
 */
export const WEB_BASE_URL = EXPO_PUBLIC_WEB_URL || 'https://linkcard.xyz';

/** Axios 全域逾時（毫秒） */
export const API_TIMEOUT_MS = 15000;

/** SecureStore 儲存 key（與 Promoter App 分離，避免 token 互相覆寫） */
export const TOKEN_STORAGE_KEY = 'lc_event_admin_token';