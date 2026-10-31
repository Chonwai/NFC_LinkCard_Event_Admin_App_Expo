import type {
  ApiResponse,
  EventDetail,
  EventManageStats,
  ManagedEventItem,
  Registration,
  TicketTypeItem,
  UpdateEventPayload,
} from "@/types/api.types";

import { apiClient } from "./api";

export interface ListPagination {
  total: number;
  page: number;
  limit?: number;
  pageSize?: number;
  pages?: number;
  totalPages?: number;
}

export function listPageCount(pagination?: ListPagination): number {
  return pagination?.totalPages ?? pagination?.pages ?? 1;
}

/**
 * 呼叫者在這場活動的實際權限（`GET /v1/events/:eventId/my-access`）。
 *
 * 後端是唯一權威（`EventController.getMyEventAccess` → `EventService`）：
 * `canManage` 需要 owner / SUPER_ADMIN / COORDINATOR；`canOperate` 另外包含
 * OPERATOR。
 *
 * ⚠️ 兩者是**不同**的能力，不要互相推導：
 * 現場工作人員可以報到（canOperate）但讀不到名單（canManage=false）。
 */
export interface EventAccess {
  canManage: boolean;
  canOperate: boolean;
  canInviteAdmins?: boolean;
  role?: string | null;
}

/** GET /v1/events/my-managed — 登入者擁有或 org-role 授權的活動 */
export const eventService = {
  /**
   * Backend 每筆 event 的 role/counts 放在 `_meta` 內層，這裡 unwrap 成
   * ManagedEventItem 的 top-level 欄位，讓 UI 不必知道 `_meta` 形狀。
   */
  async getMyManagedEvents(params?: {
    page?: number;
    limit?: number;
  }): Promise<{ events: ManagedEventItem[]; pagination?: ListPagination }> {
    const res = await apiClient.get<
      ApiResponse<{ events: ManagedEventItem[]; pagination?: ListPagination }>
    >("/api/v1/events/my-managed", { params });
    const data = res.data.data;

    const events = (data.events ?? []).map((item) => {
      const meta = (
        item as ManagedEventItem & { _meta?: Partial<ManagedEventItem> }
      )._meta;
      return {
        ...item,
        userRole: item.userRole ?? meta?.userRole,
        registrationCount: item.registrationCount ?? meta?.registrationCount,
        exhibitorCount: item.exhibitorCount ?? meta?.exhibitorCount,
      } as ManagedEventItem;
    });

    return { events, pagination: data.pagination };
  },

  /** GET /v1/events/by-id/:eventId — 單一活動（slug 或 id 皆可） */
  async getEventById(eventId: string): Promise<{ event: EventDetail }> {
    const res = await apiClient.get<ApiResponse<{ event: EventDetail }>>(
      `/api/v1/events/by-id/${encodeURIComponent(eventId)}`,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/my-access — 呼叫者在這場活動能做什麼。
   *
   * 這是「進去才撞牆」與「一開始就不顯示」的差別。前端自
   * `manage/[eventId]/layout.tsx` 起就用它當閘門；App 直到 2026-10-22 都沒接
   * （parity §S-6）。
   */
  async getMyAccess(eventId: string): Promise<EventAccess> {
    const res = await apiClient.get<ApiResponse<EventAccess>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/my-access`,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/manage-stats — 一次拿齊報名／參展／轉帳的計數。
   *
   * 取代舊做法：每個數字各打一次列表端點讀 `pagination.total`。overview 原本
   * 為了「報名總數」與「已報到數」各發一次 `getRegistrations({limit: 1})`，
   * 兩支請求換兩個整數（parity §G-10 的後半）。
   *
   * 權限與 `my-access` 的 `canManage` 是**同一個判定**（後端
   * `EventController.getManageStats` 用 `getEventWriteAccess === 'ALLOWED'`，
   * 而 `my-access` 的 `canManage` 正是同一條式子的結果），所以 `canManage` 為真
   * 時這支不會 403。OPERATOR 兩邊都被擋，不會出現「看得到入口卻撞牆」。
   */
  async getEventManageStats(eventId: string): Promise<EventManageStats> {
    const res = await apiClient.get<ApiResponse<EventManageStats>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/manage-stats`,
    );
    return res.data.data;
  },

  /** GET /v1/events/:eventId/registrations — 報名清單（寫入權限；OPERATOR 仍可能 403） */
  async getRegistrations(
    eventId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      ticketTypeId?: string;
      visibility?: string;
      /**
       * 保證金退款篩選。後端值域是 `all | refunded | not_refunded`
       * （`EventRegistrationController.ts:130-146`）；其他值會回
       * `400 INVALID_DEPOSIT_REFUND_FILTER`，所以型別收緊到同一個集合。
       */
      depositRefunded?: "all" | "refunded" | "not_refunded";
    },
  ): Promise<{ registrations: Registration[]; pagination?: ListPagination }> {
    const res = await apiClient.get<
      ApiResponse<{
        registrations: Registration[];
        pagination?: ListPagination;
      }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/registrations`, {
      params,
    });
    return res.data.data;
  },

  /** GET /v1/events/:eventId/ticket-types — 補報名選票種 */
  async listTicketTypes(
    eventId: string,
  ): Promise<{ ticketTypes: TicketTypeItem[] }> {
    const res = await apiClient.get<
      ApiResponse<{ ticketTypes: TicketTypeItem[] }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/ticket-types`);
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId — 更新活動本體與 `configJson`（活動資料／活動設定
   * 兩頁共用同一條路由，Web 也是）。
   *
   * 後端 `EventController.updateEvent`：先過 `UpdateEventDto`
   * （class-validator），再做 `getEventWriteAccess === 'ALLOWED'` 授權；
   * OPERATOR 與非成員都會 403 `INSUFFICIENT_PERMISSION`。
   *
   * 回傳整筆更新後的活動，呼叫端可直接覆蓋本地狀態（與 Web
   * `profile/page.tsx` 的 `setEvent(updated)` 相同），不必再補一次 GET。
   */
  async updateEvent(
    eventId: string,
    payload: UpdateEventPayload,
  ): Promise<{ event: EventDetail }> {
    const res = await apiClient.patch<ApiResponse<{ event: EventDetail }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}`,
      payload,
    );
    return res.data.data;
  },
};
