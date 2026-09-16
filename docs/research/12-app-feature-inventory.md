# 12 — Admin App 功能現況盤點（交接用）

> **讀者**：**用戶本人**（想知道「現在到底有什麼功能」）+ **feiteng2015**（即將接手）
> **產出**：Neo Loop Engine / Edison 研究部（morpheus），2026-09-17
> **掃描基準**：`LinkCard_Event_Admin_App_Expo` @ HEAD `c4101e8`（branch `main`，working tree clean）
> **快取狀態**：`docs/.project-context.md` **STALE**（`Last Updated: 2026-09-13`，早於 12 個實質 commit）→ **本報告全部為當前 HEAD 實測**，未採用快取內容
> **標記**：✅ 已驗證 ｜ 📌 規劃建議 ｜ ⚠️ 未驗證
>
> **下游文件導航**（本文件的 W-ID / B-ID / C-ID 皆定義於此）：
> - **W-ID 任務清單**（30 項 × 3 批次）→ `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`
> - **API 契約凍結**（29 端點）→ `docs/20260915_AdminApp_API_Contract_Freeze_v1.md`
> - **死碼權威清單**（§4.1 可清理 / §4.2 絕對不可清理）→ `docs/research/11-app-defect-register.md`
> - **完成度審計**（2026-09-16 基線）→ `docs/research/10-app-completion-audit.md`

---

## §0 執行摘要

- **規模**：`src/` 共 **38 檔 / 5,267 行**（`theme.ts` 佔 647 行）。頁面 11 檔、UI 元件 10 檔、service 5 檔、store 2 檔、util 6 檔、constant 3 檔、type 1 檔。
- **Build 健康**：`npx tsc --noEmit` = **0 錯誤**；`npx eslint .` = **0 錯誤**（本輪實測）。
- **可用功能**：登入、活動列表、活動概覽（3 統計卡 + 3 快速操作）、手動簽到（含結果卡 5 欄）、NFC 寫卡流程（程式碼完整）、Badge 查詢 + 分頁列表、設定頁（NFC 探測 + 登出二次確認）、`+not-found` 復原頁。
- **四態覆蓋**：**22/28（79%）**。`home` / `badges` 四態齊；`settings` 缺 E；`overview` / `check-in` / `nfc-bind` **缺「資料空態」**（僅有 `eventId` 缺失守衛）；`+not-found` 僅 E/S。
- **A0–A9 全數落地**：12 個 commit 的修復**逐項可在 HEAD 驗證**（見 §6）。
- **死碼**：**4 個死 copy key（1 真死 + 3 偽死）**、**11 個死 icon（全部偽死）**、**4 個死 npm 依賴（2 真死 + 2 偽死）**、**4 個死 theme token（2 真死 + 2 偽死）**、**約 22 個未接線 props**。W-13 已清掉 6 項真死碼。
  > ⚠️ **「偽死」= 0 使用但已被 W-ID 認領，清理會製造重工**。權威判定見 `docs/research/11-app-defect-register.md` §4.1 / §4.2。
- **驗證層級**：**真機 0**、**EAS build 0**、**自動化測試 0**、**CI 0**。所有「已驗證」皆為 **web 實測**（依賴 `.env.local`）。
- **最大缺口**：名單查詢 / Token 操作 / 用戶詳情 **三條旅程完全不存在**；**權限門控 0**（所有角色看到全部功能）；**QR 掃描全鏈路從未執行**；**NFC 寫卡從未成功執行**。

---

## §1 現在有什麼功能（逐項 + 證據）

| # | 功能 | 證據（符號名） | 驗證層級 |
| :-: | --- | --- | :-: |
| 1 | **Email/密碼登入** | `LoginScreen` / `handleLogin` / `classifyLoginError`（`src/app/index.tsx`） | ✅ web 實測 |
| 2 | **登入錯誤分類**（401/403/網路/5xx/未知） | `classifyLoginError` + `getApiErrorStatus` / `isNetworkError` / `isServerError`（`utils/api-error.ts`） | ✅ web 實測 |
| 3 | **Session 過期/停用橫幅** | `SESSION_NOTICE_BANNERS` / `useSessionNotice`（`utils/session-notice.ts`） | ✅ web 實測 |
| 4 | **Auth guard（未登入→`/`，已登入→`/(auth)/home`）** | `RootLayout` 的 `useSegments` effect（`src/app/_layout.tsx`） | ✅ web 實測 |
| 5 | **Token 持久化（web localStorage / native SecureStore）** | `tokenStorage`（`utils/storage.ts`） | 🟡 僅 web 分支 |
| 6 | **啟動 hydrate（token → `me()` 還原 user）** | `hydrate`（`stores/auth.store.ts`） | ✅ web 實測 |
| 7 | **活動列表（我的管理活動）** | `HomeScreen` / `renderEvent` / `loadEvents`（`stores/event.store.ts`） | ✅ web 實測 |
| 8 | **活動狀態徽章（6 值）** | `EVENT_STATUS_LABEL` / `EVENT_STATUS_TONE` / `getEventStatusLabel`（`utils/event-status.ts`） | ✅ web 實測 |
| 9 | **下拉刷新 + 標題列重整鈕** | `onRefresh` / `ScreenHeader.onRefresh` | ✅ web 實測 |
| 10 | **活動概覽統計卡（報名數 / 已報到 / 參展商）** | `EventOverviewScreen` / `StatItem` / `Promise.all` 兩次 `getRegistrations` | ✅ web 實測 |
| 11 | **快速操作 3 卡（Check-in / NFC / Badge）** | `QUICK_ACTIONS`（`overview.tsx`） | ✅ web 實測 |
| 12 | **手動輸入報到** | `doCheckIn` / `manualCode`（`check-in.tsx`） | ✅ web 實測 |
| 13 | **QR 掃描報到** | `CameraView` / `onBarcodeScanned`（`check-in.tsx`） | ❌ **從未執行** |
| 14 | **相機失敗降級** | `cameraError` / `onMountError` / `cameraFallback` | ❌ 未驗 |
| 15 | **報到三態回饋（idle/loading/result）** | `CheckInState` union | ✅ web 實測 |
| 16 | **報到結果卡（5 欄身分核對）** | `CheckInAttendeeBlock` / `DetailRow` / `firstNonEmpty` / `formatCheckedInAt` | ✅ web 實測（A3） |
| 17 | **報到錯誤碼映射（4 碼）** | `ERROR_MESSAGES`（`ALREADY_CHECKED_IN` / `REGISTRATION_NOT_CONFIRMED` / `REGISTRATION_NOT_FOUND` / `INSUFFICIENT_PERMISSION`） | ✅ web 實測 |
| 18 | **3 秒自動重置** | `resetTimer` / `clearResetTimer` | ✅ web 實測 |
| 19 | **NFC 寫卡（URI NDEF）** | `writeUriToCard` / `buildUriNdefMessage`（`utils/nfc-utils.ts`） | ❌ **從未執行** |
| 20 | **NFC 綁定 badge ↔ registration** | `writeAndBind` / `nfcService.bind` | ❌ **從未成功** |
| 21 | **Badge 類型選擇（3 種）** | `BADGE_TYPES`（`WRISTBAND` / `CARD` / `QR_ONLY`） | ✅ web 實測（UI） |
| 22 | **NFC 能力探測（3 態）** | `NfcProbe` / `NFC_PROBE_LABEL` / `isNfcSupported`（`settings.tsx`） | ✅ web 實測 |
| 23 | **Badge by-uid 查詢** | `doLookup` / `nfcService.lookup` | 🟡 僅錯誤路徑 |
| 24 | **Badge 庫存列表 + 分頁** | `loadList` / `onEndReached` / `hasMore` / `PAGE_SIZE` | 🟡 僅空狀態 |
| 25 | **Badge 狀態標籤（5 值）** | `STATUS_LABELS` / `STATUS_TONE` | ✅ 程式碼 |
| 26 | **登出（含二次確認）** | `logout` / `confirmingLogout` / `settings-logout-confirm` | ✅ web 實測 |
| 27 | **登出清活動快取** | `clearEventCache`（`auth.store.ts`，dynamic import） | ✅ 程式碼（A4） |
| 28 | **401/403 全域強制登出** | `apiClient.interceptors.response`（`services/api.ts`） | ✅ 程式碼 |
| 29 | **請求世代守衛（防跨帳號污染）** | `requestId` / `isCurrent`（`event.store.ts`） | ✅ 程式碼（N1/L3） |
| 30 | **未匹配路由復原頁** | `NotFoundScreen`（`src/app/+not-found.tsx`） | ✅ 程式碼（W-12） |
| 31 | **`eventId` 缺失守衛（3 頁）** | `hasEventId`（`overview` / `check-in` / `nfc-bind`） | ✅ 程式碼（W-12） |
| 32 | **品牌 Logo（登入頁 + 首頁）** | `Logo` / `logo-mark` icon | ✅ web 實測 |
| 33 | **繁中字型顯式指定** | `cjkFontFamily`（`PingFang TC` / `Noto Sans TC`） | ✅ 程式碼 |
| 34 | **品牌聚焦環（取代 UA 橘框）** | `useFocusRing`（5 個元件消費） | ✅ web 實測 |
| 35 | **48dp 觸控目標** | `layout.touchMin = 48` / `layout.ctaHeight = 56` | ✅ 程式碼 |

