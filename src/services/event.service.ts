import type { ApiResponse, ManagedEventItem, Registration } from '@/types/api.types';

import { apiClient } from './api';

interface Pagination {
    total: number;
    page: number;
    pageSize: number;
    pages?: number;
}

/** GET /v1/events/my-managed — 登入者擁有或 org-role 授權的活動 */
export const eventService = {
    async getMyManagedEvents(params?: {
        page?: number;
        limit?: number;
    }): Promise<{ events: ManagedEventItem[]; pagination?: Pagination }> {
        const res = await apiClient.get<ApiResponse<{ events: ManagedEventItem[]; pagination?: Pagination }>>(
            '/v1/events/my-managed',
            { params }
        );
        return res.data.data;
    },

    /** GET /v1/events/by-id/:eventId — 單一活動（slug 或 id 皆可） */
    async getEventById(eventId: string): Promise<{ event: ManagedEventItem }> {
        const res = await apiClient.get<ApiResponse<{ event: ManagedEventItem }>>(
            `/v1/events/by-id/${encodeURIComponent(eventId)}`
        );
        return res.data.data;
    },

    /** GET /v1/events/:eventId/registrations — 報名清單（管理員） */
    async getRegistrations(
        eventId: string,
        params?: { page?: number; limit?: number; status?: string }
    ): Promise<{ registrations: Registration[]; pagination?: Pagination }> {
        const res = await apiClient.get<
            ApiResponse<{ registrations: Registration[]; pagination?: Pagination }>
        >(`/v1/events/${encodeURIComponent(eventId)}/registrations`, { params });
        return res.data.data;
    },
};
