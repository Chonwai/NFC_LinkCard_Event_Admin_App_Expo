import type { ApiResponse } from "@/types/api.types";
import type {
  EventSession,
  SessionCreatePayload,
  SessionRegistrationsResponse,
  SessionUpdatePayload,
} from "@/types/session.types";

import { apiClient } from "./api";

/**
 * 場次後台的四支呼叫（parity `sessions`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/sessions.ts` 的
 * `listEventSessions` / `createSession` / `updateSession` /
 * `listSessionRegistrations`，以及
 * `LinkCard_Frontend/app/(event)/manage/[eventId]/sessions/page.tsx`
 * 與同目錄下的 `[sessionId]/registrations/page.tsx`。
 *
 * ## 為什麼是「四支」而不是五支——刪除不在這裡
 *
 * 後端 `sessions-polls.routes.ts:27-49` 在 `/sessions` 底下掛了七條路由，
 * 但**沒有** `DELETE /sessions/:sessionId`：
 *
 * | 後端路由                                         | Web 管理頁 | App |
 * | ------------------------------------------------ | ---------- | --- |
 * | `GET    /sessions`                               | 用         | 用 |
 * | `POST   /sessions`                               | 用         | 用 |
 * | `PATCH  /sessions/:sessionId`                    | 用         | 用 |
 * | `GET    /sessions/:sessionId/registrations`      | 用（名冊） | 用 |
 * | `GET    /sessions/:sessionId`                    | 不用       | 不用 |
 * | `POST   /sessions/:sessionId/register`           | 不用（參加者行為） | 不用 |
 * | `DELETE /sessions/:sessionId/register`           | 不用（參加者行為） | 不用 |
 * | `POST   /sessions/:sessionId/checkin`            | **無 UI**  | **無 UI** |
 *
 * Web 的 `deleteSession`（`LinkCard_Frontend/lib/events/sessions.ts:142-144`）
 * 打的是 `DELETE /:eventId/sessions/:sessionId`——**這條路由不存在**，
 * 而且它有一個活的呼叫點（`sessions/page.tsx:317` 的 `handleDelete`），
 * 所以 Web 的「刪除場次」按下去是 **404**。App 不重現一個壞掉的按鈕，
 * 也不自行發明 `PATCH status=DELETED` 之類的等效做法假裝對齊。
 * 相關記錄見 `docs/analysis/adminapp-parity-20261028/12-parity-build-plan-20261029.md`
 * §12.3.2 的 `ESC-CRA-001`。
 *
 * `POST …/sessions/:sessionId/checkin`（場次現場報到）在 Web **沒有任何 UI**
 * （`grep -rn 'sessions/.*checkin' app components lib hooks` 為空），
 * 所以本輪也不接——沒有可對齊的對象。後端這條路由在兩邊都無人使用，
 * 這件事本身已記在 `03-capability-matrix.md:204-205`。
 *
 * ## 路徑為什麼寫成行內模板字串
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，
 * 往後抓**第一個字串字面**」。若改用 helper 組路徑，它抓到的會是**下一個**
 * 呼叫的字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `ticket-type.service.ts`、`poll.service.ts`、`bank-transfer.service.ts`
 * 都是行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 *
 * ⚠️ 查詢字串必須**接在同一個模板字串裡、`?` 之後**（`bank-transfer.service.ts:102`
 * 同一個形狀）。掃描器以第一個 `?` 切掉查詢再比對路徑；若把查詢寫成
 * 巢狀模板的條件式，內層反引號會把外層的比對截斷（`nfc.service.ts:183`
 * 記錄過這個坑）。
 */
