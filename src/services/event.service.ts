import type {
  ApiResponse,
  ManagedEventItem,
  Registration,
  TicketTypeItem,
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
  async getEventById(eventId: string): Promise<{ event: ManagedEventItem }> {
    const res = await apiClient.get<ApiResponse<{ event: ManagedEventItem }>>(
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
};
