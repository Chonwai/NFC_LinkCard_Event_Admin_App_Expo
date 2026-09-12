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
    if (error === null || typeof error !== 'object') {
        return null;
    }
    return error as ApiErrorShape;
}

/** 取 HTTP 狀態碼 */
export function getApiErrorStatus(error: unknown): number | null {
    const status = asApiError(error)?.response?.status;
    return typeof status === 'number' ? status : null;
}

/** 取後端錯誤碼 */
export function getApiErrorCode(error: unknown): string | null {
    const code = asApiError(error)?.response?.data?.error?.code;
    return typeof code === 'string' && code !== '' ? code : null;
}

/** 取出可顯示的錯誤訊息 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
    const serverMessage = asApiError(error)?.response?.data?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim() !== '') {
        return serverMessage;
    }
    return fallback;
}

/**
 * 永久性憑證失敗碼
 * 對於 LinkCard 用戶，401/403 通常意味著 token 失效或帳號問題。
 */
const TERMINAL_AUTH_CODES = new Set(['USER_SUSPENDED', 'INVALID_TOKEN']);

export type TerminalAuthReason = 'expired' | 'suspended';

/**
 * 憑證是否已永久失效
 */
export function getTerminalAuthReason(error: unknown): TerminalAuthReason | null {
    const status = getApiErrorStatus(error);
    const code = getApiErrorCode(error);

    if (status === 401) {
        return 'expired';
    }

    if (status === 403 && code != null && TERMINAL_AUTH_CODES.has(code)) {
        return 'suspended';
    }

    return null;
}

/** 是否為網路層錯誤（axios 特徵推斷） */
export function isNetworkError(error: unknown): boolean {
    const shaped = asApiError(error);

    if (shaped == null) {
        return false;
    }

    if (shaped.response != null) {
        return false;
    }

    if (shaped.code === 'ECONNABORTED' || shaped.code === 'ERR_NETWORK') {
        return true;
    }

    /** axios 在無 response 時的預設訊息 */
    return /network error|failed to fetch|socket hang up|timeout of \d+ms exceeded/i.test(
        shaped.message ?? ''
    );
}

/** 是否為伺服器端錯誤（5xx） */
export function isServerError(error: unknown): boolean {
    const status = getApiErrorStatus(error);
    return status != null && status >= 500;
}