export const sessionService = {
  /**
   * GET /v1/events/:eventId/sessions
   *
   * 後端掛 `optionalAuthMiddleware`：帶 token 時多回一個 `isRegistered`，
   * 匿名呼叫者拿到 `false`。後台要的是完整清單，靠的是登入身分，不是參數。
   *
   * ⚠️ **後端只回已發佈的場次**：`EventSessionService.listSessions:66` 的
   * where 是 `{ eventId, isPublished: true }`。這對後台是一個真實的限制——
   * 已取消發佈（`isPublished=false`）的場次**不會出現在任何一頁**，
   * 而 Web 也一樣看不到。這是後端行為，不是 App 的取捨；
   * 若要讓後台看到未發佈的場次，得先改後端，不是改這裡。
   *
   * 沒有分頁：這個端點不回 `pagination`（與 `ticket-types` 同一個情形），
   * 所以**不送** `limit`——多送一個後端不讀的參數只會讓人以為有分頁。
   */
  async listSessions(eventId: string): Promise<{ sessions: EventSession[] }> {
    const res = await apiClient.get<ApiResponse<{ sessions: EventSession[] }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/sessions`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/sessions
   *
   * 後端 `authMiddleware` ＋ `getEventWriteAccess === 'ALLOWED'`，非擁有者／
   * 協作者回 `403 INSUFFICIENT_PERMISSION`。App 不自行猜權限，照 Web 直接打。
   *
   * 成功回 201，body 是 `{ session }`。
   *
   * `isPublished` 未送 ⇒ 後端 `?? true`（`EventSessionService:204`），
   * 而 schema 的預設也是 `true`（`schema.prisma:944`），所以新建的場次
   * **一定會出現在列表**。這點值得寫下來：若哪天預設改成 `false`，
   * 這裡就會變成「建完就消失」而沒有任何錯誤。
   */
  async createSession(
    eventId: string,
    payload: SessionCreatePayload,
  ): Promise<{ session: EventSession }> {
    const res = await apiClient.post<ApiResponse<{ session: EventSession }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/sessions`,
      payload,
    );
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId/sessions/:sessionId
   *
   * body 形狀：照 Web 送**完整** payload（理由見 `SessionCreatePayload`
   * 的 `X | null` 那段——後端是 `!== undefined` 語意，送 `null` 才是清空）。
   *
   * 三種後端錯誤需要畫面分辨（都由 `getApiErrorMessage` 分類呈現）：
   * - `400 VALIDATION_ERROR`：`class-validator` 擋下來（例如 `capacity` 送了
   *   0，或 `startDate` 不是 ISO）。
   * - `404 SESSION_NOT_FOUND`：這一場已經被別人刪了／`eventId` 對不上。
   * - `403 INSUFFICIENT_PERMISSION`：沒有寫入權限。
   */
  async updateSession(
    eventId: string,
    sessionId: string,
    payload: SessionUpdatePayload,
  ): Promise<{ session: EventSession }> {
    const res = await apiClient.patch<ApiResponse<{ session: EventSession }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`,
      payload,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/sessions/:sessionId/registrations
   *
   * 名冊。後端除了 `authMiddleware` 之外**沒有** role gate
   * （`sessions-polls.routes.ts:29-33`），但 controller 自己再查一次
   * `getEventOperatorAccess`（`EventSessionController:76-84`）：不是
   * OPERATOR 以上就回 `403 INSUFFICIENT_PERMISSION`。權限仍然存在，
   * 只是不在路由層——所以「路由沒掛 gate」不等於「誰都能看」。
   *
   * `page`／`limit` 一律送滿（Web 是 `{ page, limit: 50 }`）。後端
   * `limit` 上限 100、預設 50（`EventSessionController:91-93`），
   * 不送就會拿到預設值——這裡照 Web 明確送，避免「預設值改變＝行為改變」。
   *
   * 回應含 `attendance`（三態彙總）與 `pagination`。
   */
  async listSessionRegistrations(
    eventId: string,
    sessionId: string,
    params: { page: number; limit: number },
  ): Promise<SessionRegistrationsResponse> {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
    });
    const res = await apiClient.get<ApiResponse<SessionRegistrationsResponse>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}/registrations?${query.toString()}`,
    );
    return res.data.data;
  },
};
