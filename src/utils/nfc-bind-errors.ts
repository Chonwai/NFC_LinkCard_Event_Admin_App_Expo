import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";
import { NfcFlowError } from "@/utils/nfc-utils";

/** 寫卡 / 綁定失敗的畫面分類。成功態不在此列。 */
export type NfcBindFailureKind =
  | "unsupported"
  | "invalid-uid"
  | "duplicate"
  | "bound-other"
  | "write-failed"
  | "uri-mismatch"
  | "bind-failed";

const INVALID_UID_CODES = new Set([
  "INVALID_TAG_UID",
  "TAG_UID_INVALID",
  "TAG_UID_MISSING",
]);

const BOUND_OTHER_CODES = new Set([
  "REGISTRATION_ALREADY_BOUND",
  "REGISTRATION_HAS_BADGE",
  "BADGE_ALREADY_ASSIGNED",
]);

const DUPLICATE_CODES = new Set([
  "TAG_UID_ALREADY_EXISTS",
  "BADGE_ALREADY_BOUND",
  "TAG_ALREADY_BOUND",
  "DUPLICATE_TAG_UID",
  "DUPLICATE_TAG_UIDS",
]);

/**
 * 把寫卡例外與後端 bind 錯誤收成互斥的失敗種類。
 * 先判斷「報名已有卡」，再判斷「這張 UID 已被佔用」，避免 ALREADY 字樣互相蓋掉。
 */
export function classifyNfcBindError(error: unknown): NfcBindFailureKind {
  if (error instanceof NfcFlowError) {
    if (error.kind === "unsupported") return "unsupported";
    if (error.kind === "invalid-uid") return "invalid-uid";
    if (error.kind === "uri-mismatch") return "uri-mismatch";
    return "write-failed";
  }

  const code = (getApiErrorCode(error) ?? "").toUpperCase();
  if (
    INVALID_UID_CODES.has(code) ||
    code.includes("INVALID_TAG") ||
    code.includes("TAG_UID_MISSING")
  ) {
    return "invalid-uid";
  }
  if (
    BOUND_OTHER_CODES.has(code) ||
    code.includes("REGISTRATION_ALREADY") ||
    code.includes("ALREADY_HAS_BADGE")
  ) {
    return "bound-other";
  }
  if (
    DUPLICATE_CODES.has(code) ||
    code.includes("ALREADY_EXIST") ||
    code.includes("ALREADY_BOUND") ||
    code.includes("DUPLICATE")
  ) {
    return "duplicate";
  }

  const status = getApiErrorStatus(error);
  if (status === 409) return "duplicate";
  if (status === 400) return "invalid-uid";
  return "bind-failed";
}
