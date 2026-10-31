/**
 * 參展廠商（Exhibitor）型別 — parity `exhibitors`。
 *
 * 前端 counterpart：`LinkCard_Frontend/lib/events/types.ts:362-410` 的
 * `Exhibitor`、`LinkCard_Frontend/lib/events/exhibitorImport.ts:27-78` 的匯入
 * 型別。**逐字照 Web 建模，不多也不少**——少一個欄位就讀不到後端回的資料，
 * 多一個欄位就會有人「順手補齊」送進 PATCH。
 *
 * ## 為什麼獨立成一個檔案而不是塞回 `api.types.ts`
 *
 * 與 `poll.types.ts` 同一個理由：這一組型別帶著兩條必須寫在型別旁邊的約定
 * （`status` 只有四值、匯入的 `mode` 只有 `skip_existing`），塞進 700 多行的
 * 匯入宿主裡沒有人會看到。
 *
 * ## 這份型別刻意**不含**的東西
 *
 * - `Exhibitor.members`：後端 `exhibitorAdminListSelect` 會回傳邀請列
 *   （`{ userId, email, role, status, expiresAt }`），Web 用它畫「未認領／已
 *   過期」徽章。App **不接**這一欄，因為接了也沒有下一步——唯一的處置是
 *   `POST …/members/:memberId/resend`，那是一條 App 沒有實作、也不在本次
 *   對齊範圍內的端點。只顯示卻不能處理，就是一條產品死路。
 * - `updateExhibitor` 的 payload：Web 的管理頁沒有呼叫 PATCH `/:exhibitorId`
 *   （「編輯」連到展商入口的 `manage/company` 頁，那是另一個 surface）。
 *   這裡跟著不提供，避免多出一條 Web 沒有的寫入路徑。
 */

/** 廠商類型。逐字照 Web `ExhibitorType`（`lib/events/types.ts:24-31`）。 */
export type ExhibitorType =
  | "ALPHA_STARTUP"
  | "ENTERPRISE"
  | "BUSINESS_ENABLER"
  | "SPONSOR"
  | "MEDIA"
  | "GOVERNMENT"
  | "OTHER";

/**
 * 覆核狀態。逐字照後端 `ExhibitorStatus`（`prisma/schema.prisma:324-329`）。
 *
 * ⚠️ 這四個值**不是**一條線性的流程：`COMPLETED` 是活動結束後的人為標記，
 * 不是「審核通過的下一步」。Web 的列表頁只在三個狀態之間移動
 * （`PENDING_APPROVAL → ACTIVE → SUSPENDED → ACTIVE`），沒有 `COMPLETED`
 * 的按鈕——App 照抄，不新增第四個動作。
 */
export type ExhibitorStatus =
  "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "COMPLETED";

/**
 * `GET …/exhibitors` 的 `exhibitors[]` 元素（＝後端 `eventExhibitor` 一列）。
 *
 * 欄位依後端 `exhibitorPublicListSelect`（`ExhibitorService.ts:46-61`）——主辦
 * 讀的是同一個投影再疊 `members`（見檔頭說明為什麼 App 不接）。
 * `createdAt` / `updatedAt` 真的會回傳，所以列出來；不列會讓「後端多給了什麼」
 * 變成一個要靠猜的問題。
 */
