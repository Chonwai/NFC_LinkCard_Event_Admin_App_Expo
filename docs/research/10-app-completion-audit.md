# 10 — Admin App 完成度審計（App 側）

> **讀者**：**你（專案擁有者）**——本文回答「我做到哪了 / 還缺什麼」
> **產出**：Neo Loop Engine / Edison 規劃部（architect），2026-09-16
> **基準**：`LinkCard_Event_Admin_App_Expo` @ `49f377e`（2026-09-15）、46 commits、working tree clean
> **方法**：全量實時 scan（git / grep / read_file）+ 與既有 6 份文件交叉比對。**Snapshot 快取僅供定位，所有 Critical 結論皆實測複驗。**
> **範圍**：**僅 App 側**；後端僅作契約對照
> **標記**：✅ 已驗證 ｜ 📌 規劃建議 ｜ ⚠️ 未驗證

---

## §0 執行摘要

1. **App 程式碼自 `040ebd4`（2026-09-12）起完全未變動**——4 天來只有文件。`src/` 共 **14 個 commit**（2 scaffold + 6 feat + 6 fix），全部集中在 **2026-09-12 一天**。
2. **規模**：`src/` **36 檔 / 4674 行**；route 檔 10 個 = **7 個實際畫面** + 3 個 layout。
3. **路由註冊 0 缺口**——沒有「註冊了但檔案不存在」或「檔案存在但沒註冊」。`[eventId]/settings.tsx` **在整個 git 歷史中從未存在**（非被刪除）。
4. **完成度**：畫面功能完整 **4/7**；四態覆蓋 **21/28 格（75%）**（L 6/7、E 2/7、Er 6/7 但**其中 1 個是死的**、S 7/7）。
5. **Service**：10 個方法；完整驗證 5、僅錯誤路徑 3、從未成功執行 1、死碼 1。
6. **驗證真相：真機 0、EAS build 0、自動化測試 0。** PROGRESS 的 12 項 E2E **全部是 web + Metro + staging**，且**全靠 `.env.local` 才成立**。
7. **發現 10 個既有研究未記載的缺陷（A0..A9）**，其中最關鍵：**A0 預設 API base URL 構成雙重 `/api` → 首次 build 全 404**（本輪已實測確認，非推論）。
8. **死碼／未使用合計約 48 項**（Icon 12/34、copy **11/64**、型別 3、theme export 6、token 5、npm 6、其他 6）。
   > ⚠️ **其中僅 11 項可實際清理**（見 `11-app-defect-register.md` §4.1）；其餘為**待消費資產**（W-02 / W-08 / W-15 / W-26 / W-31 的下游），**不得清理**。
9. **工程基建幾乎為零**：無測試、無 CI、無 error reporting、無 analytics、無 i18n 框架、husky **宣告但不存在**、EAS 未初始化。
10. **結論一句話**：**「骨架完成、Build 健康、驗證層級嚴重不足、且帶著 1 個 Critical 配置缺陷」**——不是半成品，但也不能宣稱「可用」。

---

## §1 我做過什麼（14 個 `src/` commit 逐條）

> ✅ 全部 14 個 commit **日期皆為 2026-09-12**（`git log --format='%h|%ad' -- src/` 實測）
> 對照：全 repo **46 commits**，其中 `src/` 14 個、`docs/` 25 個、其餘 7 個（root md / 設定）

|  #  | Hash      | 類型  | 實際做了什麼                                                                                                                                                    | 產出檔案                                                                      |
| :-: | --------- | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
|  1  | `c569f83` | chore | scaffold：Expo 結構 + `theme.ts`（自 Promoter 複製）+ `api.types.ts`                                                                                            | 全專案骨架                                                                    |
|  2  | `53bc571` | chore | **與 #1 同名同內容**（`chore: scaffold Expo app + theme + types`，實質空增量）                                                                                  | —                                                                             |
|  3  | `919cf5d` | feat  | **auth**：Login 頁 + `auth.store`（hydrate/setAuth/logout）+ `api.ts`（JWT request interceptor + terminal-auth response interceptor）+ `_layout.tsx` auth guard | `app/index.tsx`、`stores/auth.store.ts`、`services/api.ts`、`app/_layout.tsx` |
|  4  | `5292ece` | feat  | **home**：My Events 列表（`getMyManagedEvents`）+ `event.store` + `(auth)/_layout.tsx` Bottom Tabs + status badge                                               | `app/(auth)/home.tsx`、`stores/event.store.ts`、`services/event.service.ts`   |
|  5  | `40578ff` | feat  | **event**：`[eventId]` Stack layout + `overview`（統計卡 + 快速操作）+ settings tab + **check-in / nfc-bind / badges 三頁各 25 行 placeholder**                 | `[eventId]/_layout.tsx`、`overview.tsx`(185)、3 個 placeholder                |
|  6  | `f20f158` | feat  | **check-in**：`CameraView` QR 掃描 + 手動輸入 + 四相機（idle/loading/result）+ 3s auto-reset + `ERROR_MESSAGES` 映射                                            | `check-in.tsx` 25→265 行                                                      |
|  7  | `f794974` | feat  | **nfc**：`writeUriToCard` + `nfc.service`（lookup/bind）+ `BADGE_TYPES` 選擇 + iOS 不支援提示                                                                   | `nfc-bind.tsx`(263)、`services/nfc.service.ts`、`utils/nfc-utils.ts`          |
|  8  | `c076189` | feat  | **badges**：tagUid 查詢 + 庫存列表分頁（`PAGE_SIZE=20` + `onEndReached`）+ `STATUS_LABELS/STATUS_TONE`                                                          | `badges.tsx`(280)                                                             |
|  9  | `e590209` |  fix  | react-hooks pattern 對齊 Promoter + lint 全綠                                                                                                                   | 多檔                                                                          |
| 10  | `a3b7d2e` |  fix  | web-safe NFC（dynamic import + `Platform.OS==='web'` 短路）+ `ScreenHeader` 路徑 + staging env                                                                  | `utils/nfc-utils.ts`                                                          |
| 11  | `e7112af` |  fix  | Logo branding（Promoter→Event Admin）+ CORS port 對齊                                                                                                           | `Logo.tsx`、`app.json`                                                        |
| 12  | `99ace15` |  fix  | service 路徑 `/api` **prefix** + `_meta` unwrap（`getMyManagedEvents`）+ `[eventId]` tab `href: null` 隱藏                                                      | `event.service.ts`、`(auth)/_layout.tsx`                                      |
| 13  | `e647ddb` |  fix  | check-in 錯誤訊息改用 `getApiErrorCode`/`getApiErrorMessage`                                                                                                    | `check-in.tsx`                                                                |
| 14  | `040ebd4` |  fix  | overview 已報到統計改為真實 `CHECKED_IN` 查詢（移除硬編碼 0）                                                                                                   | `overview.tsx`                                                                |

