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

/**
 * 非開發建置缺少 `EXPO_PUBLIC_API_URL` 時的處理（`F-07`，2026-10-15）。
 *
 * 對齊 Promoter App 的 `W-24`：**不 throw**（module-load throw 會白屏、且沒有任何
 * 錯誤畫面），改為回傳可判讀的 `missing-api-url` 狀態，由 `api.ts` 的 request
 * interceptor 在送出任何請求前攔下。
 *
 * 為什麼要攔：舊行為是 `EXPO_PUBLIC_API_URL || "https://linkcard.xyz"`——
 * 一個漏設變數的 preview／staging build 會**靜默打 production**。報到、walk-in、
 * NFC 綁卡都是**寫入**操作，這條路徑會寫進 production 資料。
 *
 * `.env.example` 早就宣稱有此 guard，但程式碼裡從來沒有——本檔把宣稱變成事實。
 */
export type ApiConfig =
  | { ok: true; apiBaseUrl: string; source: "env" | "dev-fallback" }
  | { ok: false; reason: "missing-api-url" };

/**
 * 設定無效時 `api.ts` 拒絕請求所用的錯誤碼。
 *
 * 由 `config.ts` 擁有而非散在 service 內：這是常數契約的一部分，需要能在 Node
 * 下被行為測試（`.tsx` 沒有 renderer，測不到畫面分支）。
 */
export const APP_CONFIG_INVALID_CODE = "APP_CONFIG_INVALID";

/** 本機後端預設 origin（僅在「非確定 production」的建置允許） */
const LOCAL_DEV_API_ORIGIN = "http://127.0.0.1:3020";

/**
 * 只有 `__DEV__` **明確為 `false`** 才算「確定非開發」。
 *
 * 未定義（Node 單元測試、部分 web build）時**不放行**攔截，避免把測試環境誤判成
 * `missing-api-url`——條件刻意與 Promoter `W-24` 對齊。以 `globalThis` 讀取是為了
 * 在沒有 RN 型別宣告的 Node 測試下也能編譯。
 */
export function isKnownNonDevRuntime(): boolean {
  return (globalThis as { __DEV__?: boolean }).__DEV__ === false;
}

/** 純解析（可測）：不 throw、不讀取憑證、不把內部細節放進 `reason`。 */
export function resolveApiConfig(
  envUrl: string | undefined,
  isKnownNonDev: boolean,
): ApiConfig {
  const raw = envUrl?.trim();
  if (raw) {
    return { ok: true, apiBaseUrl: normalizeApiOrigin(raw), source: "env" };
  }
  if (isKnownNonDev) {
    return { ok: false, reason: "missing-api-url" };
  }
  return {
    ok: true,
    apiBaseUrl: normalizeApiOrigin(LOCAL_DEV_API_ORIGIN),
    source: "dev-fallback",
  };
}

/** 本次啟動解析出的 API 設定；`ok === false` 時**不得**發出任何請求。 */
export const API_CONFIG: ApiConfig = resolveApiConfig(
  EXPO_PUBLIC_API_URL,
  isKnownNonDevRuntime(),
);

/**
 * 設定無效時用來**取代** baseURL 的不可路由位址。
 *
 * 第二道防線：即使有請求繞過了 interceptor 的攔截，也只會得到「連線被拒」，
 * 而不是打到 production。
 */
const UNROUTABLE_API_ORIGIN = "http://127.0.0.1:1";

export const API_BASE_URL = API_CONFIG.ok
  ? API_CONFIG.apiBaseUrl
  : UNROUTABLE_API_ORIGIN;

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
 * 報到成功態的自動返回等待（毫秒；`INC-2`／Loop AF，2026-10-05）。
 *
 * 現場回報：3 秒不足以讀完六列資訊（5–8 秒）再決定「寫卡／繼續掃碼」——
 * 操作者與計時器賽跑，只能重掃同一張碼。15 秒是「從容讀完＋決策」的合理
 * 上限；保留有限計時＝佇列自癒（忘了按也不會永遠卡在成功態），同時另備
 * 顯式「繼續掃碼」按鈕，操作者隨時可主動返回。
 *
 * `WP-R2`（Loop AF R2）：`0`＝**不自動返回**——成功態就留在畫面上，僅由
 * 操作者按按鈕離開（PM：有些現場節奏需要「畫面就一直留着」）。語意由
 * `shouldAutoResetCheckIn()` 統一判讀；預設值維持 15 秒不變。
 */
export const CHECK_IN_AUTO_RESET_MS = 15000;

/**
 * `WP-R2`：是否要排程「成功態自動返回」與渲染倒數提示。
 *
 * `ms <= 0`（現行語意：`0`＝永不自動返回）回 `false`——畫面據此不排程
 * 計時器、也不渲染提示列。抽成函式而非在畫面內散寫 `> 0`：這是常數
 * 契約的一部分，需要能在 Node 下被行為測試（`.tsx` 沒有 renderer，
 * 測不到畫面分支）。
 */
export function shouldAutoResetCheckIn(
  ms: number = CHECK_IN_AUTO_RESET_MS,
): boolean {
  return ms > 0;
}

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
