/**
 * API 錯誤收斂
 */

/** 後端統一的錯誤 envelope */
interface ApiErrorShape {
  response?: {
    status?: number;
    data?: { error?: { code?: string; message?: string } };
  };
  code?: string;
  message?: string;
}

function asApiError(error: unknown): ApiErrorShape | null {
  if (error === null || typeof error !== "object") {
    return null;
  }
  return error as ApiErrorShape;
}

/** 取 HTTP 狀態碼 */
export function getApiErrorStatus(error: unknown): number | null {
  const status = asApiError(error)?.response?.status;
  return typeof status === "number" ? status : null;
}

/** 取後端錯誤碼 */
export function getApiErrorCode(error: unknown): string | null {
  const code = asApiError(error)?.response?.data?.error?.code;
  return typeof code === "string" && code !== "" ? code : null;
}

/** 取出可顯示的錯誤訊息 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const serverMessage = asApiError(error)?.response?.data?.error?.message;
  if (typeof serverMessage === "string" && serverMessage.trim() !== "") {
    return serverMessage;
  }
  return fallback;
}

/**
 * 永久性憑證失敗碼
 * 對於 LinkCard 用戶，401/403 通常意味著 token 失效或帳號問題。
 */
const TERMINAL_AUTH_CODES = new Set(["USER_SUSPENDED", "INVALID_TOKEN"]);

export type TerminalAuthReason = "expired" | "suspended";

/**
 * 憑證是否已永久失效
 */
export function getTerminalAuthReason(
  error: unknown,
): TerminalAuthReason | null {
  const status = getApiErrorStatus(error);
  const code = getApiErrorCode(error);

  if (status === 401) {
    return "expired";
  }

  if (status === 403 && code != null && TERMINAL_AUTH_CODES.has(code)) {
    return "suspended";
  }

  return null;
}

/**
 * axios / Node 的網路層錯誤碼（A9）。
 *
 * axios v1 在「連不上 / 逾時」時**沒有** `response`，並以 `error.code` 標示型別；
 * 只認 `ECONNABORTED` / `ERR_NETWORK` 會讓 `ETIMEDOUT`（Node 逾時）與
 * `ENETUNREACH`（無路由，常見於切換 Wi-Fi/基地台）被誤歸類為後端錯誤。
 */
const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ERR_NETWORK",
  "ETIMEDOUT",
  "ENETUNREACH",
]);

/**
 * 是否為網路層錯誤（axios 特徵推斷）
 *
 * 判定順序（A9）：**`error.code` 優先於 `error.message`**——`code` 是穩定的機器
 * 可讀欄位，`message` 會隨 axios 版本改寫。因此只要 `code` 存在，就以它作唯一依據
 * （不在集合內＝非網路錯誤），不再用 message 文字猜測；只有完全沒有 `code` 時才
 * 退回 message 特徵。
 */
export function isNetworkError(error: unknown): boolean {
  const shaped = asApiError(error);

  if (shaped == null) {
    return false;
  }

  /** 有 response = 伺服器有回應，屬後端錯誤而非網路錯誤 */
  if (shaped.response != null) {
    return false;
  }

  if (typeof shaped.code === "string" && shaped.code !== "") {
    return NETWORK_ERROR_CODES.has(shaped.code);
  }

  /** axios 在無 response 且無 code 時的預設訊息 */
  return /network error|failed to fetch|socket hang up|timeout of \d+ms exceeded/i.test(
    shaped.message ?? "",
  );
}

/** 是否為伺服器端錯誤（5xx） */
export function isServerError(error: unknown): boolean {
  const status = getApiErrorStatus(error);
  return status != null && status >= 500;
}
