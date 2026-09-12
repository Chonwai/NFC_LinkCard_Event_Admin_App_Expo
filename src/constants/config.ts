/**
 * LinkCard Event Admin App — 環境設定（單一真相來源）
 *
 * 與 Promoter App 的 config.ts 對齊：production 預設指向 linkcard.xyz API。
 * 本地開發可用 EXPO_PUBLIC_API_URL 覆寫（expo 內建 env 注入）。
 */
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

/** Production API origin（與 Web Frontend / MiniProgram 共用同一個 backend） */
export const API_BASE_URL = EXPO_PUBLIC_API_URL || 'https://linkcard.xyz/api';

/** Axios 全域逾時（毫秒） */
export const API_TIMEOUT_MS = 15000;

/** SecureStore 儲存 key（與 Promoter App 分離，避免 token 互相覆寫） */
export const TOKEN_STORAGE_KEY = 'lc_event_admin_token';