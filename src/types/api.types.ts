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
}

/** Check-in 成功結果 */
export interface CheckInResult {
  registration: Registration;
  checkedInAt: string;
  alreadyCheckedIn?: boolean;
}

/** Badge 狀態（nfc lookup / badges list） */
export type BadgeStatus =
  "UNASSIGNED" | "BOUND" | "ACTIVE" | "DEACTIVATED" | "LOST";

export interface BadgeInfo {
  tagUid: string;
  status: BadgeStatus;
  registrationId: string | null;
  boundAt: string | null;
}
