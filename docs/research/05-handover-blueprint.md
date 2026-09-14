# LinkCard Event Admin App — 交接前開發藍圖（2026-09-14）

> 產出：Neo Loop Engine（JARVIS Agent Network）｜2026-09-14
> 品質合約：strict（threshold 93）/ L3 Deep Dive
> 研究方法：Web 後台（LinkCard_Frontend）12 個 manage 頁實時掃描 + Admin App 現況審計 + Backend API 規格交叉驗證
> 目標：**交接給下個工程師前，盡可能把更多功能開發好，減輕對方壓力**

---

## TL;DR（三句話）

1. **Web 後台功能已非常完整**（12/13 個管理頁全在，含 badges/registrations/org-roles 等），**不需要大改**——真正的下一步是 **Admin App 補強現場功能** + **Deploy 基建**。
2. **Admin App 缺 2 個「應移植」功能**：① Registrations 列表/搜尋頁 ② `[eventId]/settings.tsx` 缺頁；另有 **7 個 Web 功能不適合移植**（桌面管理面），**2 個可選**（Exhibitors/Sessions 查看）。
3. **交接前必做 4 件事**（~10 小時）：Settings 補頁 → Registrations 列表頁 → EAS 初始化 → 真機 E2E。做完後下個工程師接手的是「功能核心完整、Build 健康、Deploy 可啟動」的 App。

---

## 一、核心結論：下一步策略

| 選項 | 建議 | 理由 |
|---|---|---|
| 先完善 Web 後台？ | ❌ **非首選** | Web 後台 12 個 manage 頁已齊（badges/bank-transfers/content/exhibitors/org-roles/polls/profile/registrations/sessions/settings/ticket-types + 主頁），缺的是整合測試與品質，非新功能 |
| 先做 Admin App？ | ✅ **首選** | Admin App 是「現場工具」，骨架完成但缺現場高頻操作（Registrations 列表）+ Deploy 全斷（EAS 未初始化）+ 真機零驗證 |
| 兩邊同步？ | ⚠️ 有條件的同步 | 若下個工程師要同時接手兩邊，則「Web 後台只做整合測試、Admin App 做功能補強」最平衡 |

**判斷依據**：Admin App 的定位是「現場營運工具」——工作人員在活動現場用**手機**查報名、check-in、寫卡、綁 badge。Web 後台的 registrations 頁雖然功能豐富（status/visibility/deposit/ticketType 四種 filter + detail drawer + archive/refund 操作），但那是**桌面管理**用的；App 只需要**精簡版**（搜尋/狀態/分頁/查看），不該把 500 行的 drawer 移植到手機。

---

## 二、Web 後台 vs Admin App 功能差距矩陣

### 2.1 應移植（✅）

| Web 功能 | Web 頁面 | Admin App 現況 | 移植內容 | 複雜度 |
|---|---|---|---|---|
| **Registrations 報名列表** | `manage/[eventId]/registrations/page.tsx` | ❌ 無列表頁（只有 overview 用 `getRegistrations({limit:1})` 取統計） | 精簡版：status filter + 分頁 + 查看（含 badge 綁定狀態） | **Easy-Medium**（service 已存在） |
| **Settings 補頁** | `manage/[eventId]/settings/page.tsx` | ❌ `[eventId]/settings.tsx` 不存在 | 登出 + Event 切換 + 版本 + **NFC 狀態檢查**（消費既有 `copy.settings.nfc*` 文案） | Easy |

### 2.2 可選移植（⚠️ 視現場需求）

| Web 功能 | Web 頁面 | 移植價值 | 複雜度 |
|---|---|---|---|
| **Exhibitors 參展商查看** | `manage/[eventId]/exhibitors/page.tsx` | 現場需引導展商入場/查資料時有用 | Medium |
| **Sessions 場次查看** | `manage/[eventId]/sessions/page.tsx` + `sessions/[sessionId]/registrations` | 有分場 check-in 需求時有用 | Medium |

