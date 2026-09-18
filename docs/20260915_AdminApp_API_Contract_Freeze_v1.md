# LinkCard Event Admin App — API 契約凍結規格 v1.0

> **版本**：v1.0（**凍結候選 — 待雙方簽核**）｜**建立日期**：2026-09-15
> **產出**：Neo Loop Engine（JARVIS Agent Network）/ Edison 規劃部（architect）
> **品質合約**：strict（Pass 93）/ L3 Deep Dive
> **適用範圍**：`LinkCard_Event_Admin_App_Expo`（前端 feiteng2015）↔ `LinkCard_ExpressJS_Backend`（後端 用戶本人）
> **證據基準**：2026-09-15 實測。**行號會變動，以函式名為準。**

## 標記約定

| 標記  | 意義                                                                                                 |
| :---: | ---------------------------------------------------------------------------------------------------- |
|  🟢   | **已存在且契約穩定**（live 驗證過）                                                                  |
|  🟡   | **已存在但契約有問題**（附具體修正內容）                                                             |
|  🔴   | **待新建**（附 request/response 草案）                                                               |
| 🟢+🔴 | **已存在但本次將新增欄位（additive）**：既有欄位不得改名、不得移除；新增欄位前端可先忽略（向後相容） |
|  📌   | **規劃建議**（非實作事實）                                                                           |
|  ⚠️   | **未驗證**（需用戶確認）                                                                             |

---

## 0. 凍結聲明（先讀）

| 項               | 內容                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **凍結什麼**     | §2 端點總表的 **method / path / request 欄位名 / response 欄位名 / 錯誤碼**               |
| **不凍結什麼**   | 後端內部實作、DB schema、樂觀鎖策略、快取策略                                             |
| **變更程序**     | 任一方要改 → 提出 → 雙方同意 → 本文件升版（v1.1）+ 記錄變更原因。**口頭同意無效**         |
| **前端開工條件** | §6「待裁決清單」**C-1 / C-2 / C-3 必須先拍板**                                            |
| **文件維護責任** | 🔴 待新建端點：**用戶**在交付時更新本文件 → 前端據此改型別。🟢 已存在：前端發現不符即回報 |

---

## 1. 環境與認證

### 1.1 Base URL 與前綴（⚠️ 後端有兩套前綴）

| 群組        | 前綴                          | 證據（以函式名為準、行號為輔）                                                 |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------ |
| 認證 / 用戶 | `/api/auth/*`、`/api/users/*` | `auth.service.ts` 的 `login()` / `me()`（≈ :12 / :21）                         |
| 活動模組    | `/api/v1/events/*`            | `event.service.ts` 的 `getMyManagedEvents()` / `getEventById()`（≈ :18 / :47） |

> 📌 **規劃建議**：此雙前綴為歷史遺留，v1.0 **不動它**（改動成本 > 收益）。前端只需記住：**認證走 `/api`，活動走 `/api/v1`**。

### 1.2 認證模型

| 項       | 內容                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 機制     | JWT Bearer（`Authorization: Bearer <token>`）                                 |
| 取得     | `POST /api/auth/login` → `{ token, user }`                                    |
| 儲存     | `expo-secure-store`（`utils/storage.ts` 的 token 讀寫）                       |
| 注入     | axios **request interceptor** 自動附加 `Authorization`（`api.ts`）            |
| 逾時處理 | 非 login 端點的 401 → 清 token + 導回登入（`api.ts` 的 response interceptor） |

### 1.3 統一 Response Envelope

```jsonc
// 成功
{ "success": true, "data": { /* T */ }, "message": "..." }   // message 選用

// 失敗
{ "success": false, "error": { "code": "ERROR_CODE", "message": "人類可讀文字" } }
```

| 項            |     狀態      | 證據                                                                                                                                                                                                                                                |
| ------------- | :-----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 成功 envelope |      🟢       | `api.types.ts` 的 `ApiSuccess<T>` 已對齊                                                                                                                                                                                                            |
| 錯誤 envelope | 🟡 **有分歧** | 後端由 `ApiResponse.error()`（`utils/apiResponse.ts`）發出；Admin App 由 `api.types.ts` 的 `ApiFailure` 宣告 `error: { code, message }`。實測前端用 `getApiErrorCode()`（`utils/api-error.ts`）以**結構型別**讀取，不 import axios → **目前可運作** |

> 📌 **v1.0 起以 `error.code` 為唯一錯誤碼來源。** `message` 只供顯示參考，不作為程式判斷依據。

---

## 2. 端點總表

> 全部掛於 `{BASE}/api/v1/events/:eventId`（除認證群組）。
> `:eventId` 可為 **id 或 slug**（後端 `EventService.resolveEventId()`，`EventService.ts:330`；controller 只是呼叫它）。
> **引用慣例（本文件全域有效）**：一律以**函式名 / 路由字串**定位；`file.ts:NN` 僅為 2026-09-15 的輔助行號，會隨開發漂移。

### 2.A 認證與活動上下文

| #   | Mark | Method & Path                       | 用途                            | Auth   | 證據                                                                                                       |
| --- | :--: | ----------------------------------- | ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| A-1 |  🟢  | `POST /api/auth/login`              | 登入                            | public | `auth.service.ts` 的 `login()`（≈ :12）                                                                    |
| A-2 |  🟢  | `GET /api/users/me`                 | 當前用戶                        | JWT    | `auth.service.ts` 的 `me()`（≈ :21）                                                                       |
| A-3 |  🟢  | `GET /api/v1/events/my-managed`     | 我的活動（含 `_meta.userRole`） | JWT    | `event.service.ts` 的 `getMyManagedEvents()`；後端 `EventService.getMyManagedEvents()` 回 `_meta.userRole` |
| A-4 |  🟢  | `GET /api/v1/events/by-id/:eventId` | 單一活動                        | JWT    | `event.service.ts` 的 `getEventById()`（≈ :47）                                                            |

---

### 2.B QR 簽到

