/**
 * LinkCard Event Admin App — API 型別（單一真相來源）
 *
 * 與 LinkCard backend 的回應 envelope 對齊：
 *   成功：`{ success: true, data: T }`
 *   失敗：`{ success: false, error: { code, message } }`
 *
 * 註：LinkCard 後端實際回傳結構為 `ApiResponse.success(res, result)`，
 * 登入回應即為 `{ success, data: { token, user } }`（與 Promoter 的
 * `{ success, data: LoginResponse }` envelope 相同）。
 */

/** 後端統一回應 envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

/** 後端錯誤 envelope（`api-error.ts` 以結構型別讀取，不 import axios） */
export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  /** Backend returns snake_case field name from the User model */
  display_name?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/** 活動狀態（源自 backend Event model） */
export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_OPEN"
  | "ONGOING"
  | "ENDED"
  | "CANCELLED";

/** 我的活動清單項目（GET /v1/events/my-managed） */
export interface ManagedEventItem {
  id: string;
  slug: string;
  name: string;
  status: EventStatus | string;
  userRole: string;
  registrationCount?: number;
  exhibitorCount?: number;
}

/** 報名基本欄位（by-code / checkin 實測為 flat 欄位） */
export interface Registration {
  id: string;
  registrationCode: string;
  status: string;
  /** 部分回應可能缺此欄 */
  eventId?: string;
  createdAt?: string;
  /** flat 身分欄（staging 實測） */
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  registrantType?: string | null;
  tokenBalance?: number | null;
  checkedInAt?: string | null;
  ticketType?: { name?: string; title?: string } | null;
  /** 舊/擴充形狀（可選） */
  profile?: {
    fullName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
  };
  customFields?: Record<string, unknown>;
  formData?: Record<string, unknown>;
  /** C-1: 完整 URL（含 origin）；null＝profile 尚未就緒（X-23 預設讀此欄，不自組 origin） */
  profileUrl?: string | null;
  /**
   * `WP-R2`（Loop AF R2）：報到台「LinkCard 帳號」三態。`null`＝無 user（未建檔）；
   * `true`／`false`＝已激活／已建檔未激活。**選配**：舊 BE 未部署此欄 ⇒
   * `undefined`，畫面自動降級（不渲染該列）。僅認證端點（checkin）會回傳；
   * 公開端點（by-code）不會有此欄位。
   */
  isActivated?: boolean | null;

  // ── 名單端點會回、但 App 先前沒有建模的欄位 ──────────────────────────────
  // 來源：`EventRegistrationService.listRegistrations` 的 select。
  // 前端 counterpart：`LinkCard_Frontend/lib/events/types.ts:521-542`。
  //
  // ⚠️ 範圍限制：**只有 `GET /:eventId/registrations` 會回這幾欄**。
  // `GET …/registrations/by-code/:code` 的 select 沒有它們
  // （`EventRegistrationService.getRegistrationByCode`），
  // 所以在詳情頁（走 by-code）渲染這些欄位只會得到永遠的「—」——
  // 那正是 `approvedBy` 已經犯過的錯。要顯示，先換資料來源。
  /** 誰核銷／修正了報到（稽核軌跡）。 */
  checkedInBy?: string | null;
  /** 封存時間；非 null 表示已被主辦封存。 */
  archivedAt?: string | null;
  /** 保證金退款時間；非 null 即「已退」。 */
  depositRefundedAt?: string | null;
  depositRefundedBy?: string | null;
  /** Decimal 以字串回傳（Prisma Decimal → JSON）。 */
  depositRefundedAmount?: string | null;
  depositRefundedReference?: string | null;
  depositRefundedNote?: string | null;
}

export interface TicketTypeItem {
  id: string;
  name?: string;
  displayName?: string;
  price?: number | string;
  currency?: string;
  isHidden?: boolean;
}

export interface WalletTransactionItem {
  id: string;
  type: string;
  amount: number;
  /**
   * 交易後餘額。後端 `EventWalletService.getTransactionHistory` 的 `select`
   * 一定有這個欄位，App 先前漏接——於是畫面只能顯示異動量，看不到「剩下多少」。
   */
  balanceAfter: number;
  description?: string | null;
  /**
   * 交易來源別（`MANUAL` / `STRIPE` / …）。後端有 select，App 先前漏接。
   *
   * ⚠️ 這裡**沒有** `approvedBy`：後端的 select 從來沒有這個欄位。
   * 舊版型別宣告了它、UI 也照著渲染，於是每一行都顯示「—」——
   * 看起來像「沒有人員記錄」，實際上是「這個欄位不存在」。見
   * `docs/analysis/adminapp-parity-20261022/03-semantic-drift.md` §S-2。
   */
  sourceType?: string | null;
  createdAt: string;
}

export interface WalletTransactionPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * `GET /:eventId/wallet/:registrationId/transactions` 的完整回應。
 *
 * 後端預設 `page=1&limit=20`；不讀 `pagination` 的呼叫端會靜默只看得到
 * 前 20 筆（S-2）。
 */
export interface WalletTransactionList {
  transactions: WalletTransactionItem[];
  pagination?: WalletTransactionPagination;
}
export interface CheckInResult {
  registration: Registration;
  checkedInAt: string;
  alreadyCheckedIn?: boolean;
}

/** Badge 狀態（nfc badges list） */
export type BadgeStatus =
  "UNASSIGNED" | "BOUND" | "ACTIVE" | "DEACTIVATED" | "LOST";

export interface BadgeInfo {
  tagUid: string;
  status: BadgeStatus;
  registrationId: string | null;
  boundAt: string | null;
}

/**
 * GET /nfc/lookup 實際回傳（EventRegistrationService.lookupNfcBadge）。
 * 公開查詢綁定後的參加者摘要，**不是** `{ badge: BadgeInfo }`。
 */
export interface NfcLookupResult {
  profileUrl: string | null;
  displayName: string;
  company: string | null;
  jobTitle: string | null;
  registrantType: string;
  registrationId: string | null;
}

/**
 * 交換類型。鏡射 `FE:lib/events/types.ts:93`（桌台只會用到 `PEER_TO_PEER`）。
 *
 * 註：BE enum（`BE:prisma/schema.prisma:986-991`）另有第 4 值 `QR_SCAN`，
 * FE／ADM 皆未提供（已登記為 `R-DK-07`）；`POST /nfc/exchange` 的 DTO 以
 * `@IsEnum(ExchangeType)` 驗證，送未知值會回 **422 `VALIDATION_ERROR`**。
 */
export type ExchangeType =
  "PEER_TO_PEER" | "EXHIBITOR_LEAD_SCAN" | "ATTENDEE_BOOTH_TAP";

/**
 * `POST /api/v1/events/:eventId/nfc/exchange` 的回應（WP-20 落點 #1）。
 *
 * 與 `FE:lib/events/nfc.ts:41-52` 的 `RecordNfcExchangeResult` **逐字同構**
 * （Loop AB · WP-19 契約）。BE `EventNfcExchangeService.recordExchange` 有兩個
 * 成功分支、**皆回 201**：
 *   - 首交換 → `{ alreadyExchanged: false, contactsExchanged: 2 }`（`:81`）
 *   - 重複   → `{ alreadyExchanged: true, exchangeId }`（`:58`）
 * 兩個分支都**不會**同時帶三個鍵 ⇒ 只有 `alreadyExchanged` 保證存在，
 * 其餘兩者皆為 optional。
 */
export interface RecordNfcExchangeResult {
  alreadyExchanged: boolean;
  exchangeId?: string;
  contactsExchanged?: number;
}
