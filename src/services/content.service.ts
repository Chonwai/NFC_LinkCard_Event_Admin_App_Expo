import type {
  ApiResponse,
  PageCardPayload,
  PageSection,
  PageSectionCard,
  PageSectionPayload,
} from "@/types/api.types";

import { apiClient } from "./api";

/**
 * 落地頁內容 CMS（parity `content`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/page-content.ts` 的
 * `createEventPageSection` / `updateEventPageSection` / `deleteEventPageSection`
 * / `createEventPageCard` / `updateEventPageCard` / `deleteEventPageCard`。
 * 六支寫入逐字照 Web 建模（方法、路徑、body 形狀），讀取那一支在
 * `listSections`。後端全部掛在 `/api/v1/events/:eventId/page-sections`
 * 之下（`events.routes.ts:57-93`）。
 *
 * ## 為什麼路徑是行內模板字串，而不是 `sectionsPath(eventId)` 這種 helper
 *
 * Web 用 helper 組路徑，但本 repo 不行：`scripts/check-backend-contract.mjs`
 * 抽呼叫的方式是「定位呼叫動詞後，往後抓**第一個字串字面**」
 * （`check-backend-contract.mjs:222-238`）。若在呼叫端改用 helper 組路徑
 * （動詞後面接的是識別字而不是字面），它抓到的會是**下一個**呼叫的字面，
 * 閘門於是拿別人的路徑去比對——那是靜默失效，比沒有閘門更糟。
 * `event.service.ts` 與 `registration.service.ts` 也都是行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「動詞＋括號＋後續字面」，
 * 就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字描述，不要寫成程式碼。
 *
 * ## ⚠️ 卡片 PATCH 只送五個欄位，這是刻意的（資料保全）
 *
 * Web 的 `CardEditor.handleSave` 送的是
 * `{ title, description, actionLabel, actionUrl, isPublished }`，
 * **不含 `badgeText` / `iconKey` / `imageUrl`**。這不是遺漏：
 * 後端 `EventPageContentService.updateCard` 逐欄用
 * `hasOwn(dto, '<欄位>')` 判斷要不要寫（`EventPageContentService.ts:203-226`），
 * 沒送到的欄位維持原值。
 *
 * 反過來說，只要有人「順手把型別有的欄位補齊」，例如
 * `imageUrl: card.imageUrl ?? null`，`hasOwn` 就會變成 true，後端於是把
 * `imageUrl` 寫成 `null`——**在 Web 上傳的卡片圖會被手機後台一鍵清空**，
 * 而且不會有任何錯誤訊息。所以建構 payload 的責任留在呼叫端，這裡只提供
 * 型別，並由 `tests/content-service.test.mjs` 釘住「key 集合恰好是那五個」。
 *
 * ## 為什麼刪除回傳 `void`
 *
 * 後端 `deleteSection` / `deleteCard` 會回 `{ deletedId }`，但 Web 的
 * `deleteEventPageSection` / `deleteEventPageCard` 都宣告成 `Promise<void>`
 * 並忽略它——刪完之後兩邊都是「重新載入整份清單」。App 照抄，避免多一個
 * 沒有消費者的回傳值。
 */
export const contentService = {
  /** GET /v1/events/:eventId/page-sections — 含 cards，兩層一次拿完 */
  async listSections(eventId: string): Promise<{ sections: PageSection[] }> {
    const res = await apiClient.get<ApiResponse<{ sections: PageSection[] }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections`,
    );
    return res.data.data;
  },

  /** POST /v1/events/:eventId/page-sections */
  async createSection(
    eventId: string,
    payload: PageSectionPayload,
  ): Promise<{ section: PageSection }> {
    const res = await apiClient.post<ApiResponse<{ section: PageSection }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections`,
      payload,
    );
    return res.data.data;
  },

  /** PATCH /v1/events/:eventId/page-sections/:sectionId */
  async updateSection(
    eventId: string,
    sectionId: string,
    payload: PageSectionPayload,
  ): Promise<{ section: PageSection }> {
    const res = await apiClient.patch<ApiResponse<{ section: PageSection }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections/${encodeURIComponent(sectionId)}`,
      payload,
    );
    return res.data.data;
  },

  /** DELETE /v1/events/:eventId/page-sections/:sectionId（連同底下卡片） */
  async deleteSection(eventId: string, sectionId: string): Promise<void> {
    await apiClient.delete(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections/${encodeURIComponent(sectionId)}`,
    );
  },

  /** POST /v1/events/:eventId/page-sections/:sectionId/cards */
  async createCard(
    eventId: string,
    sectionId: string,
    payload: PageCardPayload,
  ): Promise<{ card: PageSectionCard }> {
    const res = await apiClient.post<ApiResponse<{ card: PageSectionCard }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections/${encodeURIComponent(sectionId)}/cards`,
      payload,
    );
    return res.data.data;
  },

  /** PATCH /v1/events/:eventId/page-sections/:sectionId/cards/:cardId */
  async updateCard(
    eventId: string,
    sectionId: string,
    cardId: string,
    payload: PageCardPayload,
  ): Promise<{ card: PageSectionCard }> {
    const res = await apiClient.patch<ApiResponse<{ card: PageSectionCard }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections/${encodeURIComponent(sectionId)}/cards/${encodeURIComponent(cardId)}`,
      payload,
    );
    return res.data.data;
  },

  /** DELETE /v1/events/:eventId/page-sections/:sectionId/cards/:cardId */
  async deleteCard(
    eventId: string,
    sectionId: string,
    cardId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/v1/events/${encodeURIComponent(eventId)}/page-sections/${encodeURIComponent(sectionId)}/cards/${encodeURIComponent(cardId)}`,
    );
  },
};
