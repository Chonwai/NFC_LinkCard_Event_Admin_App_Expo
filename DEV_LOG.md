# LinkCard Event Admin App — Dev Log

> 開發環境：macOS / Node v22.21.1 / npm 10.9.4 | Expo SDK 57 / RN 0.86.2
> Quality Contract: strict (93) / L3 Deep Dive

## 2026-09-12 — Commit 1: scaffold

- 手動建立完整 Expo 結構（比 `npx create-expo-app` 更精確控制，兩個 commit 內可完成 scaffold + theme）
- `theme.ts` 從 Promoter App **100% 複製**（diff 驗證 OK）
- `config.ts`：API_BASE_URL = `https://linkcard.xyz/api`（production），EXPO_PUBLIC_API_URL 可覆寫
- backend 契約確認（只讀）：
  - `POST /api/auth/login` → `{ success, data: { token, user } }`（Web Frontend 共用認證）
  - `GET /api/v1/events/my-managed`（authMiddleware）
  - `GET /api/v1/events/:eventId/registrations/by-code/:code`（公開 + rate limit 20/5min）
  - `POST /api/v1/events/:eventId/registrations/checkin` body `{ registrationCode }`（authMiddleware）
  - `GET /api/users/me`（userController.getCurrentUser）
- @ 路徑 alias 對齊 Promoter
- android.package 用 `xyz.linkcard.event_admin`（Expo 不允許連字號）

<!-- 每個 commit 完成後在此追加記錄 -->

## 2026-09-14 — 交接前開發藍圖研究

### 研究目的
評估下一步策略（Web 後台 vs Admin App），盤點未開發功能，產出交接前開發藍圖。

### 研究過程
- Neo Loop B（DISCOVER → PLAN → VERIFY → DELIVER），Quality = strict(93) / L3 Deep Dive
- Snapshot Pre-Flight：Admin App HEAD `2aaf7f2`（27 commits）+ Web Frontend HEAD `7138800`（27 commits），snapshot 皆 2026-09-13 FRESH
- morpheus dispatch：3 次全部失敗（2 次 `ERR_NETWORK_CHANGED` + 1 次 rate limit）→ Neo DEGRADED 接手
- Neo 直接掃描驗證：`find`（頁面結構）、`grep`（service 調用）、`read_file`（backend controller API 規格）— 全部有 file:line 證據

### 關鍵發現
1. **Web 後台 12/13 個 manage 頁已全在**（badges/bank-transfers/content/exhibitors/org-roles/polls/profile/registrations/sessions/settings/ticket-types + 主頁）→ 功能已非常完整
2. **Admin App 缺 2 個「應移植」功能**：Registrations 列表（service 已存在）+ Settings 補頁
3. **後端 `GET /registrations` 無 search 參數**（`EventRegistrationController.ts:70-150` 只支援 page/limit/status/ticketTypeId/visibility/depositRefunded）→ by name/email 搜尋需新建 API
4. **Admin App `eventService.getRegistrations` 已存在**（`event.service.ts:50`），overview 頁已消費（`overview.tsx:56-57`）→ 註冊列表頁只需建 UI

### 交付
- `docs/research/05-handover-blueprint.md`（交接前開發藍圖）
- `docs/research/README.md` 更新（索引入口 + 交接摘要）
- `PROGRESS.md` 更新（交接前狀態 + todo）
- 4 個 hackathon commits：`3e038a2` → `d77f041`（branch `main`）

## 2026-09-15 — 會議整合功能清單研究

### 研究目的
整合 20260914 Meeting 1（深度需求整理）+ Token v11.3 設計規劃 + 交接前藍圖，產出 Admin App 完整功能開發清單。

### 研究過程
- Neo Loop B（DISCOVER → PLAN → DELIVER），Quality = strict(93) / L3 Deep Dive
- Snapshot Pre-Flight：Admin App HEAD `e6bcea0`、Web Frontend `7138800`、Token v11.3 文件存在（R3 PASS 93.00）
- 重大發現：**Token v11.3 已有 Admin App wallet-counter 完整規格（§5.2）**——會議模組 B 有現成施工圖
- 交叉驗證：`overview.tsx:27-30`（QUICK_ACTIONS 需加 wallet）、`check-in.tsx:1-60`（簽到基本版）、`event.service.ts:50`（getRegistrations 已存在）