> 📌 **可讀出的三件事**：
> ① **#12 的教訓被寫進 #1 的預設值裡沒被修**——#12 修的是**服務路徑**（加上 `/api` prefix），但 `config.ts` 的**預設 base URL 仍含 `/api`** → 這正是 A0 的成因（見 `11-app-defect-register.md`）。
> ② **程式碼工作量集中在 1 天**（6 個 feat）；**其餘 4 天全是文件**。
> ③ **#1/#2 是重複 commit**（同名同內容），屬歷史噪音，不影響現況。

---

## §2 頁面盤點表

### 2.1 路由註冊完整性（先排除「假缺頁」）

| 檢查                           |      結果       | 證據                                                         |
| ------------------------------ | :-------------: | ------------------------------------------------------------ |
| `[eventId]/_layout.tsx` 註冊數 |        4        | `overview` / `check-in` / `nfc-bind` / `badges`              |
| 檔案存在但未註冊               |      ❌ 無      | `find src/app/(auth)/[eventId]` = 恰好 4 畫面 + 1 layout     |
| 註冊但檔案不存在               |      ❌ 無      | 4 個 `name` 皆有對應檔                                       |
| 曾被刪除的 route 檔            |      ❌ 無      | `git log --diff-filter=D --name-only -- src/` = 空           |
| `[eventId]/settings.tsx`       | ❌ **從未存在** | `git log --all -- '.../[eventId]/settings.tsx'` = **0 命中** |
| `+not-found.tsx` / `+html.tsx` |      ❌ 無      | Expo Router 404 無自訂頁（📌 建議由 W-12 補）                |
| 殘留 placeholder               |      ❌ 無      | 3 個 placeholder 已在 #6/#7/#8 全部替換                      |

### 2.2 逐頁盤點

> 四態：**L**=loading、**E**=empty、**Er**=error、**S**=success ｜ ➖ = 不適用

| 路由                | 檔案（行數）                  | 已實作功能（關鍵符號）                                                                                                                                                      |  L  |  E  |    Er     |  S  | 驗證層級                                   | 缺口                                                                                                               |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-: | :-: | :-------: | :-: | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `/`（登入）         | `index.tsx`（215）            | `LoginScreen`、`classifyLoginError`（401/403/network/5xx/unknown）、`SESSION_NOTICE_BANNERS`、`handleLogin`、`FieldInput`×2                                                 | ✅  | ➖  |    ✅     | ✅  | ✅ web 實測（PROGRESS #1/#12）             | 無「忘記密碼」；`copy.auth.networkError`/`loggedOut` 未用                                                          |
| `/`（root）         | `_layout.tsx`（50）           | `RootLayout`、`hydrate()`、auth guard（`segments[0]==='(auth)'` 雙向 redirect）、2 個 `Stack.Screen`                                                                        | ➖  | ➖  |    ➖     | ➖  | ✅ web 實測                                | guard 僅依 `isAuthenticated`，**無 role**                                                                          |
| `/(auth)`           | `(auth)/_layout.tsx`（42）    | Tabs：`home`/`settings`；`[eventId]` 設 `href: null`                                                                                                                        | ➖  | ➖  |    ➖     | ➖  | ✅ web 實測（#3）                          | 無 `tabBarBadge`、無自訂 a11y label                                                                                |
| `/(auth)/home`      | `home.tsx`（240）             | `HomeScreen`、`loadEvents`、`onRefresh`、`renderEvent`、`STATUS_TONE`(L18-26)、`STATUS_LABEL`(L28-35)、`Skeleton`×3、`EmptyState`                                           | ✅  | ✅  | ❌ **死** | ✅  | ✅ web 實測（#2）                          | **錯誤橫幅永不顯示**（A1）；**缺 `ARCHIVED` label/tone**（A2）                                                     |
| `/(auth)/settings`  | `settings.tsx`（**40**）      | **僅 3 項**：`user.email` 文字、`copy.app.name + copy.app.version`、`logout` 按鈕 + `ScreenHeader`                                                                          | ❌  | ➖  |    ❌     | ✅  | ✅ web 實測（#11）                         | **無 NFC 狀態檢查**（`copy.settings.nfcStatus/nfcSupported` 已定義未用）、無活動切換、無音效/震動/亮度、無清除快取 |
| `/(auth)/[eventId]` | `[eventId]/_layout.tsx`（19） | `EventLayout`、4 個 `Stack.Screen`                                                                                                                                          | ➖  | ➖  |    ➖     | ➖  | ✅ web 實測                                | —                                                                                                                  |
| `…/overview`        | `overview.tsx`（185）         | `EventOverviewScreen`、`Promise.all` 2 次 `getRegistrations`（total + `status:'CHECKED_IN'`）、`StatItem`×3、`QUICK_ACTIONS`(L31，**3 張卡**)                               | ✅  | ❌  |    ✅     | ✅  | ✅ web 實測（#4/#8）                       | **空狀態 ❌**；快速操作**缺 Token / 名單 2 張卡**；`?? fallback`（A8）                                             |
| `…/check-in`        | `check-in.tsx`（265）         | `CheckInScreen`、`CheckInState`（idle/loading/result）、`onBarcodeScanned`、`doCheckIn`、3s `resetTimer`、`ERROR_MESSAGES`（4 碼）、camera fallback                         | ✅  | ❌  |    ✅     | ✅  | ✅ web 實測（手動 3 態）；**QR ❌ 無真機** | 無手電筒（`flash-*` 未用）、無音效/震動、**`checkIn` 回傳值完全未使用**（A3）、無閘口、無主管覆核、無現場補報名    |
| `…/nfc-bind`        | `nfc-bind.tsx`（263）         | `NfcBindScreen`、`FlowState`（lookup/…/done）、`lookup`、`writeAndBind`、`BADGE_TYPES`(L37-39)、`isNfcSupported`/`startNfc`/`writeUriToCard`/`normalizeTagUid`、iOS `Alert` | ✅  | ❌  |    ✅     | ✅  | 🟡 web 只驗「顯示不支援」；**真機 ❌ 0**   | 無換卡/補發/退卡；`payloadUrl` 硬編 prod 域名（A7）；8 處硬編中文（A6）                                            |
| `…/badges`          | `badges.tsx`（280）           | `BadgesScreen`、`lookup`、`listBadges` 分頁、`STATUS_LABELS/STATUS_TONE`、`Skeleton`×2、`EmptyState`、`ListFooterComponent`                                                 | ✅  | ✅  |    ✅     | ✅  | 🟡 web 只驗空狀態（#9）；分頁/多狀態 ❌    | 無 `batchId`/`status` 篩選 UI（service 參數已備）、無批次建立、無匯出、無 void/補發；**11 行**硬編中文（A6）       |

