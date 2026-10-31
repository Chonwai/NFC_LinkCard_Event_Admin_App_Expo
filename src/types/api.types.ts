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

/**
 * 報名的「email 狀態」七態。
 *
 * 來源：BE `src/events/services/registrationEmailStatus.ts` 的
 * `RegistrationEmailState`；前端 counterpart：`LinkCard_Frontend/lib/events/types.ts:479-487`。
 * 語意（照抄 Web 的註解，避免兩邊對同一態有不同解釋）：
 * - `AWAITING_PAYMENT` 銀行轉帳未審批 → **依設計不寄**（審批通過才寄）
 * - `NO_ACCOUNT`       報名無帳號連結 → 需先建檔才會有 claim 信
 * - `CLAIMED`          已 claim（帳號已啟用）
 * - `NOT_REQUIRED`     帳號已驗證 → 走確認信，不需 claim
 * - `SEND_FAILED`      有錯誤痕跡 → 可重試
 * - `SENT_NOT_OPENED`  已寄出、尚未 claim
 * - `NOT_SENT`         應寄但從未寄、也無錯誤痕跡（歷史事故特徵）
 */
export type RegistrationEmailState =
  | "AWAITING_PAYMENT"
  | "NO_ACCOUNT"
  | "CLAIMED"
  | "NOT_REQUIRED"
  | "SEND_FAILED"
  | "SENT_NOT_OPENED"
  | "NOT_SENT";

/**
 * 管理名單每列附掛的 email 狀態。
 *
 * 鏡射 `LinkCard_Frontend/lib/events/types.ts:487-514`，逐欄同構：BE 的
 * `deriveRegistrationEmailStatus` 產出什麼，這裡就收什麼，**不多也不猜**。
 */
export interface RegistrationEmailStatus {
  state: RegistrationEmailState;
  claimEmail: {
    sentAt: string | null;
    error: string | null;
    hasActiveToken: boolean;
  };
  claim: { claimedAt: string | null };
  /** outbox 通知（確認信／受理信…）的投遞狀態與重試次數。 */
  notifications: {
    eventType: string;
    status: "PENDING" | "PROCESSED" | "FAILED";
    attempts: number;
    lastError: string | null;
    processedAt: string | null;
  }[];
  /**
   * provider 回報的**送達證明**（webhook 落地的最新一筆）。
   * `null` ＝ 沒有證據——**不是**「沒送達」。
   */
  delivery?: {
    lastEventType: "DELIVERED" | "BOUNCED" | "COMPLAINED" | "OPENED" | "OTHER";
    occurredAt: string;
    provider: string;
  } | null;
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
  /**
   * 票種。後端兩條路徑（名單與 by-code）都只回 `displayName`——
   * `name`／`title` 是舊版型別的誤植，留著只為了容忍快取裡的舊資料。
   */
  ticketType?: {
    id?: string;
    displayName?: string | null;
    name?: string;
    title?: string;
  } | null;
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
  /**
   * 報名是否被主辦「隱藏」（資料品質管理，不是封存）。
   *
   * 只有 `GET /:eventId/registrations` 的 select 有這一欄
   * （`EventRegistrationService.listRegistrations`），`by-code` 沒有——
   * 同上一段警告：詳情頁不得渲染它。
   */
  isHidden?: boolean | null;
  /** 隱藏原因（`hide` 的 `reason`）。 */
  hiddenReason?: string | null;
  /** 封存時間；非 null 表示已被主辦封存。 */
  archivedAt?: string | null;
  /** 封存原因（`archive` 的 `reason`）。 */
  archivedReason?: string | null;
  /** 保證金退款時間；非 null 即「已退」。 */
  depositRefundedAt?: string | null;
  depositRefundedBy?: string | null;
  /** Decimal 以字串回傳（Prisma Decimal → JSON）。 */
  depositRefundedAmount?: string | null;
  depositRefundedReference?: string | null;
  depositRefundedNote?: string | null;
  /**
   * 這一筆的 email 狀態（claim 信／確認信的投遞實況）。
   *
   * ⚠️ **只有 `GET /:eventId/registrations` 會回這一欄**
   * （`EventRegistrationService.listRegistrations:1987`）。`by-code` 的 select
   * 沒有它，所以詳情頁（走 by-code）渲染它只會得到永遠的「未知」。
   *
   * 也可能合法地是 `null`：BE 是 `emailStatusByRegistration.get(id) ?? null`，
   * 帳號與 outbox 資料都湊不出狀態時就是 `null`。呼叫端**不得**把 `null`
   * 當成任何一種狀態顯示——那是「不知道」，不是「沒寄」。
   */
  emailStatus?: RegistrationEmailStatus | null;
}

