import type {
  ActivationLinkInfo,
  ApiResponse,
  GuestImportConfirmResult,
  GuestImportMode,
  GuestImportNotifyResult,
  GuestImportPreview,
  Registration,
  RegistrationStatusCorrectionResult,
  RegistrationStatusCorrectionTarget,
  ResendActivationEmailResult,
  ResendConfirmationResult,
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
   * GET /v1/events/:eventId/registrations/:registrationId/activation-link?readonly=1
   *
   * 讀單筆的 **claim 狀態**（批次寄送面板的探針）。
   *
   * ## ⚠️ 那個 `readonly=1` 不是可選項，這裡刻意把它寫死在 URL 上
   * 同一條路由的**預設**行為是「當場簽發一顆 activation token 並回傳可轉傳的
   * URL」（`BE:EventRegistrationController.getActivationLink`）。批次面板只是要
   * **讀狀態**，但它會對整頁每一筆各打一次——少了 `readonly=1`，開一次面板就會把
   * 每個 `pending_claim` 的人變成「已有有效連結」，於是面板的預設收件人
   * （有帳號、未 claim、無有效 token）在第二次開啟時**歸零**（`AA-F-01`）。
   *
   * 而 `?readonly` **只認字串 `'1'`**：`true`、`1`（數字，經 `qs` 後仍是
   * `'1'`但別名寫法不同）、`0`、`readonly[]=1` 全部落到**簽發**預設路徑
   * （BE 註解 `Query-shape contract (CRA-002)`）。
   *
   * 所以這裡**不開放參數**：沒有參數，就沒有人能傳錯。呼叫端若真的需要「簽發
   * 一顆可轉傳的連結」，那是另一個能力，必須另外開方法並另外想權限與誤用防護，
   * 不是在這裡加一個 boolean。
   *
   * 唯讀探針下 `activationToken`／`activationUrl` 仍是**既有**那顆 token 的值
   * （未過期、未 claim 才有），因此 `has_token` 判定照樣成立。
   */
  async getActivationLinkStatus(
    eventId: string,
    registrationId: string,
  ): Promise<ActivationLinkInfo> {
    const res = await apiClient.get<ApiResponse<ActivationLinkInfo>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/activation-link?readonly=1`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/activation-link
   *
   * 重寄單筆的 **claim（領取）信**（BE-02）。批次面板的單筆單元。
   *
   * ## 與 `resendConfirmation` 的差別
   * - 這條：對方**還沒有帳號**（或已有帳號但未啟用）⇒ 請他啟用。
   * - 那條：帳號已驗證 ⇒ 告訴他已確認的場次資訊。
   *
   * ## 刻意不輪換 token（BE-02）
   * 後端不 rotate，所以重寄同一人**不會**讓先前寄出的連結失效。這也是為什麼
   * 批次寄送可以逐筆重試單一失敗，而不必整批重來。
   *
   * 失敗語意（`error.response.data.error.code`；呼叫端逐筆呈現，`S-4` 不得自動重試）：
   * - `409 TOKEN_ALREADY_CLAIMED` — 已 claim
   * - `422 REGISTRATION_ACCOUNT_MISSING` — 補建帳號失敗（可重試）
   * - `502 ACTIVATION_EMAIL_SEND_FAILED` — SMTP 失敗
   * - `403 INSUFFICIENT_PERMISSION` / `404 REGISTRATION_NOT_FOUND`
   */
  async resendActivationEmail(
    eventId: string,
    registrationId: string,
  ): Promise<ResendActivationEmailResult> {
    const res = await apiClient.post<ApiResponse<ResendActivationEmailResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/activation-link`,
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/:registrationId/resend-confirmation
   *
   * 重寄**確認信**（P2-3）。對應 Web `resendRegistrationConfirmation`
   * （`LinkCard_Frontend/lib/events/registrations.ts:479`，呼叫端在
   * `RegistrationDetailDrawer.tsx:143`）。
   *
   * ## 它做什麼、不做什麼
   * 把該報名的 `REGISTRATION_CONFIRMED` outbox 意圖重置回 `PENDING`
   * （BE `mode:'resend'`，同列不新增）。**不直接寄信**——relay cron 每 5 分鐘
   * 接手。所以回應只保證「已排入佇列」，畫面不得寫「已寄出」。
   *
   * ## 這是確認信，不是領取信
   * 領取（claim）信用的是另一條 `POST …/activation-link`（見 Commit 4 那條）。
   * 兩者在 UI 上是兩個不同的問題：「告訴我已確認的人場次資訊」 vs「請他啟用帳號」。
   *
   * 失敗語意（`error.response.data.error.code`）：
   * - `CONFIRMATION_EMAIL_NOT_APPLICABLE` — 沒有已驗證帳號 ⇒ 依設計走領取信
   * - `REGISTRATION_NOT_FOUND_OR_NOT_CONFIRMED` — 狀態不是 CONFIRMED／CHECKED_IN
   * - `REGISTRATION_NOT_FOUND` — 無此報名／非本活動
   * - `403 INSUFFICIENT_PERMISSION` — 需活動寫入權限
   */
  async resendConfirmation(
    eventId: string,
    registrationId: string,
  ): Promise<ResendConfirmationResult> {
    const res = await apiClient.post<ApiResponse<ResendConfirmationResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(registrationId)}/resend-confirmation`,
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

  /* ──────────────────────────────────────────────────────────────────────
   * 貴賓名單匯入（`/registrations/import/*`）
   *
   * 對應 Web `lib/events/registrationImport.ts`。四條呼叫與 BE
   * `registration-import.routes.ts` 一一對應（同一組 rate limit、同一個
   * `file` 欄位名、同一個 5MB 上限）。
   *
   * ## 為什麼這些要帶 FormData 而其他呼叫不用
   * 這個 client 的全域預設是 `Content-Type: application/json`。multipart
   * 請求必須逐次覆寫，否則後端 multer 收到的 body 是空的，錯誤會變成
   * 「請上傳 CSV 或 XLSX 檔案」（`EMPTY_FILE`）——看起來像使用者沒選檔，
   * 實際上是標頭錯了。
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * POST /v1/events/:eventId/registrations/import/preview
   *
   * dry-run：**零寫入**。回傳有效／無效／重複列與名額影響。
   */
  async previewGuestImport(
    eventId: string,
    file: GuestImportFile,
  ): Promise<GuestImportPreview> {
    const res = await apiClient.post<ApiResponse<GuestImportPreview>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/import/preview`,
      buildGuestImportFormData(file),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/import/confirm
   *
   * 建立報名（per-row 交易）。**冪等**：同一份檔案重跑不會重複建立。
   */
  async confirmGuestImport(
    eventId: string,
    file: GuestImportFile,
    mode: GuestImportMode,
  ): Promise<GuestImportConfirmResult> {
    const res = await apiClient.post<ApiResponse<GuestImportConfirmResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/import/confirm`,
      buildGuestImportFormData(file, mode),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  /**
   * POST /v1/events/:eventId/registrations/import/notify
   *
   * 分批寄票。單請求上限 100 筆（BE `NOTIFY_MAX`），呼叫端要自己切批——
   * 這裡**不**代為切批，因為「寄了幾批、哪一批失敗」是呼叫端要呈現的事實。
   */
  async notifyGuestImport(
    eventId: string,
    registrationIds: string[],
  ): Promise<GuestImportNotifyResult> {
    const res = await apiClient.post<ApiResponse<GuestImportNotifyResult>>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/import/notify`,
      { registrationIds },
    );
    return res.data.data;
  },

  /**
   * GET /v1/events/:eventId/registrations/import/template
   *
   * 下載 CSV 模板（**文字**）。App 沒有檔案系統下載語意，所以回傳字串，
   * 由畫面決定怎麼交給使用者（`Share`／剪貼簿）——與 `exportAttendeesCsv`
   * 同一個理由。
   *
   * `responseType: "text"` 是必要的：預設會嘗試 JSON 解析，CSV 一解析就爆。
   */
  async downloadGuestImportTemplate(eventId: string): Promise<string> {
    const res = await apiClient.get<string>(
      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/import/template`,
      { responseType: "text" },
    );
    return res.data;
  },
};

/**
 * 選好的一個檔案（`expo-document-picker` 的 asset 去掉它自己的欄位）。
 *
 * 刻意不直接用 `DocumentPicker.DocumentPickerAsset`：那會讓 service 依賴
 * 一個 UI 層的套件，Node 測試就載不進來了。這裡只留 RN `FormData` 真正
 * 需要的三個欄位。
 */
export interface GuestImportFile {
  /** 平台原生的 URI（iOS `file://…`、Android `content://…`）。 */
  uri: string;
  name: string;
  mimeType: string | null;
}

/**
 * 組出 multipart body。
 *
 * `append` 的第二個參數在 React Native 是「帶 `uri` 的物件」，型別卻寫成
 * `Blob`（那是瀏覽器的定義）——所以這裡一定要轉型。這不是偷懶：RN 的
 * `FormData` 實作會讀 `uri`／`name`／`type` 去串出檔案區段，傳真的 `Blob`
 * 反而在 RN 上不能用。
 */
function buildGuestImportFormData(
  file: GuestImportFile,
  mode?: GuestImportMode,
): FormData {
  const body = new FormData();
  body.append("file", {
    uri: file.uri,
    name: file.name,
    // 後端白名單接受 `application/octet-stream`，所以 Android 回報不出
    // MIME 時退回它不會被擋；檔名本身仍帶著 `.csv`／`.xlsx`。
    type: file.mimeType ?? "application/octet-stream",
  } as unknown as Blob);
  if (mode) body.append("mode", mode);
  return body;
}