---

## §2 表 1：頁面盤點

> 四態欄位：**L**=loading ｜ **E**=empty ｜ **Er**=error ｜ **S**=success ｜ ➖=不適用

| 路由 | 檔案（行數） | 已實作功能（符號名） | L | E | Er | S | 驗證層級 | 缺口 |
| --- | --- | --- | :-: | :-: | :-: | :-: | --- | --- |
| `/` | `src/app/_layout.tsx`（50） | `RootLayout`、`SafeAreaProvider`、`StatusBar`、`Stack`、auth guard effect | ➖ | ➖ | ➖ | ➖ | ✅ web 實測 | 無 splash 遮罩（hydrate 期間白屏） |
| `/` | `src/app/index.tsx`（215） | `LoginScreen`、`handleLogin`、`classifyLoginError`、`SESSION_NOTICE_BANNERS`、`FieldInput`×2、`Card`、`Logo` | ➖ | ➖ | ✅ | ✅ | ✅ web 實測 | 無「記住我」、無忘記密碼、無 token 續期 |
| `+not-found` | `src/app/+not-found.tsx`（48） | `NotFoundScreen`、`EmptyState kind="no-results"`、`router.replace('/(auth)/home')` | ➖ | ✅ | ➖ | ✅ | ✅ 程式碼（W-12） | 未在 `_layout.tsx` 顯式註冊（依賴 expo-router 自動） |
| `/(auth)` | `(auth)/_layout.tsx`（42） | `AuthLayout`、`Tabs`、`Tabs.Screen`×3（home/settings/`[eventId]` href:null） | ➖ | ➖ | ➖ | ➖ | ✅ web 實測 | — |
| `/(auth)/home` | `(auth)/home.tsx`（213） | `HomeScreen`、`renderEvent`、`loadEvents`、`dismissError`、`onRefresh`、`reloadKey`、`FlatList`、`EVENT_STATUS_TONE`、`getEventStatusLabel` | ✅ | ✅ | ✅ | ✅ | ✅ web 實測 | **雙標題**（`brandRow` 的 `copy.home.title` 與 `ScreenHeader title` 同字串並存）；無活動切換 UI |
| `/(auth)/settings` | `(auth)/settings.tsx`（184） | `SettingsScreen`、`NfcProbe`、`NFC_PROBE_LABEL`、`confirmingLogout`、`hydrate` 重試、`logout` | ✅ | ➖ | ✅ | ✅ | ✅ web 實測（W-12） | 無活動切換、無音效/震動/亮度、無清除快取、無裝置資訊 |
| `/(auth)/[eventId]` | `[eventId]/_layout.tsx`（19） | `EventLayout`、`Stack.Screen`×4 | ➖ | ➖ | ➖ | ➖ | ✅ 程式碼 | — |
| `…/overview` | `[eventId]/overview.tsx`（238） | `EventOverviewScreen`、`StatItem`×3、`QUICK_ACTIONS`×3、`Promise.all`、`hasEventId` 守衛、`EmptyState` | ✅ | ❌ | ✅ | ✅ | ✅ web 實測 | **無資料空態**（活動存在但 0 統計時仍渲染 0 值卡）；快速操作缺 Token / 名單 2 卡 |
| `…/check-in` | `[eventId]/check-in.tsx`（428） | `CheckInScreen`、`CheckInState`、`doCheckIn`、`onBarcodeScanned`、`resetTimer`、`ERROR_MESSAGES`、`CheckInAttendeeBlock`、`DetailRow`、`firstNonEmpty`、`formatCheckedInAt`、`cameraError`、`hasEventId` 守衛 | ✅ | ❌ | ✅ | ✅ | 🟡 手動 web 實測；**QR ❌ 無真機** | **無資料空態**；無手電筒（`flash-*` 未用）；無音效/震動；無閘口；無主管覆核；無現場補報名 |
| `…/nfc-bind` | `[eventId]/nfc-bind.tsx`（302） | `NfcBindScreen`、`FlowState`（5 態）、`lookup`、`writeAndBind`、`BADGE_TYPES`、`reset`、`hasEventId` 守衛、iOS `Alert` 阻擋 | ✅ | ❌ | ✅ | ✅ | 🟡 web 僅驗「不支援」；**真機 ❌ 0** | **無資料空態**；無換卡/補發/退卡；`payloadUrl` 用 `WEB_BASE_URL`（A7 已修） |
| `…/badges` | `[eventId]/badges.tsx`（285） | `BadgesScreen`、`doLookup`、`loadList`、`initial`、`STATUS_LABELS`、`STATUS_TONE`、`PAGE_SIZE`、`onEndReached`、`ListFooterComponent` | ✅ | ✅ | ✅ | ✅ | 🟡 web 僅驗空狀態 | 無 `status`/`batchId` 篩選 UI（service 參數已備）；無批次建立；無匯出；無 void/補發 |

### 2.1 四態總計

> **分母定義**：**7 個頁面**（`home` / `settings` / `overview` / `check-in` / `nfc-bind` / `badges` / `+not-found`）。
> **排除**：`index`（登入頁無 L/E 態，`loading` 僅驅動按鈕 spinner）、3 個 layout 檔（全 ➖）。
> 故 7 × 4 = **28** 為分母。

| 狀態 | 覆蓋 | 說明 |
| :-: | :-: | --- |
| **L** | **6/7** | `+not-found` 為 ➖（無載入態）；其餘 6 頁皆有（`home`/`overview`/`badges`/`settings` 用 `Skeleton`，`check-in`/`nfc-bind` 用 `ActivityIndicator`） |
| **E** | **3/7** | ✅ `home`（`EmptyState`）、`badges`（`EmptyState`）、`+not-found`；❌ `overview`/`check-in`/`nfc-bind` **僅有 `eventId` 缺失守衛，無資料空態**；`settings` 為 ➖ |
| **Er** | **6/7** | `+not-found` 為 ➖（本身就是錯誤頁）；其餘 6 頁皆有（`InlineBanner` 或 `EmptyState`） |
| **S** | **7/7** | — |
| **合計** | **22/28（79%）** | 較 2026-09-16 審計的 21/28 提升 **+1**（`settings` loading/error 已補） |

> ⚠️ **E 的判定說明**：`overview` / `check-in` / `nfc-bind` 的 `EmptyState` 只在 `!hasEventId` 時渲染（`overview.tsx` 的 `if (!hasEventId)` 早退），**不是資料空態**。活動存在但無資料時，`overview` 仍渲染 3 張 0 值統計卡。

---

## §3 表 2：Service 層盤點

### 3.1 `api.ts` interceptor

| 項目 | 實作 | 判定 |
| --- | --- | :-: |
| `apiClient` | `axios.create` + `baseURL: API_BASE_URL` + `timeout: API_TIMEOUT_MS`(15000) + JSON header | ✅ |
| Request interceptor | `tokenStorage.getItem(TOKEN_STORAGE_KEY)` → `Authorization: Bearer` | ✅ |
| Response interceptor | `isLoginRequest` 豁免（`url.includes('/auth/login')`）；`getTerminalAuthReason` → `setSessionNotice` + `auth.logout()`；`alreadyTerminated` 防重複 | ✅ |
| 401 處理 | 一律 `'expired'`（`getTerminalAuthReason`） | 🟡 過寬：`/nfc/lookup` 為公開端點，若回 401 會誤登出 |
| 5xx / network | 不觸發登出 | ✅ |
| `/api` 前綴 | `API_BASE_URL` 為 **origin-only**（`config.ts` 註解明示），service 路徑自帶 `/api/...` | ✅ **A0 已修** |

### 3.2 逐方法

