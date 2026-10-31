import type {
  ApiResponse,
  Registration,
  RegistrationStatusCorrectionResult,
  RegistrationStatusCorrectionTarget,
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
   * POST /v1/events/:eventId/registrations/:registrationId/archive
   *
   * 封存：欄位轉為 `ARCHIVED` 並把封存前的狀態記在 `archivedFromStatus`，
   * 因此 `unarchive` 能回到原本那一格。與 `hide` 是**不同層級**的操作——
   * 隱藏只是不顯示，封存是狀態轉移。Web 的 row menu 也把両者分開放。
   *
   * `reason` **必填**（後端 trim 後寫入 `archivedReason`）。
   */
  async archive(
    eventId: string,
    registrationId: string,
    reason: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/archive`,
      { reason },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/unarchive
   *
   * `archive` 的反向操作。**不帶 body**（與 `unhide` 同一理由）。
   */
  async unarchive(
    eventId: string,
    registrationId: string,
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/unarchive`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/status
   *
   * 後台狀態修正（`NEW-34`）：撤銷報到（`CHECKED_IN → CONFIRMED`）或人工報到
   * （`CONFIRMED → CHECKED_IN`）。對應 Web `updateRegistrationStatus`。
   *
   * 與 `checkIn()` 的差別：以 `registrationId`（不是報名碼）定位，需要 `reason`
   * （後端 trim 後寫入稽核），且權限較嚴（`getEventWriteAccess`，**不是**現場
   * 掃碼的 OPERATOR 層級）。呼叫端拿到 403 應提示「需要主管權限」。
   *
   * 失敗語意（`error.response.data.error.code`）：
   * - `409 REGISTRATION_STATUS_UNCHANGED` — 已是該狀態 ⇒ 畫面過期，應重新載入
   * - `409 STATUS_TRANSITION_NOT_ALLOWED` — 不在轉移表內
   * - `409 REGISTRATION_STATUS_CONFLICT` — 並行競態，本次為輸家
   * - `404 REGISTRATION_NOT_FOUND` — 找不到／非本活動
   * - `403 INSUFFICIENT_PERMISSION` — 權限不足（需 COORDINATOR+）
   * - `422` — `reason` 空白或 `targetStatus` 不在值域
   */
  async updateStatus(
    eventId: string,
    registrationId: string,
    payload: {
      targetStatus: RegistrationStatusCorrectionTarget;
      reason: string;
    },
  ): Promise<{ registration: RegistrationStatusCorrectionResult }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: RegistrationStatusCorrectionResult }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/status`,
      payload,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/deposit-refund
   *
   * 押金退款追蹤（參展商押金，離線銀行轉賬退回）。對應 Web
   * `markDepositRefund`。不是退款本身——是把「線下已退」這件事記進稽核。
   *
   * `amount` 必須 > 0：後端 DTO 是 `@Min(0.01)`，送 0 會被 422 擋下；
   * 但即使後端擋得住，「已退但金額 0」本身就是一筆矛盾的稽核，所以畫面
   * 也不該允許送出。
   *
   * 回應是**整筆** registration（含 `depositRefunded*`），與狀態修正不同。
   */
  async markDepositRefund(
    eventId: string,
    registrationId: string,
    payload: { amount: number; reference?: string; note?: string },
  ): Promise<{ registration: Registration }> {
    const res = await apiClient.post<
      ApiResponse<{ registration: Registration }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/deposit-refund`,
      payload,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/export/attendees
   *
   * 後台下載報名名單（CSV **文字**）。對應 Web `exportAttendeesCsv`。
   *
   * ## 為何回傳字串而不是檔案
   * 這一層只負責拿資料；「怎麼交到使用者手上」是畫面的事。Web 交给
   * `downloadTextFile`，App 没有檔案系統就交给 `Share`/剪貼簿——把下載行為
   * 綁死在這裡，任何想在報表或測試裡重用這份 CSV 的呼叫端都得先欺騙環境。
   *
   * ## 這是大量 PII 讀取
   * 後端有 `authMiddleware` + 寫入權限檢查，且每次匯出都寫一筆稽核
   * （誰、哪個活動、幾筆）。呼叫端不該另外記錄。
   */
  async exportAttendeesCsv(eventId: string): Promise<string> {
    const res = await apiClient.get<ApiResponse<{ csv: string }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/export/attendees`,
    );
    return res.data.data.csv;
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
