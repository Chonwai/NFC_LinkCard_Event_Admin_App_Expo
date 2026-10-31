import type { ApiResponse } from "@/types/api.types";
import type { EventPoll, PollCreatePayload } from "@/types/poll.types";

import { apiClient } from "./api";

/**
 * 投票後台的四支呼叫（parity `polls`）。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/sessions.ts:65-120` 的
 * `listPolls` / `createPoll` / `activatePoll` / `closePoll`，
 * 以及 `LinkCard_Frontend/app/(event)/manage/[eventId]/polls/page.tsx`。
 *
 * 後端全部掛在 `/api/v1/events/:eventId/polls` 之下
 * （`src/events/routes/sessions-polls.routes.ts:53-58`）。那一組路由共有六條，
 * Web 的投票頁**只用四條**——`vote` 與 `results` 都沒有呼叫：
 *
 * - `vote` 是**參加者**端行為（`badgeTagUid` 去重），後台不做投票。
 * - `results`（`GET …/polls/:pollId/results`）存在，但 Web 不呼叫它：
 *   `listPolls` 已經把每一票帶回來，Web 在 client 端數 `votes[]` 就得到結果
 *   （`polls/page.tsx:15-35` 的 `computeResults`，註解寫明是為了避開 N+1）。
 *
 * 所以 App 也只做四支。多接一條 `results` 會變成「比 Web 多打一次請求」，
 * 少接一條就做不到「不增不減」。`tests/poll-service.test.mjs` 把這四條的
 * method／路徑／body 逐一釘住。
 *
 * ## 路徑為什麼寫成行內模板字串
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，往後抓
 * **第一個字串字面**」。若改用 `pollsPath(eventId)` 這種 helper 組路徑，它抓到
 * 的會是**下一個**呼叫的字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `event.service.ts`、`registration.service.ts`、`content.service.ts` 也都是
 * 行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 *
 * ## 四支呼叫的權限不對稱（照抄後端，不是 App 自行決定）
 *
 * `listPolls` 在後端**沒有** `authMiddleware`（`sessions-polls.routes.ts:53`），
 * 另外三支都有。這不是漏洞——投票列表本來就是公開資料（參加者要能看到題目，
 * `LinkCard_Frontend` 的參加者端也讀同一條）。App 照抄這條不對稱，
 * 不額外要求登入，也不因為「後台用的」就自行加上。
 */
export const pollService = {
  /** GET /v1/events/:eventId/polls — 依 `createdAt` 新到舊，含每一票 */
  async listPolls(eventId: string): Promise<{ polls: EventPoll[] }> {
    const res = await apiClient.get<ApiResponse<{ polls: EventPoll[] }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/polls`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/polls
   *
   * 後端只讀 `question` 與 `options`，且 `options.length < 2` 直接回
   * 400 `VALIDATION_ERROR`。新建立的投票 `isActive` 一律為 false
   * （`EventPollService.createPoll`），所以建立完還要再按一次「啟用」。
   */
  async createPoll(
    eventId: string,
    payload: PollCreatePayload,
  ): Promise<{ poll: EventPoll }> {
    const res = await apiClient.post<ApiResponse<{ poll: EventPoll }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/polls`,
      payload,
    );
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId/polls/:pollId/activate — **不帶 body**。
   *
   * 後端只認路徑上的 pollId（`EventPollController.activatePoll` 不解讀 body）。
   * 送一個空物件不會壞，但那是多餘的；Web 也不送。
   */
  async activatePoll(
    eventId: string,
    pollId: string,
  ): Promise<{ poll: EventPoll }> {
    const res = await apiClient.patch<ApiResponse<{ poll: EventPoll }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/polls/${encodeURIComponent(pollId)}/activate`,
    );
    return res.data.data;
  },

  /** PATCH /v1/events/:eventId/polls/:pollId/close — **不帶 body**，理由同上。 */
  async closePoll(
    eventId: string,
    pollId: string,
  ): Promise<{ poll: EventPoll }> {
    const res = await apiClient.patch<ApiResponse<{ poll: EventPoll }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/polls/${encodeURIComponent(pollId)}/close`,
    );
    return res.data.data;
  },
};