| Service | 方法 | 端點 | 被誰呼叫 | 已驗證可用 |
| --- | --- | --- | --- | :-: |
| `authService` | `login` | `POST /api/auth/login` | `index.tsx: handleLogin` | ✅ web 實測 |
| `authService` | `me` | `GET /api/users/me` | `auth.store.ts: hydrate`（dynamic import） | ✅ web 實測 |
| `eventService` | `getMyManagedEvents` | `GET /api/v1/events/my-managed` | `event.store.ts: loadEvents` | ✅ web 實測 |
| `eventService` | `getRegistrations` | `GET /api/v1/events/:eventId/registrations` | `overview.tsx`（`limit:1` ×2） | ✅ web 實測 |
| `registrationService` | `getByCode` | `GET …/registrations/by-code/:code` | `nfc-bind.tsx: lookup` | 🟡 僅錯誤路徑 |
| `registrationService` | `checkIn` | `POST …/registrations/checkin` | `check-in.tsx: doCheckIn` | ✅ web 實測（3 態） |
| `nfcService` | `lookup` | `GET …/nfc/lookup?uid=\|qr=` | `badges.tsx: doLookup` | 🟡 僅錯誤路徑 |
| `nfcService` | `listBadges` | `GET …/nfc/badges?page&pageSize&status&batchId&all` | `badges.tsx: loadList` / `initial` | 🟡 僅空狀態 |
| `nfcService` | `bind` | `POST …/nfc/bind` | `nfc-bind.tsx: writeAndBind` | ❌ **從未成功執行** |

**Dead code 檢查**：**0 個未被呼叫的方法**。`getEventById` 已於 W-13 移除（`grep getEventById src/` = 0 命中）。

**未被使用的可選參數**（能力儲備，非死碼）：

| 參數 | 定義處 | 呼叫端使用 |
| --- | --- | :-: |
| `nfcService.lookup` 的 `qr` | `nfc.service.ts` | ❌ 0（只用 `uid`） |
| `nfcService.listBadges` 的 `status` / `batchId` / `all` | `nfc.service.ts` | ❌ 0 |
| `nfcService.bind` 的 `colorCode` | `nfc.service.ts` | ❌ 0（只用 `badgeType`） |
| `eventService.getRegistrations` 的 `page` | `event.service.ts` | ❌ 0（只用 `limit` / `status`） |

---

## §4 表 3：UI 元件與工具盤點

### 4.1 `src/components/ui/`（10 檔 / 1,590 行）

| 檔案 | 行數 | 被誰使用（import 實測） | 判定 |
| --- | :-: | --- | --- |
| `Button.tsx` | 154 | `index` / `settings` / `check-in` / `nfc-bind` / `badges` / `EmptyState`（6 處） | 🟡 **3 個 props 未用**：`icon` / `fullWidth` / `accessibilityHint`。`variant` 5 值中 `primary`（預設）與 `dangerSolid` 從未顯式傳入 |
| `Card.tsx` | 136 | `index` / `overview`（2 處） | 🟡 **6 個 props 未用**：`showChevron` / `onPress` / `onLayout` / `accessibilityState` / `accessibilityHint` / `testID` → **互動式卡片從未啟用**（`chevron-right` 因此成死碼） |
| `EmptyState.tsx` | 163 | `home` / `badges` / `overview` / `check-in` / `nfc-bind` / `+not-found`（6 處） | 🟡 **3 個 props 未用**：`secondaryLabel` / `onSecondary` / `compact`。`kind` 只用 `no-results`（`first-use` / `filtered` 從未使用） |
| `FieldInput.tsx` | 245 | `index`（1 處） | 🟡 **4 個 props 未用**：`error` / `multiline` / `onFocus` / `inputRef` → **錯誤顯示與捲動修正能力存在但未接線** |
| `Icon.tsx` | 253 | `_layout` / `home` / `overview` / `check-in` / `nfc-bind` / `Card` / `EmptyState` / `FieldInput` / `InlineBanner` / `Logo` / `ScreenHeader`（11 處） | 🟡 `IconName` **34 個中 11 個 0 使用**（見 §4.4） |
| `InlineBanner.tsx` | 173 | `index` / `home` / `settings` / `overview` / `nfc-bind` / `badges`（6 處） | 🟡 **1 個 prop 未用**：`title`。`dismissible`/`onDismiss` 只用於 `home` |
| `Logo.tsx` | 104 | `index` / `home`（2 處） | 🟡 **3 個 props 未用**：`wordmark` / `accessibilityLabel` / `testID` |
| `ScreenHeader.tsx` | 174 | `home` / `settings` / `overview` / `check-in` / `nfc-bind` / `badges`（6 處） | 🟡 **1 個 prop 未用**：`right`（右側動作槽）→ **「+ 新增批次」類入口無處可放** |
| `Skeleton.tsx` | 93 | `home` / `settings` / `overview` / `badges`（4 處） | 🟡 **1 個 prop 未用**：`animated`（恆為預設 `true`）。`SkeletonList` 已於 W-13 移除 |
| `useFocusRing.ts` | 95 | `Button` / `Card` / `FieldInput` / `InlineBanner` / `ScreenHeader`（5 處） | ✅ 全數消費 |

> **一句話**：**10 個元件全部有被 import（0 個孤兒）**，但合計 **約 22 個已實作 props 從未被使用**（Button 3 + Card 6 + EmptyState 3 + FieldInput 4 + InlineBanner 1 + Logo 3 + ScreenHeader 1 + Skeleton 1）。這不是死碼，是**未接線的能力儲備**。

### 4.2 `src/utils/`（6 檔 / 331 行）

| 檔案 | 行數 | export 使用情形 | 判定 |
| --- | :-: | --- | :-: |
| `api-error.ts` | 117 | `getApiErrorStatus` / `getApiErrorCode` / `getApiErrorMessage` / `getTerminalAuthReason` / `isNetworkError` / `isServerError` 皆有消費者；`asApiError` 僅內部 | ✅ |
| `event-status.ts` | 43 | `EVENT_STATUS_LABEL` / `EVENT_STATUS_TONE` / `getEventStatusLabel`（`home` + `overview`） | ✅ |
| `nfc-utils.ts` | 85 | `normalizeTagUid` / `writeUriToCard` / `isNfcSupported` / `startNfc` 各 2 處；`buildUriNdefMessage` 已降為 module-private（W-13） | ✅ |
| `session-notice.ts` | 44 | `setSessionNotice` / `clearSessionNotice` / `useSessionNotice` 有消費者；`getSessionNotice` 僅內部 | ✅ |
| `storage.ts` | 40 | `tokenStorage`（`api.ts` + `auth.store.ts`） | ✅ |
| `validation.ts` | **2** | `isValidEmail`（`index.tsx`） | ✅ 但**全 App 只有 1 個驗證函式** |

### 4.3 `src/constants/`（3 檔 / 855 行）

| 檔案 | 行數 | 判定 |
| --- | :-: | --- |
| `config.ts` | 42 | ✅ **A0 已修**：`API_BASE_URL` origin-only + fail-closed guard（`!__DEV__` 時 throw）+ `WEB_BASE_URL` 獨立（A7） |
| `copy.zh-TW.ts` | 166 | 🟡 **4 個 key 從未被消費**（見 §7） |
| `theme.ts` | 647 | 🟡 **檔頭第 2 行仍寫 `LinkCard Promoter App`**；**4 個 token 0 使用**（見 §7） |

### 4.4 死 Icon（`IconName` 34 個，**11 個 0 使用**）

| 死 icon | 對應的未接線能力 | 將由誰消費 |
| --- | --- | --- |
| `chevron-left` / `chevron-down` / `chevron-up` | `Card.showChevron` 未啟用 | W-03 / W-15 |
| `flash-on` / `flash-off` | **check-in 手電筒**（會議明確要求） | **W-26** |
| `camera-shutter` | 手動拍照簽到 | —（P2） |
| `copy` | tagUid 複製（`expo-clipboard` 依賴同在但未用） | **W-15** |
| `trash` | 刪除操作（無任何刪除 UI） | —（OOS） |
| `plus` | 「新增」入口（配合 `ScreenHeader.right` 亦未啟用） | **W-02** |
| `clock` | 報到時間戳 | **W-26** |
| `hand-raised` | 現場人員呼叫督導 | —（P1） |

> ✅ **使用中的 23 個**：`home`、`camera`、`archive`、`users`、`cog`、`chevron-right`、`close`、`check`、`arrow-left`、`nfc`、`clipboard-check`、`refresh`、`alert-triangle`、`search`、`filter`、`pencil`、`qr-code`、`check-circle`、`x-circle`、`alert-circle`、`information-circle`、`empty-card`、`logo-mark`（+ `chevron-right` 僅 `Card.tsx` 使用，而 `Card.showChevron` 未啟用 → **實質不可達**）。
> 📌 **裁決：這 11 個不得刪除**（9 個有明確下游客戶；`trash` / `camera-shutter` 為 OOS/P2 保留）。
> ⚠️ **權威清單**：可清理 vs 絕對不可清理的完整判定見 `docs/research/11-app-defect-register.md` §4.1 / §4.2。

