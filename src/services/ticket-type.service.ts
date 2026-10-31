import type { ApiResponse } from "@/types/api.types";
import type {
  AdminTicketType,
  CreateTicketTypePayload,
  UpdateTicketTypePayload,
} from "@/types/ticketType.types";

import { apiClient } from "./api";

/**
 * 票種後台的四支呼叫（parity `ticket-types`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/ticket-types.ts`
 * 的 `listAdminTicketTypes` / `createTicketType` / `updateTicketType` /
 * `deactivateTicketType`，以及
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/ticket-types/page.tsx`。
 *
 * 後端全部掛在 `/api/v1/events/:eventId/ticket-types` 之下
 * （`src/events/routes/events.routes.ts:41-55`）。那一組路由剛好**四條**，
 * Web 四條全用，所以這裡也是四條——多一條少一條都是漂移。
 *
 * ## 為什麼列表不帶 `limit`（與 `exhibitors` 相反）
 *
 * `exhibitors` 的後端預設 `limit=20`，不帶就會靜默截斷，所以那邊每次都帶滿。
 * 票種**沒有分頁**：`EventTicketTypeService.listAdminTicketTypes(:74-118)` 是
 * 一個 `findMany`，沒有 `take` / `skip`，回應也只有 `{ ticketTypes }`，
 * 沒有 `pagination`。
 *
 * 所以在這裡加 `limit` 不是「保險」，是**多送一個後端不讀的參數**，
 * 而且會讓人以為「有分頁、只是我們處理了」。
 * `tests/ticket-type-service.test.mjs` 反向釘住：`params` 必須是 `undefined`。
 *
 * ## 為什麼 `deactivateTicketType` 回傳 `{ ticketType }`，而 Web 是 `void`
 *
 * 後端 `EventTicketTypeController.deactivateTicketType` 回的是
 * `ApiResponse.success(res, { ticketType })`——**有 body**。Web 的
 * `Promise<void>` 只是把它丟掉。
 *
 * App 保留回傳值，因為型別要說實話（宣告 `void` 會讓下一個人以為這條
 * 沒有回應）。畫面仍照 Web 重新載入列表，不靠這個回傳值拼湊本地狀態。
 *
 * ## 路徑為什麼寫成行內模板字串
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，
 * 往後抓**第一個字串字面**」。若改用 helper 組路徑，它抓到的會是**下一個**
 * 呼叫的字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `event.service.ts`、`poll.service.ts` 等也都是行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 *
 * ## 與 `eventService.listTicketTypes` 的關係
 *
 * `event.service.ts:143` 已經有一支打同一條 GET 的 `listTicketTypes`，
 * 給現場報名（`walk-in.tsx`）用。這一支不是重複實作，差別在**型別**：
 * 舊的用 `TicketTypeItem`（只有 5 個欄位，夠現場報名挑票就好），
 * 新的用 `AdminTicketType`（後端 `adminSelect` 的完整欄位）。
 *
 * 沒有把舊的那支改掉，是因為那會動到 `walk-in.tsx` 的既有行為，超出本輪
 * 範圍。兩支打同一條路由這件事記在這裡，避免下一個人以為有兩條端點。
 */
export const ticketTypeService = {
  /**
   * GET /v1/events/:eventId/ticket-types
   *
   * 後端掛的是 `optionalAuthMiddleware`（`events.routes.ts:41-45`）：
   * - 帶 token 且 `getEventWriteAccess === 'ALLOWED'` ⇒ 走 admin 分支，
   *   回**全部**票種（含已停用、含隱藏、含 `accessCode`）。
   * - 否則走公開分支，只回 `isActive && !isHidden`，且**不含** `accessCode`。
   *
   * 後台畫面能拿到停用票種，靠的是登入身分，不是靠額外參數。
   */
  async listAdminTicketTypes(
    eventId: string,
  ): Promise<{ ticketTypes: AdminTicketType[] }> {
    const res = await apiClient.get<
      ApiResponse<{ ticketTypes: AdminTicketType[] }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/ticket-types`);
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/ticket-types
   *
   * 後端 `authMiddleware` ＋ `getEventWriteAccess === 'ALLOWED'`，非擁有者／
   * 協作者回 `403 INSUFFICIENT_PERMISSION`。App 不自行猜權限，照 Web 直接打。
   *
   * 回應 201，body 是 `{ ticketType }`（含解析後的 capabilities）。
   */
  async createTicketType(
    eventId: string,
    payload: CreateTicketTypePayload,
  ): Promise<{ ticketType: AdminTicketType }> {
    const res = await apiClient.post<
      ApiResponse<{ ticketType: AdminTicketType }>
    >(`/api/v1/events/${encodeURIComponent(eventId)}/ticket-types`, payload);
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId/ticket-types/:ticketTypeId
   *
   * body 形狀：照 Web 送**完整** payload（理由見 `CreateTicketTypePayload`）。
   *
   * 兩種後端錯誤需要畫面分辨：
   * - `409 EVENT_TICKET_TYPE_ACCESS_CODE_CONFLICT`：`accessCode` 撞到別的票種
   *   （DB 上是 `@unique`，所以是**跨活動**唯一）。
   * - `400 INVALID_FORM_SCHEMA`：`formFieldsJson` 過不了語意綁定驗證。
   *
   * 兩者都會經過 `getApiErrorMessage`，只呈現分類、不回顯後端原文。
   */
  async updateTicketType(
    eventId: string,
    ticketTypeId: string,
    payload: UpdateTicketTypePayload,
  ): Promise<{ ticketType: AdminTicketType }> {
    const res = await apiClient.patch<
      ApiResponse<{ ticketType: AdminTicketType }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(ticketTypeId)}`,
      payload,
    );
    return res.data.data;
  },

  /**
   * DELETE /v1/events/:eventId/ticket-types/:ticketTypeId
   *
   * ⚠️ 這是**軟刪除**：後端 `EventTicketTypeService.deactivate`（`:203-213`）
   * 只把 `isActive` 設成 `false`，**不刪任何一列**，也**不動**
   * `EventRegistration`。
   *
   * 已售出的票會怎樣（查證結果，畫面文案照這個寫）：
   * - 既有報名**完全不受影響**：`EventRegistration` 沒有被改，報到照常。
   * - 這個票種**不能再被新報名選用**：
   *   `EventRegistrationService:347` 與 `:1061` 都對 `!ticketType.isActive`
   *   拋 `TICKET_TYPE_NOT_FOUND`。
   * - 公開頁**不再列出**它：`listPublicTicketTypes` 的 where 有
   *   `isActive: true`。
   * - 後台列表**仍然看得到**它，狀態顯示為「已停用」（admin 分支不過濾）。
   *
   * 也就是「下架，不是刪除」。
   */
  async deactivateTicketType(
    eventId: string,
    ticketTypeId: string,
  ): Promise<{ ticketType: AdminTicketType }> {
    const res = await apiClient.delete<
      ApiResponse<{ ticketType: AdminTicketType }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(ticketTypeId)}`,
    );
    return res.data.data;
  },
};