### 2.3 四態總計

|   狀態   |       覆蓋       | 說明                                                                                                                                                   |
| :------: | :--------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  **L**   |     **6/7**      | 缺 `settings`                                                                                                                                          |
|  **E**   |     **2/7**      | 缺 `overview` / `check-in` / `nfc-bind`（`index` / `settings` 為 ➖ 不適用）；✅ 僅 `home`（`EmptyState`）與 `badges`——`grep EmptyState src/app/` 實測 |
|  **Er**  |     **6/7**      | ⚠️ `home` **表面有、實際死**（A1）                                                                                                                     |
|  **S**   |     **7/7**      | —                                                                                                                                                      |
| **合計** | **21/28（75%）** | 📌 由 **W-12** 補齊                                                                                                                                    |

### 2.4 Spec 有列但從未實作的頁面

| 頁面                     | 出處                                                             |      狀態       | 裁決                                                                                                   |
| ------------------------ | ---------------------------------------------------------------- | :-------------: | ------------------------------------------------------------------------------------------------------ |
| `[eventId]/settings.tsx` | Engineering Spec §4/§7；`research/01` §1；`06-feature-list` P-06 | ❌ **從未存在** | 📌 **非缺陷**（從未存在 ≠ 退化）。其去留為 **C-17**；W-08 只涵蓋 `(auth)/settings.tsx`，**不涵蓋本頁** |

---

## §3 Service 層盤點表

### 3.1 `api.ts` interceptor

| 項目                 | 實作                                                                                                              | 位置                                        |                         判定                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | :--------------------------------------------------: |
| `apiClient`          | `axios.create` + `baseURL: API_BASE_URL` + `timeout 15000` + JSON header                                          | `services/api.ts`                           |                          ✅                          |
| Request interceptor  | `tokenStorage.getItem(TOKEN_STORAGE_KEY)` → `Authorization: Bearer`                                               | 同上                                        |                          ✅                          |
| Response interceptor | `isLoginRequest` 豁免；`getTerminalAuthReason` → `setSessionNotice` + `auth.logout()`；`alreadyTerminated` 防重複 | 同上                                        |                     ✅ 邏輯完整                      |
| 401 處理             | 一律 `'expired'`                                                                                                  | `utils/api-error.ts: getTerminalAuthReason` | 🟡 過寬：`/nfc/lookup` 是公開端點，若回 401 會誤登出 |
| 5xx / network        | 不觸發登出                                                                                                        | 同上                                        |                          ✅                          |
| **`/api` 前綴**      | service 路徑已含 `/api`，而預設 `API_BASE_URL` 也含 `/api`                                                        | `constants/config.ts:10` × 各 service       |                🔴 **雙重前綴（A0）**                 |

### 3.2 逐方法

> 服務檔共 **5 個**（`api.ts` + 4 個領域 service）／**10 個方法**

| Service               | 方法                 | 端點                                                | 被誰呼叫                                       |                已驗證可用                |
| --------------------- | -------------------- | --------------------------------------------------- | ---------------------------------------------- | :--------------------------------------: |
| `authService`         | `login`              | `POST /api/auth/login`                              | `app/index.tsx: handleLogin`                   |               ✅ web 實測                |
| `authService`         | `me`                 | `GET /api/users/me`                                 | `stores/auth.store.ts: hydrate`（動態 import） |         ✅ web 實測（#12 guard）         |
| `eventService`        | `getMyManagedEvents` | `GET /api/v1/events/my-managed`                     | `stores/event.store.ts:27`                     |            ✅ web 實測（#2）             |
| `eventService`        | **`getEventById`**   | `GET /api/v1/events/by-id/:eventId`                 | **無（0 call site）**                          |             ❌ **dead code**             |
| `eventService`        | `getRegistrations`   | `GET /api/v1/events/:eventId/registrations`         | `overview.tsx`（`limit:1` ×2）                 |            ✅ web 實測（#8）             |
| `registrationService` | `getByCode`          | `GET …/registrations/by-code/:code`                 | `nfc-bind.tsx`                                 |        🟡 web 實測**僅錯誤路徑**         |
| `registrationService` | `checkIn`            | `POST …/registrations/checkin`                      | `check-in.tsx:62`                              |        ✅ web 實測 3 態（#5/6/7）        |
| `nfcService`          | `lookup`             | `GET …/nfc/lookup?uid=\|qr=`                        | `badges.tsx`                                   |              🟡 僅錯誤路徑               |
| `nfcService`          | `listBadges`         | `GET …/nfc/badges?page&pageSize&status&batchId&all` | `badges.tsx`                                   | 🟡 **僅空狀態**（staging 無 badge 資料） |
| `nfcService`          | `bind`               | `POST …/nfc/bind`                                   | `nfc-bind.tsx`                                 |   ❌ **從未成功執行**（真機 0 + 無卡）   |

