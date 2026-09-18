# 02 — API 對接指南（先讀這份再寫 API 呼叫）

> 權威來源：`docs/20260915_AdminApp_API_Contract_Freeze_v1.md`（635 行）
> 這裡是**精簡工作版**。完整 request/response 見契約文件。

---

## 0. 三句話總結

1. **認證走 `/api`，活動走 `/api/v1`**（歷史遺留雙前綴，v1.0 不動）。
2. **登入必須用 promoter 端點**（`POST /api/v1/promoter/auth/login`），**不要用** `POST /api/auth/login`——後者拿到的 token 會讓每個 promoter API 回 401。
3. **Response envelope**：成功 `{ success: true, data }`；錯誤 `{ success: false, message, code? }`。

---

## 1. Base URL 與認證模型

| 項               | 值                                                                   |
| ---------------- | -------------------------------------------------------------------- |
| Staging Base URL | `https://staging-api.link-card.xyz`（由 `EXPO_PUBLIC_API_URL` 決定） |
| 認證機制         | JWT Bearer（`Authorization: Bearer <token>`）                        |
| Token 儲存       | `expo-secure-store`（`utils/storage.ts`）                            |
| 注入             | axios request interceptor（`api.ts`）                                |
| 401 處理         | 清 token + 導回登入（response interceptor）                          |

**三步認證流程（順序不能變）**：

| 步  | 呼叫                               | 拿到                                          |
| :-: | ---------------------------------- | --------------------------------------------- |
|  1  | `POST /api/v1/promoter/auth/login` | **claim token**（`aud: 'linkcard-promoter'`） |
|  2  | `GET /api/users/me`                | 完整身分（含 `promoterRole`）                 |
|  3  | 之後每個 API                       | 都帶這個 claim token                          |

> ⚠️ **`promoterRole == null` ⇒ 無推廣者身分 ⇒ App 丟 `PromoterAccessError`**（`utils/login-error.ts`）

---

## 2. 已知端點清單（App 相關）

### 認證

| Method & Path                      | Auth     | 用途                | App 對應          |
| ---------------------------------- | -------- | ------------------- | ----------------- |
| `POST /api/v1/promoter/auth/login` | 無       | 登入（claim token） | `auth.service.ts` |
| `GET /api/users/me`                | promoter | 還原身分            | `auth.service.ts` |

### 活動（`/api/v1/events`）

| Method & Path                   | Auth | 用途             | App 對應           |
| ------------------------------- | ---- | ---------------- | ------------------ |
| `GET /api/v1/events/my-managed` | ✅   | 列出有權限的活動 | `event.service.ts` |
| `GET /api/v1/events/:eventId`   | ✅   | 活動詳情         | `event.service.ts` |

### 註冊 / 簽到

| Method & Path                                             | Auth      | 用途     | 備註                                       |
| --------------------------------------------------------- | --------- | -------- | ------------------------------------------ |
| `GET /api/v1/events/:eventId/registrations`               | OPERATOR+ | 名單列表 | ⚠️ T-1：OPERATOR 目前 403（WP-A2 修復）    |
| `POST /api/v1/events/:eventId/check-in`（或類似）         | OPERATOR+ | 簽到     | 需確認契約                                 |
| `GET /api/v1/events/:eventId/registrations/by-code/:code` | 公開      | 掃碼查詢 | ⚠️ B-5：限流 20 次/5 分鐘/IP（WP-A3 修復） |

### NFC

| Method & Path                                     | Auth      | 用途                    | 備註                         |
| ------------------------------------------------- | --------- | ----------------------- | ---------------------------- |
| `GET /api/v1/events/:eventId/nfc/lookup?uid=&qr=` | 公開      | 查 badge                | ⚠️ N-4：無 auth（11 月接受） |
| `GET /api/v1/events/:eventId/nfc/badges`          | Write     | badge 庫存              | `nfc.service.ts`             |
| `POST /api/v1/events/:eventId/nfc/bind`           | OPERATOR+ | 綁定 badge↔registration | `nfc.service.ts`             |
| `POST /nfc/batch` 系列                            | Write     | 批次寫卡                | WP-N2 確認契約               |

### Wallet（模組 B，⚠️ Web 端做，App 不做 UI）

| Method & Path                              | Auth | 用途                               |
| ------------------------------------------ | ---- | ---------------------------------- |
| `GET /wallet/:registrationId/balance`      | ✅   | 餘額                               |
| `GET /wallet/:registrationId/transactions` | ✅   | 流水                               |
| `POST /wallet/:registrationId/top-up`      | ✅   | 增值                               |
| `POST /wallet/:registrationId/deduct`      | ✅   | 扣減（**用 deduct，不是 redeem**） |

---

## 3. 最容易踩的 5 個 API 地雷

|  #  | 地雷                           | 結果                               | 解法                                   |
| :-: | ------------------------------ | ---------------------------------- | -------------------------------------- |
|  1  | 用 `POST /api/auth/login` 登入 | 登入成功但每個 promoter API 都 401 | 改用 promoter 登入端點                 |
|  2  | 扣減用 `redeem`                | 404                                | 用 `deduct`                            |
|  3  | OPERATOR 身分查名單            | 403                                | 等 WP-A2 修復（或用 SUPRE_ADMIN 測試） |
|  4  | 掃碼尖峰                       | 429                                | 等 WP-A3 修復；測試時勿壓測            |
|  5  | 無視 response envelope         | 取錯欄位                           | 一律 `res.data.data`                   |

---

## 4. 型別對照（App 端）

`src/types/api.types.ts` 已定義 `ApiResponse<T>`、`ManagedEventItem`、`Registration` 等。**新增端點時先在這裡加型別**，不要在各頁面 inline 定義。