export interface Exhibitor {
  id: string;
  eventId: string;
  companyName: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  isPublic: boolean;
  exhibitorType: ExhibitorType;
  status: ExhibitorStatus;
  boothNumber?: string | null;
  boothLocation?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 後端列表端點的分頁欄位（`ExhibitorService.listPublicExhibitors` 回傳）。 */
export interface ExhibitorPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** `GET …/exhibitors` 的完整回應。 */
export interface ExhibitorListResponse {
  exhibitors: Exhibitor[];
  pagination: ExhibitorPagination;
}

/**
 * 後端允許的單頁上限（`ExhibitorService.ts:225` 的 `Math.min(100, …)`）。
 *
 * 為什麼要明寫：後端**不帶 `limit` 時預設只回 20 筆**，而且這個截斷不會有
 * 任何錯誤——Web 的列表頁正是沒帶 `limit`，所以第 21 家之後的廠商在畫面上
 * 直接不存在。App 每次請求都帶滿這個上限，並用 `pagination.total` 判斷有沒有
 * 被截斷（見 `src/utils/exhibitor-list.ts` 的 `isListTruncated`）。
 */
export const EXHIBITOR_LIST_MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// 匯入（`/exhibitors/import/*`）— EXH-IMPORT 契約 §11.2
// ---------------------------------------------------------------------------

/**
 * 確認匯入的 `mode`。**只有這一個值**（EXH-IMPORT 拍板 #4）。
 *
 * 後端 `EventExhibitorImportController.confirm` 對「有送 `mode` 但不等於
 * `skip_existing`」是**明確拒絕**（400 `UNSUPPORTED_IMPORT_MODE`），不會靜默
 * 降級。所以這個字串寫錯就是整個匯入失敗，不是「行為不同」。
 */
export const EXHIBITOR_IMPORT_CONFIRM_MODE = "skip_existing";

/** 一列被判定為重複的原因。 */
export type ExhibitorImportDuplicateReason =
  "EMAIL_EXISTS_IN_EVENT" | "DUPLICATE_IN_FILE";

/** 確認匯入時被跳過的原因（重複原因 ＋ 邀請列已存在）。 */
export type ExhibitorImportSkipReason =
  ExhibitorImportDuplicateReason | "MEMBER_EXISTS";

/** 單一欄位的錯誤。`value` 是原始格值，供逐列錯誤報表使用。 */
export interface ExhibitorImportRowError {
  field: string;
  code: string;
  message: string;
  value?: string | null;
}

/** 一列多錯。後端保證 `errors` 至少一筆。 */
export interface ExhibitorImportInvalidRow {
  row: number;
  errors: ExhibitorImportRowError[];
}

/** 一列重複。`existingExhibitorId` 只在 `EMAIL_EXISTS_IN_EVENT` 時出現。 */
export interface ExhibitorImportDuplicateRow {
  row: number;
  reason: ExhibitorImportDuplicateReason;
  existingExhibitorId?: string;
}

/**
 * 一列可用（預覽通過）的資料。
 *
 * `slug` 由後端計算（`resolveSlugs`）：檔案裡沒填時它會從公司名推導並加上
 * 去重後綴，所以型別是 `string | null`——極端情況下推導失敗會是 `null`。
 * 預覽畫面顯示的是**後端算出來的值**，不是使用者填的值。
 */
export interface ExhibitorImportValidRow {
  row: number;
  companyName: string;
  email: string;
  slug: string | null;
  website?: string | null;
  phone?: string | null;
  description?: string | null;
  boothNumber?: string | null;
  boothLocation?: string | null;
  exhibitorType?: string;
}

/** `POST …/import/preview` 的回應（dry-run，**零寫入**）。 */
export interface ExhibitorImportPreview {
  fileHash: string;
  total: number;
  summary: { valid: number; invalid: number; duplicate: number };
  valid: ExhibitorImportValidRow[];
  invalid: ExhibitorImportInvalidRow[];
  duplicates: ExhibitorImportDuplicateRow[];
}

/** 確認匯入成功建立的一列。`memberId` 是邀請列的 id（notify 要用的就是它）。 */
export interface ExhibitorImportCreatedRow {
  row: number;
  exhibitorId: string;
  memberId: string;
  email: string;
  slug: string;
}

/** 確認匯入被跳過的一列（去重命中，沒有進入交易）。 */
export interface ExhibitorImportSkippedRow {
  row: number;
  reason: ExhibitorImportSkipReason;
}

/** 確認匯入失敗的一列（該列專屬交易回滾，其餘列照常）。 */
export interface ExhibitorImportFailedRow {
  row: number;
  reason: string;
  code?: string;
}

/** `POST …/import/confirm` 的回應。三態互斥：created／skipped／failed。 */
export interface ExhibitorImportConfirmResult {
  fileHash: string;
  mode: string;
  created: ExhibitorImportCreatedRow[];
  skipped: ExhibitorImportSkippedRow[];
  failed: ExhibitorImportFailedRow[];
}

/** `POST …/import/notify` 的回應（單請求 ≤100 筆）。 */
export interface ExhibitorImportNotifyResult {
  sent: { memberId: string }[];
  skipped: { memberId: string; reason: string }[];
  failed: { memberId: string; error: string }[];
}

/** 單次 notify 的上限（後端 `EventExhibitorImportService.BATCH_MAX`）。 */
export const EXHIBITOR_IMPORT_NOTIFY_BATCH_MAX = 100;