### 2.3 不適合移植（❌ 桌面管理面）

| Web 功能 | Web 頁面 | 為何不移植 |
|---|---|---|
| Org Roles 權限管理 | `manage/[eventId]/org-roles/page.tsx` | 配置面，不需現場操作 |
| Ticket Types 票種 | `manage/[eventId]/ticket-types/page.tsx` | 配置面 |
| Bank Transfers 匯款審核 | `manage/[eventId]/bank-transfers/page.tsx` | 需桌面表格/審核，手機不適合 |
| Content 頁面內容 | `manage/[eventId]/content/page.tsx` | 需富文本編輯 |
| Polls 投票管理 | `manage/[eventId]/polls/page.tsx` | 配置面 |
| Profile 活動檔案 | `manage/[eventId]/profile/page.tsx` | 配置面 |
| Badges 批次管理 | `manage/[eventId]/badges/page.tsx` | **App 只管現場查詢/綁定，批次建立/CSV 匯出屬 Web 職責**（雙軌設計） |

---

## 三、未開發功能盤點（Admin App，按優先序）

| # | 功能 | 複雜度 | 後端 API | 交接前/後 | 估時 |
|---|---|---|---|---|---|
| 1 | `[eventId]/settings.tsx` 補頁 | Easy | 無 | **交接前** | 30 分 |
| 2 | Settings NFC 狀態檢查 | Easy | 無（`NfcManager.isSupported`） | **交接前** | 15 分 |
| 3 | Registrations 列表頁（status filter + 分頁 + 查看） | Easy-Med | ✅ 已有 | **交接前** | 2 小時 |
| 4 | EAS 初始化 + projectId | Easy | 無 | **交接前** | 30 分 |
| 5 | Badge 批次資料建置（staging） | Easy | ✅ 已有 | **交接前** | 30 分 |
| 6 | 真機 E2E（Android + iOS） | — | — | **交接前** | 3 小時 |
| 7 | 角色門控（VOLUNTEER 限制） | Medium | 無（前端 userRole） | 交接前 | 1 小時 |
| 8 | Exhibitors 查看頁（現場用） | Medium | ✅ 已有 | 交接前可選 | 2 小時 |
| 9 | Sessions 查看頁（分場 check-in） | Medium | ✅ 已有 | 交接前可選 | 2 小時 |
| 10 | Badge 補發流程（void→綁新） | Medium | ⚠️ 需確認 void API | **交接後** | 2 小時 |
| 11 | Registrations 搜尋（by name/email） | Medium | ❌ **無 search 參數**（需新建 API） | **交接後** | 2 小時 |
| 12 | Offline mode | Hard | 需新建 sync | **交接後** | 3-5 天 |
| 13 | 完整現場統計 Dashboard | Hard | 需新建 aggregate API | **交接後** | 3-5 天 |
| 14 | 測試基建（vitest） | Medium | 無 | **交接後** | 2 天 |
| 15 | App icon/splash 客製 | Easy | 無 | 交接後可選 | 1 小時 |

> **關鍵發現**：後端 `GET /registrations` 只支援 `page/limit/status/ticketTypeId/visibility/depositRefunded`，**無 search 參數**（`EventRegistrationController.ts:70-150` 實測）。所以「Registrations 搜尋」若要做到 by name/email，需要**新建 backend search API**——這建議留給下個工程師（或交接前做 backend 小 API）。

---

## 四、交接前開發藍圖（Sprint 計畫）

### Sprint 0（基建補完）— 估時 1.5 小時
- [ ] 建 `[eventId]/settings.tsx`（登出 + Event 切換 + 版本 + NFC 狀態檢查）→ commit
- [ ] `eas init`（補 `projectId`）→ commit
- [ ] Staging 建 10-20 張 Badge 批次資料（`POST /nfc/batch`）

