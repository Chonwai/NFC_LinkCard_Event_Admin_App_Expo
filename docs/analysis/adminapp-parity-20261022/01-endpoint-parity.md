# 01 — 端點級三方比對（Endpoint Parity）

這一層是**唯一可以機械判定對錯**的層。結論先講：

> App 呼叫 13 條事件端點，**其中 1 條後端根本不存在**（`registrations/checkin/override`）。
> 其餘 12 條路徑與方法全部正確。

## 1.1 App 的完整呼叫清單（13 條事件端點 + 2 條 auth）

| #   | Method | Path                                                   | 後端存在？            | 前端同功能對應           | 判定                                           |
| --- | ------ | ------------------------------------------------------ | --------------------- | ------------------------ | ---------------------------------------------- |
| 1   | GET    | `/events/my-managed`                                   | ✅ `events.routes.ts` | `getMyManagedEvents`     | 一致                                           |
| 2   | GET    | `/events/by-id/:eventId`                               | ✅ `events.routes.ts` | `getEventById`           | 一致                                           |
| 3   | GET    | `/events/:eventId/registrations`                       | ✅                    | `listRegistrations`      | 路徑一致／參數不全（見 03）                    |
| 4   | POST   | `/events/:eventId/registrations`                       | ✅                    | `createRegistration`     | 路徑一致／回應型別過窄（見 03）                |
| 5   | GET    | `/events/:eventId/registrations/by-code/:code`         | ✅                    | `getRegistrationByCode`  | 一致                                           |
| 6   | POST   | `/events/:eventId/registrations/checkin`               | ✅                    | `checkIn`                | 一致                                           |
| 7   | POST   | `/events/:eventId/registrations/checkin/override`      | ❌ **不存在**         | **前端沒有這個呼叫**     | **契約漂移 P0**                                |
| 8   | GET    | `/events/:eventId/ticket-types`                        | ✅（`optionalAuth`）  | `listAdminTicketTypes`   | 一致（App 帶 JWT ⇒ admin 分支）                |
| 9   | GET    | `/events/:eventId/nfc/lookup`                          | ✅（公開＋限流）      | `lookupNfcBadge`         | App 是超集（多支援 `qr`，後端確實支援）        |
| 10  | GET    | `/events/:eventId/nfc/badges`                          | ✅                    | `listNfcBadges`          | 缺 `boundOnly`（見 03）                        |
| 11  | POST   | `/events/:eventId/nfc/bind`                            | ✅                    | `bindNfcBadge`           | 一致                                           |
| 12  | POST   | `/events/:eventId/nfc/exchange`                        | ✅                    | `recordNfcExchange`      | 一致（欄名 `initiatorUid`/`receiverUid` 正確） |
| 13  | GET    | `/events/:eventId/wallet/:registrationId/transactions` | ✅                    | `listWalletTransactions` | **缺 pagination + 至少 3 個欄位**（見 03）     |
| —   | POST   | `/api/auth/login`                                      | ✅（非 `/v1`）        | `signin`                 | 一致                                           |
| —   | GET    | `/api/users/me`                                        | ✅                    | `me`                     | 一致                                           |

## 1.2 那條死路徑的完整證據

```
App 呼叫端   src/services/registration.service.ts:50
UI 呼叫端    src/app/(auth)/[eventId]/check-in.tsx:303-330（onRequestOverride）
後端 route   src/events/routes/registrations.routes.ts:105-172
             → 只有 `/checkin` 與 `/:registrationId/status`
```

`POST /api/v1/events/:eventId/registrations/:registrationId/status` 的語意**不能**替代它：

|                    | App 想要的「重複報到覆核」 | 後端 `/status` 能做的                                      |
| ------------------ | -------------------------- | ---------------------------------------------------------- |
| 定位               | 用 `registrationCode`      | 用 `registrationId`                                        |
| 已 `CHECKED_IN` 時 | 想「放行」                 | 回 `409 REGISTRATION_STATUS_UNCHANGED`                     |
| 權限               | OPERATOR                   | `getEventWriteAccess`（owner / SUPER_ADMIN / COORDINATOR） |
| 必填               | 無                         | `reason`（稽核用）                                         |

也就是說：後端**刻意沒有**「重複報到放行」這個能力（`EventRegistrationService.ts:1462` 明文寫「拒絕無意義寫入」）。
所以 App 那顆按鈕不是「還沒接好」，而是**這個能力在後端不存在**。

