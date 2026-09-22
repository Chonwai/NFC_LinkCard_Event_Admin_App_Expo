import type {
  ApiResponse,
  BadgeInfo,
  NfcLookupResult,
} from "@/types/api.types";

import { apiClient } from "./api";

interface BadgeListResponse {
  badges: BadgeInfo[];
  pagination: { total: number; page: number; pageSize: number; pages?: number };
}

export const nfcService = {
  /**
   * GET /v1/events/:eventId/nfc/lookup — 公開查 badge（by uid 或 qr）
   *
   * 成功時回傳綁定後的參加者摘要（displayName / registrationId…），
   * 與 listBadges 的 `BadgeInfo` 形狀不同。
   */
  async lookup(
    eventId: string,
    opts: { uid?: string; qr?: string },
  ): Promise<NfcLookupResult> {
    const params = new URLSearchParams();
    if (opts.uid) params.set("uid", opts.uid);
    if (opts.qr) params.set("qr", opts.qr);
    const res = await apiClient.get<ApiResponse<NfcLookupResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/lookup?${params.toString()}`,
    );
    return res.data.data;
  },

  /** GET /v1/events/:eventId/nfc/badges — badge 庫存列表（Write 權限） */
  async listBadges(
    eventId: string,
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      batchId?: string;
      all?: boolean;
    },
  ): Promise<BadgeListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.status) query.set("status", params.status);
    if (params?.batchId) query.set("batchId", params.batchId);
    if (params?.all) query.set("all", "true");
    const res = await apiClient.get<ApiResponse<BadgeListResponse>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/badges?${query.toString()}`,
    );
    return res.data.data;
  },

  /** POST /v1/events/:eventId/nfc/bind — 綁定 badge ↔ registration（OPERATOR+） */
  async bind(
    eventId: string,
    registrationId: string,
    tagUid: string,
    opts?: { badgeType?: "WRISTBAND" | "CARD" | "QR_ONLY"; colorCode?: string },
  ): Promise<{ badge: BadgeInfo }> {
    const res = await apiClient.post<ApiResponse<{ badge: BadgeInfo }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/bind`,
      { registrationId, tagUid, ...opts },
    );
    return res.data.data;
  },
};