| #      | Mark | Method & Path                          | 用途                   | Auth                                                          | 證據                                                                                                            |
| ------ | :--: | -------------------------------------- | ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CHK-01 |  🟡  | `GET /registrations/by-code/:code`     | 掃碼查詢（簽到第一步） | **public**（限流）                                            | 路由 `router.get('/by-code/:code'`（`registrations.routes.ts:67-71`）；限流 `registrationCodeLookupRateLimiter` |
| CHK-02 |  🟡  | `POST /registrations/checkin`          | 執行報到               | `EventService.getEventOperatorAccess()`（owner/SA/CO/**OP**） | 路由 `router.post('/checkin'`；handler `EventRegistrationController.checkIn()`                                  |
| CHK-03 | 🔴📌 | `POST /registrations/checkin/override` | 重複簽到覆核放行       | COORDINATOR+                                                  | 新增                                                                                                            |
| CHK-04 | 🔴📌 | `GET /checkin-stats`                   | 單日/單場簽到計數      | operator+                                                     | 新增                                                                                                            |

#### CHK-01 🟡 — by-code 查詢

| 項            | 內容                                                                                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**      | `GET /api/v1/events/:eventId/registrations/by-code/:code`                                                                                                                                                                  |
| **Auth**      | Public（**無需 JWT**）                                                                                                                                                                                                     |
| **Query**     | 無                                                                                                                                                                                                                         |
| **Response**  | `{ registration: {...} }`                                                                                                                                                                                                  |
| **❌ 問題 1** | **限流 20 次 / 5 分鐘 / IP**（`registrationCodeLookupRateLimiter`：`windowMs: 5*60*1000`、`limit: 20`、`keyGenerator: ipKeyGenerator(req.ip)`；`registrations.routes.ts:12-26`）→ `REGISTRATION_LOOKUP_RATE_LIMITED` (429) |
| **❌ 問題 2** | `registration` 回 **flat** `firstName`/`lastName`/`company`/`jobTitle`（`EventRegistrationService.getRegistrationByCode()` 的 select），但 Admin App 型別（`api.types.ts` 的 `Registration`）宣告 `profile.fullName`       |
| **修正建議**  | ① 限流改為**認證後以 userId 計 key**；未認證才退回 IP。理由：展館 WiFi NAT 共用出口 IP，20 次/5min 在開場尖峰必然誤殺（會議 §五：5 分鐘 500 人）。② 型別二選一 → §6 裁決 **C-2**                                           |
| **前端文案**  | 429 → 「查詢過於頻繁，請稍候 3 秒再掃」+ 自動退避重試                                                                                                                                                                      |

#### CHK-02 🟡 — 執行報到

| 項            | 內容                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**      | `POST /api/v1/events/:eventId/registrations/checkin`                                                                                                                                                                 |
| **Auth**      | JWT + `getEventOperatorAccess` → owner / SUPER_ADMIN / COORDINATOR / OPERATOR                                                                                                                                        |
| **Request**   | `{ registrationCode: string }`                                                                                                                                                                                       |
| **Response**  | `{ registration: {...} }`（flat 欄位）                                                                                                                                                                               |
| **❌ 問題 1** | `EventRegistrationService.checkIn()` **無條件**拋 `ALREADY_CHECKED_IN`（`EventRegistrationService.ts:1044`），且 DTO `CheckInDto` 只有 `registrationCode`、**無 override 參數** → 會議「主管覆核後二次放行」無法實作 |
| **❌ 問題 2** | `EventRegistration` model 只有 `checkedInAt` / `checkedInBy` 兩欄（`schema.prisma`）→ **無閘口/地點**                                                                                                                |
| **修正**      | 見後端待辦 B-2 / B-3                                                                                                                                                                                                 |

#### CHK-03 🔴 — 重複簽到覆核（草案）

```jsonc
// POST /api/v1/events/:eventId/registrations/checkin/override
// Auth: JWT + getEventWriteAccess (owner / SUPER_ADMIN / COORDINATOR)
// Request:
{
  "registrationCode": "ABC123",
  "reason": "客人手機重裝 App，QR 重新出示",   // 必填，審計用
  "gateId": "GATE-A"                            // 選用（若 B-3 落地）
}

// 200:
{
  "success": true,
  "data": {
    "registration": { /* flat 欄位 */ },
    "override": { "appliedAt": "...", "appliedBy": "userId", "attemptCount": 2 }
  }
}

// 錯誤：
// 403 INSUFFICIENT_PERMISSION     （非 COORDINATOR+）
// 404 REGISTRATION_NOT_FOUND
// 409 CHECKIN_NOT_IN_CONFLICT     （原本沒簽到過，不該走 override）
```

> 📌 **規劃建議（開放選項）**：也可不新增端點，改為 `checkin` 加 body `{ override?: true, reason?: string }`。**技術上兩者等價**，但新增端點的好處是**權限可分離**（打卡 = OPERATOR，覆核 = COORDINATOR+）。
> **建議採新增端點** → 裁決 **C-6**。

#### CHK-04 🔴 — 簽到計數（草案）

```jsonc
// GET /api/v1/events/:eventId/checkin-stats?scope=today|session&sessionId=xxx
// Auth: JWT + getEventOperatorAccess
// 200:
{
  "success": true,
  "data": {
    "scope": "today",
    "count": 137,
    "lastCheckInAt": "2026-11-14T10:32:11Z",
    "generatedAt": "...",
  },
}
```

> ⚠️ **替代方案（若後端來不及）**：用既有 `GET /registrations?status=CHECKED_IN&limit=1` 讀 `pagination.total`（`overview.tsx` 的統計卡已用此法）→ 得 **總簽到數**而非**今日數**。**語意降級但可用**，需在 UI 標示清楚。
> **此為 PM 決策點** → 裁決 **C-7**（語意）＋ **C-12**（是否本批交付）。

---

### 2.C 名單

| #      | Mark | Method & Path                      | 用途        | Auth                                                         | 證據                                                                                                                                       |
| ------ | :--: | ---------------------------------- | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| REG-01 |  🟡  | `GET /registrations`               | 名單列表    | `EventService.getEventWriteAccess()`（owner/SA/**CO only**） | 路由 `router.get('/'`（`registrations.routes.ts:64`）→ `EventRegistrationController.listRegistrations()`；guard 實作 `EventService.ts:352` |
| REG-02 | 🔴📌 | `GET /registrations`（新增 query） | 搜尋 / 排序 | 同上                                                         | 新增參數                                                                                                                                   |

#### REG-01 🟡 — 名單列表

| 項                      | 內容                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**                | `GET /api/v1/events/:eventId/registrations`                                                                                                                                                                                             |
| **Query（現況）**       | `page`（預設 1）、`limit`（預設 20，上限 100）、`status`、`ticketTypeId`、`visibility`（all/active/hidden/archived）、`depositRefunded`（all/refunded/not_refunded）                                                                    |
| **Query（❌ 缺）**      | `search`、`sortBy`、`sortOrder`                                                                                                                                                                                                         |
| **Response**            | `{ registrations: [...], pagination: { total, page, limit, totalPages } }`                                                                                                                                                              |
| **❌ 問題 1**           | **OPERATOR 被擋**：`EventRegistrationController.listRegistrations()` 用 `EventService.getEventWriteAccess()`（僅 owner/SA/CO），但 `checkIn()` 用 `EventService.getEventOperatorAccess()`（含 OP）。→ **閘口 staff 能簽到卻看不到名單** |
| **❌ 問題 2**           | 無 `search` / `sortBy`：`EventRegistrationService.listRegistrations()` 只接受 `page` / `limit` / `status` / `ticketTypeId` / `visibility` / `depositRefunded`，排序**硬寫** `createdAt desc`                                            |
| **❌ 問題 3**           | pagination 欄位名與文件不符（`totalPages` vs 文件 `pages`）                                                                                                                                                                             |
| **Pagination 精確契約** | `{ "total": number, "page": number, "limit": number, "totalPages": number }` ← **以 `EventRegistrationService.listRegistrations()` 回傳為準**                                                                                           |
| **修正**                | 見後端待辦 B-4（權限）+ REG-02（參數）+ 裁決 **C-1**（pagination）                                                                                                                                                                      |

#### REG-02 🔴 — 搜尋 / 排序（草案）

| 參數        | 型別   | 說明                                                                       | 驗證             |
| ----------- | ------ | -------------------------------------------------------------------------- | ---------------- |
| `search`    | string | 模糊比對 `firstName` / `lastName` / `email` / `phone` / `registrationCode` | 長度 ≤ 100；trim |
| `sortBy`    | enum   | `createdAt` \| `firstName` \| `tokenBalance` \| `checkedInAt`              | 預設 `createdAt` |
| `sortOrder` | enum   | `asc` \| `desc`                                                            | 預設 `desc`      |

```jsonc
// 200 範例
{
  "success": true,
  "data": {
    "registrations": [/* ... */],
    "pagination": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 },
  },
}