/**
 * 後台狀態修正可用的目標狀態。由後端轉移表決定，App 只鏡射值域、不自行判斷
 * 合法性（不合法會回 `409 STATUS_TRANSITION_NOT_ALLOWED`）。
 */
export type RegistrationStatusCorrectionTarget = "CONFIRMED" | "CHECKED_IN";

/**
 * `POST …/registrations/:id/status` 的回應。
 *
 * ⚠️ 這**不是**整筆 registration：後端只回白名單 6 欄。呼叫端要用它同步畫面時
 * 只能改這幾欄，其他欄位（`isHidden`、`depositRefundedAt`…）必須重新載入名單。
 */
export interface RegistrationStatusCorrectionResult {
  id: string;
  registrationCode: string;
  status: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
  updatedAt: string;
}

/**
 * `GET …/registrations/:id/activation-link` 的回應（單筆 claim 狀態）。
 *
 * 鏡射 `LinkCard_Frontend/lib/events/registrations.ts:392-403`。
 *
 * ⚠️ `activationToken`／`activationUrl` 只在「該人**已經**持有有效 token」時
 * 有值。App 只走唯讀探針（`?readonly=1`，見
 * `registrationService.getActivationLinkStatus`），所以那些值**永遠不會是本輪
 * 新造的**——它們只反映原本就存在的事實。
 */
export interface ActivationLinkInfo {
  email: string;
  firstName: string;
  lastName: string;
  isActivated: boolean;
  userId: string | null;
  activationToken: string | null;
  activationUrl: string | null;
  /** 這一輪**是否**簽發了新 token。唯讀探針恆為 `false`。 */
  issued?: boolean;
}

/**
 * `POST …/registrations/:id/activation-link`（BE-02）的回應。
 * `activationEmailSentAt` 由後端寫入後回傳——它是「這次寄信的證據」。
 */
export interface ResendActivationEmailResult {
  email: string;
  activationEmailSentAt: string;
}

/**
 * `POST …/registrations/:id/resend-confirmation` 的回應。
 *
 * 鏡射 `LinkCard_Frontend/lib/events/registrations.ts:477-481`。
 *
 * ⚠️ 回應只保證**已排入佇列**：真正寄出由 relay cron（每 5 分鐘一輪）接手。
 * 畫面不得因此顯示「已寄出」——只能說「已排入佇列」。
 */
export interface ResendConfirmationResult {
  outboxId: string;
  created: boolean;
  email: string;
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

/**
 * 一種資源的計數（`GET /api/v1/events/:eventId/manage-stats` 每個 key 的形狀）。
 *
 * `byStatus` 只列**真的有資料**的狀態——BE `EventService.getManageStats`
 * （`BE:src/events/services/EventService.ts:633`）刻意不補 0，所以呼叫端要自己
 * 用 `?? 0` 取值。把「狀態不存在」與「該狀態 0 筆」混為一談，會讓剛開好的活動
 * 看起來像載入失敗。
 *
 * 鏡射 `FE:lib/events/events.ts:130`（`ResourceCounts`），逐字同構。
 */
export interface ResourceCounts {
  total: number;
  byStatus: Record<string, number>;
}

/**
 * 管理後台聚合計數（`GET /api/v1/events/:eventId/manage-stats`）。
 *
 * 一次拿齊報名／參展／轉帳的數量，取代「每個數字各打一次列表端點讀
 * `pagination.total`」。鏡射 `FE:lib/events/events.ts:136`。
 *
 * 需要活動**寫入權限**（BE `EventController.getManageStats` 以
 * `getEventWriteAccess === 'ALLOWED'` 把關）；OPERATOR 回 403——業務數字不給
 * 操作員。這與 `my-access` 的 `canManage` 是同一條判定。
 */
export interface EventManageStats {
  registrations: ResourceCounts;
  exhibitors: ResourceCounts;
  bankTransfers: ResourceCounts;
}
