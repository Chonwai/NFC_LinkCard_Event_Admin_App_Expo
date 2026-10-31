import type { ApiResponse } from "@/types/api.types";
import {
  EXHIBITOR_IMPORT_CONFIRM_MODE,
  type ExhibitorImportConfirmResult,
  type ExhibitorImportNotifyResult,
  type ExhibitorImportPreview,
  type ExhibitorListResponse,
  type ExhibitorStatus,
} from "@/types/exhibitor.types";
import {
  buildSpreadsheetFormData,
  type SpreadsheetFile,
} from "@/utils/spreadsheet-upload";

import { apiClient } from "./api";

/**
 * 展商後台與展商名單匯入的六支呼叫（parity `exhibitors`）。
 *
 * 前端 counterpart：
 * - `LinkCard_Frontend/lib/events/exhibitors.ts:247` 的 `listAllExhibitorsAdmin`
 * - `LinkCard_Frontend/lib/events/exhibitors.ts:93` 的 `updateExhibitorStatus`
 * - `LinkCard_Frontend/lib/events/exhibitorImport.ts` 的四支匯入呼叫
 *
 * 後端掛載：
 * - 列表與狀態覆核在 `/api/v1/events/:eventId/exhibitors`（`exhibitors.routes.ts`）
 * - 匯入四支在 `/api/v1/events/:eventId/exhibitors/import`（`exhibitor-import.routes.ts`，
 *   由 `exhibitors.routes.ts:52` 以 `router.use('/import', …)` 掛進去）
 *
 * ## 為什麼只有六支
 *
 * 後端在 `/exhibitors` 底下還有十幾條（`create`／`update`／`page-sections`／
 * `company-page`／`my-access`／`export` …）。Web 的**管理頁與匯入頁**只用到
 * 六支，App 就只接這六支：
 *
 * - `POST /`（建立展商）與 `PATCH /:exhibitorId`（改資料）在 Web 屬於**展商
 *   入口**（`/exhibitor/[id]/manage/company`），不是主辦的管理頁。多接就是在
 *   App 上開一條 Web 主辦端沒有的寫入路徑。
 * - `company-page` / `link` 是「我的活動」hub 的用戶自決轉化，同樣不在這個
 *   頁面。
 * - `export/exhibitors` 給的是投票 kiosk／大螢幕用的精簡清單，不是後台資料。
 *
 * 範圍由 `tests/exhibitor-contract.test.mjs` 釘住（多一條或少一條都會紅）。
 *
 * ## PATCH 只送 Web 也送的欄位
 *
 * `updateExhibitorStatus` 的 body **恰好一個鍵**：`status`。後端
 * `ReviewExhibitorStatusDto` 只有這一個 `@IsEnum` 欄位，多送的鍵會被忽略；
 * 但「App 送了 Web 沒送的欄位」本身就是能力漂移，所以測試釘住確切的 key 集合
 * （`tests/exhibitor-service.test.mjs`）。
 *
 * ## 路徑為什麼寫成行內模板字串
 *
 * `scripts/check-backend-contract.mjs` 抽呼叫的方式是「定位呼叫動詞後，往後抓
 * **第一個字串字面**」。若改用 helper 組路徑，它抓到的會是**下一個**呼叫的
 * 字面，閘門於是以為一條路徑存在——那是靜默失效。
 * `event.service.ts`、`registration.service.ts`、`content.service.ts`、
 * `poll.service.ts` 也都是行內字面，這裡照既有慣例。
 *
 * ⚠️ 那個掃描器**不跳過註解**：本檔任何一行註解只要出現「呼叫動詞＋括號＋
 * 後續字串字面」，就會被當成一條真的呼叫去比對後端快照。寫說明時請用文字
 * 描述，不要寫成程式碼。
 */
