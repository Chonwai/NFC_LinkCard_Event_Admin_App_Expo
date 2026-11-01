import type {
  ApiResponse,
  BadgeInfo,
  ClaimNfcBadgesResult,
  CompleteNfcBatchParams,
  CompleteNfcBatchResult,
  CreateNfcBatchParams,
  ExchangeType,
  NfcBadgeListResponse,
  NfcBatchCreated,
  NfcLookupResult,
  RecordNfcExchangeResult,
} from "@/types/api.types";

import { apiClient } from "./api";

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
      /** 只回已綁定的卡片。後端 `EventNfcBatchController.ts:88` 讀此參數。 */
      boundOnly?: boolean;
      /** `true` → 回全量（統計與批次聚合用）。與 Web 的 `listNfcBadges(…, { all: true })` 同義。 */
      all?: boolean;
    },
  ): Promise<NfcBadgeListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    if (params?.status) query.set("status", params.status);
    if (params?.batchId) query.set("batchId", params.batchId);
    if (params?.boundOnly) query.set("boundOnly", "true");
    if (params?.all) query.set("all", "true");
    const res = await apiClient.get<ApiResponse<NfcBadgeListResponse>>(
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

  /**
   * POST /v1/events/:eventId/nfc/exchange — 記錄兩張卡之間的雙向交換（OPERATOR+）。
   *
   * 欄名是 BE 的 wire 契約（`BE:src/events/dtos/event-exchange.dto.ts:7`／`:11`）：
   * `initiatorUid` / `receiverUid` —— **不是** `initiatorTagUid` / `receiverTagUid`。
   * 該 controller 自 Loop AB · WP-19 起 `forbidNonWhitelisted`：舊欄名會被
   * **422 `VALIDATION_ERROR`** 指名拒絕，不再被靜默丟棄成誤導性的 400（`R-DK-01`）。
   *
   * 冪等由後端負責（同 pair 第二次回 `alreadyExchanged: true`，不再寫 DB）；
   * 呼叫端不應把它當失敗。
   */
  async recordExchange(
    eventId: string,
    body: {
      initiatorUid: string;
      receiverUid: string;
      exchangeType?: ExchangeType;
    },
  ): Promise<RecordNfcExchangeResult> {
    const res = await apiClient.post<ApiResponse<RecordNfcExchangeResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/exchange`,
      body,
    );
    return res.data.data;
  },

  // -------------------------------------------------------------------------
  // Badge 批次（`badges` 能力）— 與 Web 的 `FE:lib/events/nfc.ts` 逐條對齊
  // -------------------------------------------------------------------------

  /**
   * POST /v1/events/:eventId/nfc/batch — 建立一批 badge（Write 權限）。
   *
   * `count` 後端上限是 500（Web 的 `handleCreateBatch` 先在畫面上擋 1–500，
   * 這裡不重複驗—畫面那層會把錯誤訊息顯示在欄位旁）。這裡只負責**不送
   * `undefined` 的鍵**：後端 DTO 對 `badgeType`／`colorCode`／`batchLabel`
   * 都是 optional，但送 `undefined` 經 `JSON.stringify` 會整鍵消失，
   * 送 `""` 則會被當成「空了色碼」而 422。
   */
  async createBatch(
    eventId: string,
    params: CreateNfcBatchParams,
  ): Promise<NfcBatchCreated> {
    const body: CreateNfcBatchParams = { count: params.count };
    if (params.badgeType) body.badgeType = params.badgeType;
    if (params.colorCode) body.colorCode = params.colorCode;
    if (params.batchLabel) body.batchLabel = params.batchLabel;
    const res = await apiClient.post<ApiResponse<NfcBatchCreated>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/batch`,
      body,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/nfc/batch/:batchId/complete — 完成批次
   * （operator access）。
   *
   * 把批次內每張 badge 的假 `tagUid` 換成**實體手環量到的** UID。
   * 後端是逐筆套用、部分成功仍回 200（`updatedCount` ＋ `failures`），
   * 所以呼叫端**不可**把「有 failures」當成整批失敗。
   *
   * ⚠️ 手環一次性：寫入後那張手環就不能改用另一個 `badgeId` 重寫。
   * 這也是畫面必須二次確認的原因。
   */
  async completeBatch(
    eventId: string,
    batchId: string,
    params: CompleteNfcBatchParams,
  ): Promise<CompleteNfcBatchResult> {
    const res = await apiClient.post<ApiResponse<CompleteNfcBatchResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/batch/${encodeURIComponent(batchId)}/complete`,
      params,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/nfc/batch/claim — 把 badge 指派給展商
   * （Write 權限）。
   *
   * 後端對「已指派給別人」的 badge 回 `BADGE_ALREADY_ASSIGNED`；
   * 呼叫端只據此給分類文案，不回顯後端 message。
   */
  async claimBadges(
    eventId: string,
    params: { badgeIds: string[]; exhibitorId: string },
  ): Promise<ClaimNfcBadgesResult> {
    const res = await apiClient.post<ApiResponse<ClaimNfcBadgesResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/batch/claim`,
      params,
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/nfc/badges/export — CSV（Write 權限）。
   *
   * 後端回的是 **JSON `{ csv }`**，不是 `text/csv` 檔案（Web 收到字串後自己
   * 用 Blob 下載）。App 沒有檔案系統依賴，所以呼叫端把 `csv` 顯示在可複製的
   * 面板裡（見 `badges.tsx` 檔頭「與 Web 的差異四」）。
   *
   * ⚠️ 查詢字串**永遠帶 `?`**（沒參數時就是一個空 query），與同檔 `listBadges`
   * 一致。不照 Web 的「有參數才接 `?`」，是因為 `scripts/check-backend-contract.mjs`
   * 抽呼叫的方式是「定位動詞後往後抓**第一個**字串字面」—— 條件式版本必然寫成
   * 嵌套模板字串（`${qs ? `?${qs}` : ""}`），内層的反引號會把外層的比對截斷，
   * 閘門於是拿到一条殘缺路徑而誤紅。空 query 在 HTTP 上等於沒有 query。
   */
  async exportBadges(
    eventId: string,
    params?: { status?: string; batchId?: string },
  ): Promise<{ csv: string }> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.batchId) query.set("batchId", params.batchId);
    const res = await apiClient.get<ApiResponse<{ csv: string }>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/nfc/badges/export?${query.toString()}`,
    );
    return res.data.data;
  },
};