### 3.3 契約偏差：`EventStatus`

| 位置                                | 值域                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| App `types/api.types.ts:43-49`      | `DRAFT \| PUBLISHED \| REGISTRATION_OPEN \| ONGOING \| ENDED \| CANCELLED` |
| 後端 `prisma/schema.prisma:289-296` | `DRAFT \| PUBLISHED \| ONGOING \| COMPLETED \| CANCELLED \| ARCHIVED`      |

- App **幻覺 2 值**（`REGISTRATION_OPEN` / `ENDED`，後端全 repo `grep` = 0）
- App **缺 1 值**（`ARCHIVED`）→ `home.tsx` 的 `STATUS_LABEL`(L28-35) 無此鍵 → 該活動顯示**原始英文**
- 📌 處置：**W-01 第 4 處漂移（D-4）**

---

## §4 UI 元件與工具盤點表

### 4.1 `src/components/ui/`（10 檔 / 1634 行）

| 檔案               | 行數 | 被誰使用                                                    | 判定                                                                                                                                                                                                  |
| ------------------ | :--: | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button.tsx`       | 154  | **5 處**（index / settings / check-in / nfc-bind / badges） | 🟡 4 個 props 未用（`icon` / `fullWidth` / `accessibilityHint` / `testID`）；`icon` 是唯一能放圖示的入口 → **6 個 icon 因此成死碼**                                                                   |
| `Card.tsx`         | 136  | **2 處**（index / overview）                                | 🟡 7 個 props 未用（`tone='sunken'` / `showChevron` / `onPress` / `onLayout` / `accessibilityState` / `accessibilityHint` / `testID`）→ **互動式卡片從未啟用**，這是 4 個 `chevron-*` icon 死掉的根因 |
| `EmptyState.tsx`   | 163  | **2 處**（home / badges）                                   | 🟡 6 個 props 未用（`kind` / `secondaryLabel` / `onSecondary` / `headingLevel` / `compact` / `testID`）→ **三種語氣分流（first-use/no-results/filtered）與次要 CTA 全未落地**                         |
| `FieldInput.tsx`   | 245  | **1 處**（index）                                           | 🟡 4 個 props 未用（`error` / `multiline` / `onFocus` / `inputRef`）→ **錯誤顯示與捲動修正能力存在但未接線**                                                                                          |
| `Icon.tsx`         | 258  | **6 處**                                                    | 🟡 `IconName` 34 個中 **12 個 0 使用**；`iconStyles`（L255）**無外部消費者**                                                                                                                          |
| `InlineBanner.tsx` | 173  | **5 處**                                                    | 🟡 4 個 props 未用（`title` / `dismissible` / `onDismiss` / `testID`）→ **可關閉橫幅能力存在但未啟用**                                                                                                |
| `Logo.tsx`         | 104  | **2 處**                                                    | 🟡 3 個 props 未用（`wordmark` / `accessibilityLabel` / `testID`）                                                                                                                                    |
| `ScreenHeader.tsx` | 174  | **6 處**                                                    | 🟡 `right`（右側動作槽）未用 → **「+ 新增批次」類入口無處可放**；`testID` 未用                                                                                                                        |
| `Skeleton.tsx`     | 132  | **3 處（僅 `Skeleton`）**                                   | 🟡 **`SkeletonList` 完全未被使用**                                                                                                                                                                    |
| `useFocusRing.ts`  |  95  | **5 處**                                                    | ✅ 全數消費                                                                                                                                                                                           |

> 📌 **一句話**：**10 個元件全部有被 import（0 個孤兒），但合計約 30 個已實作 props 從未被使用。** 這不是死碼，是**未接線的能力儲備**——正是 W-02/W-03/W-12/W-26 的施工面。

### 4.2 `src/utils/`（5 檔 / 262 行）

| 檔案                | 行數  | export 使用情形                                                     |                        判定                         |
| ------------------- | :---: | ------------------------------------------------------------------- | :-------------------------------------------------: |
| `api-error.ts`      |  95   | 7 個 export 中 6 個有外部消費者；`asApiError` 僅內部                |           ✅ 使用中（🟡 A9 逾時分類過窄）           |
| `nfc-utils.ts`      |  81   | 4 個各 2 處；**`buildUriNdefMessage` 外部 0**                       | 🟡 exported 但無外部消費者（可降為 module-private） |
| `session-notice.ts` |  44   | `setSessionNotice`/`clearSessionNotice`/`useSessionNotice` 有消費者 |                         ✅                          |
| `storage.ts`        |  40   | `tokenStorage` **4 處**                                             |                         ✅                          |
| `validation.ts`     | **2** | `isValidEmail`（index）                                             |          ✅ 但**全 App 只有 1 個驗證函式**          |

### 4.3 `src/constants/`（3 檔 / 773 行）

| 檔案            |  行數   | 判定                                                                                                                        |
| --------------- | :-----: | --------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`     |   15    | 🔴 預設值構成雙重 `/api`（**A0**）；🟡 **無 Promoter 的 fail-closed guard**；🟡 **Repo 無 `.env.example`**                  |
| `copy.zh-TW.ts` |   88    | 🟡 **64 個 key 中 11 個從未被消費**                                                                                         |
| `theme.ts`      | **670** | 🟡 佔 constants 的 87%；**檔頭第 2 行仍寫 `LinkCard Promoter App`**；**6 個 export 未被外部 import**；**5 個 token 0 使用** |

