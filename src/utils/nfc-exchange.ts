/**
 * `WP-20`（`93-plan-desk-nfc-pack.md` §2.3）交換流程的**純邏輯**。
 *
 * 為什麼獨立成模組：AdminApp 沒有元件層測試（`node:test`，無 jsdom／RN renderer），
 * 留在畫面檔裡的規則只能被「掃原始碼字串」驗到——那正是 Loop AB · Batch A 驗收
 * `M-03` 的缺口。搬到 `src/utils/**` 之後即可沿用既有慣例
 * （`nfc-bind-errors.ts`／`desk-handoff.ts`）對**行為**下斷言。
 *
 * 界線：本檔不含任何 React／RN 依賴、不碰 state、不發網路請求。畫面只負責把
 * 這裡的決策接上 UI；`readTagUid()`／`startNfc()` 仍由畫面呼叫既有原子
 * （`@/utils/nfc-utils`，N-6：**不新寫 NFC 驅動層**）。
 *
 * 依賴 `nfc-utils` 的理由與 `nfc-bind-errors.ts` 相同：`normalizeTagUid` 是
 * UID 正規化的**單一真相來源**，在這裡再寫一份等價函式會製造第二份規則
 * （CR-D4）。因此本模組的測試同樣只 mock `react-native`。
 */
import { getApiErrorCode, getApiErrorStatus } from "@/utils/api-error";
import { NfcFlowError, normalizeTagUid } from "@/utils/nfc-utils";

/**
 * 交換失敗的畫面分類。成功態（含「已交換過」的冪等態）不在此列。
 *
 * 每個值都必須對應一句**可執行的現場指示**——`AC-20-6`／`AC-20-7` 要求
 * 「不要只顯示原始錯誤」。
 */
export type ExchangeFailureKind =
  | "unsupported"
  | "invalid-uid"
  | "same-badge"
  | "card-not-bound"
  | "initiator-not-bound"
  | "receiver-not-bound"
  | "deactivated"
  | "identifier-missing"
  | "rejected"
  | "unauthorized"
  | "network"
  | "server"
  | "failed";

/** 「尚未綁定」語意的後端碼（lookup 與 exchange 共用同一批）。 */
const NOT_BOUND_CODES = new Set([
  "NFC_BADGE_NOT_BOUND",
  "INITIATOR_BADGE_NOT_BOUND",
  "RECEIVER_BADGE_NOT_BOUND",
  "BADGE_NOT_BOUND",
]);

const DEACTIVATED_CODES = new Set([
  "NFC_BADGE_DEACTIVATED",
  "BADGE_DEACTIVATED",
  "INITIATOR_BADGE_DEACTIVATED",
  "RECEIVER_BADGE_DEACTIVATED",
]);

const IDENTIFIER_MISSING_CODES = new Set([
  "INITIATOR_IDENTIFIER_MISSING",
  "RECEIVER_IDENTIFIER_MISSING",
]);

/** Value 未經 `AxiosError` 包裝時的網路錯誤碼（`api-error.ts` 同族）。 */
const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ERR_NETWORK",
  "ETIMEDOUT",
  "ENETUNREACH",
  "ECONNREFUSED",
  "ERR_BAD_RESPONSE",
]);

/**
 * 把讀卡例外與後端交換錯誤，收斂成互斥的畫面分類。
 *
 * 判定順序刻意是「先具體後泛用」：
 * 1. `NfcFlowError`（讀卡層，無 HTTP）→ 直接映射；
 * 2. 有後端 `code` → 逐碼判定（`RECEIVER_BADGE_NOT_BOUND` 必須先於泛用的
 *    `NOT_BOUND`／`404`，否則現場會拿到「你的卡沒綁」這種**指錯邊**的指示）；
 * 3. 只有狀態碼時退回 `404 → receiver-not-bound`／`400 → invalid-uid`／
 *    `422 → rejected`／`401|403 → unauthorized`／`5xx → server`；
 * 4. 其餘 → `failed`（永遠不得當成成功）。
 */
