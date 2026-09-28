import { copy } from "@/constants/copy.zh-TW";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/api-error";

/**
 * 現場補報名的後端錯誤碼 → 現場文案（`ADM-02`／S4）。
 * 消費端：`app/(auth)/[eventId]/walk-in.tsx` 的 `submit()` catch。
 *
 * **誰是閘門**：只有伺服器是同意閘門。AdminApp **不做**本地旗標推論、也不假裝自己
 * 是閘門——它只把伺服器回的 `CONSENT_REQUIRED`／`CONSENT_VERSION_MISMATCH` 翻成
 * **可分辨**的現場文案（`03-contract-alignment § 3.4.3` 的 consumer action）。
 *
 * 兩碼的文案**必須互異**：把「條款改版、請重新同意」講成「請先同意條款」，現場人員
 * 會把人擋在錯誤的理由上（與 `check-in-errors.ts` 的 `CRA-V1-002` 同型：錯的訊息
 * 會讓第一線做出錯的處置）。
 *
 * 預設不擋：`EVENT_CONSENT_ENFORCE` 未設或非 `'true'` 時伺服器不會回這兩碼，
 * 此時本函式的作用等同 `getApiErrorMessage`——這是刻意的，不是漏接。
 */
export function mapWalkInError(error: unknown, fallback: string): string {
  switch (getApiErrorCode(error)) {
    case "EVENT_NOT_ACCEPTING_REGISTRATIONS":
      return copy.checkIn.walkInNotAccepting;
    case "CONSENT_REQUIRED":
      return copy.checkIn.walkInConsentRequired;
    case "CONSENT_VERSION_MISMATCH":
      return copy.checkIn.walkInConsentVersionMismatch;
    default:
      return getApiErrorMessage(error, fallback);
  }
}