### 關鍵發現
1. 會議 7 模組中 4 個有既有資產（QR 簽到 / Token / NFC / 名單 service）
2. 核心增量 = 三態簽到增強 + 四大功能卡 + 用戶詳情 + 現場補報名 + 工作人員權限 + 儀表板 + Credential 統一模型
3. 10 個 P0 功能（F-01..F-10）+ 9 個 P1 + 7 個 P2
4. MVP 底線：掃碼簽到 + Token 增扣 + 名單查詢 + Email 自動建帳

### 交付
- `docs/research/05b-meeting-blueprint.md`、`06-feature-list.md`、`07-mvp-schedule.md`、`08-appendix.md`
- `README.md`、`PROGRESS.md` 更新

## 2026-09-15 — 交接前可行性複審 + 外派 handoff

### 研究目的
**新增前提**：前端畫面交給工程師 `feiteng2015`、後端 API 由用戶本人開發。
在此分工下複審「功能清單是否真的做得出來」+ 製作甩手 handoff 文件。

### 研究過程
- Neo Loop B（DISCOVER → PLAN），Quality = strict(93) / L3 Deep Dive
- Snapshot Pre-Flight：`docs/.project-context.md` FRESH（2026-09-13）
- **Maker ≠ Checker**：DISCOVER（morpheus）與 PLAN（architect）由不同 agent 執行，交叉比對結論差異
- architect 逐項 file:line 證據核對，**推翻 DISCOVER 的 1 項評級**（B-5 由 High 升 Critical）

### 關鍵發現

**5 個硬阻斷項**

| ID | 阻斷項 | 級別 | 證據 |
|:---:|---|:---:|---|
| B-1 | Token 帳務層未實作（缺 6 端點 + `REVERSAL` + `idempotencyKey` + `EventWalletAdjustment` 表） | 🔴 Critical | `premium.routes.ts:13-20`、`schema.prisma:1306-1312`、grep `idempotency` = 0 |
| B-2 | `checkIn` 無條件拋 `ALREADY_CHECKED_IN`，無 override | 🔴 High | `EventRegistrationService.ts:1042-1044` |
| B-3 | 無閘口/地點欄位 | 🔴 High | `schema.prisma:802-803` |
| B-4 | `VOLUNTEER` 角色無任何 access 引用 | 🔴 High | `EventService.ts:424-458` |
| B-5 | `by-code` 限流 20 次/5 分鐘/**IP** | 🔴 **Critical** | `registrations.routes.ts:15-33` |

**PLAN 階段新增發現（DISCOVER 未列）**
- 🔴 **G-1**：`GET /registrations` 擋 OPERATOR（`EventService.ts:375`），但 `checkin` 放行（`:440-446`）→ 閘口 staff 按名單卡 403，**彩排才會爆**（修復 0.25 日）
- 🔴 **DEF-01**：自助 top-up 漏洞（參加者可自發 Token），**現存於 prod** → 建議最優先修
- 🟠 **Pagination 5 種形狀**：3 種 live（`/registrations` + `/my-managed` + `/nfc/badges`）+ 1 種文件 + 1 種 App 型別；`/nfc/badges` 連 query 參數名都不同（`pageSize` vs `limit`）

**可行性裁決**：5 個 P0 可立即開工（7.0 日，零依賴）／1 個部分（F-01 三態 UI）／4 個被後端阻斷

### 交付（6 hackathon commits）

| # | Commit | 內容 |
|:---:|---|---|
| 1 | `bc3813a` | `docs/research/09-feasibility-review.md`（可行性複審） |
| 2 | `77f3fc3` | `docs/20260915_AdminApp_API_Contract_Freeze_v1.md`（25 端點凍結） |
| 3 | `5b31575` | `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`（17 W-ID × 3 批次） |
| 4 | `395722c` | **後端 repo** `docs/20260915_AdminApp_Backend_TODOs.md`（5 阻斷項施工化） |
| 5 | `beb149a` | `docs/research/README.md` + `PROGRESS.md` 索引更新 |
| 6 | — | 本檔案（DEV_LOG） |

### 移交給 feiteng2015 的三份核心文件
- 施工計畫（batch1 可立刻開工，7.0 人日無依賴）
- API 契約凍結 v1（共同真相）
- 後端待辦（用戶自用）
- 6 個 hackathon commits：`ca6cb4e` → `47a32b6`（branch `main`）