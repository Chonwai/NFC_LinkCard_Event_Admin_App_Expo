import type { ApiResponse } from "@/types/api.types";
import type {
  LeaderboardQuery,
  LeaderboardResponse,
} from "@/types/leaderboard.types";

import { apiClient } from "./api";

/**
 * 活動社交排行榜的一支呼叫（主辦方看榜）。
 *
 * 對應後端 `GET /api/v1/events/:eventId/taps/leaderboard`
 * （`LeaderboardController.getEventLeaderboard`，掛在 `event-ops.routes.ts`）。
 *
 * ## 只有一條，而且刻意不是設計文件寫的那條路徑
 *
 * 設計文件 §7.1 寫 `/api/v1/events/:eventId/leaderboard`，後端實際落在
 * `/taps/leaderboard`（理由：資料來源是 tap 聚合，`/api/v1/taps/*` 的既有結構
 * 不改）。**這裡以實作為準**——寫成文件上的路徑不會有編譯錯誤，只會在活動
 * 當天回 404。`tests/leaderboard-contract.test.mjs` 會拿後端路由快照比對，
 * 把它釘在實作這一邊。
 *
 * ## 查詢參數走 axios 的 `params`，不拼進網址
 *
 * 兩個理由，第二個是硬的：
 *
 * 1. `undefined` 的鍵會被 axios 直接略過，不必自己判斷「有沒有帶」；
 * 2. `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，往後抓
 *    **第一個字串字面**」。若把查詢字串接在同一個模板字串裡
 *    （尾端多一個 `${search}`），那個 `${…}` 會被正規化成一段額外的路徑參數，
 *    閘門於是拿 `…/taps/leaderboard/*` 去比對後端的 `…/taps/leaderboard` ——
 *    永遠對不上。查詢參數留在 `params` 裡，路徑字面就剛好是後端的那一條。
 *
 * ## 值域不在前端重複夾
 *
 * `limit` 上限 100、`minUniqueVisitors` 夾在 1..50、`metric` 非法值回 400，全部
 * 由後端決定，並在 `methodology.threshold.applied` 回報**實際套用值**。前端再夾
 * 一次只會製造兩個不一致的真相（畫面顯示 20、後端用 50 之類）。
 *
 * ## 錯誤處理
 *
 * 不在這裡吞錯。403（非 owner 且非 SUPER_ADMIN／COORDINATOR）、400
 * `LEADERBOARD_COHORT_TOO_LARGE`、其他失敗要分成三種不同的畫面語意
 * （S5／S14／S4），所以由畫面用 `utils/api-error.ts` 的
 * `getApiErrorStatus` / `getApiErrorCode` 分類。service 只負責把
 * `res.data.data` 取出來。
 *
 * ⚠️ 契約掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 */
export const leaderboardService = {
  /**
   * GET /v1/events/:eventId/taps/leaderboard
   *
   * 一次拿回整份榜單：`entries`（Top N）、`belowThreshold`、`excluded`、
   * `totals`、`methodology`。**沒有**「每列再補打一次」的端點，也不需要
   * ——後端已經把 `totals` 的算術校驗（`unaccounted === 0`）做完，不成立就
   * 直接回 500，所以拿到 200 就代表那份數字自洽。
   */
  async getLeaderboard(
    eventId: string,
    query: LeaderboardQuery = {},
  ): Promise<LeaderboardResponse> {
    const res = await apiClient.get<ApiResponse<LeaderboardResponse>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/taps/leaderboard`,
      { params: toQueryParams(query) },
    );
    return res.data.data;
  },
};

/**
 * `LeaderboardQuery` → axios `params`。
 *
 * 只保留**真的有值**的鍵：`undefined` 與空字串都略過，讓後端套自己的預設。
 * 送 `registrantTypes: ''` 會被後端當成非法 CSV（回 400），所以空字串必須
 * 過濾掉，不能靠 axios 的 `undefined` 規則順手處理。
 */
function toQueryParams(query: LeaderboardQuery): Record<string, string> {
  const params: Record<string, string> = {};

  if (query.metric) params.metric = query.metric;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.registrantTypes) params.registrantTypes = query.registrantTypes;
  if (typeof query.limit === "number") params.limit = String(query.limit);
  if (typeof query.minUniqueVisitors === "number") {
    params.minUniqueVisitors = String(query.minUniqueVisitors);
  }

  return params;
}