### 4.5 死 copy key（**4 個**，逐 key grep = 0）

> ⚠️ **排除聲明**：本表**不含** §7.2 所列的偽死項。下列 3 項雖 0 命中，但屬 **W-08 / W-10 / W-26 的能力儲備，不可清理**（見 §7.2 與 `11-app-defect-register.md` §4.2）。
> 故 §0 的「4 個死 copy key」實為 **1 真死 + 3 偽死**。

| Key | 位置 | 判定 |
| --- | --- | --- |
| `auth.networkError` | `copy.zh-TW.ts` | 🗑️ **真死**：與 `auth.errorNetwork` 語意重複（後者才是 `classifyLoginError` 使用的） |
| `auth.loggedOut` | 同上 | 🚫 **偽死**：**W-08 / W-10** 將消費（登出成功提示） |
| `checkIn.switchToScan` | 同上 | 🚫 **偽死**：**W-26** 將消費（掃描/手動切換） |
| `settings.appVersion` | 同上 | 🚫 **偽死**：**W-08** 將消費（設定頁版本號） |

> ✅ **已轉活（A3/W-12 生效）**：`checkIn.attendeeName/Email/Company/Type`、`checkIn.resultTitle`、`checkIn.checkedInAt`、`settings.nfcStatus/nfcSupported/nfcChecking`、`event.unavailableTitle/unavailableHint`、`notFound.title/hint`、`eventStatus.*`（6）、`badgeStatus.*`（5）、`badges.*`（7）、`nfc.*` 擴充（8）——**全部有消費者**。

### 4.6 死 theme token / export

> ⚠️ **排除聲明**：本表**不含** §7.2 所列的偽死項。`layout.touchGapMin` / `layout.breakpointNarrow` 雖 0 使用，但屬 **C-15 / C-16 的能力儲備，不可清理**（見 §7.2 與 `11-app-defect-register.md` §4.2）。
> 故 §0 的「4 個死 theme token」實為 **2 真死 + 2 偽死**。

| 項目 | 位置 | 外部使用 | 判定 |
| --- | --- | :-: | --- |
| `primitive` | `theme.ts` | 0 | 🗑️ 設計上 Layer 1 不外流（可接受） |
| `radius.none` | `theme.ts` | 0 | 🗑️ |
| `layout.touchGapMin` | `theme.ts` | 0 | 🚫 **偽死**（會議要求「相鄰觸控目標間距」，token 已備未用；C-15/C-16 若拍板即需用） |
| `layout.breakpointNarrow` | `theme.ts` | 0 | 🚫 **偽死**（響應式斷點 token 存在，但全 App 無任何 `Dimensions`/`useWindowDimensions`） |
| `fontFamily` | `theme.ts:188` | 0（module-private，非 export） | ➖ 非死碼 |
| `elevation` | `theme.ts` | **0 外部**（module-private，非 export） | ➖ **非死碼**（與 `fontFamily` 同類；`components.card.elevation` 值為 `elevation.flat` = `{}`，接線與否無行為差異） |
| `metaText` | `theme.ts:647` | **7**（`home.tsx` ×3、`badges.tsx` ×2 + import） | ✅ **已接線**（2026-09-16 審計稱 0 使用 → **已修正**） |

### 4.7 型別（`src/types/api.types.ts`，93 行）

| 型別 | 外部使用 | 判定 |
| --- | :-: | --- |
| `ApiResponse` | 13 | ✅ |
| `AuthUser` | 6 | ✅ |
| `LoginResponse` | 3 | ✅ |
| `EventStatus` | 4 | ✅ **A2 已修**：值域 = `DRAFT\|PUBLISHED\|ONGOING\|COMPLETED\|CANCELLED\|ARCHIVED`（與後端一致） |
| `ManagedEventItem` | 8 | ✅ |
| `Registration` | 11 | ✅ |
| `CheckInResult` | 8 | ✅ **A3 已消費**（`check-in.tsx` 的 `CheckInState`） |
| `BadgeStatus` | 3 | ✅ |
| `BadgeInfo` | 8 | ✅ |
| `ApiErrorEnvelope` | — | ✅ **已移除**（W-13） |

**未被消費的欄位**：`Registration.customFields`（僅型別定義 + service 註解，**0 處渲染**）、`CheckInResult.alreadyCheckedIn`（僅型別定義，**0 處讀取**）、`Registration.profile.phone/jobTitle`（0 處渲染）。

### 4.8 npm 依賴（20 個 dependencies）

> ⚠️ **排除聲明**：本表**不含** §7.2 所列的偽死項。`expo-clipboard` / `react-native-qrcode-svg` 雖 0 命中，但屬 **W-15 / W-31 的能力儲備，不可清理**。
> 故 §0 的「4 個死 npm 依賴」實為 **2 真死 + 2 偽死**。

| 依賴 | src 命中 | 判定 |
| --- | :-: | --- |
| `axios` / `expo` / `expo-camera` / `expo-router` / `expo-secure-store` / `expo-status-bar` / `react` / `react-dom` / `react-native` / `react-native-safe-area-context` / `react-native-svg` / `react-native-web` / `zustand` | ≥1 | ✅ 使用中 |
| `react-native-nfc-manager` | 3（**dynamic import**） | ✅ 非死碼 |
| `expo-dev-client` | 0 | 🟡 開發工具（`eas.json` development profile 需要） |
| `react-native-screens` | 0 | 🟡 expo-router 的 peer（間接使用） |
| **`expo-clipboard`** | **0** | 🚫 **偽死** → **W-15** 將消費（tagUid 複製） |
| **`expo-constants`** | **0** | 🗑️ **真死** |
| **`expo-linking`** | **0** | 🗑️ **真死** |
| **`react-native-qrcode-svg`** | **0** | 🚫 **偽死** → **W-31** 將消費（Credential QR） |

> 📌 `expo-device` / `expo-image-picker` **不在 `package.json`**（2026-09-16 審計稱其為死依賴 → **該項已不適用**）。

---

## §5 表 4：功能級盤點（使用者旅程）