export const exhibitorService = {
  /**
   * GET /v1/events/:eventId/exhibitors
   *
   * ⚠️ **一定要帶 `limit`。** 後端不帶 `limit` 時預設 `20`
   * （`ExhibitorService.ts:225`），而且不會有任何錯誤或提示——第 21 家之後的
   * 廠商在畫面上直接不存在。Web 的列表頁沒帶 `limit`，這是它的缺陷；App 不
   * 照抄，每次請求都帶滿 `EXHIBITOR_LIST_MAX_LIMIT`。
   *
   * ⚠️ 另一個 Web 缺陷：`status` 不帶時後端**強制** `ACTIVE`
   * （`ExhibitorService.ts:219-222`），所以 Web 的「全部」分頁其實只顯示
   * 已通過的廠商，待審的一筆都看不到。App 的做法是不打「全部」這個曖昧查詢，
   * 而是**四個狀態各打一次**再合併。
   */
  async listExhibitors(
    eventId: string,
    params: { status: ExhibitorStatus; page?: number; limit?: number },
  ): Promise<ExhibitorListResponse> {
    const res = await apiClient.get<ApiResponse<ExhibitorListResponse>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors`,
      { params },
    );
    return res.data.data;
  },

  /**
   * PATCH /v1/events/:eventId/exhibitors/:exhibitorId/status
   *
   * 後端 `ExhibitorController.reviewStatus` 會先驗
   * `getEventOwnerAccess`（`ALLOWED` 才放行），不是活動擁有者／協作者回
   * `403 INSUFFICIENT_PERMISSION`。App 不自行猜權限，照 Web 直接打，讓後端
   * 決定。
   */
  async updateExhibitorStatus(
    eventId: string,
    exhibitorId: string,
    status: ExhibitorStatus,
  ): Promise<{ exhibitor: { id: string; status: ExhibitorStatus } }> {
    const res = await apiClient.patch<
      ApiResponse<{ exhibitor: { id: string; status: ExhibitorStatus } }>
    >(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors/${encodeURIComponent(exhibitorId)}/status`,
      { status },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/exhibitors/import/preview
   *
   * dry-run：**零寫入**。回傳有效／無效／重複三類與 `fileHash`。
   * 後端對同一份檔案重跑會得到同一個 `fileHash`——這正是「預覽過的就是要
   * 匯入的那份」可以成立的原因。
   */
  async previewImport(
    eventId: string,
    file: SpreadsheetFile,
  ): Promise<ExhibitorImportPreview> {
    const res = await apiClient.post<ApiResponse<ExhibitorImportPreview>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors/import/preview`,
      buildSpreadsheetFormData(file),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/exhibitors/import/confirm
   *
   * 建立展商＋ owner 邀請列（per-row 交易，冪等可重跑）。
   *
   * ⚠️ `mode` 一定要送 `skip_existing`。後端對「有送但不等於 `skip_existing`」
   * 是**明確拒絕**（400），不是靜默降級；而**完全不送**時後端自己會補上這個
   * 預設值。這裡選擇明送——與 Web 同一個值，而且讓「App 送了什麼」在測試裡
   * 看得見。
   */
  async confirmImport(
    eventId: string,
    file: SpreadsheetFile,
  ): Promise<ExhibitorImportConfirmResult> {
    const res = await apiClient.post<ApiResponse<ExhibitorImportConfirmResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors/import/confirm`,
      buildSpreadsheetFormData(file, { mode: EXHIBITOR_IMPORT_CONFIRM_MODE }),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/exhibitors/import/notify
   *
   * 分批寄邀請信。單請求上限 100 筆（後端 `BATCH_MAX`），呼叫端要自己切批
   * （`chunkSpreadsheetIds`）——這裡**不**代為切批，因為「寄了幾批、哪一批
   * 失敗」是呼叫端要呈現的事實。
   *
   * 後端只寄**待接受者**：已接受回 `ALREADY_ACCEPTED`、已撤銷回 `REVOKED`、
   * 已寄過回 `ALREADY_SENT`，這些都在 `skipped` 裡，不是錯誤。
   */
  async notifyImport(
    eventId: string,
    memberIds: string[],
  ): Promise<ExhibitorImportNotifyResult> {
    const res = await apiClient.post<ApiResponse<ExhibitorImportNotifyResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors/import/notify`,
      { memberIds },
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/exhibitors/import/template
   *
   * 回傳 CSV **文字**（帶 UTF-8 BOM，Excel 才不會把中文讀成亂碼）。App 沒有
   * 「下載到資料夾」這個概念，所以這裡回字串、由畫面交給系統分享面板——
   * 與 `registrationService.downloadGuestImportTemplate` 同一條路。
   *
   * `responseType: "text"` 是必要的：預設會嘗試 JSON 解析，CSV 一解析就爆。
   */
  async downloadImportTemplate(eventId: string): Promise<string> {
    const res = await apiClient.get<string>(
      `/api/v1/events/${encodeURIComponent(eventId)}/exhibitors/import/template`,
      { responseType: "text" },
    );
    return res.data;
  },
};