// 400 INVALID_SORT_FIELD / INVALID_SEARCH_QUERY
```

> 📌 **索引建議**：`search` 用 `contains` + `mode: 'insensitive'`。`event_registrations` 的 `email` 已有索引（`schema.prisma` 的 `@@index([email])`），但 `firstName`/`lastName` **無索引**。活動規模（數百至數千筆/場）下 `ILIKE` 全表掃描可接受，**不建議**為此加 trigram 索引（無信號、增加 migration 風險）。

---

### 2.D Token 錢包

| #      | Mark  | Method & Path                              | 用途           | Auth（v11.3 §4.3）                | 證據                                                                                                                     |
| ------ | :---: | ------------------------------------------ | -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| WAL-01 | 🟢+🔴 | `GET /wallet/:registrationId/balance`      | 查餘額         | `PART` ‖ `OWNER/SA/CO/OP`（⚠D12） | `premium.routes.ts` 的 `router.get('/wallet/:registrationId/balance'`（≈ :13）                                           |
| WAL-02 | 🟢+🔴 | `GET /wallet/:registrationId/transactions` | 查流水         | 同上                              | `premium.routes.ts` 的 `router.get(` + 路徑字串 `'/wallet/:registrationId/transactions'`（**多行寫法**，≈ :14-18）       |
| WAL-03 |  🟡   | `POST /wallet/:registrationId/top-up`      | 現場增值       | **OP+ only**（收緊）              | `premium.routes.ts` 的 `router.post('/wallet/:registrationId/top-up'`（≈ :19）；handler `EventWalletController.topUp()`  |
| WAL-04 |  🟡   | `POST /wallet/:registrationId/deduct`      | （deprecated） | **OP+** + 白名單 + reasonCode     | `premium.routes.ts` 的 `router.post('/wallet/:registrationId/deduct'`（≈ :20）；handler `EventWalletController.deduct()` |
| WAL-05 |  🔴   | `POST /wallet/:registrationId/redeem`      | 核銷消費       | OP+                               | 新增                                                                                                                     |
| WAL-06 |  🔴   | `POST /wallet/:registrationId/adjust`      | 管理調整       | OWNER/SA（maker）                 | 新增                                                                                                                     |
| WAL-07 |  🔴   | `GET /wallet/adjustments`                  | 審批佇列       | OWNER/SA/CO                       | 新增                                                                                                                     |
| WAL-08 |  🔴   | `POST /wallet/adjustments/:id/approve`     | 覆核通過       | OWNER/SA（checker ≠ requester）   | 新增                                                                                                                     |
| WAL-09 |  🔴   | `POST /wallet/adjustments/:id/reject`      | 覆核駁回       | 同上                              | 新增                                                                                                                     |
| WAL-10 |  🔴   | `GET /wallet/report/summary`               | 對帳報告       | OWNER/SA/CO                       | 新增                                                                                                                     |

> **設計依據全文**：`LinkCard_ExpressJS_Backend/docs/development-cycles/v11.3-event-token-system/04-design-plan.md`
> §4.3（端點 + 權限）、§4.4（冪等 + 正負號）、§5.2（畫面規格）。
> 🔴 端點的完整 schema 以該文件為**唯一權威**，本文件只摘錄**前端所需欄位**。
> 📌 **範圍邊界（本表只列「前端消費」端點）**：`POST /wallet/:registrationId/allocate-initial`（OP+，報名確認後配發初始 Token）與 `POST /internal/cron/events/token-expire`（EXPIRY 排程）**不在 Admin App 範圍**——前者由報名流程觸發、後者由 cron 觸發，**App 不呼叫、不顯示**（因此不列入 WAL-xx，也不列在 C-11/C-12 的交付判定中）。

#### WAL-01 🟢+🔴 — 查餘額

```jsonc
// GET /api/v1/events/:eventId/wallet/:registrationId/balance
// 200:
{
  "success": true,
  "data": {
    "registrationId": "uuid",
    "balance": 14,
    "frozen": false, // 🔴 v11.3 新增（由 endDate + 24h 即時推算，非 DB 欄位）
    "updatedAt": "...",
  },
}

// 錯誤：404 REGISTRATION_NOT_FOUND ｜ 403 INSUFFICIENT_PERMISSION
```

> 🔴 **前端必注意**：`frozen` 是 v11.3 **新增欄位**。在它上線前，前端**不要**自行用 `event.endDate` 推算（會與後端不一致，且時區處理易錯）。

#### WAL-02 🟢+🔴 — 查流水

```jsonc
// GET /api/v1/events/:eventId/wallet/:registrationId/transactions?page=1&limit=20
// 200:
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "DEDUCTION", // 6 值：INITIAL_ALLOCATION|TOP_UP|DEDUCTION|EXPIRY|ADMIN_ADJUSTMENT|REVERSAL
        "amount": -1, // ⚠️ DEDUCTION 負、REVERSAL 恆正（§4.4 唯一記法）
        "balanceAfter": 9,
        "description": "...",
        "sourceType": "coffee_pass", // 🟢 既有
        "sourceId": "booth-a1", // 🔴 新增輸出
        "reasonCode": "counter_sale", // 🔴 新增輸出
        "approvedBy": "userId", // 🟢 DB 有、🔴 新增輸出
        "createdAt": "...",
      },
    ],
    "pagination": { "total": 57, "page": 1, "limit": 20, "totalPages": 3 }, // ⚠️ 待確認（見 §6 C-1）
  },
}
```

> ⚠️ **未驗證（U-2）**：`getTransactionHistory` 回的 pagination 欄位名**尚未實測**。前端開發時請先打一次實際 API 確認，並回報用戶以更新本文件。

#### WAL-03 🟡 — 現場增值

```jsonc
// POST /api/v1/events/:eventId/wallet/:registrationId/top-up
// Header: Idempotency-Key: 01JXXXXXXXXXXXXXXXXXXXXXXX
// Request:
{ "amount": 50, "paymentMethod": "CASH", "referenceCode": "R-0012", "note": "攤位購買" }

// 201:
{ "success": true, "data": { "balance": 64, "transactionId": "uuid", "type": "TOP_UP" } }