export function classifyExchangeError(error: unknown): ExchangeFailureKind {
  if (error instanceof NfcFlowError) {
    // `unsupported`＝web 或裝置不支援；呼叫端再依 Platform 決定文案。
    if (error.kind === "unsupported") return "unsupported";
    if (error.kind === "invalid-uid") return "invalid-uid";
    // timeout／cancelled／write-failed／uri-mismatch 在「只讀不寫」的交換流程
    // 都代表「這次沒讀到卡」，一律收斂成讀取失敗（畫面文案相同）。
    return "invalid-uid";
  }

  const code = (getApiErrorCode(error) ?? "").toUpperCase();

  // 先判「哪一張卡沒綁」——這是最常見的現場失敗，且必須指對邊。
  if (code === "RECEIVER_BADGE_NOT_BOUND") return "receiver-not-bound";
  if (code === "INITIATOR_BADGE_NOT_BOUND") return "initiator-not-bound";

  if (code === "SAME_BADGE_EXCHANGE") return "same-badge";
  if (DEACTIVATED_CODES.has(code)) return "deactivated";
  if (IDENTIFIER_MISSING_CODES.has(code)) return "identifier-missing";
  if (code === "VALIDATION_ERROR") return "rejected";
  // 讀卡階段的公開 lookup 用的就是這個碼（`lookupNfcBadge` 的 `NFC_BADGE_NOT_BOUND`）。
  if (NOT_BOUND_CODES.has(code)) return "card-not-bound";
  if (NETWORK_ERROR_CODES.has(code)) return "network";

  const status = getApiErrorStatus(error);
  if (status == null) {
    // 有 code 但無 response ⇒ 多半是網路層；無 code 且非 NfcFlowError ⇒ 不明例外。
    return code === "" ? "failed" : "network";
  }
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "receiver-not-bound";
  if (status === 422) return "rejected";
  if (status === 400) return "invalid-uid";
  if (status >= 500) return "server";
  return "failed";
}

/** 第一張卡是否已讀到（`null`＝尚未讀到）。 */
export interface ExchangeCapture {
  initiatorUid: string | null;
}

export type CaptureDecision =
  | { action: "set-initiator"; uid: string }
  | { action: "set-receiver"; uid: string }
  | { action: "reject-same-badge" };

/**
 * 讀到一張卡之後要做什麼。
 *
 * 自換（同一張卡感應兩次）**在前端就要擋**，不是等後端回
 * `SAME_BADGE_EXCHANGE`：`AC-20-5` 要求「不消耗第一張卡狀態（可重試第二張）」，
 * 若送出去才被拒絕，操作者會以為整筆失敗。
 *
 * 比較採 `normalizeTagUid`（大小寫／分隔符無關），與後端同語意。
 */
export function decideCapture(
  capture: ExchangeCapture,
  scannedUid: string,
): CaptureDecision {
  if (capture.initiatorUid == null) {
    return { action: "set-initiator", uid: scannedUid };
  }
  if (normalizeTagUid(scannedUid) === normalizeTagUid(capture.initiatorUid)) {
    return { action: "reject-same-badge" };
  }
  return { action: "set-receiver", uid: scannedUid };
}

export type SubmitDecision =
  | { action: "submit"; initiatorUid: string; receiverUid: string }
  | { action: "incomplete" }
  | { action: "reject-same-badge" }
  | { action: "duplicate" };

/** 交換配對的識別鍵（**無序**：A↔B 與 B↔A 是同一筆交換）。 */
export function exchangePairKey(
  initiatorUid: string,
  receiverUid: string,
): string {
  const pair = [
    normalizeTagUid(initiatorUid),
    normalizeTagUid(receiverUid),
  ].sort();
  return pair.join(">");
}

/**
 * 送不送 `POST /nfc/exchange`。
 *
 * `lastSubmittedPair` 是**前端**的防重送：後端雖冪等（同 pair 第二次不再寫 DB），
 * 但重複出網仍是無謂的現場延遲，且會讓操作者看到兩次「已交換」。
 * 注意這**不是**取代後端冪等，只是少打一次。
 */
export function decideSubmit(
  initiatorUid: string | null,
  receiverUid: string | null,
  lastSubmittedPair: string | null = null,
): SubmitDecision {
  if (!initiatorUid || !receiverUid) return { action: "incomplete" };
  if (normalizeTagUid(initiatorUid) === normalizeTagUid(receiverUid)) {
    return { action: "reject-same-badge" };
  }
  if (
    lastSubmittedPair != null &&
    lastSubmittedPair === exchangePairKey(initiatorUid, receiverUid)
  ) {
    return { action: "duplicate" };
  }
  return { action: "submit", initiatorUid, receiverUid };
}