| # | 旅程 | 判定 | 走到哪 / 卡在哪（附符號） |
| :-: | --- | :-: | --- |
| 1 | **登入 → 選活動 → 首頁** | ✅ **走得通** | `handleLogin` → `setAuth` → `router.replace('/(auth)/home')` → `renderEvent` 的 `router.push('/(auth)/[eventId]/overview')`。**缺**：無「記住我」、無 token 續期、hydrate 期間無 splash 遮罩（`_layout.tsx` 無 loading gate） |
| 2 | **掃碼簽到（QR + 手動 + 三態 + 結果卡）** | 🟡 **手動走得通；QR 未驗** | 手動 ✅ web 3 態 + 結果卡 5 欄（A3）。**卡點**：① `CameraView` / `onBarcodeScanned` **從未在任何環境執行**（web 無 camera）；② 會議要三態＝有效/重複/**無效→現場補報名**，App 只做 error banner（`ERROR_MESSAGES` 4 碼）；③ 無音效/震動/手電筒（`flash-*` 未用）；④ 無閘口/地點；⑤ 無主管覆核（`checkIn` 無 override 參數 → 後端 B-2） |
| 3 | **NFC 寫卡 / 綁定** | ❌ **走不通（從未成功執行）** | 程式碼全在：`isNfcSupported` → `startNfc` → `writeUriToCard` → `nfcService.bind`。**卡在**：① 真機 0（需 Android + NTAG）；② iOS 直接 `Alert.alert(copy.nfc.iosWriteNotSupported)` 阻擋；③ 無換卡/補發/退卡；④ **支援晶片型號未定義**（會議 §六 #4 仍無 owner） |
| 4 | **Badge 查詢** | 🟡 **走得通但只驗空狀態** | `doLookup` + `loadList` + `onEndReached`。**卡在**：① staging 無 badge 資料 → 命中/分頁/多狀態**從未驗證**；② 無 `status`/`batchId` 篩選 UI（service 參數已備）；③ 無批次建立/匯出 |
| 5 | **名單查詢** | ❌ **不存在** | **無 route 檔**。`getRegistrations` 僅被 `overview.tsx` 用來取 `pagination.total`（`limit:1`），**從未取實際名單**。後端亦無 name/email search 參數（B-6） |
| 6 | **Token 操作（增/扣/流水）** | ❌ **不存在** | **無 route / service / copy key / icon**。後端 6 端點亦未實作（B-1） |
| 7 | **用戶詳情** | ❌ **不存在** | 無 route 檔。`Registration.profile.*` 與 `customFields` 型別存在，**無任何畫面渲染** |
| 8 | **設定 / 登出 / 活動切換** | 🟡 **登出走得通** | `logout` + `confirmingLogout` 二次確認 ✅（W-12）。**卡在**：① **無活動切換 UI**；② 無音效/震動/亮度；③ `[eventId]/settings.tsx` **從未存在**（裁決 C-17）；④ 登出清快取 ✅ **已修**（A4） |
| 9 | **權限門控（角色差異）** | ❌ **完全不存在** | `grep userRole src/` = **4 命中，全是型別映射與顯示字串**（`api.types.ts`、`event.service.ts`、`home.tsx` ×2），**零處用於 gate 任何功能** → **所有頁面對所有角色完全開放**（VOLUNTEER 也能寫卡、也能看統計） |

---

## §6 與 2026-09-16 審計的差異（哪些缺口已補）

> 對照 `docs/research/10-app-completion-audit.md`（v1.0-r1）。**逐項以 HEAD `c4101e8` 實測**。

| 當時缺口 | 當時判定 | **HEAD 實況** | 證據 |
| --- | :-: | :-: | --- |
| **A0**：`API_BASE_URL` 雙重 `/api` 前綴 | 🔴 真缺陷 | ✅ **已修** | `config.ts` 註解明示 origin-only；`API_BASE_URL = EXPO_PUBLIC_API_URL \|\| 'https://linkcard.xyz'` |
| **A0 附**：無 fail-closed guard | 🟡 | ✅ **已補** | `config.ts`：`if (!EXPO_PUBLIC_API_URL && !__DEV__) throw` |
| **A0 附**：無 `.env.example` | 🟡 | ✅ **已補** | `.env.example`（2,958 bytes，含 staging 範本） |
| **A1**：`home` 錯誤橫幅表面有實際死 | 🔴 | ✅ **已修** | `home.tsx` 讀 `useEventStore().error` + `dismissError` + `testID="home-error-banner"` |
| **A2**：`EventStatus` 值域幻覺 | 🔴 | ✅ **已修** | `api.types.ts` 6 值與後端一致；`utils/event-status.ts` 共用映射 |
| **A3**：`checkIn` 回傳值完全未使用 | 🔴 | ✅ **已修** | `CheckInAttendeeBlock` / `DetailRow` / `firstNonEmpty` / `formatCheckedInAt` |
| **A4**：登出不清 `event.store` | 🔴 | ✅ **已修** | `auth.store.ts: clearEventCache()`（dynamic import 避 cycle） |
| **A5**：死狀態 | 🟡 | ✅ **已移除** | `grep selectEvent src/` = 0 |
| **A6**：26 行硬編中文 | 🟡 | ✅ **已歸零**（頁面層） | 殘留僅 6 處**元件層 a11y label**（見 §10） |
| **A7**：`payloadUrl` 硬編 prod 域名 | 🟡 | ✅ **已修** | `nfc-bind.tsx` 用 `WEB_BASE_URL`（`config.ts` 獨立 export） |
| **A8**：`?? 'Badge'` / `?? '快速操作'` fallback | 🟡 | ✅ **已移除** | `overview.tsx` 的 `QUICK_ACTIONS` 直接讀 `copy.event.badgesTitle` |
| **A9**：逾時碼分類過窄 | 🟡 | ✅ **已修** | `NETWORK_ERROR_CODES` 4 碼（+`ETIMEDOUT`/`ENETUNREACH`）；`code` 優先於 `message` |
| **W-12**：`overview`/`check-in`/`nfc-bind` 空態 | ❌ | 🟡 **部分補** | 三頁皆有 `hasEventId` 守衛 + `EmptyState`，但**仍無資料空態** |
| **W-12**：`settings` loading/error | ❌ | ✅ **已補** | `settings-loading` / `settings-account-error` testID |
| **W-12**：`+not-found` 不存在 | ❌ | ✅ **已補** | `src/app/+not-found.tsx`（48 行） |
| **W-12**：登出二次確認 | ❌ | ✅ **已補** | `confirmingLogout` 行內兩段式（避開 RNW `Alert.alert` no-op） |
| **W-12**：NFC 狀態檢查 | ❌ | ✅ **已補** | `NfcProbe` 3 態 + `NFC_PROBE_LABEL` |
| **W-13**：`SkeletonList` | 🗑️ | ✅ **已刪** | `grep SkeletonList src/` = 1（僅註解） |
| **W-13**：`iconStyles` | 🗑️ | ✅ **已刪** | 0 命中 |
| **W-13**：`getEventById` | 🗑️ | ✅ **已刪** | 0 命中 |
| **W-13**：`ApiErrorEnvelope` | 🗑️ | ✅ **已刪** | 0 命中 |
| **W-13**：`theme`/`default` export | 🗑️ | ✅ **已刪** | 0 import |
| **W-13**：`buildUriNdefMessage` | 🟡 | ✅ **已降 module-private** | `nfc-utils.ts` 註解明示 |
| **W-13**：`fontFamily`/`elevation`/`metaText` | 🗑️ | 🟡 **部分**：`metaText` ✅ 已接線（7 處）；`fontFamily` 與 `elevation` 皆為 **module-private（非 export）**，原「0 使用」判定不適用 | — |
| **W-13**：`radius.none`/`buttonHeightSm`/`iconBox` | 🗑️ | 🟡 **部分**：`buttonHeightSm`/`iconBox` ✅ 已刪；`radius.none` ❌ **仍在**（`theme.ts:108`） | — |
| **W-13**：`husky`/`lint-staged` 假承諾 | 🗑️ | ✅ **已無此宣告** | `package.json` 無 `husky`/`lint-staged`/`prepare` |
| **W-13**：`dist/` 殘留 | 🗑️ | ✅ **已無** | `ls dist` = 不存在 |
| **N1**：跨帳號活動污染 | 🔴 | ✅ **已修** | `event.store.ts` 的 `requestId` + `isCurrent()` |
| **F1**：`clear()` 未重置 `loading` | 🟡 | ✅ **已修** | `clear()` 同時重置 `loading` + 遞增 `requestId` |
| **F2**：`event-status` 未共用 | 🟡 | ✅ **已修** | `utils/event-status.ts` 由 `home` + `overview` 共用 |
| **L2**：`home`/`overview` status fallback 分歧 | 🟡 | ✅ **已修** | `getEventStatusLabel` 改用 `\|\|`；`home.tsx` 走共用 helper |
| **L3**：世代述詞重複 | 🟡 | ✅ **已修** | `const isCurrent = () => get().requestId === requestId` |
| **N4**：檔尾換行 | 🟡 | ✅ **已修** | — |
| **死 copy key 11 個** | 🗑️ | ✅ **降至 4 個**（7 個已轉活） | 見 §4.5 |
| **死 icon 12 個** | 🗑️ | ✅ **降至 11 個**（`chevron-right` 仍定義但實質不可達） | 見 §4.4 |
| **死 npm 依賴 6 個** | 🗑️ | ✅ **降至 4 個**（`expo-device`/`expo-image-picker` 本就不在 `package.json`） | 見 §4.8 |
| **四態 21/28（75%）** | 🟡 | ✅ **提升至 22/28（79%）**（**+1**） | `settings` loading/error 已補 |
| **`theme.ts` 檔頭寫 Promoter** | 🟡 | ❌ **仍未修** | `theme.ts:2` = `LinkCard Promoter App — 三層設計 token 系統` |

---

## §7 死碼 / 半成品清單

> ⚠️ **權威來源**：可清理 vs 絕對不可清理的**最終判定**見 `docs/research/11-app-defect-register.md` §4.1 / §4.2。
> **本節與該文件衝突時，以該文件為準。** 清理前必須先確認該符號**不在 §4.2 的 13 列內**。

### 7.1 🗑️ 真死（可清理）

> **排除聲明**：本表**不含** §7.2 所列的任何項目。若某列同時出現在 §7.2，**以 §7.2 為準（不可清理）**。

| # | 項目 | 位置 | 判定 |
| :-: | --- | --- | --- |
| 1 | `copy.auth.networkError` | `copy.zh-TW.ts` | 0 命中；與 `auth.errorNetwork` 語意重複 |
| 2 | `radius.none` | `theme.ts` | 0 命中 |
| 3 | `primitive` export | `theme.ts` | 0 外部命中（設計上 Layer 1 不外流） |
| 4 | npm `expo-constants` | `package.json` | 0 命中 |
| 5 | npm `expo-linking` | `package.json` | 0 命中 |
| 6 | `Registration.customFields` | `api.types.ts` | 型別有、**0 處渲染** |
| 7 | `CheckInResult.alreadyCheckedIn` | `api.types.ts` | 型別有、**0 處讀取** |
| 8 | `Registration.profile.phone` / `jobTitle` | `api.types.ts` | 型別有、**0 處渲染** |
| 9 | `nfcService.lookup` 的 `qr` 參數 | `nfc.service.ts` | 0 呼叫端使用 |
| 10 | `nfcService.listBadges` 的 `status`/`batchId`/`all` | `nfc.service.ts` | 0 呼叫端使用 |
| 11 | `nfcService.bind` 的 `colorCode` | `nfc.service.ts` | 0 呼叫端使用 |
| 12 | `eventService.getRegistrations` 的 `page` | `event.service.ts` | 0 呼叫端使用 |
| 13 | `EmptyState` 的 `first-use` / `filtered` kind | `EmptyState.tsx` | 0 呼叫端使用（只用 `no-results`） |
| 14 | `Button` 的 `dangerSolid` variant | `Button.tsx` | 0 呼叫端使用 |
| 15 | `Card` 的 `tone="sunken"` | `Card.tsx` | 0 呼叫端使用 |
| 16 | `theme.ts` 檔頭的 `LinkCard Promoter App` 字串 | `theme.ts` | **品牌殘留**（非死碼，是錯誤標示） |

> 🚫 **已從本表移除的 7 項**（原列於此，但 `11-app-defect-register.md` §4.2 明列為**絕對不可清理**）：
> `copy.auth.loggedOut`（W-08/W-10）、`copy.checkIn.switchToScan`（W-26）、`copy.settings.appVersion`（W-08）、
> `layout.touchGapMin` / `layout.breakpointNarrow`（C-15/C-16）、`expo-clipboard`（W-15）、`react-native-qrcode-svg`（W-31）。
> **誤刪這 7 項會直接製造 W-08 / W-10 / W-15 / W-26 / W-31 的重工。**

### 7.2 🚫 偽死（**不可清理**，將被消費）

> **權威清單**：`docs/research/11-app-defect-register.md` §4.2（13 列）。下表為其展開，**兩者衝突時以該文件為準**。

| 項目 | 將由誰消費 |
| --- | --- |
| Icon `flash-on` / `flash-off` | **W-26**（手電筒） |
| Icon `plus` + `ScreenHeader.right` | **W-02**（新增入口） |
| Icon `chevron-left/down/up` + `Card.showChevron` | W-03 / W-15 |
| Icon `copy` + `expo-clipboard` | **W-15**（tagUid 複製） |
| Icon `clock` | **W-26**（報到時間） |
| Icon `hand-raised` | P1（呼叫督導） |
| Icon `camera-shutter` | P2（拍照簽到） |
| Icon `trash` | OOS |
| copy `checkIn.attendee*` / `resultTitle` / `switchToScan` | **W-26** |
| copy `settings.nfcStatus` / `nfcSupported` / `appVersion` | **W-08** |
| copy `auth.loggedOut` | W-08 / W-10 |
| 型別 `CheckInResult` | **W-26** |
| 型別 `EventStatus` | **W-01**（改值域，非刪） |
| `react-native-qrcode-svg` | **W-31**（Credential QR） |
| `react-native-nfc-manager` | 動態 import，**非死碼** |
| `layout.touchGapMin` / `layout.breakpointNarrow` | **C-15 / C-16** 若拍板要做 |
| `FieldInput.error` / `multiline` / `onFocus` / `inputRef` | W-03 / W-05（表單錯誤與捲動） |
| `EmptyState.secondaryLabel` / `onSecondary` | W-03（清除篩選） |
| `InlineBanner.title` | W-23（錯誤碼文案） |

### 7.3 半成品（有骨架、未完成）

| 項目 | 現況 | 缺什麼 |
| --- | --- | --- |
| `overview` 快速操作 | 3 卡（Check-in / NFC / Badge） | 缺 **Token** 與 **名單** 2 卡（W-02） |
| `badges` 篩選 | service 參數齊備 | 缺 UI（W-15） |
| `check-in` 三態 | idle/loading/result | 缺「無效→現場補報名」分支（W-26） |
| `nfc-bind` 流程 | lookup → confirm → writing → done | 缺換卡/補發/退卡 |
| `settings` | 帳號 + NFC + 登出 | 缺活動切換、音效/震動/亮度、清除快取 |
| `home` 標題 | `brandRow` + `ScreenHeader` 同標題並存 | **雙標題殘留** |

---

## §8 缺口清單（四分類）

> 📌 **ID 導航**：
> - **W-ID**（W-01..W-32）定義 → `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`
> - **B-ID**（B-1a..B-8）定義 → 同上（後端章節）
> - **C-ID**（C-3..C-18）定義 → 同上；**C-15/C-16/C-17 例外**，見 `docs/research/09-feasibility-review.md`
> - **API 契約**（29 端點）→ `docs/20260915_AdminApp_API_Contract_Freeze_v1.md`

### (a) App 側可獨立施工（交 feiteng2015）

| # | 缺口 | 對應 W-ID | 證據 |
| :-: | --- | :-: | --- |
| 1 | 契約適配層 + mock 基建 | W-01 | 需先有 3 項裁決 |
| 2 | 四大功能卡首頁（補 Token / 名單 2 卡） | W-02 | `QUICK_ACTIONS` 僅 3 項 |
| 3 | 名單列表頁 | W-03 | 無 route 檔 |
| 4 | 用戶詳情頁 | W-05 | 無 route 檔 |
| 5 | EAS 初始化 | W-06 | `app.json` 無 `projectId` |
| 6 | Badge 批次資料建置 | W-07 | 無批次 UI |
| 7 | Settings 頁補完（活動切換等） | W-08 | `settings.tsx` 僅 3 區塊 |
| 8 | 契約護欄 smoke script | W-14 | 無 scripts/ |
| 9 | Badge 篩選 UI + tagUid 複製 | W-15 | service 參數已備、`expo-clipboard` 未用 |
| 10 | 簽到三態 UI 重構 | W-26 | `ERROR_MESSAGES` 僅 4 碼 |
| 11 | 音效 + 震動 + 大字狀態 | W-28 | 0 命中 |
| 12 | 權限矩陣門控 | W-30 | `userRole` 0 處 gate |
| 13 | Credential 展示適配 | W-31 | `react-native-qrcode-svg` 未用 |
| 14 | 真機 E2E | W-32 | 真機 0 |
| 15 | 補「資料空態」（overview/check-in/nfc-bind） | — | 三頁僅 `eventId` 守衛 |
| 16 | 修 `theme.ts:2` 品牌字串 | — | 仍寫 Promoter |
| 17 | 修 `home` 雙標題 | — | `brandRow` + `ScreenHeader` 重複 |
| 18 | 補測試框架 + CI | — | 0 測試、0 `.github/` |
| 19 | 補 i18n 框架（或至少元件層 a11y label 進 copy） | — | 6 處硬編中文 |
| 20 | 補 error reporting / analytics | — | 0 命中 |

### (b) 被後端 API 阻斷（等用戶本人）

| # | 缺口 | 後端項 | 影響 |
| :-: | --- | :-: | --- |
| 1 | Token 帳務層（wallet-counter 全鏈路） | **B-1a / B-1b** | W-20..W-25 / W-22b |
| 2 | 重複簽到覆核（override） | **B-2** | W-27 |
| 3 | 閘口 / 地點欄位 | **B-3** | W-27 的地點顯示 |
| 4 | `VOLUNTEER` 角色 access | **B-4** | W-30 門控前提 |
| 5 | `by-code` 限流放寬 | **B-5** | W-21 / W-26 現場可靠性 |
| 6 | `GET /registrations` 的 `search`/`sortBy`/`sortOrder` | **B-6** | W-04（名單搜尋） |
| 7 | 簽到計數端點 | **B-7** | W-29 |
| 8 | Credential 統一模型 | **B-8** | W-31 |
| 9 | 錯誤碼總表上線 | — | W-23 |

### (c) 需用戶 / PM 決策

| # | 決策 | 影響 |
| :-: | --- | --- |
| 1 | **C-14**：A0 修法（production apex origin 是否為 `linkcard.xyz`） | 部署正確性 |
| 2 | **C-15**：深色高對比（`userInterfaceStyle: light`） | 架構級（theme 需雙層） |
| 3 | **C-16**：平板 / 折疊機適配 | `breakpointNarrow` 未用 |
| 4 | **C-17**：`[eventId]/settings.tsx` 去留 | 從未存在 |
| 5 | **C-18**：批次 1 時程（2.7 週 vs 移出 buffer） | 排期 |
| 6 | **C-3**：`by-code` 限流策略 | W-21 / W-26 |
| 7 | **C-11**：B-6 是否交（名單搜尋） | W-04 |
| 8 | **C-12**：B-7 是否交（計數器） | W-29 |
| 9 | **C-13**：Credential 模型 | W-31 |
| 10 | **P1-9**：NFC 硬體到貨與可寫入性（**6 週 lead time**） | W-07 / W-32 |
| 11 | **AU-08**：是否存在 `xyz.linkcard.event_admin` 的 EAS project | W-06 |
| 12 | **AU-09**：會議「四大功能卡」是否真要求 Token + 名單並列 | W-02 |
| 13 | **AU-10**：`docs/LinkCard Event related/` 原文不在本 repo | 核對「刻意不做 vs 忘了做」 |
| 14 | 澳門 PDPA 合規（第 8/2005 號法律） | 後端 §6.5.1 |

> 📌 **C-15 / C-16 / C-17 的定義來源**：`docs/research/09-feasibility-review.md`（**不在** handoff doc 的 C-ID 清單內，故需回該文件查閱）。
> 其餘 C-3 / C-11 / C-12 / C-13 / C-14 / C-18 皆定義於 `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`。

### (d) 明確不做（OOS）

| # | 項目 | 依據 |
| :-: | --- | --- |
| 1 | org-roles / ticket-types / bank-transfers / content / polls / profile / badges 批次管理 | `PROGRESS.md`（桌面管理面，不移植） |
| 2 | Icon `trash` 對應的刪除操作 | 無任何刪除 UI |
| 3 | 後端 §6 明確不做項 | `20260915_AdminApp_Backend_TODOs.md` §6 |

---

## §9 驗證層級真實狀況

### 9.1 「只有代碼、從未在任何環境跑過」的精確清單

| # | 項目 | 為何未驗證 |
| :-: | --- | --- |
| 1 | `CameraView` / `onBarcodeScanned`（QR 掃描全鏈路） | web 無 camera |
| 2 | `writeUriToCard` → `NfcManager.requestTechnology` / `getTag` / `ndefHandler.writeNdefMessage` | 需 Android + NTAG 卡 |
| 3 | `nfcService.bind` 的**成功**分支 | staging 無 badge 資料 |
| 4 | `isNfcSupported()` 回 `true` 的分支 | web 恆 `false` |
| 5 | `tokenStorage` 的 **native 分支**（`expo-secure-store`） | 只走過 web `localStorage` |
| 6 | `badges` 分頁 `onEndReached` + `hasMore` | staging 無資料 |
| 7 | `check-in` 的 `cameraError` fallback | 需真的拒絕相機權限 |
| 8 | `overview` 統計卡在**非零**資料下的渲染 | 只驗 0→1 |
| 9 | **任何 role ≠ 最高權限的帳號** | 無門控，無從驗 |
| 10 | **任何不使用 `.env.local` 的啟動方式** | 因 A0（已修，但未重驗） |
| 11 | `EmptyState` 的 `first-use` / `filtered` 分支 | 0 呼叫端 |
| 12 | `Card` 的 `onPress` / `showChevron` 分支 | 0 呼叫端 |
| 13 | `FieldInput` 的 `error` / `multiline` 分支 | 0 呼叫端 |
| 14 | `Button` 的 `icon` / `fullWidth` 分支 | 0 呼叫端 |
| 15 | `Skeleton` 的 `animated={false}` 分支 | 0 呼叫端 |
| 16 | `InlineBanner` 的 `title` 分支 | 0 呼叫端 |
| 17 | `ScreenHeader` 的 `right` 分支 | 0 呼叫端 |
| 18 | `EmptyState` 的 `secondaryLabel` / `onSecondary` 分支 | 0 呼叫端 |
| 19 | `Logo` 的 `wordmark` / `accessibilityLabel` 分支 | 0 呼叫端 |
| 20 | `+not-found` 的實際觸發（深連結） | 未測 |
| 21 | `registrationService.getByCode` 的**成功**分支 | staging 無對應 code |
| 22 | `nfcService.lookup` 的**成功**分支 | staging 無 badge 資料 |

### 9.2 驗證層級統計

| 層級 | 數量 | 說明 |
| --- | :-: | --- |
| ✅ 代碼存在 | 35 項功能 | 全部 |
| ✅ web 實測 | 約 20 項 | 依賴 `.env.local` |
| 🟡 僅錯誤路徑 / 僅空狀態 | 4 項 | `getByCode` / `lookup` / `listBadges` / `bind` |
| ❌ 真機實測 | **0** | — |
| ❌ EAS build | **0** | 未初始化 |
| ❌ 自動化測試 | **0** | 無框架、無測試檔 |
| ❌ CI | **0** | 無 `.github/` |

---

## §10 UI/UX 與工程基建缺口

### 10.1 會議硬要求達標率

| 要求 | 現況 | 依據 |
| --- | :-: | --- |
| 按鈕最小 **48dp** | ✅ **達標** | `layout.touchMin = 48`；`layout.ctaHeight = 56` |
| 支援**戴手套**操作 | 🟡 尺寸達標，但 `layout.touchGapMin` **0 使用** | `theme.ts:158` |
| **深色高對比** | ❌ **未做** | `app.json: userInterfaceStyle: "light"` → **架構級決策 C-15** |
| 關鍵狀態**四重冗餘**（色+圖+字+音） | 🟡 **只有 3 重** | 結果卡有色 + icon + 文字；**音效 ❌、震動 ❌** |
| 首頁到核心操作 **≤ 2 次點擊** | 🟡 | home → overview(1) → check-in(2) ✅；**但 Token / 名單 / 詳情不存在** |
| 全螢幕相機 + 底部固定結果卡 | 🟡 | `CameraView flex:1` ✅；但結果卡是**取代**相機 |
| 手電筒 | ❌ | 無 `enableTorch`；`flash-on`/`flash-off` icon 已定義未用 |
| 響應式 / 平板 / 折疊機 | ❌ **零** | `grep useWindowDimensions\|Dimensions` src/ = **0 命中** |

**達標統計：✅ 1 ｜🟡 4 ｜❌ 3**

### 10.2 無障礙（A11y）

| 項目 | 現況 |
| --- | --- |
| `useFocusRing` | ✅ 5 處元件實際消費 |
| 品牌聚焦環 | ✅ 取代 Chromium UA 橘框 |
| `accessibilityRole="header"` | ✅ |
| `accessibilityLiveRegion` | ✅ danger=assertive / 其餘 polite |
| RNW `accessibilityState` 補償 | ✅ 手動補 `aria-busy`/`aria-disabled`/`aria-expanded` |
| `accessibilityLabel` 覆蓋 | ✅ 主要互動元素皆有 |
| **元件層硬編中文 a11y label** | 🟡 **6 處**（未進 copy 層） |
| **焦點管理（route 切換後 focus）** | ❌ 無 `setAccessibilityFocus` |
| **動態字級** | 🟡 有 `maxFontSizeMultiplier`，但部分 `TextInput` 無上限 |
| **螢幕閱讀器實測** | ❌ 無 |

### 10.3 工程基建

| 項目 | 現況 |
| --- | --- |
| TypeScript | ✅ `strict: true`、`@/*` alias |
| Lint | ✅ `eslint-config-expo/flat` + prettier 外掛（**0 錯誤**） |
| **Prettier config** | ❌ **不存在** → `npx prettier --check .` 報 **65 檔 warn**（因缺 config，故以 prettier **預設值**比對；非「格式錯誤」而是「未定義團隊格式」） |
| **測試框架** | ❌ **無**（0 個 `*.test.*`） |
| **CI** | ❌ **無**（無 `.github/`） |
| Git hooks | ✅ 已無假承諾（`husky`/`lint-staged` 已移除） |
| **i18n 基建** | ❌ **僅繁中、無框架**；頁面層已歸零，但**元件層仍有 6 處硬編** |
| **錯誤上報** | ❌ **無** |
| **Analytics** | ❌ **無** |
| **EAS** | ❌ **未初始化**（`app.json` 無 `extra.eas.projectId`） |
| **app icon / splash** | ❌ **仍是 Promoter 資產** |
| 環境管理 | ✅ **A0 已修**：`.env.example` 存在（含 staging 範本）；`.env.local` 已設 staging 的 API + Web origin |

---

## §11 未驗證項（需用戶確認）

| # | 項目 | 為何未驗證 | 建議確認方式 |
| :-: | --- | --- | --- |
| AU-01 | `CameraView` QR 掃描是否真能解 LinkCard 報名 QR | web 無 camera → **從未執行** | 真機（Android 優先）+ 實體 QR |
| AU-02 | NFC 寫卡能否寫入指定晶片 | 需 Android + NTAG 卡；**晶片型號未定** | 先定晶片 → 真機寫入 |
| AU-03 | `nfcService.bind` 成功分支 | 從未成功執行（staging 無 badge 資料） | 先在 staging 建 badge batch |
| AU-04 | `expo-secure-store` 真機 token 持久化 | 只走過 web `localStorage` | 真機冷啟動 + 飛航模式 |
| AU-05 | A0 是否為真缺陷 | — | ✅ **已於 2026-09-16 實測結案：A0 為真**（且已修復） |
| AU-06 | `.env.local` 是否會被 EAS 上傳 | `git check-ignore` 證實被排除 | 未實際跑 `eas build` |
| AU-07 | 後端 `getMyManagedEvents` 的 status mapping | 未追進後端 response mapping | 打一次 API 確認 |
| AU-08 | 是否存在 `xyz.linkcard.event_admin` 的 EAS project | `app.json` 無 `projectId` | 用戶確認 Expo 帳號 |
| AU-09 | 會議「四大功能卡」是否真要求 Token + 名單並列 | 只讀了 repo 內摘要 | 用戶／PM 確認 |
| AU-10 | `docs/LinkCard Event related/` 原文不在本 repo | `ls` = 不存在 | 用戶提供原文 |
| AU-11 | `assets/brand/logo-mark.svg` master | — | ✅ **已結案**：存在於姊妹 repo（Promoter） |

---

## §12 證據附錄（實際執行的指令與結果摘要）

### 12.1 基線

> ⚠️ **本附錄所有輸出皆於掃描基線 `c4101e8` 實測**（`src/` 自該 commit 起未再變動，故輸出仍有效）。
> 文件本身後續有 v1.1/v1.2/v1.3 修訂（`9f3821a` / `3b8fdbd` / 本 commit），但**皆為 docs-only，未觸及 `src/`**。

```bash
git log --oneline -13        # HEAD = c4101e8
git status --short           # (空) → clean
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l    # 38
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + | tail -1  # 5267
npx tsc --noEmit             # 0 錯誤
npx eslint .                 # 0 錯誤
```

### 12.2 死碼掃描

```bash
# copy key（逐 key grep，列出 4 個 0 命中）
for k in networkError loggedOut switchToScan appVersion; do
  grep -rn "copy\.[a-zA-Z]*\.$k\b" src/ | wc -l   # 皆 0
done

# Icon（34 name 逐一 grep，列出 11 個 0 命中）
# chevron-left/down/up, flash-on, flash-off, camera-shutter,
# copy, trash, plus, clock, hand-raised

# Service / store
grep -rn "getEventById" src/     # 0（W-13 已刪）
grep -rn "selectEvent" src/      # 0（A5 已刪）
grep -rn "SkeletonList" src/     # 1（僅註解）
grep -rn "iconStyles" src/       # 0（W-13 已刪）

# theme token
grep -rno "layout\.touchGapMin" src | wc -l      # 0
grep -rno "layout\.breakpointNarrow" src | wc -l # 0
grep -rno "radius\.none" src | wc -l             # 0

# npm 依賴
for d in expo-clipboard expo-constants expo-linking react-native-qrcode-svg; do
  grep -rn "from '$d'" src/ index.ts | wc -l   # 皆 0
done
```

### 12.3 缺陷驗證

```bash
# A0 已修
grep -n "API_BASE_URL" src/constants/config.ts
# → export const API_BASE_URL = EXPO_PUBLIC_API_URL || 'https://linkcard.xyz';  ✅ 無 /api

# A1 已修
grep -n "error\|dismissError" "src/app/(auth)/home.tsx"   # 有消費者 ✅

# A2 已修
grep -n "EventStatus" src/types/api.types.ts   # 6 值，無 REGISTRATION_OPEN/ENDED ✅

# A3 已修
grep -n "CheckInAttendeeBlock\|firstNonEmpty" "src/app/(auth)/[eventId]/check-in.tsx"  # ✅

# A4 已修
grep -n "clearEventCache" src/stores/auth.store.ts   # ✅

# A6 已歸零（頁面層）
# perl 掃 src/app/**/*.tsx 非註解 CJK = 0 ✅

