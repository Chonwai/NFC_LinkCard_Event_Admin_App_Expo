/**
 * LinkCard Event Admin App — 環境設定（單一真相來源）
 *
 * 與 Promoter App 的 config.ts 對齊：`EXPO_PUBLIC_API_URL` 是後端 API 的
 * **origin（不含 `/api`）**，本地開發可用它覆寫（expo 內建 env 注入）。
 */
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

/**
 * API **origin**（與 Web Frontend / MiniProgram 共用同一個 backend）。
 *
 * ⚠️ 必須是 origin，**不含 `/api`**：service 一律用絕對路徑
 * （`/api/v1/...`，見 `src/services/*.service.ts`），硬接起來會得到
 * `https://linkcard.xyz/api/api/v1/...`（`F-06`）。Promoter App 的 config.ts
 * 已把這個值定義成「origin（不含 `/api`）」，本函式只是把那條契約寫成程式。
 *
 * 舊預設值 `https://linkcard.xyz/api` 因此是壞的：它長期沒被發現，只因為
 * EAS 每個 profile 都提供 origin-only 的 `EXPO_PUBLIC_API_URL` 把它遮住，
 * 而任何缺這個變數的建置會拿到 404 而不是「設定錯誤」。尾綴一併剝除，因為
 * 這個值也會由人手填進 EAS 環境變數，貼上含 `/api` 的網址是常見失誤。
 */
export function normalizeApiOrigin(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
}

export const API_BASE_URL = normalizeApiOrigin(
  EXPO_PUBLIC_API_URL || "https://linkcard.xyz",
);

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
 * 用戶端網頁 origin。NFC 寫入優先用 BE 回傳的完整 `profileUrl`（X-23）；
 * `buildRegistrationProfileUrl` 僅作 `/p/{slug}` 輔助組裝（同源 WEB_BASE_URL）。
 * 與 API origin 分開：staging API 與 staging Web 不是同一台。
 * 未設定時預設 production，確認頁會顯示實際網址，避免靜默寫錯環境。
 */
const EXPO_PUBLIC_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim();
export const WEB_BASE_URL = (
  EXPO_PUBLIC_WEB_URL || "https://linkcard.xyz"
).replace(/\/$/, "");

/** SecureStore 儲存 key（與 Promoter App 分離，避免 token 互相覆寫） */
export const TOKEN_STORAGE_KEY = "lc_event_admin_token";