### 4.4 死 Icon（`IconName` 34 個，12 個 0 使用）

| 死 icon                      | 對應的未接線能力                                                | 將由誰消費  |
| ---------------------------- | --------------------------------------------------------------- | ----------- |
| `chevron-left/right/down/up` | `Card` 的 `showChevron` 未啟用 → 清單項展開/導引                | W-03 / W-15 |
| `flash-on` / `flash-off`     | **check-in 手電筒**（會議 §四 #3 明確要求）                     | **W-26**    |
| `camera-shutter`             | 手動拍照簽到                                                    | —（P2）     |
| `copy`                       | tagUid／activationToken 複製（`expo-clipboard` 依賴同在但未用） | **W-15**    |
| `trash`                      | 刪除操作（無任何刪除 UI）                                       | —（OOS）    |
| `plus`                       | 「新增」入口（配合 `ScreenHeader.right` 亦未啟用）              | **W-02**    |
| `clock`                      | 時間歷程（簽到時間戳）                                          | **W-26**    |
| `hand-raised`                | 現場人員詢問/呼叫督導                                           | —（P1）     |

> ✅ **使用中的 22 個**：`home`、`camera`、`archive`、`users`、`cog`、`close`、`check`、`arrow-left`、`nfc`、`clipboard-check`、`refresh`、`alert-triangle`、`search`、`filter`、`pencil`、`qr-code`、`check-circle`、`x-circle`、`alert-circle`、`information-circle`、`empty-card`、`logo-mark`
> 📌 **裁決：這 12 個不得刪除**（9 個有明確下游客戶）。詳見 `11-app-defect-register.md` §4.2。

### 4.5 死 copy key（11 個，逐 key grep = 0）

| Key                                       | 計畫中用途（未實作即證據）                 | 將由誰消費                       |
| ----------------------------------------- | ------------------------------------------ | -------------------------------- |
| `auth.networkError`                       | 與 `auth.errorNetwork` 重複                | W-11（併入 `errorNetwork` 或刪） |
| `auth.loggedOut`                          | **登出成功提示從未顯示**                   | W-08 / W-10                      |
| `checkIn.switchToScan`                    | 只有 `switchToManual` 被使用               | W-26                             |
| `checkIn.attendeeName/Email/Company/Type` | **簽到詳情卡四欄**（會議模組 A「有效」態） | **W-26**                         |
| `checkIn.resultTitle`                     | 結果卡標題                                 | **W-26**                         |
| `settings.appVersion`                     | 設定頁用了內嵌 `copy.app.version`          | W-08                             |
| `settings.nfcStatus` / `nfcSupported`     | **設定頁的 NFC 狀態檢查**（Spec §5.7）     | **W-08**                         |

### 4.6 死 theme export / token

| 項目                          | 位置               | 外部使用 | 判定                                                                             |
| ----------------------------- | ------------------ | :------: | -------------------------------------------------------------------------------- |
| `primitive`                   | `theme.ts:23`      |    0     | 🗑️ 設計上 Layer 1 不外流（可接受）                                               |
| `fontFamily`                  | `theme.ts:195`     |    0     | 🗑️ dead export                                                                   |
| `elevation`                   | `theme.ts:333`     |    0     | 🗑️ dead export                                                                   |
| `metaText`                    | `theme.ts:654`     |    0     | 🗑️ **`home.tsx`/`badges.tsx` 各自重寫**                                          |
| `theme` / `default`           | `theme.ts:656/670` | 0 import | 🗑️ 整包集合物件無人使用                                                          |
| `radius.none`                 | `theme.ts:142`     |    0     | 🗑️                                                                               |
| `layout.buttonHeightSm`       | `theme.ts:159`     |    0     | 🗑️                                                                               |
| **`layout.touchGapMin`**      | `theme.ts:161`     |    0     | 🗑️ **會議要求「相鄰觸控目標間距」，token 已備未用**                              |
| `layout.iconBox`              | `theme.ts:163`     |    0     | 🗑️                                                                               |
| **`layout.breakpointNarrow`** | `theme.ts:180`     |    0     | 🗑️ **響應式斷點 token 存在，但全 App 無任何 `Dimensions`/`useWindowDimensions`** |

### 4.7 死型別

| 型別               |         外部使用          | 判定                                                | 處置                                                             |
| ------------------ | :-----------------------: | --------------------------------------------------- | ---------------------------------------------------------------- |
| `ApiErrorEnvelope` |             0             | 🗑️（`api-error.ts` 另立 `ApiErrorShape`，兩者並存） | W-13 清                                                          |
| `EventStatus`      | 0（僅自用）且**值域不符** | 🗑️                                                  | **W-01（D-4）修值域**，不刪                                      |
| `CheckInResult`    |           **0**           | 🗑️                                                  | **W-26 消費**（`checkedInAt`/`alreadyCheckedIn` 目前無 UI 承接） |

### 4.8 未使用 npm 依賴

| 依賴                                                                    | 判定                                               | 處置                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `expo-clipboard`                                                        | **真死**                                           | **W-15 消費**（tagUid 複製）                     |
| `react-native-qrcode-svg`                                               | **真死**                                           | **W-31 消費**（Credential QR）                   |
| `expo-constants` / `expo-device` / `expo-image-picker` / `expo-linking` | **真死**                                           | W-13 清（或 W-12 用 `expo-device` 顯示裝置資訊） |
| `react-native-nfc-manager`                                              | **非死**（`utils/nfc-utils.ts` 的 dynamic import） | 保留                                             |

---

## §5 功能旅程盤點（9 條）

