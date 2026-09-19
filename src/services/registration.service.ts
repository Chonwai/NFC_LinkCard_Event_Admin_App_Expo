import type { ApiResponse, Registration } from "@/types/api.types";

import { apiClient } from "./api";

/** GET /v1/events/:eventId/registrations/by-code/:code — 公開查詢報名 */
export const registrationService = {
  /**
   * 依報名編號查詢（公開，QR 掃描後第一步行為）。
   * 回傳 { registration }，含 profile / customFields。
   */
  async getByCode(
    eventId: string,
    code: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.get<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/by-code/${encodeURIComponent(code)}`,
    );
    return res.data.data;
  },

  /** POST /v1/events/:eventId/registrations/checkin — 執行報到（需 OPERATOR+） */
  async checkIn(
    eventId: string,
    code: string,
  ): Promise<{ registration: Registration; checkedInAt?: string }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration; checkedInAt?: string }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin`, {
      registrationCode: code,
    });
    return res.data.data;
  },

  /**
   * WP-A7 / CHK-03：重複簽到覆核。
   * B-2 未就緒時後端可能 404；呼叫端應顯示 BLOCKED 骨架，勿當成功。
   */
  async checkInOverride(
    eventId: string,
    code: string,
    reason?: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin/override`,
      {
        registrationCode: code,
        reason: reason ?? "SUPERVISOR_OVERRIDE",
      },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations — 與線上報名同一端點。
   * 付費票會回傳付款資訊，不會在 App 內假裝已完成付款。
   */
  async createRegistration(
    eventId: string,
    body: {
      ticketTypeId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      company?: string;
    },
  ): Promise<{
    registration: {
      id: string;
      registrationCode: string;
      status: string;
      paymentMethod?: string;
      stripeCheckoutUrl?: string;
    };
  }> {
    const res = await apiClient.post<
      ApiResponse<{
        registration: {
          id: string;
          registrationCode: string;
          status: string;
          paymentMethod?: string;
          stripeCheckoutUrl?: string;
        };
      }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/registrations`, body);
    return res.data.data;
  },

  /** GET wallet transactions。無操作員欄位時 UI 顯示 —，不估算。 */
  async getWalletTransactions(
    eventId: string,
    registrationId: string,
  ): Promise<{
    transactions: {
      id: string;
      type: string;
      amount: number;
      description?: string | null;
      createdAt: string;
      approvedBy?: string | null;
    }[];
  }> {
    const res = await apiClient.get<
      ApiResponse<{
        transactions: {
          id: string;
          type: string;
          amount: number;
          description?: string | null;
          createdAt: string;
          approvedBy?: string | null;
        }[];
      }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/wallet/${encodeURIComponent(registrationId)}/transactions`,
    );
    return res.data.data;
  },
};
