/**
 * 匯款覆核（`EventBankTransferApproval`）型別 — parity `bank-transfers`。
 *
 * 前端 counterpart：
 * - `LinkCard_Frontend/lib/events/types.ts:980` 的 `BankTransferApproval`
 * - `LinkCard_Frontend/lib/events/registrations.ts:360` 的
 *   `listBankTransferApprovals` / `:376` 的 `reviewBankTransfer`
 * - 後端 `LinkCard_ExpressJS_Backend/prisma/schema.prisma` 的
 *   `EventBankTransferApproval`
 *
 * **逐字照 Web 建模，不多也不少**——少一個欄位就讀不到後端回的資料，
 * 多一個欄位就會有人「順手」把它顯示到核可畫面旁邊。
 *
 * ## `amount` 是字串，不是 number，也不是「分」
 *
 * 後端 `EventBankTransferApproval.amount` 是 Prisma `Decimal`，經 JSON 序列化
 * 後是**字串**（Web 的 `amount: string` 就是這個原因）。同一份錢在
 * `EventRegistrationService.listBankTransferApprovals`（`:1317-1335`）會被
 * **重算**一次：
 *
 * ```
 * approval.amount = pricing.amount.toString()   // 不是資料庫存的舊值
 * ```
 *
 * 理由是舊資料列的 `amount` 可能是 0（價格欄位回退修正之前建立的）。也就是說
 * 列表上的金額是「這個報名**應該**付多少」，不是「當初寫進這一列的值」——
 * 覆核時顯示的正是前者，所以 **App 一律顯示回應值，不自己再算、不自己格式化
 * 成整數**。
 *
 * ## 為什麼 `status` 是 `string` 而不是 `BankTransferStatus`
 *
 * Web 也是 `string`。後端 DTO（`ReviewBankTransferDto`）只約束**寫入**的
 * 值域是 `APPROVED | REJECTED`；**讀出**的 `status` 來自 DB 字串欄，今天只有
 * `PENDING` / `APPROVED` / `REJECTED` 三個值，但那是資料現況、不是型別契約。
 * 收緊成 union 會讓「後端多一個狀態」變成一個**執行期才會炸**的 `as` 斷言。
 * 畫面上的徽章用 `BankTransferStatus` 做對照，認不得的字串照原樣顯示。
 *
 * ## 刻意沒有建模的欄位（不是漏抄）
 *
 * - `breakdown`：後端列表會多回一個重算明細（`pricing.breakdown`），Web 的
 *   `BankTransferApproval` 沒有它，畫面也沒用到。建模它就等於給下一個人一個
 *   「可以顯示明細」的邀請，而那是新的產品行為。
 * - `reviewNote` / `reviewedBy`：只在寫入時送出（`reviewNote`），回讀時後端
 *   的 `approval` 物件含有它，但 Web 不顯示——覆核理由寫進去之後沒有任何畫面
 *   讀得到。要不要顯示是產品決定，不在「對齊」範圍內。
 * - `registration.id` / `registrantType` / `formData` / `ticketType`：後端
 *   `include.registration.select` 有回，Web 型別只取四個顯示欄位 + 報名碼。
 */

/** 後端今天實際會出現在清單裡的狀態。 */
export type BankTransferStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * 狀態頁籤的值。
 *
 * `""` ＝「全部」，對應 Web `STATUS_TABS` 的第一個 tab（`bankTransfers.all`）。
 * 這個空字串不是裝飾：`listBankTransferApprovals` 對 `status` 是
 * `status ? {...} : {}`，所以「全部」＝**不帶** `status` 參數。
 */
export type BankTransferStatusFilter = "" | BankTransferStatus;

/** 覆核決定。與後端 `ReviewBankTransferDto.decision` 的 `@IsEnum` 值域一致。 */
export type BankTransferDecision = "APPROVED" | "REJECTED";

/**
 * 這筆匯款對應的報名（後端 `include.registration.select` 的子集）。
 *
 * `company` 是可空的（個人報名沒有公司）。
 */
export interface BankTransferRegistrationSummary {
  firstName: string;
  lastName: string;
  email: string;
  company?: string | null;
  registrationCode: string;
}

/** 一筆待核／已核的匯款憑證。 */
export interface BankTransferApproval {
  id: string;
  eventId: string;
  registrationId: string;
  /** 憑證圖檔的絕對網址（後端上傳後回傳的 URL）。 */
  proofUrl: string;
  /** 幣別單位金額，字串（見檔頭）。 */
  amount: string;
  currency: string;
  /** 參加者填的匯款參考號（可空——後端 `SubmitBankTransferDto.bankRef` 是 optional）。 */
  bankRef?: string | null;
  status: string;
  reviewedAt?: string | null;
  submittedAt: string;
  registration: BankTransferRegistrationSummary;
}

/**
 * 分頁資訊。
 *
 * ⚠️ Web 的 `Pagination`（`lib/events/types.ts`）是同一組四個欄位。這裡獨立
 * 宣告而不是共用 `api.types.ts` 的 `ListPagination`，是因為後端這一支**一定**
 * 會回這四個（`EventRegistrationService:1337-1342`），沒有「缺席」的可能，
 * 而 `ListPagination` 的欄位是 optional（其他端點會省）。
 */
export interface BankTransferPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 列表查詢參數（與 Web `listBankTransferApprovals` 的第二個參數同構）。
 *
 * ⚠️ **後端有分頁，而 Web 的頁面從來沒送過 `page`／`limit`**：它只送
 * `{ status }`，於是永遠停在第 1 頁、每頁 20 筆
 * （`EventRegistrationController.listBankTransfers:440-443` 的預設值）。
 * 這一支型別把 `page` / `limit` 留著，是因為呼叫端（service）要能原樣透傳
 * Web 的能力；**畫面送不送**是另一件事——`bank-transfers.tsx` 照 Web 只送
 * `status`，這個落差在交付說明裡單獨列出。
 */
export interface BankTransferListParams {
  status?: string;
  page?: number;
  limit?: number;
}