// 錯誤：403 INSUFFICIENT_PERMISSION（自助已被移除，v11.3 DEF-01）
//      400 INVALID_AMOUNT / TOPUP_LIMIT_EXCEEDED
//      409 IDEMPOTENCY_CONFLICT
//      409 EVENT_TOKEN_FROZEN
```

> 🟡 **契約變更警告**：`top-up` 的權限**收緊**（移除 `PART` 自助）。
> 現況 `assertRegistrationOwnershipOrOperator`（`registrationAccess.ts:18-35`）允許 registration owner 自己增值 = **v11.3 DEF-01 Critical（自由發幣）**。
> **前端務必不要提供任何「自己給自己加 Token」的入口。**

#### WAL-05 🔴 — 核銷

```jsonc
// POST /api/v1/events/:eventId/wallet/:registrationId/redeem
// Header: Idempotency-Key: <ULID>
// Request: { "sourceType": "coffee_pass", "sourceId": "booth-a1", "amount": 1 }
// 201: { "data": { "balance": 9, "transactionId": "uuid", "type": "DEDUCTION" } }
// 錯誤：400 INSUFFICIENT_TOKEN_BALANCE / INVALID_AMOUNT / SOURCE_TYPE_NOT_ALLOWED
//      404 SOURCE_NOT_FOUND｜409 EVENT_TOKEN_FROZEN｜409 IDEMPOTENCY_CONFLICT
// **sourceType 白名單**：counter_topup, xoxo_machine, coffee_pass, workshop,
//                          matching_session, admin_adjustment, reversal
//                          （booth_tap 預設停用 — SVF-2）
```

#### WAL-06 🔴 — 管理調整

```jsonc
// POST /api/v1/events/:eventId/wallet/:registrationId/adjust
// Request: { "direction": "CREDIT", "amount": 5, "reasonCode": "GOODWILL", "note": "咖啡機故障補償" }
// 201（直通）: { "data": { "status": "APPLIED", "transactionId": "uuid", "balance": 14 } }
// 202（待批）: { "data": { "status": "PENDING", "adjustmentId": "uuid" } }
// 錯誤：403 MAKER_CHECKER_SAME_USER｜400 REASON_CODE_REQUIRED
//      409 EVENT_TOKEN_FROZEN｜409 IDEMPOTENCY_CONFLICT
```

> 🔴 **前端必注意**：**HTTP 202 不是失敗**。`202` = 已送出待審批，UI 必須顯示「已送出，待主管覆核」而非錯誤畫面。

#### WAL-07/08/09 🔴 — 審批佇列

```jsonc
// GET /api/v1/events/:eventId/wallet/adjustments?status=PENDING
// 200: { "data": { "adjustments": [{ "id","registrationId","direction","amount",
//        "reasonCode","note","status","requestedBy","createdAt" }] } }
// POST /api/v1/events/:eventId/wallet/adjustments/:adjustmentId/approve
// POST /api/v1/events/:eventId/wallet/adjustments/:adjustmentId/reject
// Request: { "reviewNote": "..." }   // 選用
// 200: { "data": { "status": "APPROVED", "transactionId": "uuid", "balance": 19 } }
// 錯誤：404 ADJUSTMENT_NOT_FOUND｜409 ADJUSTMENT_ALREADY_REVIEWED
//      403 MAKER_CHECKER_SAME_USER / INSUFFICIENT_PERMISSION
```

#### WAL-10 🔴 — 對帳報告

```jsonc
// GET /api/v1/events/:eventId/wallet/report/summary
// 200: { "data": {
//   "eventId","float","paidFloat","accounts","driftCount","orphanCount","generatedAt",
//   "byType": { "INITIAL_ALLOCATION","TOP_UP","DEDUCTION","ADMIN_ADJUSTMENT","EXPIRY","REVERSAL" }
// }}
```

---

### 2.E NFC / Badge

| #      | Mark | Method & Path                       | 用途                      | Auth                                 | 證據                                                                                                                        |
| ------ | :--: | ----------------------------------- | ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| NFC-01 |  🟢  | `GET /nfc/lookup?uid=&qr=`          | 查 badge                  | **public**                           | `eventOpsRouter.get('/nfc/lookup'`（`event-ops.routes.ts:60`）                                                              |
| NFC-02 |  🟢  | `POST /nfc/bind`                    | 綁定 badge ↔ registration | JWT（operator+）                     | `eventOpsRouter.post('/nfc/bind'`（`event-ops.routes.ts:61`）                                                               |
| NFC-03 |  🟢  | `GET /nfc/badges`                   | badge 列表                | `checkAccess('write')` = owner/SA/CO | `eventOpsRouter.get('/nfc/badges'`（`event-ops.routes.ts:66`）；`EventNfcBatchController.listBadges()`                      |
| NFC-04 |  🟢  | `GET /nfc/badges/export`            | CSV 匯出                  | 同上                                 | `eventOpsRouter.get('/nfc/badges/export'`（`event-ops.routes.ts:67`）                                                       |
| NFC-05 |  🟢  | `POST /nfc/batch`                   | 建立批次                  | 同上                                 | `eventOpsRouter.post('/nfc/batch'`（`event-ops.routes.ts:68`）                                                              |
| NFC-06 |  🟢  | `POST /nfc/batch/:batchId/complete` | 完成批次                  | `checkAccess('operator')` = +OP      | `eventOpsRouter.post('/nfc/batch/:batchId/complete'`（`event-ops.routes.ts:69`）；`EventNfcBatchController.completeBatch()` |
| NFC-07 |  🟢  | `POST /nfc/batch/claim`             | 指派 badge 予展商         | write                                | `eventOpsRouter.post('/nfc/batch/claim'`（`event-ops.routes.ts:70`）                                                        |
| NFC-08 | 🔴📌 | `GET /nfc/badges?registrationId=`   | 查某用戶的 badge          | write                                | 新增參數                                                                                                                    |

> 📌 **重要**：NFC-01..07 **實作已完成**（`EventNfcBatchController` 的 `listBadges()` / `createBatch()` / `completeBatch()` / `claimBadge()`，程式碼審查 96/100），但 **`docs/api/**` 內零文件覆蓋**（實測 grep 0 命中）。本節為首次書面化。

#### NFC-03 🟢 — badge 列表（**注意參數名與 REG-01 不同**）

| 項           | 內容                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Query**    | `page`（預設 1）、`pageSize`（預設 20，上限 200）、`status`、`batchId`、`boundOnly`、`all`                                                                            |
| **Response** | `{ badges: [...], pagination: { total, page, pageSize } }`                                                                                                            |
| **⚠️ 關鍵**  | **參數名是 `pageSize`，不是 `limit`**；且回應**無** `totalPages`（`EventNfcBatchService.listBadges()` 回傳，`EventNfcBatchService.ts:146`；`all=true` 分支為 `:130`） |

> 🔴 **紅字警告**：同一個後端，`/registrations` 用 `limit` 且回 `totalPages`，`/nfc/badges` 用 `pageSize` 且不回 `totalPages`。
> **前端必須為兩者寫不同的型別**（或用 §6 C-1 的統一方案）。**這是本契約最容易寫錯的地方。**

#### NFC-08 🔴 — 依 registrationId 查 badge（草案）

```jsonc
// GET /api/v1/events/:eventId/nfc/badges?registrationId=<uuid>
// 200: { "data": { "badges": [ /* BadgeInfo */ ], "pagination": {...} } }
```

> **為什麼需要**：F-05 用戶詳情頁要顯示「綁定 NFC 編號」。現有 `nfc/lookup` 需要 `uid` 或 `qr`（我們不知道），`nfc/badges` 無 `registrationId` 篩選 → **目前拼不出來**。
> ⚠️ 替代：DB 有 `EventNfcBadge.registrationId @unique`（`schema.prisma`），後端加這個 filter 成本極低（📌 ≤ 0.25 人日）→ 裁決 **C-9**。

---

### 2.F Credential（🔴 全部待建，純後端主導）

| #      | Mark | Method & Path              | 用途                                             |
| ------ | :--: | -------------------------- | ------------------------------------------------ |
| CRD-01 |  🔴  | `GET /credentials?userId=` | 用戶的憑證列表（社團會員 / 活動票務 / 電子名片） |

> ⚠️ **未驗證**：F-06 目前只有會議層級的「統一抽象為 Credential 模型」意向（會議 §六 決策 #2）。
> **後端無 `EventCredential` model**（實測 `schema.prisma` grep 0 命中）。
> **本項需用戶先完成後端設計，前端才有契約可依** → 前端在批次 3 只做「可選區塊」，**無契約時不開發**。
> 🔴 **後端施工項 = B-8**（Credential 統一模型，2.0 BE 人日，見後端待辦 §2.8）；裁決 **C-13**（是否本批交付）。
> 會議 §六 決策 #2 與原文 §九 待辦 #2 皆標 **P0**，並註明「**先做架構否則後面重工**」。

---

### 2.G 未驗證項（需用戶確認）

|    #    | 項目                                         | 為何未驗證                                                                                                                                                               | 影響                   |
| :-----: | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
|   U-1   | **「所屬社團/協會」查詢 API**                | 會議 §D 要求用戶詳情顯示所屬社團；未找到對應端點（LinkCard 有 association 模組，但是否可按 userId 反查未確認）                                                           | F-05 區塊可能做不出    |
|   U-2   | `getTransactionHistory` 的 pagination 欄位名 | 未實測該函式回傳                                                                                                                                                         | 前端型別可能錯         |
|   U-3   | `wallet/report/summary` 是否 P0 交付         | 設計有列，實作進度未知                                                                                                                                                   | 批次 2 是否含報表      |
|   U-4   | 現場「收款方式」是否含 `MPAY`                | 會議 §五 說 11 月只做記帳，但 UI 要預留「已收款」勾選                                                                                                                    | W-22 欄位設計          |
| **U-5** | `by-code` 路由是否已解析 `req.user`          | 路由 `router.get('/by-code/:code'`（`registrations.routes.ts:67-71`）**未掛 auth 中間件**，僅掛限流（**連 `optionalAuthMiddleware` 都沒有**）→ `req.user` 可能 undefined | **B-5.1 的前置驗證項** |

---

## 3. 權限矩陣（會議 §F 4 角色 × 後端 5 值）

### 3.1 角色對照

| 會議角色     | 後端 `EventOrgRoleType`                   | 說明                   |
| ------------ | ----------------------------------------- | ---------------------- |
| 閘口 staff   | `OPERATOR`（或 `VOLUNTEER`）              | 只簽到                 |
| 攤位 staff   | `OPERATOR`（+ 展商 scope，**P1 未實作**） | 簽到 + Token 增扣      |
| 主管 / 督導  | `COORDINATOR`                             | 全場操作 + 覆核        |
| 主辦方 Admin | `SUPER_ADMIN` / event owner               | 全部（改規則只在 Web） |
| （未使用）   | `VOLUNTEER`                               | 🔴 **無任何授權引用**  |
| （未使用）   | `MEDIA`                                   | 會議未提               |

後端 enum 實證：`EventOrgRoleType`（`schema.prisma:1245-1251`，**5 值**：`SUPER_ADMIN` / `COORDINATOR` / `OPERATOR` / `VOLUNTEER` / `MEDIA`）。**event owner 不在 enum 內**，由 `Event.ownerId`（`schema.prisma:551`）判定（`EventService.getEventWriteAccess()` 只 select `ownerId` 並比對 `event.ownerId === userId`，同時接受 owner 與 SA/CO）。`Event.ownerAssociationId`（`:553`）為關聯歸屬欄位，**不參與** write-access 判定。

### 3.2 操作 × 角色（**live 實測**）

| 操作                          |         owner          | SUPER_ADMIN | COORDINATOR |  OPERATOR  | VOLUNTEER |   PART（本人）    | 證據                                                                 |
| ----------------------------- | :--------------------: | :---------: | :---------: | :--------: | :-------: | :---------------: | -------------------------------------------------------------------- |
| 登入 / 看我的活動             |           ✅           |     ✅      |     ✅      |     ✅     |    ✅     |        ✅         | `EventService.getMyManagedEvents()`                                  |
| 掃碼查詢（by-code）           |           ✅           |     ✅      |     ✅      |     ✅     |    ✅     |        ✅         | 路由 `router.get('/by-code/:code'`（**public**，無 auth 中間件）     |
| **執行簽到**                  |           ✅           |     ✅      |     ✅      |     ✅     |    ❌     |    ✅（本人）     | `EventService.getEventOperatorAccess()`（含 OP）                     |
| **看重名單**                  |           ✅           |     ✅      |     ✅      | 🔴 **❌**  |    ❌     |        ❌         | `EventService.getEventWriteAccess()`（**不含 OP**）                  |
| 名單篩選（status/ticketType） |           ✅           |     ✅      |     ✅      |   🔴 ❌    |    ❌     |        ❌         | 同上                                                                 |
| 建立/看 badge 批次            |           ✅           |     ✅      |     ✅      |   🔴 ❌    |    ❌     |        ❌         | `EventNfcBatchController.checkAccess(..., 'write')`                  |
| 完成 badge 批次               |           ✅           |     ✅      |     ✅      |     ✅     |    ❌     |        ❌         | `EventNfcBatchController.checkAccess(..., 'operator')`               |
| NFC 綁定                      |           ✅           |     ✅      |     ✅      |     ✅     |    ❌     |        ❌         | `assertRegistrationOwnershipOrOperator()`（`registrationAccess.ts`） |
| 查 Token 餘額                 |           ✅           |     ✅      |     ✅      | ✅（⚠D12） |    ❌     |    ✅（本人）     | 同上（`registrationAccess.ts`）                                      |
| 查 Token 流水                 |           ✅           |     ✅      |     ✅      | ✅（⚠D12） |    ❌     |    ✅（本人）     | 同上                                                                 |
| **Token 增值**                |           ✅           |     ✅      |     ✅      |     ✅     |    ❌     | 🔴 **✅（漏洞）** | `EventWalletController.topUp()`（`EventWalletController.ts:51`）     |
| Token 扣減                    |           ✅           |     ✅      |     ✅      |     ✅     |    ❌     | 🔴 **✅（漏洞）** | `EventWalletController.deduct()`（`EventWalletController.ts:94`）    |
| Token 核銷（redeem）          |        🔴 待建         |     🔴      |     🔴      |     🔴     |    ❌     |        ❌         | v11.3 §4.3                                                           |
| Token 調整（提出）            | 🔴 待建（僅 OWNER/SA） |     🔴      |     ❌      |     ❌     |    ❌     |        ❌         | v11.3 §4.3                                                           |
| 審批 / 駁回                   |  🔴 待建（OWNER/SA）   |     🔴      |     ❌      |     ❌     |    ❌     |        ❌         | v11.3 §4.3                                                           |
| 對帳報告                      | 🔴 待建（owner/SA/CO） |     🔴      |     🔴      |     ❌     |    ❌     |        ❌         | v11.3 §4.3                                                           |

### 3.3 🔴 兩個必須修的角色缺口

|    #    | 缺口                                               | 現場後果                                                      | 修正                                                                                                                                                           |
| :-----: | -------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-1** | `GET /registrations` 不含 OPERATOR                 | 閘口 staff 首頁看到「名單」卡 → 點進去 403。**W6 彩排才會爆** | 新增 `getEventReadAccess`（owner/SA/CO/OP）用於**讀取**類端點，寫入仍用 `getEventWriteAccess`。**或** PM 決定 App 端由 COORDINATOR+ 操作名單（則前端隱藏卡片） |
| **G-2** | `COORDINATOR` 不能提 `adjust`（v11.3 限 OWNER/SA） | 主管現場遇爭議無法提補償，要等主辦方                          | **PM 決策**：① 維持（主管走紙本 SOP）；② 開放 COORDINATOR 為 maker（仍 maker≠checker）                                                                         |

> 📌 **規劃建議**：G-1 建議採「新增 read access」——因為會議 §F 明確要「攤位 staff 看自己攤位報表」，需要名單讀取。成本約 **0.25 人日**（新增一個 guard 函式 + 3 處呼叫端替換）。

---

## 4. 錯誤碼總表（Admin App 會遇到的）

> 命名風格依 `docs/api/v11.0-event-module/08-error-codes.md`；➕ = v11.3 新增。

| 錯誤碼                                    | HTTP | 觸發情境                    | **前端文案建議（zh-Hant）**        | 來源                                                                      |
| ----------------------------------------- | :--: | --------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `INVALID_AMOUNT`                          | 400  | 非正整數 / ≤ 0              | 「金額需為大於 0 的整數」          | v11.3 §4.3                                                                |
| `INSUFFICIENT_TOKEN_BALANCE`              | 400  | 餘額不足                    | 「餘額不足，尚差 N 點」            | `EventWalletController.deduct()`（`:126-131`）                            |
| `REGISTRATION_NOT_FOUND`                  | 404  | 報名不存在 / 跨活動         | 「找不到此報名紀錄」               | 既有                                                                      |
| `INSUFFICIENT_PERMISSION`                 | 403  | guard 拒絕                  | 「你的角色無此操作權限」           | 既有                                                                      |
| ➕ `EVENT_TOKEN_FROZEN`                   | 409  | T1（endDate+24h）後嘗試消費 | 「活動已結算，停止代幣消費」       | v11.3 §4.3                                                                |
| ➕ `REASON_CODE_REQUIRED`                 | 400  | adjust / deduct 缺理由碼    | 「請選擇調整理由」                 | v11.3 §4.3                                                                |
| ➕ `SOURCE_NOT_FOUND`                     | 404  | sourceId 不存在或不屬本活動 | 「找不到此兌換項目」               | v11.3 §4.3                                                                |
| ➕ `SOURCE_TYPE_NOT_ALLOWED`              | 400  | sourceType 不在白名單       | 「此兌換類型未開放」               | v11.3 §4.3                                                                |
| ➕ `ADJUSTMENT_NOT_FOUND`                 | 404  | 審批單不存在                | 「找不到此審批單」                 | v11.3 §4.3                                                                |
| ➕ `ADJUSTMENT_ALREADY_REVIEWED`          | 409  | 狀態非 PENDING（含併發）    | 「此審批單已被處理，請重新整理」   | v11.3 §4.3                                                                |
| ➕ `TOPUP_LIMIT_EXCEEDED`                 | 400  | 超單筆/每日上限             | 「已達增值上限，請聯絡主管」       | v11.3 §4.3（門檻待 D14）                                                  |
| ➕ `MAKER_CHECKER_SAME_USER`              | 403  | 提出人 = 覆核人             | 「不可覆核自己提出的調整」         | v11.3 §4.3                                                                |
| ➕ `IDEMPOTENCY_CONFLICT`                 | 409  | 同 key 但 payload 不同      | 「此操作已送出，請重新整理後確認」 | v11.3 §4.3                                                                |
| `ALREADY_CHECKED_IN`                      | 400  | 重複簽到                    | 「此報名已完成入場」＋顯示首次時間 | `EventRegistrationService.checkIn()`（`:1044`）                           |
| `REGISTRATION_NOT_CONFIRMED`              | 400  | 未確認報名                  | 「此報名尚未確認」                 | `EventRegistrationService.checkIn()`（`REGISTRATION_NOT_CONFIRMED` 分支） |
| `REGISTRATION_LOOKUP_RATE_LIMITED`        | 429  | by-code 限流                | 「查詢過於頻繁，請 3 秒後重試」    | `registrationCodeLookupRateLimiter`（`registrations.routes.ts:12-26`）    |
| 🔴 `INVALID_SORT_FIELD` 📌                | 400  | sortBy 非法                 | （不應出現；前端鎖選項）           | 草案                                                                      |
| 🔴 `INVALID_SEARCH_QUERY` 📌              | 400  | search 過長                 | （不應出現）                       | 草案                                                                      |
| 🔴 `CHECKIN_NOT_IN_CONFLICT` 📌           | 409  | override 但原本無衝突       | 「此人尚未簽到，請走一般簽到」     | 草案                                                                      |
| `EVENT_NOT_FOUND`                         | 404  | 活動不存在                  | 「活動不存在或已刪除」             | 既有                                                                      |
| `REGISTRATION_FIELD_IMAGE_TOO_LARGE`      | 400  | 圖片 > 5MB                  | 「附件不能超過 5MB」               | 既有                                                                      |
| `BANK_TRANSFER_PROOF_SUBMIT_RATE_LIMITED` | 429  | 憑證提交限流                | 「提交過於頻繁」                   | `bankTransferProofSubmitRateLimiter`（`event-ops.routes.ts:18-32`）       |

### 4.1 前端錯誤處理守則

| 守則                           | 說明                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| 讀 `error.code` 不讀 `message` | `message` 是後端中文，會隨意變動；`code` 才是契約             |
| 未知 code 的 fallback          | 「操作失敗，請重試或聯絡技術支援」+ 顯示 code（方便現場回報） |
| 429 一律自動退避重試           | 指數退避（1s → 2s → 4s），最多 3 次                           |
| 409 冪等衝突**不要**自動重試   | 改用同 key 重送或提示用戶確認                                 |
| **202 不是錯誤**               | `adjust` 的待審批狀態                                         |

---

## 5. 🔴 紅字警告區（最容易寫錯的三件事）

### 5.1 警告 R-1：Pagination 有五種形狀

|  #  | 來源                                                                  | 形狀                                                         | 證據                                                                                                                |
| :-: | --------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
|  1  | `GET /registrations`                                                  | `{ total, page, limit, totalPages }`                         | `EventRegistrationService.listRegistrations()` 回傳（≈ :1333）                                                      |
|  2  | `GET /my-managed`                                                     | `{ page, limit, total, totalPages }`                         | `EventService.getMyManagedEvents()` 回傳                                                                            |
|  3  | `GET /nfc/badges`                                                     | `{ total, page, pageSize }`（**query 參數亦為 `pageSize`**） | `EventNfcBatchService.listBadges()` 回傳（≈ :146）                                                                  |
|  4  | **文件** `docs/api/v11.0-event-module/03-registration-payment-api.md` | `{ total, page, limit, pages }`                              | ❌ 與實作不符（pagination 範例段，≈ :140）                                                                          |
|  5  | **Admin App 型別**                                                    | `{ total, page, pageSize, pages? }`                          | ❌ 與兩者皆不符（`event.service.ts` 的 registrations pagination 型別 / `nfc.service.ts` 的 badges pagination 型別） |

**規則（v1.0 有效）**：

- 以**實作為準**：`/registrations` 與 `/my-managed` 用 `totalPages`；`/nfc/badges` 用 `pageSize` 且**無** `totalPages`（分頁要自己算 `Math.ceil(total / pageSize)`）。
- Admin App **必須**使用兩個獨立型別：`OffsetPagination`（limit/totalPages）與 `BadgePagination`（pageSize）。
- 🟡 **待裁決 C-1**：長期方案（統一 / 或至少改文件對齊實作）。

### 5.2 警告 R-2：`Registration` 型別不符

| 位置                              | 形狀                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 後端 `by-code` / `checkin` / list | **flat**：`firstName`、`lastName`、`company`、`jobTitle`、`phone`、`email`、`registrantType`、`tokenBalance`、`checkedInAt`、`formData`、`ticketType{...}` |
| Admin App 型別                    | `profile: { fullName, email, phone, company, jobTitle }` + `customFields`                                                                                  |

**證據**：`EventRegistrationService.getRegistrationByCode()` 的 select（flat）vs `api.types.ts` 的 `Registration` 型別（`profile`）。

**現況風險**：`check-in.tsx` 目前能運作，因為它**可能沒實際讀 `profile.*`**。**一旦 W-03/W-05 開始讀姓名，就會拿到 `undefined`。**

**🟡 待裁決 C-2**，兩個選項：

- **(a) 前端改**（建議）：`Registration` 改為 flat 欄位，`profile` 保留為選用衍生物件。成本 ≈ 0.25 人日。
- **(b) 後端改**：`by-code`/`checkin` 回傳加 `profile` 物件。成本 ≈ 0.5 人日 + 影響 Frontend（Next.js）如果有共用型別。

> 📌 **規劃建議 (a)**：因為**後端還有多處（list/export）用 flat**，改後端要同時動 3+ 端點；改前端只動 1 個檔案。

### 5.3 警告 R-3：限流

| 端點                               | 限流                                | 現場風險                                                                                          |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /registrations/by-code/:code` | **20 次 / 5 分鐘 / IP**             | 🔴 **Critical**：展館 WiFi NAT → 全場共用 IP → 開場尖峰即爆；且這是**簽到第一步**，一爆整條流程死 |
| `POST /bank-transfers/submit`      | 10 次 / 15 分鐘 / IP                | 低（App 不用）                                                                                    |
| `POST /registrations/files/image`  | 10 次 / 15 分鐘 / IP                | 低（App 不用）                                                                                    |
| wallet mutation                    | **無限流**（v11.3 DEF-12，P1 才加） | 中（現場手滑/腳本濫用）                                                                           |

**修正建議**：by-code 改為「**已認證請求以 `userId` 計 key，未認證才用 IP**」，並把上限提高到例如 **120 / 5min / operator**。
理由：現場一位工作人員 5 分鐘掃 100+ 人是正常量。

---

## 6. 待裁決清單（開工前必須拍板）

|    ID    | 裁決點                                                       | 選項                                                                                                                                                                                       | 建議                                                                                                                                                                                       |      阻塞      |
| :------: | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------: |
| **C-1**  | Pagination 長期方案                                          | (a) 維持現狀 + **改正文件** + App 用兩個型別<br/>(b) 後端統一為 `{total,page,limit,totalPages}`（含 `/nfc/badges` 改參數名 → **breaking**）<br/>(c) 文件與 App 都對齊實作，另立 v11.x 統一 | **(a)** — 變更成本最低；`/nfc/badges` 改參數名會破壞已上線的 Promoter/Frontend 呼叫。**但文件必須改**（`docs/api/v11.0-event-module/03-registration-payment-api.md` 的 pagination 範例段） |    🚫 W-01     |
| **C-2**  | `Registration` 型別                                          | (a) 前端改 flat<br/>(b) 後端加 `profile`                                                                                                                                                   | **(a)**                                                                                                                                                                                    |    🚫 W-01     |
| **C-3**  | by-code 限流                                                 | (a) 改 userId 計 key + 提高上限<br/>(b) 維持 IP 但放寬<br/>(c) 不改                                                                                                                        | **(a)**                                                                                                                                                                                    |  🚫 W-21/W-26  |
| **C-4**  | OPERATOR 名單讀取權（G-1）                                   | (a) 新增 `getEventReadAccess` 含 OP<br/>(b) 維持，前端隱藏名單卡給 OP                                                                                                                      | **(a)** — 會議 §F 要「攤位 staff 看自己攤位」                                                                                                                                              | 🚫 W-03 / W-30 |
| **C-5**  | COORDINATOR 可否提 adjust（G-2）                             | (a) 維持 OWNER/SA<br/>(b) 開放 COORDINATOR 為 maker                                                                                                                                        | **(a)**（嚴守 maker-checker 分離；主管走紙本 SOP）                                                                                                                                         |    ⚠️ W-22     |
| **C-6**  | override 端點形式                                            | (a) 新端點 `checkin/override`<br/>(b) `checkin` 加 body 參數                                                                                                                               | **(a)** — 權限可分離                                                                                                                                                                       |    🚫 W-27     |
| **C-7**  | 簽到計數語意                                                 | (a) 新端點單日/單場<br/>(b) 降級為總數（用現有 query）                                                                                                                                     | **(a)**，但 (b) 可作 fallback                                                                                                                                                              |    ⚠️ W-29     |
| **C-8**  | 「所屬社團」API                                              | (a) 有既有端點（請提供）<br/>(b) 不做（顯示「—」）                                                                                                                                         | **(b)** 起步                                                                                                                                                                               |    ⚠️ W-05     |
| **C-9**  | NFC-08（依 registrationId 查 badge）                         | (a) 加 query 參數<br/>(b) 不做，詳情頁不顯示 NFC                                                                                                                                           | **(a)** — 成本 ≤ 0.25 人日，DB 已有 `registrationId @unique`                                                                                                                               |    ⚠️ W-05     |
| **C-10** | 音效套件                                                     | (a) `expo-audio`（SDK 57 官方音訊庫）<br/>(b) **無音效**，只用 RN 內建 `Vibration`                                                                                                         | **(a)**。❌ `expo-av` **已自候選移除**：Expo 已標記 `isDeprecated: true` 且**將於 SDK 55 移除**，本專案為 `expo ~57.0.13` → **該套件不存在，不可用**                                       |    ⚠️ W-28     |
| **C-11** | REG-02（名單 `search`/`sortBy`/`sortOrder`）**是否本批交付** | (a) **本批交付**：後端新增此三參數（施工項 **B-6**，0.75 BE 人日）<br/>(b) 本批不做：**W-04 走降級**（僅分頁+篩選，搜尋靠前端對當頁過濾）                                                  | **(a)** — 會議 §二 模組 D 將「搜尋、篩選、排序」列為名單頁必要功能；降級版在數千筆規模下不可用                                                                                             |  🚫 **W-04**   |
| **C-12** | CHK-04（簽到計數端點）**交付或降級**                         | (a) **本批交付新端點**（施工項 **B-7**，0.75 BE 人日）<br/>(b) 降級：用既有 `status=CHECKED_IN` 讀 `pagination.total`（UI 標「**總簽到**」而非「今日」）                                   | **(a)**，(b) 作 fallback（同 **C-7**：C-7 管「語意」，C-12 管「是否本批交付」）                                                                                                            |  ⚠️ **W-29**   |
| **C-13** | **Credential 統一模型（CRD-01）是否本批交付**                | (a) **本批交付**：後端新增 `EventCredential` 模型 + `GET /credentials?userId=`（施工項 **B-8**，2.0 BE 人日）<br/>(b) 本批不做：**W-31 延至活動後**（前端詳情頁不顯示 Credential 區塊）    | **(a)** — 會議 §六 決策 #2 與原文 §九 待辦 #2 **皆標 P0**，並註明「**先做架構否則後面重工**」；且 W-31 已計入批次 3 的 3.0 人日                                                            |  🚫 **W-31**   |

### 6.1 2026-09-16 完成度審計新增裁決（C-14..C-18）

> 來源：`docs/research/10-app-completion-audit.md` + `docs/research/11-app-defect-register.md`

|    ID    | 裁決點                                                   | 選項                                                                                                                                                                                                                                        | 建議                                              |            阻塞             |          狀態          |
| :------: | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | :-------------------------: | :--------------------: |
| **C-14** | **A0 base URL 修法**                                     | ✅ **已由 2026-09-16 實測收斂為單一解**：`config.ts` 的 `API_BASE_URL` 預設改為 **origin-only**（移除尾端 `/api`）。子決策：① 是否加 fail-closed guard；② 是否建 `.env.example`；③ **production apex origin 是否為 `https://linkcard.xyz`** | 三項全做                                          |         🚫 **W-09**         | ⚠️ 子決策 ③ 待用戶確認 |
| **C-15** | **深色高對比模式是否納入 11 月**                         | (a) 納入：需 theme 雙層 + `app.json` 的 `userInterfaceStyle` 改 `automatic` → **架構級**（約 2–3 人日）<br/>(b) 不納入：會議 §四 的「深色高對比」要求未達標                                                                                 | **(b) 起步**，列 P1 評估                          | ⚠️ W-02 / W-26 / W-28 的 AC |       ⚠️ 待裁決        |
| **C-16** | **平板 / 折疊機適配優先序**                              | (a) 納入：需用 `layout.breakpointNarrow` + `useWindowDimensions`（token 已備但 0 使用）<br/>(b) 不納入（`app.json` 已 `supportsTablet: true` 但零響應式邏輯）                                                                               | **(b)** — 活動場地無平板需求證據                  |       ⚠️ 無（可延後）       |       ⚠️ 待裁決        |
| **C-17** | **`[eventId]/settings.tsx` 去留**                        | (a) **不建**：W-02 的「我的」卡指向 `(auth)/settings`（現有 40 行頁）<br/>(b) 建頁（P1）                                                                                                                                                    | **(a)** — 現有頁已足夠；避免 scope creep          |  ⚠️ W-02 的「我的」卡落點   |       ⚠️ 待裁決        |
| **C-18** | **批次 1 時程處置**（因 W-09..W-15 新增而超原 2 週承諾） | (a) **承認批次 1 為 2.5–2.7 週**<br/>(b) 把 buffer pool（W-13 + W-15 = 1.0 日）移出：批次 1 = 8.5 日 ≈ 2.4 週                                                                                                                               | **(a)** — 新增者含 1 個 High 修復（A1），不宜延後 |         ⚠️ 整體排期         |   🚨 **ESC-VPW-002**   |

---

## 7. 已知落差（Expectation Gaps）

| 會議要求                                                                                                 | 後端實況                                                                                                 | 處理                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 操作可撤銷（Undo 5 秒）                                                                                  | v11.3 **明確不做 undo**（無端點）                                                                        | 改為「二次確認 + 反向 adjust」。前端**不得**用本地刪除假裝 undo                                                                           |
| 簽到顯示「地點」                                                                                         | 無 gate/location 欄位（`EventRegistration` 只有 `checkedInAt` / `checkedInBy`，`schema.prisma:802-803`） | B-3 新增；未到位前只顯示時間                                                                                                              |
| Token 扣減需二次確認                                                                                     | 後端有條件式 UPDATE，無二次確認概念                                                                      | 前端實作（W-22）                                                                                                                          |
| 增值預設快捷金額（+10/+50/+100，由 Admin Web 配置）                                                      | **無此配置端點**                                                                                         | ⚠️ 前端硬編碼起步，並回報用戶是否要建 config API                                                                                          |
| 兌換品項清單（咖啡 −20、零食 −10）                                                                       | **無價目表 API**（v11.3 D8 未決）                                                                        | ⚠️ 前端先用 `sourceType` 寫死選單；價目表屬 P1                                                                                            |
| 離線暫存                                                                                                 | v11.3 **不做離線**（§5.4）                                                                               | 走紙本 SOP（v11.3 §5.3 #4）                                                                                                               |
| 多語言（繁/簡/英/葡）                                                                                    | 無 i18n 基建（文案集中 `copy.zh-TW.ts`）                                                                 | P1；批次 1–3 先繁中                                                                                                                       |
| QR 加簽名/一次性 token 防截圖冒用                                                                        | QR 內容為 `registrationCode`（靜態）                                                                     | ⚠️ **未處理**。若需防冒用須後端改造（屬新需求），建議列 P1 並由 PM 決定風險接受度                                                         |
| 澳門《個人資料保護法》（第 8/2005 號法律）— 報名個資收集需**明示同意**、Email 需含**退訂與資料用途聲明** | 同意與退訂機制在報名流程與 Email 模板（**Admin Web / Frontend**），Admin App **無同意收集入口**          | App 端只需守住「顯示遮罩 + 不落地儲存敏感個資」；同意/退訂聲明屬 Web 與 Email 範圍 → 列 P1，並由法務/PM 確認（風險分級見可行性複審 §6.1） |

---

## 8. 文檔維護責任

| 端點類別      | 誰維護                                                                   | 何時更新       |
| ------------- | ------------------------------------------------------------------------ | -------------- |
| 🟢 已存在穩定 | 前端發現不符即回報；用戶確認後改本文件並升版                             | 發現即改       |
| 🟡 待修正     | **用戶**在修正完成時更新（含實際 response 範例）；前端據此改型別         | 修正 PR 內     |
| 🔴 待新建     | **用戶**交付時更新（含實際 response 範例）；**未更新前前端不得開發該項** | 每個端點交付時 |
| 錯誤碼表      | 用戶新增錯誤碼時同步                                                     | 每個 PR        |
| 權限矩陣      | 用戶改 guard 時同步                                                      | 每個 PR        |

**升版規則**：任何凍結項變更 → 本文升 v1.1，並在文末「變更記錄」記 `日期 / 變更項 / 原因 / 影響的 W-ID`。

---

## 9. 變更記錄

| 版本    | 日期       | 變更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 原因                                                                              |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| v1.0    | 2026-09-15 | 初版凍結候選                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Neo Loop（admin-app-handoff）PLAN stage 交付                                      |
| v1.0-r1 | 2026-09-15 | ① 標記約定補 `🟢+🔴`（additive）；② C-10 移除 `expo-av` 候選（SDK 57 已無此套件）；③ 新增裁決 **C-11**（REG-02 是否本批交付）、**C-12**（CHK-04 交付或降級）；④ §2.D 補「只列前端消費端點」範圍聲明（排除 `allocate-initial` / `token-expire` cron）；⑤ §7 補澳門 PDPA 落差列；⑥ 全文件引用改以**函式名/路由字串**為主、行號為輔（路線行號已校正）                                                                                                                                                                                                                | REPAIR R1：獨立文件審查 DRA-002 / DRA-006 / DRA-008 / DRA-009 / DRA-013 / DRA-014 |
| v1.0-r2 | 2026-09-15 | ① **L1**：§標記約定兩列 emoji 損毀（`U+FFFD`）→ 重打為 `🟢+🔴` 與 `📌`；② **M1**：`walletRouter` 為虛構符號（實測 `grep -rn walletRouter src/` = 0）→ WAL-01..04 改為 `premium.routes.ts` 的**路由字串**引用（`router.get('/wallet/:registrationId/balance'` 等）；③ **M2**：`getMyManaged()` → **`getMyManagedEvents()`**（§1.1、A-3）；④ **L4**：`resolveEventId` 歸屬由 `EventRegistrationController` 改正為 **`EventService.resolveEventId()`**（`EventService.ts:330`）；⑤ **M6**：§6 新增裁決 **C-13**（Credential 統一模型是否本批交付，對應後端 **B-8**） | REPAIR R2：獨立文件審查 M1 / M2 / M6 / L1 / L4                                    |
| v1.0-r3 | 2026-09-15 | ① **N1**：§1.1 與 A-2 證據欄的 `getMe()` 為虛構符號（實測 `grep -rn "getMe()" docs/` = 0）→ 改正為 **`me()`**（`auth.service.ts:21`）；② **N5**：§3.1 的 `Event.orgId` 不存在 → 改正為 **`Event.ownerId`**（`schema.prisma:551`），並註明 `ownerAssociationId`（`:553`）為關聯歸屬欄位、**不參與** write-access 判定（`getEventWriteAccess()` 只 select `ownerId`）                                                                                                                                                                                               | DELTA 複驗：獨立文件審查 N1 / N5 / D2                                             |
| v1.0-r4 | 2026-09-16 | ① §6.1 新增裁決 **C-14**（A0 base URL 修法，已收斂單一解）、**C-15**（深色高對比）、**C-16**（平板適配）、**C-17**（`[eventId]/settings.tsx` 去留）、**C-18**（批次 1 時程處置）；由完成度審計（`research/10`）與缺陷冊（`research/11`）引入                                                                                                                                                                                                                                                                                                                      | 交叉引用新增（無凍結項變更）                                                      |

---

**END OF FILE**
