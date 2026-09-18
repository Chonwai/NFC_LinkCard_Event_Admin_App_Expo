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
  /**
   * 推廣者／活動營運身分。`GET /api/users/me` 在無此身分時回 `null`。
   * WP-A1：登入必須走 promoter claim 路徑後再讀此欄。
   */
  promoterRole?: {
    id?: string;
    roleType?: string;
    status?: string;
  } | null;
}

export interface LoginResponse {
  token: string;
  /** 秒；promoter login 會回，目前 App 不消費 TTL */
  expiresIn?: number;
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

/** 報名基本欄位（by-code lookup / check-in 結果） */
export interface Registration {
  id: string;
  registrationCode: string;
  status: string;
  eventId: string;
  createdAt: string;
  /** 報名者基本資料（欄位值依 event form 動態） */
  profile?: {
    fullName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
  };
  /** 動態欄位：由 event form 定義，key 為欄位 label */
  customFields?: Record<string, unknown>;
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
