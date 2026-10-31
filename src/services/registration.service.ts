import type {
  ApiResponse,
  Registration,
  WalletTransactionList,
} from "@/types/api.types";
import { LOOKUP_TIMEOUT_MS } from "@/constants/config";

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
      { timeout: LOOKUP_TIMEOUT_MS },
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
   * ⛔ 已移除：`POST …/registrations/checkin/override`
   *
   * 這條路由**不存在**。`src/events/routes/registrations.routes.ts` 只有
   * `/checkin` 與 `/:registrationId/status`；打下去必定 404。
   *
   * 近似的 `/status` 不能頂替：它對已 `CHECKED_IN` 的紀錄回
   * `409 REGISTRATION_STATUS_UNCHANGED`，而且需要 `registrationId` 與
   * COORDINATOR 以上權限（見 parity 報告 §S-1）。
   *
   * 後端補上這個能力之前，UI 不再提供入口——不要加回來，除非
   * `check-backend-contract` 這道閘門能證明路由存在。
   */

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
      consent?: { tosVersion: string; privacyAcceptedAt: string };
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

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/hide
   *
   * 主辦的「資料品質管理」：把一筆報名從預設名單中隱藏（不是刪除、不是封存）。
   * 對應 Web `lib/events/registrations.ts` 的 `hideRegistration`。
   *
   * `reason` **必填**：後端 trim 後寫入稽核（`hiddenReason`）。畫面不得送出空白
   * 字串——那會讓後端的稽核留下「有隱藏、無理由」的紀錄。
   *
   * 失敗語意（`error.response.data.error.code`）：
   * - `403 INSUFFICIENT_PERMISSION` — 需 owner／SUPER_ADMIN／COORDINATOR
   * - `404 REGISTRATION_NOT_FOUND` — 無此報名或不屬於此活動
   */
  async hide(
    eventId: string,
    registrationId: string,
    reason: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/hide`,
      { reason },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/unhide
   *
   * `hide` 的反向操作。**不帶 body**：後端不需要理由，送一個空物件反而會讓
   * 「這條端點收什麼」變得含糊。
   */
  async unhide(
    eventId: string,
    registrationId: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/unhide`,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/wallet/:registrationId/transactions
   *
   * 後端分頁（預設 `page=1&limit=20`）且回傳 `pagination`。**必須轉發**——
   * 不傳參數也不讀分頁，就只會看到前 20 筆，而且沒有任何提示。
   *
   * 回應欄位以 `EventWalletService.getTransactionHistory` 的 `select` 為準：
   * `id / type / amount / balanceAfter / description / sourceType / createdAt`。
   * **沒有 `approvedBy`**（舊版型別誤植，見 parity 報告 §S-2）。
   */
  async getWalletTransactions(
    eventId: string,
    registrationId: string,
    params?: { page?: number; limit?: number },
  ): Promise<WalletTransactionList> {
    const res = await apiClient.get<ApiResponse<WalletTransactionList>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/wallet/${encodeURIComponent(registrationId)}/transactions`,
      { params },
    );
    return res.data.data;
  },
};