# A7 已修
grep -n "WEB_BASE_URL" "src/app/(auth)/[eventId]/nfc-bind.tsx"   # ✅

# N1 已修
grep -n "requestId\|isCurrent" src/stores/event.store.ts   # ✅

# 四態
grep -rn "EmptyState" src/app/   # home / badges / overview / check-in / nfc-bind / +not-found（settings.tsx 僅註解提及）
```

---

## §13 變更記錄

| 版本 | 日期 | 變更 | 原因 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-17 | 初版（A0-A9 修復後的交接功能盤點） | Neo Loop（admin-app-debt-zero-r2）DISCOVER 交付 |
| v1.1 | 2026-09-17 | 修 VERIFY 的 18 項發現（F-01..F-18） | 獨立審查（smith，strict 93）實測 81 → 修復 |
| v1.2 | 2026-09-17 | 修 RE-VERIFY 的 5 項殘留（N-01..N-05） | 獨立複審（smith R2）實測 92.50 → 修復 |
| v1.3 | 2026-09-17 | 清 strict 殘留 Low（R3-01 + N-05 傳播） | 獨立複審（smith R3）實測 **93.75 PASS** → 補完 |

### v1.3 修復明細

| ID | 級別 | 修正 |
| :-: | :-: | --- |
| **R3-01** | 🟢 Low | §4.1 `Icon.tsx` 列「34 個中 10 個 0 使用」→ **11 個**（對齊 §4.4/§0/§6/§12.2） |
| **N-05 傳播** | 🟢 Low | §4.5 加排除聲明（3 項為偽死 W-08/W-10/W-26）；§4.8 將 `expo-clipboard`/`react-native-qrcode-svg` 由「🗑️ 真死」改為「🚫 偽死」；§0 頭條數字加真死/偽死限定 |

### v1.2 修復明細

| ID | 級別 | 修正 |
| :-: | :-: | --- |
| **N-01** | 🟠 Med | **四態算術重算**：Er 由 `7/7` → `6/7`（`+not-found` 為 ➖）；L 說明改指 `+not-found`（非 `index`）；合計 `23/28（82%）` → **`22/28（79%）`**；§0 與 §6 同步；§6 delta `+2` → **`+1`** |
| **N-02** | 🟢 Low | §4.1 `EmptyState`「4 個 props 未用」→ **3 個**（`testID` 實際已接線） |
| **N-03** | 🟢 Low | §4.1 `InlineBanner` 消費者移除 `check-in`，「7 處」→ **6 處** |
| **N-04** | 🟢 Low | §12.2 證據區塊「10 個 0 命中」→ **11 個** |
| **N-05** | 🟢 Low | §4.6 加排除聲明；§0「4 個死 theme token」註明為 **2 真死 + 2 偽死** |

### v1.1 修復明細

| ID | 級別 | 修正 |
| :-: | :-: | --- |
| **F-01** | 🔴 High | §7.1 移除 4 項與 §7.2 衝突的列（`touchGapMin`/`breakpointNarrow`/`expo-clipboard`/`react-native-qrcode-svg`）+ 加排除聲明 |
| **F-02** | 🔴 High | §7.1 再移除 3 項（`auth.loggedOut`/`checkIn.switchToScan`/`settings.appVersion`）；§7.2 改為指向 `11-app-defect-register.md` §4.2 權威 13 列 |
| **F-03** | 🔴 High | §12.1 `# 36` → `# 38` + 加註「全部輸出於 HEAD 實測」 |
| **F-04** | 🔴 High | §0「36 檔」→「**38 檔**」 |
| **F-05** | 🟡 Med | §4.2「369 行」→「**331 行**」 |
| **F-06** | 🟡 Med | §4.4「10 個」→「**11 個**」；「24 個」→「**23 個**」；§0/§6 同步 |
| **F-07** | 🟡 Med | §2 `index` 列 L `✅` → `➖` |
| **F-08** | 🟡 Med | §2.1 加分母定義（7 頁 × 4 態 = 28） |
| **F-09** | 🟡 Med | §4.6 `elevation` 改列 module-private；§6 該列改寫 |
| **F-10** | 🟡 Med | §8(c) 加 C-15/16/17 來源註 |
| **F-11** | 🟡 Med | §0 + §8 開頭加 4 條下游文件連結 |
| **F-12** | 🟢 Low | §4.1「1,589」→「**1,590**」 |
| **F-13** | 🟢 Low | §5 #9「3 命中」→「**4 命中**」 |
| **F-14** | 🟢 Low | §10.3「64 檔」→「**65 檔**」+ 措辭修正 |
| **F-15** | 🟢 Low | §0「約 25 個」→「**約 22 個**」+ 加分解 |
| **F-16** | 🟢 Low | §4.4 末句「見 §7」→ 指向 §7.2 + 權威清單 |
| **F-17** | 🟢 Low | §9.1 補 2 列（`getByCode` / `lookup` 成功分支） |
| **F-18** | 🟢 Low | §12.3 加註 `settings.tsx` 僅註解提及 |

---

**END OF FILE**
