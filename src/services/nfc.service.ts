import type { ApiResponse, BadgeInfo } from '@/types/api.types';

import { apiClient } from './api';

export const nfcService = {
    /** GET /v1/events/:eventId/nfc/lookup — 公開查 badge（by uid 或 qr） */
    async lookup(
        eventId: string,
        opts: { uid?: string; qr?: string }
    ): Promise<{ badge?: BadgeInfo }> {
        const params = new URLSearchParams();
        if (opts.uid) params.set('uid', opts.uid);
        if (opts.qr) params.set('qr', opts.qr);
        const res = await apiClient.get<ApiResponse<{ badge?: BadgeInfo }>>(
            `/v1/events/${encodeURIComponent(eventId)}/nfc/lookup?${params.toString()}`
        );
        return res.data.data;
    },

    /** POST /v1/events/:eventId/nfc/bind — 綁定 badge ↔ registration（OPERATOR+） */
    async bind(
        eventId: string,
        registrationId: string,
        tagUid: string,
        opts?: { badgeType?: 'WRISTBAND' | 'CARD' | 'QR_ONLY'; colorCode?: string }
    ): Promise<{ badge: BadgeInfo }> {
        const res = await apiClient.post<ApiResponse<{ badge: BadgeInfo }>>(
            `/v1/events/${encodeURIComponent(eventId)}/nfc/bind`,
            { registrationId, tagUid, ...opts }
        );
        return res.data.data;
    },
};