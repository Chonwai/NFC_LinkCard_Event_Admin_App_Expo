import type {
  ApiResponse,
  ManagedEventItem,
  Registration,
} from "@/types/api.types";

import { apiClient } from "./api";

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  pages?: number;
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
  }): Promise<{ events: ManagedEventItem[]; pagination?: Pagination }> {
    const res = await apiClient.get<
      ApiResponse<{ events: ManagedEventItem[]; pagination?: Pagination }>
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

  /** GET /v1/events/:eventId/registrations — 報名清單（管理員） */
  async getRegistrations(
    eventId: string,
    params?: { page?: number; limit?: number; status?: string },
  ): Promise<{ registrations: Registration[]; pagination?: Pagination }> {
    const res = await apiClient.get<
      ApiResponse<{ registrations: Registration[]; pagination?: Pagination }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/registrations`, {
      params,
    });
    return res.data.data;
  },
};