App 目前的處理是誠實的——按下去必定失敗，然後顯示 `overrideBlockedBanner`。
問題在於：**它仍然會發一個必定 404 的請求**。

> 判定：**P0 契約漂移**。修法見 `04-sync-plan.md` §S1。

## 1.3 App 對後端事件 API 的覆蓋率

| 分組（後端 top-level segment）                                                                                                                  | 路由數  | App 用了幾條                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| `exhibitors`（含巢狀 `/import`、`:exhibitorId`、`:exhibitorSlug`）                                                                              | 28      | 0                                                                 |
| `registrations`（含巢狀 `/import`）                                                                                                             | 18      | 4 有效（list / create / by-code / checkin）＋1 死（**override**） |
| `page-sections`                                                                                                                                 | 9       | 0                                                                 |
| `nfc`                                                                                                                                           | 8       | 4（lookup / badges / bind / exchange）                            |
| `sessions`                                                                                                                                      | 8       | 0                                                                 |
| `connection-requests`                                                                                                                           | 7       | 0                                                                 |
| `matching`                                                                                                                                      | 7       | 0                                                                 |
| `polls`                                                                                                                                         | 6       | 0                                                                 |
| `org-roles`                                                                                                                                     | 4       | 0                                                                 |
| `ticket-types`                                                                                                                                  | 4       | 1（list）                                                         |
| `wallet`                                                                                                                                        | 4       | 1（transactions）                                                 |
| `bank-transfers`                                                                                                                                | 3       | 0                                                                 |
| `export`                                                                                                                                        | 2       | 0                                                                 |
| root（`GET /`、`POST /`、`PATCH /:eventId`）                                                                                                    | 3       | 0                                                                 |
| 其他單條（`my-access`、`my`、`:eventSlug`、`activation`、`by-id`、`my-exhibitors`、`my-managed`、`my-participation`、`my-tickets`、`webhooks`） | 10      | 3（`my-managed`、`by-id`、`my-access`）                           |
| **合計**                                                                                                                                        | **121** | **13 有效（10.7%）**                                              |

> ⚠️ 這張表在 2026-10-22 的獨立驗證後修正過：第一版寫「111 條」，漏了
> `exhibitors.routes.ts:52` 與 `registrations.routes.ts:20` 的兩層
> `router.use('/import', …)`（共 8 條），以及 `index.ts` 直接掛的 2 條。
> 詳見 `07-verification.md`。

## 1.4 前端也不完美：兩個反向發現

比對時順手抓到的**前端**問題（不是 App 的問題，但會讓「兩邊一致」的判斷失準）：

1. **`registrantType` 是前端的死參數。**
   `lib/events/registrations.ts:147-172` 的 `listRegistrations` 型別有 `registrantType`，
   且會被塞進 query string；但 `EventRegistrationController.ts` 對 `registrantType` 的出現次數是 **0**
   （service 有 21 次，但那是別的路徑在用）。⇒ 前端送出去被靜默忽略。

2. **`approvedBy` 在前後端都不存在，只有 App 在型別裡宣告。**
   `EventWalletService.getTransactionHistory` 的 `select` 只有
   `id / type / amount / balanceAfter / description / sourceType / createdAt`，
   **沒有 `approvedBy`**。前端型別正確（有 `balanceAfter`、沒有 `approvedBy`）；
   App 反而型別錯、UI 也照著錯的欄位渲染（見 03 §S-4）。

這兩條的意義：**「前端有做」不等於「前端做對」**。本輪的基準是**後端 route/response 的實作**，不是前端。

## 1.5 覆蓋率不代表完成度

10.7% 這個數字很容易被誤讀成「App 只做了 10%」。事實不是這樣：

- 分母 121 條裡，**大部分是 Web 後台專屬**（exhibitors 28、page-sections 9、sessions 8、matching 7、org-roles 4、bank-transfers 3、export 2…）。
- App 覆蓋的 13 條，正好是「門側現場」需要的全部資料面（報名查詢／報到／寫卡／名片交換／錢包查詢／權限查詢）。

所以正確的讀法是：**端點覆蓋率低是設計結果，不是缺陷**。缺陷只有 §1.2 那一條。
真正的問題在畫面層（見 `02-screen-parity.md`）與語意層（見 `03-semantic-drift.md`）。