|  #  | 旅程                         |                 判定                 | 走到哪 / 卡在哪                                                                                                                                                                                                                                    |
| :-: | ---------------------------- | :----------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | 登入 → 選活動 → 首頁         |            ✅ **走得通**             | `handleLogin` → `setAuth` → `/(auth)/home` → `selectEvent` + `push('…/overview')`。**缺**：無「記住我」、無 token 續期、hydrate 期間無 splash 遮罩                                                                                                 |
|  2  | 掃碼簽到（QR + 手動 + 三態） | 🟡 **手動走得通；QR 未驗；只有二態** | 手動 ✅ web 3 態。**卡點**：① `CameraView` **從未在任何環境執行**（web 無 camera）；② 會議要三態＝有效/重複/**無效→現場補報名**，App 只做 error banner；③ **有效態不顯示姓名/公司/票種/Token**（回傳值被丟棄）；④ 無音效/震動/手電筒/計數/閘口     |
|  3  | NFC 寫卡 / 綁定              |    ❌ **走不通（從未成功執行）**     | 程式碼全在：`isNfcSupported` → `startNfc` → `writeUriToCard` → `bind`。**卡在**：① 真機 0（需 Android + NTAG）；② iOS 直接 `Alert` 阻擋；③ `payloadUrl` **硬編 prod 域名**；④ 無換卡/補發/退卡；⑤ **支援晶片型號未定義**（會議 §六 #4 仍無 owner） |
|  4  | Badge 查詢                   |      🟡 **走得通但只驗空狀態**       | `doLookup` + `loadList`。**卡在**：① staging 4 活動皆無 badge 資料 → 命中/分頁/多狀態**從未驗證**；② 無 `status`/`batchId` 篩選 UI；③ 無批次建立/匯出                                                                                              |
|  5  | 名單查詢                     |            ❌ **不存在**             | **無 route 檔**。`getRegistrations` 僅被 overview 用來取 `pagination.total`（`limit:1`），**從未取實際名單**。後端亦無 name/email search 參數                                                                                                      |
|  6  | Token 操作（增/扣/流水）     |            ❌ **不存在**             | **無 route / service / copy key / icon**。後端 6 端點亦未實作（`09` B-1）                                                                                                                                                                          |
|  7  | 用戶詳情                     |            ❌ **不存在**             | 無 route 檔。`Registration` 型別有 `profile.*` 與 `customFields`，**無任何畫面渲染**                                                                                                                                                               |
|  8  | 設定 / 登出 / 活動切換       |          🟡 **登出走得通**           | `logout` ✅。**卡在**：① **無活動切換 UI**；② **無 NFC 狀態檢查**；③ 無音效/震動/亮度；④ `[eventId]/settings.tsx` **從未存在**；⑤ **登出不清 `event.store`**（A4）→ 換帳號會看到前一帳號的活動殘留                                                 |
|  9  | 權限門控（角色差異）         |          ❌ **完全不存在**           | `grep userRole src/` = **3 命中，全是型別映射與顯示字串**（`api.types.ts:57`、`event.service.ts:32`、`home.tsx:100/104`），**零處用於 gate 任何功能** → **所有頁面對所有角色完全開放**（VOLUNTEER 也能寫卡、也能看統計）                           |

---

## §6 完成度量化

### 6.1 程式碼規模

| 目錄             |      檔數       |   行數   |         佔比          |
| ---------------- | :-------------: | :------: | :-------------------: |
| `src/app`        |       10        |   1599   |          34%          |
| `src/components` |       10        |   1634   |          35%          |
| `src/constants`  |        3        |   773    | 17%（`theme.ts` 670） |
| `src/utils`      |        5        |   262    |          6%           |
| `src/services`   |        5        |   205    |          4%           |
| `src/stores`     |        2        |   106    |          2%           |
| `src/types`      |        1        |    95    |          2%           |
| `src/hooks`      | **0（不存在）** |    0     |           —           |
| **合計**         |     **36**      | **4674** |         100%          |

### 6.2 完成度指標

| 面向                 |       數值        | 說明                                                                                                                                      |
| -------------------- | :---------------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **畫面功能完整**     |  **4/7（57%）**   | login / home / overview / badges（`check-in` 因 QR 未驗列部分）                                                                           |
| **四態覆蓋**         | **21/28（75%）**  | L 6/7、E 2/7、Er 6/7（1 個死）、S 7/7；E 的 ✅ 僅 `home` 與 `badges`（`grep EmptyState src/app/` 實測）                                   |
| **Service 完整驗證** |  **5/10（50%）**  | 僅錯誤路徑 3、從未成功 1、死碼 1                                                                                                          |
| **UI 元件有被使用**  | **10/10（100%）** | 但 **約 30 個 props 未接線**                                                                                                              |
| **Icon 使用率**      | **22/34（65%）**  | 死 35%                                                                                                                                    |
| **copy key 使用率**  | **53/64（83%）**  | 死 **11**（實測：eval `copy` 物件得 64 leaf、逐 key grep 得 11 dead；`53 + 11 = 64` ✓）                                                   |
| **npm 依賴使用率**   |   **真死 6 個**   | `nfc-manager` 為 dynamic import（非死）                                                                                                   |
| **死碼／未使用合計** |   **約 48 項**    | icon 12 + copy **11** + 型別 3 + theme export 6 + token 5 + npm 6 + 其他 6；**其中僅 11 項可實際清理（見 doc11 §4.1）**，其餘為待消費資產 |
| **Build 健康**       |        ✅         | `tsc --noEmit` strict、`eslint` 全綠（2026-09-14 實測）                                                                                   |
| **web E2E**          |     **12 項**     | **全依賴 `.env.local`**                                                                                                                   |
| **真機驗證**         |       **0**       | —                                                                                                                                         |
| **EAS build**        |       **0**       | 未初始化                                                                                                                                  |
| **自動化測試**       |       **0**       | 無框架、無測試檔                                                                                                                          |
| **CI**               |       **0**       | 無 `.github/`                                                                                                                             |
| **i18n**             |   **手寫常數**    | 無框架、無 locale 切換、且有 **26 行（4 檔）**繞過 copy 層（A6；排除 `//`／`/* */`／`{/* */}` 註解）                                      |
| **可觀測性**         |       **0**       | 無 error reporting、無 analytics                                                                                                          |

### 6.3 會議硬要求達標率

| 要求                                |                      現況                       | 依據                                                                                        |
| ----------------------------------- | :---------------------------------------------: | ------------------------------------------------------------------------------------------- |
| 按鈕最小 **48dp**                   |                   ✅ **達標**                   | `layout.touchMin = 48`；`Button` `minHeight`；`ScreenHeader.iconButton` 48×48 + `hitSlop`   |
| 支援**戴手套**操作                  | 🟡 尺寸達標，但 `layout.touchGapMin` **0 使用** | `theme.ts:161`                                                                              |
| **深色高對比**                      |                   ❌ **未做**                   | `app.json: userInterfaceStyle: "light"`；theme 僅單一淺色 semantic 層 → **架構級決策 C-15** |
| 關鍵狀態**四重冗餘**（色+圖+字+音） |                🟡 **只有 3 重**                 | result 有色 + icon + 文字；**音效 ❌、震動 ❌**                                             |
| 首頁到核心操作 **≤ 2 次點擊**       |                       🟡                        | home → overview(1) → check-in(2) ✅；**但 Token / 名單 / 詳情不存在**                       |
| 全螢幕相機 + 底部固定結果卡         |                       🟡                        | `CameraView flex:1` ✅；但 result 卡是**取代**相機（結果時相機 unmount）                    |
| 手電筒                              |                       ❌                        | 無 `enableTorch`；`flash-on`/`flash-off` icon 已定義未用                                    |
| 響應式 / 平板 / 折疊機              |                    ❌ **零**                    | `grep useWindowDimensions\|Dimensions` src/ = **0 命中**                                    |

**達標統計：✅ 1 ｜🟡 4 ｜❌ 3**

### 6.4 無障礙（A11y）

| 項目                               | 現況                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `useFocusRing`                     | ✅ 5 處元件實際消費                                                                       |
| 品牌聚焦環                         | ✅ 取代 Chromium UA 橘框                                                                  |
| `accessibilityRole="header"`       | ✅                                                                                        |
| `accessibilityLiveRegion`          | ✅ danger=assertive / 其餘 polite                                                         |
| RNW `accessibilityState` 補償      | ✅ 手動補 `aria-busy`/`aria-disabled`/`aria-expanded`                                     |
| `accessibilityLabel` 覆蓋          | ✅ 主要互動元素皆有                                                                       |
| **焦點管理（route 切換後 focus）** | ❌ 無 `setAccessibilityFocus`                                                             |
| **動態字級**                       | 🟡 15 處有 `maxFontSizeMultiplier`，但 check-in/nfc-bind/badges 的 `TextInput` **無上限** |
| **螢幕閱讀器實測**                 | ❌ 無                                                                                     |

---

## §7 未驗證項（AU-01..AU-11）

> 📌 **命名說明**：本清單使用 **`AU-`（App Unverified）前綴**，以**避免與 `09-feasibility-review.md` / 契約文件的 `U-1..U-6` 碰撞**（兩者用途不同：`U-` 為契約/後端面向，`AU-` 為 App 完成度面向）。
> ⚠️ **已知衝突澄清**：`09` 的 **U-5** = 「`by-code` 路由是否已解析 `req.user`」；本清單的 **AU-05** = 「A0 是否為真缺陷」。**兩者不同**，勿混用。
> 🔴 **另一個前綴碰撞（本次新增）——`A-` 有兩個所指**：
>
> - 本文與 `11-app-defect-register.md` 的 **`A0..A9` = App 缺陷**（本輪新發現的 10 個）
> - `06-feature-list.md` 的 **`A1..A4` = 功能差異分類**（A1 已有完整資產 / A2 已有骨架需增強 / A3 全新開發 / A4 明確不做）——**這是完全不同的清單**
>   → **看到 `A2` 請先確認是哪一份文件**。完整代號表見本文 **§8.1**。
>   |     #     | 項目                                                                      | 為何未驗證                                                                      |                                                                                       狀態                                                                                        |
>   | :-------: | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
>   | **AU-01** | `CameraView` QR 掃描是否真能解 LinkCard 報名 QR                           | web 無 camera → **從未執行**                                                    |                                                                        ⚠️ 需真機（Android 優先）+ 實體 QR                                                                         |
>   | **AU-02** | NFC 寫卡能否寫入指定晶片                                                  | 需 Android + NTAG 卡；**晶片型號未定**（會議 §六 #4 無 owner）                  |                                                                              ⚠️ 先定晶片 → 真機寫入                                                                               |
>   | **AU-03** | `nfcService.bind` 成功分支                                                | 從未成功執行（staging 無 badge 資料）                                           |                                                                             ⚠️ 先在 staging 建 batch                                                                              |
>   | **AU-04** | `expo-secure-store` 真機 token 持久化                                     | 只走過 web `localStorage` 路徑                                                  |                                                                             ⚠️ 真機冷啟動 + 飛航模式                                                                              |
>   | **AU-05** | **A0 是否為真缺陷**                                                       | —                                                                               | ✅ **已於 2026-09-16 實測結案：A0 為真**（後端路由掛載 + Promoter `.env.example` 明文 + axios `combineURLs`）。殘餘：production apex origin 是否為 `linkcard.xyz` → **C-14 子項** |
>   | **AU-06** | `.env.local` 是否會被 EAS 上傳                                            | `git check-ignore` 證實被排除；**無 `.easignore`** → 推論不上傳                 |                                                                  ⚠️ 未實際跑 `eas build`（且 A0 未修前不建議跑）                                                                  |
>   | **AU-07** | 後端是否有其他機制提供 `REGISTRATION_OPEN`/`ENDED`（如 response mapping） | 只查了 `schema.prisma` 與 routes，**未追進 `EventService` 的 response mapping** |                                                               ⚠️ 待確認 `getMyManagedEvents` 回傳 `status` 的實際值                                                               |
>   | **AU-08** | 是否存在 `xyz.linkcard.event_admin` 的 EAS project                        | `app.json` 無 `projectId`                                                       |                                                                          ⚠️ 用戶確認 Expo 帳號內是否已建                                                                          |
>   | **AU-09** | 會議「四大功能卡」是否真要求 Token + 名單並列為首頁卡                     | 只讀了 repo 內摘要                                                              |                                                                                 ⚠️ 用戶／PM 確認                                                                                  |
>   | **AU-10** | `docs/LinkCard Event related/` 系列**原文不在本 repo**                    | `ls` = 不存在；`PROGRESS.md` 引用 `../../docs/LinkCard Event related/…`         |                                                                    ⚠️ 用戶提供原文以核對「刻意不做 vs 忘了做」                                                                    |
>   | **AU-11** | `assets/brand/logo-mark.svg` master 是否存在                              | 只在 `Icon.tsx` 註解中被引用                                                    |                      ✅ **已結案**：該檔**存在於姊妹 repo** `LinkCard_Promoter_App_Expo/assets/brand/logo-mark.svg`；本 repo 未納入 → **W-31 需要時再複製**                       |

### 7.1 「代碼在、但從未在任何環境跑過」的精確清單

1. `CameraView` / `onBarcodeScanned`（QR 掃描全鏈路）
2. `writeUriToCard` → `NfcManager.requestTechnology` / `getTag` / `ndefHandler.writeNdefMessage`（真機寫卡）
3. `nfcService.bind` 的**成功**分支
4. `isNfcSupported()` 回 `true` 的分支（web 恆 `false`）
5. `tokenStorage` 的 **native 分支**（`expo-secure-store`）
6. `badges` 分頁 `onEndReached` + `hasMore`
7. `check-in` 的 `cameraError` fallback（需真的拒絕相機權限）
8. `overview` 統計卡在**非零**資料下的渲染（#8 只驗 0→1）
9. **任何 role ≠ 最高權限的帳號**（無門控，無從驗）
10. **任何不使用 `.env.local` 的啟動方式**（因 A0 → 全 404）

---

## §8 相關文件索引

| 文件                                                                 | 用途                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| **本文 `10-app-completion-audit.md`**                                | **你（擁有者）**：完成度與缺口                       |
| **`11-app-defect-register.md`**                                      | **feiteng2015**：10 個缺陷 + 死碼清單 + 修復優先序   |
| `20260915_AdminApp_Handoff_for_feiteng2015.md`                       | 施工計畫（**30 W-ID** × 3 批次 + W-09..W-15）        |
| `20260915_AdminApp_API_Contract_Freeze_v1.md`                        | 雙方共同真相（29 端點 + 錯誤碼 + 權限矩陣）          |
| `research/09-feasibility-review.md`                                  | 可行性複審（5 阻斷項 B-1..B-5 + 決策 **C-1..C-18**） |
| `research/01-completion-audit.md` / `02-verification-gaps.md`        | 舊版審計（2026-09-14）                               |
| `20260914_AdminApp_Meeting_Requirements.md`                          | 需求來源（本 repo 可讀版）                           |
| `PROGRESS.md`                                                        | 進度記錄（已於 2026-09-16 同步為 **30 W-ID**）       |
| `LinkCard_ExpressJS_Backend/docs/20260915_AdminApp_Backend_TODOs.md` | 後端施工清單（B-1..B-8）                             |

---

## §8.1 代號表（Glossary）

> 本 repo 的 `docs/` 用**不同前綴**區分不同清單。**若你看到 `A2`，請先確認是哪一份文件**：

| 代號                   | 含義                                  | 定義位置                                                                                |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| **W-ID**（W-01..W-33） | **工作項**（施工單元）                | `20260915_AdminApp_Handoff_for_feiteng2015.md` §4                                       |
| **B-ID**（B-1..B-8）   | **後端施工項**                        | `LinkCard_ExpressJS_Backend/docs/20260915_AdminApp_Backend_TODOs.md`                    |
| **C-ID**（C-1..C-18）  | **待裁決項**                          | 契約文件 §6 / 本文 §9 引用的 `09` §11                                                   |
| **D-n**（D-1..D-4）    | **契約漂移**（文件 vs 後端實作）      | handoff §5.1                                                                            |
| **A0..A9**             | **App 缺陷**（本文與 doc11 使用）     | `11-app-defect-register.md` §2                                                          |
| **A1..A4**             | ⚠️ **功能差異分類**（**不同清單！**） | `06-feature-list.md`（A1 已有完整資產 / A2 已有骨架需增強 / A3 全新開發 / A4 明確不做） |
| **AU-01..AU-11**       | **App 未驗證項**（本輪）              | 本文 §7                                                                                 |
| **U-1..U-6**           | **契約/後端未驗證項**（不同清單）     | `09-feasibility-review.md` §12 / 契約 §2.G                                              |
| **W0**                 | **移交前準備週**（用戶負責）          | handoff §4.1b                                                                           |

---

## §9 變更記錄

| 版本    | 日期       | 變更                                                                                                                                                                                                                                                                                                                                                                     | 原因                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| v1.0    | 2026-09-16 | 初版（DISCOVER 深度盤點 + PLAN 對接裁決）                                                                                                                                                                                                                                                                                                                                | Neo Loop（admin-app-completion-audit）   |
| v1.0-r1 | 2026-09-16 | ① **copy 指標修正**：74 → **64** leaf key、10 → **11** dead、使用率 **53/64（83%）**（實測 eval + 逐 key grep）；② **四態修正**：E 3/7 → **2/7**、22/28 → **21/28（75%）**；③ **A6 範圍修正**：14 處 → **26 行（4 檔）**（`home` 6 + `badges` 11 + `nfc-bind` 8 + `overview` 1；排除註解）；④ **§4.4 的 Icon 下游客戶 8 → 9**；⑤ §7 行尾多餘 `>` 移除（R2 自引入之回歸） | VERIFY R2 findings N-1 / N-2 / L-5 / L-7 |

---

**END OF FILE**