### Sprint 1（Registrations 列表頁）— 估時 2 小時
- [ ] `src/app/(auth)/[eventId]/registrations.tsx`：status filter（CONFIRMED/CHECKED_IN/PENDING_PAYMENT/ARCHIVED）+ 分頁 + 查看（姓名/Email/公司/類型/badge 狀態）
- [ ] 複用既有 `eventService.getRegistrations(eventId, params)`（已存在，`event.service.ts:50`）
- [ ] `copy.zh-TW.ts` 加 registrations 文案 → commit
- [ ] `[eventId]/_layout.tsx` 加 Registrations 入口（tab 或 overview 快速操作）→ commit

### Sprint 2（角色門控 + 真機 E2E）— 估時 4 小時
- [ ] 各頁面依 `userRole` 判斷可見性（VOLUNTEER：僅 Check-in；OPERATOR+：NFC/Badges/Registrations）→ commit
- [ ] Android 真機：登入→活動→Check-in QR→NFC 寫卡→綁定→Badge 查詢→Registrations 列表 → commit
- [ ] iOS 真機：登入→Check-in QR→SecureStore token 恢復

### Sprint 3（品牌收尾）— 估時 1 小時
- [ ] `assets/` 品牌資產替換（icon/splash → Event Admin 品牌）→ commit
- [ ] `theme.ts` 檔頭改「LinkCard Event Admin App」→ commit

### 交接物（給下個工程師）
1. Admin App（所有 commits 已提交、working tree clean）
2. `docs/research/` 研究報告（已提交 5 份 + 本藍圖）
3. 交接前/後清單（哪些做了、哪些沒做、為什麼）
4. 本藍圖 + 重啟審計報告（`docs/research/03-restart-roadmap.md`）

---

## 五、風險與注意事項

| 風險 | 嚴重度 | 緩解 |
|---|---|---|
| `GET /registrations` 無 search 參數 | 中 | App 先做 status filter + 分頁；by name/email 搜尋留交接後（需 backend API） |
| Web registrations 頁功能太豐富（500+ 行 drawer） | 低 | App 只移植精簡版（列表 + 查看），不搬 drawer |
| iOS NFC session 每張一張限制 | 低 | 藍圖已考量（walk-in only）；批量由 ACR122U 桌面工具 |
| CORS：Admin App origin 是否在 backend 白名單 | 高 | 真機 E2E 前確認 `staging-api` CORS 白名單含 App origin |
| Badge 批次資料需先建 | 中 | Sprint 0 建立；否則綁定/列表無法測 |
| EAS 需 Apple Developer 帳號 | 中 | Sprint 0 `eas init` 只需 Expo 帳號；TestFlight 才需 Apple |

---

## 六、證據清單（file:line）

| 證據 | 位置 |
|---|---|
| Web 後台 12 個 manage 頁 | `LinkCard_Frontend/app/(event)/manage/[eventId]/*/page.tsx`（`find` 實測） |
| Web registrations 頁 4 種 filter + drawer | `manage/[eventId]/registrations/page.tsx:483-538`（statusFilter/visibilityFilter/depositRefundFilter/ticketTypeFilter + pagination） |
| Admin App `getRegistrations` 已存在 | `LinkCard_Event_Admin_App_Expo/src/services/event.service.ts:50` |
| overview 已消費 getRegistrations | `(auth)/[eventId]/overview.tsx:56-57`（`{limit:1}`、`{limit:1,status:'CHECKED_IN'}`） |
| Backend list API 支援 query | `LinkCard_ExpressJS_Backend/src/events/controllers/EventRegistrationController.ts:70-150`（page/limit/status/ticketTypeId/visibility/depositRefunded，**無 search**） |
| Admin App `[eventId]/settings.tsx` 不存在 | `src/app/(auth)/[eventId]/` 下只有 badges/check-in/nfc-bind/overview（`find` 實測） |
| `copy.settings.nfc*` 文案已定義未消費 | `LinkCard_Event_Admin_App_Expo/src/constants/copy.zh-TW.ts:82-84` |
| Backend registrations 路由 | `LinkCard_ExpressJS_Backend/src/events/routes/registrations.routes.ts:64`（authMiddleware） |
