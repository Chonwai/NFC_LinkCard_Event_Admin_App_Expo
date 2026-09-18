# 11 — Admin App 缺陷冊與死碼清理清單

> **讀者**：**feiteng2015（主）+ 用戶（次）**
> **產出**：Neo Loop Engine / Edison 規劃部（architect），2026-09-16
> **基準**：`LinkCard_Event_Admin_App_Expo` @ `49f377e`
> **證據基準**：2026-09-16 實測。**行號會漂移，以函式名/符號名為準。**
> **標記**：✅ 已驗證 ｜ 📌 規劃建議 ｜ ⚠️ 未驗證
> **前置閱讀**：`20260915_AdminApp_Handoff_for_feiteng2015.md`（施工計畫）+ `20260915_AdminApp_API_Contract_Freeze_v1.md`（契約）

---

## §0.1 代號表（先讀這個，再讀 §1）

| 代號                   | 含義                                                                                                                 | 首次出現                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **W-ID**（W-01..W-33） | **工作項**（施工單元）。每一個都有檔案/依賴/估時/AC/阻斷標記                                                         | handoff §4                      |
| **W0**                 | **移交前準備週**（用戶負責；本冊的 **W-09** 在此週）                                                                 | handoff §4.1b                   |
| **B-ID**（B-1..B-8）   | **後端施工項**。本冊**不**修，只在 §3 指向                                                                           | 後端待辦文件                    |
| **C-ID**（C-1..C-18）  | **待裁決項**（需用戶/PM 拍板）。影響施工範圍或排期                                                                   | 契約 §6                         |
| **D-n**（D-1..D-4）    | **契約漂移**（文件 vs 後端實作不一致）                                                                               | handoff §5.1                    |
| **A0..A9**             | **本冊的 App 缺陷**（本輪審計新發現）                                                                                | 本文件 §2                       |
| **A1..A4**             | ⚠️ **不同清單！** `06-feature-list.md` 的功能分類（A1 已有完整資產 / A2 已有骨架需增強 / A3 全新開發 / A4 明確不做） | `06-feature-list.md`            |
| **AU-01..AU-11**       | **App 未驗證項**（尚未在任何環境跑過的東西）                                                                         | `10-app-completion-audit.md` §7 |
| **U-1..U-6**           | **契約/後端未驗證項**（不同清單）                                                                                    | `09-feasibility-review.md` §12  |

> 🔴 **看到 A2 請先確認是哪份文件**：本冊的 `A2` = `EventStatus` 漂移；`06-feature-list.md` 的 `A2` = 「已有骨架需增強」。

---

## §0 這份文件怎麼用

| 你想知道                           | 看哪節                                      |
| ---------------------------------- | ------------------------------------------- |
| **能不能 build / 能不能跑**        | §1 修復優先序（**P-0 層沒修，其他都別做**） |
| 每個缺陷的修法                     | §2 缺陷逐節（A0..A9）                       |
| 哪些死碼可以刪、哪些**絕對不能刪** | §4                                          |
| 缺陷落在哪個 W-ID                  | §5 對應表                                   |

**三個原則**：

1. **不要自行發明修法**——每節的「最小修法」都是實測推導的，照做即可。
2. **不要清理 §4.2 的「偽死碼」**——那些是後續 W-ID 的資產。
3. **修完每個缺陷請跑 T1 + T2**（`npm run typecheck` + `npm run lint`），並依 handoff §8.2 的門檻驗收。

---

## §1 修復優先序

### P-0 ｜移交前必修（**用戶負責**，不修則新 clone 需手動補 `.env.local`）

|   ID   | 缺陷                          | 為什麼堵住一切                                                                                                                                                                                                                                                                                         |
| :----: | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A0** | 預設 API base URL 雙重 `/api` | ⓐ 新 clone **沒有 `.env.local`**（`.gitignore:31 .env*.local`）→ 預設值生效 → **所有 API 404**；ⓑ **EAS build 不含 `.env.local`** → 首次 build 全 404。<br>📌 **緩解現況**：開發期仍有繞道（手動建 `.env.local`），但 **EAS build 產物無法繞道**，且新工程師不知該檔的格式（repo 無 `.env.example`）。 |

### P-1 ｜批次 1 首日（**feiteng2015 負責**）

|   ID   | 缺陷                     |       W-ID       |
| :----: | ------------------------ | :--------------: |
| **A1** | `home` 錯誤橫幅是死路徑  |       W-10       |
| **A2** | `EventStatus` 與後端不符 | W-01（漂移 D-4） |
| **A4** | 登出不清活動快取         |       W-10       |
| **A5** | `currentEventId` 死狀態  |       W-10       |

### P-2 ｜批次 1（**feiteng2015 負責**）

|   ID   | 缺陷                          | W-ID |
| :----: | ----------------------------- | :--: |
| **A6** | **26 行（4 檔）**硬編中文字串 | W-11 |
| **A7** | `payloadUrl` 硬編 prod 域名   | W-11 |

### P-3 ｜隨所屬 W-ID（**feiteng2015 負責**）

|   ID   | 缺陷                         | W-ID | 何時                   |
| :----: | ---------------------------- | :--: | ---------------------- |
| **A3** | 丟棄 `checkIn` 回傳值        | W-26 | 批次 2（可提前）       |
| **A8** | `?? fallback` 掩蓋 copy 缺鍵 | W-02 | 批次 1（順手，0 成本） |
| **A9** | 逾時碼分類過窄               | W-23 | 批次 2（順手）         |

> 📌 **跨 W-ID 順手修原則**：A8/A9 都是「當你剛好在改那個檔案時」順手處理，**不要為它們開獨立任務**。

---

## §2 缺陷逐節（A0..A9）

---

### A0 ｜🔴 Critical ｜預設 API base URL 構成雙重 `/api`

| 項                          | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬**                | **用戶（移交前 W0）** → W-09                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **症狀（使用者可見後果）**  | 在**任何沒有 `.env.local` 的環境**（新 clone、EAS build、CI）啟動 App → 登入、載入活動、簽到、查 badge **全部失敗**，且錯誤訊息是通用網路錯誤（非 404 明示），極難定位                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **根因**                    | `src/constants/config.ts:10`：<br>`export const API_BASE_URL = EXPO_PUBLIC_API_URL \|\| 'https://linkcard.xyz/api';`<br>而**所有 service 路由都以 `/api/...` 開頭**（**只列符號名，刻意不附行號**——行號會漂移，本冊 §0 原則已聲明以符號名為準）：<br>`auth.service.ts` 的 `login()` / `me()` → `/api/auth/login`、`/api/users/me`<br>`event.service.ts` 的 `getMyManagedEvents()` / `getEventById()` / `getRegistrations()` → `/api/v1/events/…`<br>`registration.service.ts` 的 `getByCode()` / `checkIn()` → `/api/v1/events/:eventId/registrations/…`<br>`nfc.service.ts` 的 `lookup()` / `listBadges()` / `bind()` → `/api/v1/events/:eventId/nfc/…`<br>→ axios `combineURLs('https://linkcard.xyz/api', '/api/v1/events/my-managed')` = **`https://linkcard.xyz/api/api/v1/events/my-managed`** |
| **為何目前不爆**            | `.env.local` 內容為 `EXPO_PUBLIC_API_URL=https://staging-api.link-card.xyz`（**origin-only**）→ 覆寫掉錯誤預設值。該檔 `git check-ignore` 命中 `.gitignore:31 .env*.local` → **不在版控**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **✅ 正確慣例（本輪實證）** | ⓐ 後端 `LinkCard_ExpressJS_Backend/src/app.ts:153-154`：`app.use('/api/v1/events', eventRoutes)` + `app.use('/api', routes)`；`src/routes/index.ts:11-14`：`router.use('/auth', authRoutes)` / `router.use('/users', userRoutes)` → `/api/auth/login` 與 `/api/users/me` 為真<br>ⓑ 姊妹 App `LinkCard_Promoter_App_Expo/src/constants/config.ts:10` 的 base 為 `http://127.0.0.1:3020`（**無 `/api`**），服務路徑同為 `/api/v1/promoter/…`<br>ⓒ Promoter `.env.example` **明文**：「`EXPO_PUBLIC_API_URL` = 後端 API 的 origin — **只填 origin，不含 `/api` 或任何路徑後綴**」                                                                                                                                                                                                                       |
| **重現步驟**                | ① `mv .env.local .env.local.bak`<br>② `npm run web`（或 `npx expo start --web`）<br>③ 用 staging 帳號登入 → Network 面板可見 `POST https://linkcard.xyz/api/api/auth/login` → **404**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **最小修法**                | **1 行**：`src/constants/config.ts:10` 移除尾端 `/api`：<br>`export const API_BASE_URL = EXPO_PUBLIC_API_URL \|\| 'https://linkcard.xyz';`<br>📌 **建議一併做（同屬 W-09）**：<br>① 複製 Promoter 的 **fail-closed guard**（`config.ts:6-8`）：非 `__DEV__` 且缺 `EXPO_PUBLIC_API_URL` 時 `throw`；<br>② 新增 **`.env.example`**（Promoter 已有可照抄格式），明文「只填 origin」；<br>③ 移交時**把 `.env.local` 交給 feiteng2015**（或用 `.env.example` 讓他自建）                                                                                                                                                                                                                                                                                                                                   |
| **驗收標準**                | ① 無 `.env.local` 時不 throw（dev）；② 有 `.env.local` 時登入成功；③ `npm run typecheck` + `npm run lint` 全綠；④ 新增 1 個 `curl` 或 smoke script 斷言 `/api/auth/login` 不回 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **⚠️ 未驗證子項**           | production 的 apex origin 是否為 `https://linkcard.xyz`（而非 `api.linkcard.xyz`）→ **C-14**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

### A1 ｜🔴 High ｜`home` 的錯誤橫幅永遠不會顯示

| 項               | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬**     | feiteng2015 → **W-10**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **症狀**         | 活動載入失敗（斷網 / 5xx / token 失效）時，畫面**不會出現任何錯誤提示**——只看到空清單或一直轉圈，使用者不知道發生什麼事                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **根因（兩層）** | ① `src/stores/event.store.ts:29-31`：<br>`} catch (err) {`<br>`    set({ loading: false, error: err instanceof Error ? err.message : '載入活動失敗' });`<br>`}` ← **沒有 `throw`**<br>② `src/app/(auth)/home.tsx` 的 `loadEvents` 呼叫被包在 `try/catch` 內，其 `catch` 要負責 `setBanner({ … copy.home.loadFailed })`——但因為 ① 永不 rethrow，**該 catch 永不執行**。<br>③ 附加證據：store 的 `error` 欄位**全 repo 0 處讀取**（`home.tsx` 只解構 `events, loading, loadEvents`）                                                              |
| **重現步驟**     | ① 關閉後端 / 改 `EXPO_PUBLIC_API_URL` 指向不存在的 host<br>② 登入後進 `home`<br>③ 觀察：無 banner、無錯誤訊息                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **最小修法**     | **二選一（建議 (b)）**：<br>**(a) 保留 store 語意，讓 consumer 讀 `error`**——`event.store.ts` 的 `catch` 改為 `set({loading:false, error:...}); throw err;`，並在 `home.tsx` 的 catch 保留現有 banner 邏輯；<br>**(b) 移除 `home.tsx` 的 try/catch**，改為從 store 解構 `error` 並在 `error != null` 時渲染 `InlineBanner`（＋ 在 `loadEvents` 開頭 `set({error:null})`，該行**已存在**於 `event.store.ts:25`）。<br>📌 建議 **(b)**：改動更少、且讓 `error` 狀態有唯一來源；同時滿足 `InlineBanner` 的 `dismissible`/`onDismiss`（未用 props） |
| **驗收標準**     | ① 斷網時 `home` 顯示錯誤 banner；② 重試（pull-to-refresh）成功後 banner 消失；③ `loading` 不會卡住                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

### A2 ｜🟠 Medium ｜`EventStatus` 型別有後端不存在的值、且缺 `ARCHIVED`

| 項            | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬**  | feiteng2015 → **W-01（漂移 D-4）**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **症狀**      | `ARCHIVED` 狀態的活動在 `home` 顯示**原始英文** `ARCHIVED`（而非中文），且徽章色為 `neutral`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **根因**      | App `src/types/api.types.ts:43-49`：<br>`'DRAFT' \| 'PUBLISHED' \| 'REGISTRATION_OPEN' \| 'ONGOING' \| 'ENDED' \| 'CANCELLED'`<br>後端 `LinkCard_ExpressJS_Backend/prisma/schema.prisma:289-296`：<br>`DRAFT \| PUBLISHED \| ONGOING \| COMPLETED \| CANCELLED \| ARCHIVED`<br>→ App **幻覺 2 值**（`REGISTRATION_OPEN` / `ENDED`；後端全 repo `grep REGISTRATION_OPEN` = **0 命中**）、**缺 1 值**（`ARCHIVED`）<br>受影響處：`src/app/(auth)/home.tsx` 的 `STATUS_TONE`(L18-26) 與 `STATUS_LABEL`(L28-35) 皆無 `ARCHIVED` 鍵 → L73-74 的 `?? item.status` fallback 顯示英文 |
| **重現步驟**  | 在 staging 把任一活動設為 `ARCHIVED` → `home` 列表該列顯示 `ARCHIVED`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **最小修法**  | ⓐ `api.types.ts` 的 `EventStatus`（**L43-49**）改為與後端完全一致（移除 `REGISTRATION_OPEN`/`ENDED`、加入 `ARCHIVED`）；<br>ⓑ `home.tsx` 的 `STATUS_TONE` 移除 `REGISTRATION_OPEN`、加入 `ARCHIVED: 'neutral'`（`COMPLETED` 已在）；<br>ⓒ `home.tsx` 的 `STATUS_LABEL`（L29-34）移除 `REGISTRATION_OPEN`、加入 `ARCHIVED`，**文案引用 `copy.eventStatus.archived`**（該命名空間由 **W-11** 建立；若 W-11 未完成則暫以硬編並標 `TODO(W-11)`）；<br>ⓓ **與 A6 同批處理**（A6 要將 `STATUS_LABEL` 的 6 個硬編中文搬進 `copy.eventStatus.*`，兩者是同一個物件）                   |
| **驗收標準**  | ① `tsc` 對 `REGISTRATION_OPEN`/`ENDED` 的任何引用報錯（證明無殘留）；② `ARCHIVED` 活動顯示中文標籤；③ `STATUS_TONE`/`STATUS_LABEL` 的鍵集合 = 後端 enum                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **⚠️ 未驗證** | 後端 `EventService.getMyManagedEvents()` 的 **response mapping** 是否另行映射 status（AU-07）→ 修前先打一次 API 確認 `status` 實值                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

### A3 ｜🟠 Medium ｜簽到成功丟棄 API 回傳值

| 項           | 內容                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬** | feiteng2015 → **W-26**（與「簽到結果卡詳情」合併交付）                                                                                                                                                                                                                                                                                                                                                                 |
| **症狀**     | 簽到成功後只知道「成功了」，**看不到報到者姓名 / 公司 / 票種 / 報到時間** → 現場無法做身分確認（會議模組 A「有效」態的硬要求）                                                                                                                                                                                                                                                                                         |
| **根因**     | `src/app/(auth)/[eventId]/check-in.tsx:62`：<br>`await registrationService.checkIn(eventId, code.trim());` ← **回傳值未賦值**<br>`src/types/api.types.ts:82` 的 `CheckInResult`（含 `checkedInAt` / `alreadyCheckedIn`）**外部使用 = 0** → 簽到時間與重複旗標無 UI 承接<br>同時 4 個已定義未用的 copy key（`checkIn.attendeeName` / `attendeeEmail` / `attendeeCompany` / `attendeeType`）指向的就是這個未實作的結果卡 |
| **重現步驟** | 手動輸入一個 `CONFIRMED` 的 registrationCode → 成功畫面只有「報到成功」+ code                                                                                                                                                                                                                                                                                                                                          |
| **最小修法** | ⓐ `check-in.tsx` 接住回傳：`const result = await registrationService.checkIn(...)`；<br>ⓑ 在 `CheckInResultSheet`（W-26 新元件）渲染 `result.registration` 的姓名/公司/票種與 `result.checkedInAt`；<br>ⓒ 消費 4 個死 copy key + `checkIn.resultTitle`；<br>ⓓ 保留 3s auto-reset（現場連續操作不得退化）                                                                                                               |
| **驗收標準** | ① 成功結果卡顯示姓名 + 公司 + 票種 + 報到時間；② 3s auto-reset 仍運作；③ `CheckInResult` 在 repo 內有 ≥1 個消費者；④ 4 個 copy key 從死碼清單移除                                                                                                                                                                                                                                                                      |

---

### A4 ｜🟠 Medium ｜登出不清活動快取

| 項           | 內容                                                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬** | feiteng2015 → **W-10**                                                                                                                                                                                                                                     |
| **症狀**     | A 帳號登出後，B 帳號登入 → `home` **短暫或持續顯示 A 帳號的活動清單**（含 A 的報名人數、角色），屬跨帳號資料殘留                                                                                                                                           |
| **根因**     | `src/stores/event.store.ts:38-40` 定義了 `clear()`（`set({ events: [], currentEventId: null, error: null })`），但**全 repo 0 個呼叫點**——`grep -rn "getState()" src/` 只命中 2 處（`home.tsx:80 selectEvent`、`api.ts:32 useAuthStore`）                  |
| **重現步驟** | ① A 登入 → 進 home（載入完成）② 登出 ③ B 登入 → 進 home，觀察殘留清單                                                                                                                                                                                      |
| **最小修法** | 在 `auth.store` 的 `logout()`（以及 `api.ts` response interceptor 觸發的強制登出）中呼叫 `useEventStore.getState().clear()`。<br>⚠️ **注意循環依賴**：`event.store` 不應 import `auth.store`；由 `auth.store`/`api.ts` 單向呼叫 `event.store.clear()` 即可 |
| **驗收標準** | ① 登出後 `useEventStore.getState().events` 為 `[]`；② 強制登出（401）亦清；③ 不產生循環 import（`tsc` + lint 過）                                                                                                                                          |

---

### A5 ｜🟡 Low ｜`currentEventId` 只寫不讀（死狀態）

| 項           | 內容                                                                                                                                                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬** | feiteng2015 → **W-10**                                                                                                                                                                                                                                                                                      |
| **症狀**     | 無使用者可見症狀；但「目前選中活動」的狀態是假的——任何依賴它的後續功能都會踩空                                                                                                                                                                                                                              |
| **根因**     | `src/stores/event.store.ts:34-36` 的 `selectEvent(id)` 寫入 `currentEventId`；但 `grep -rn "currentEventId" src/` 的 **4 個命中全部在 `event.store.ts` 內**（宣告 L9、初始值 L19、寫入 L35、清除 L39）→ **無任何讀取端**。<br>實際路由參數來自 `useLocalSearchParams` 的 `eventId`（各 `[eventId]/*` 畫面） |
| **最小修法** | **二選一**：<br>**(a) 刪除**（建議）：移除 `currentEventId` + `selectEvent`，並移除 `home.tsx:80` 的呼叫；<br>**(b) 啟用**：讓 `[eventId]` 畫面改從 store 讀，`useLocalSearchParams` 僅作首次寫入。<br>📌 建議 **(a)**——目前無任何消費需求，屬過度設計（**不需額外 pattern**）                              |
| **驗收標準** | ① 選擇方案後 `tsc`/lint 全綠；② 若選 (b)，`[eventId]` 系列畫面在深連結（直接開 URL）時仍可運作                                                                                                                                                                                                              |

---

### A6 ｜🟠 Medium ｜硬編中文字串繞過 copy 層

| 項                       | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬**             | feiteng2015 → **W-11**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **症狀**                 | 無視覺症狀；但**違反 `copy.zh-TW.ts` 自稱的「單一真相來源」**，且使 P-08（繁/簡/英/葡多語言）無法只靠換 copy 檔完成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **根因**                 | **4 檔共 26 行**（實測定義：**非註解行**含 CJK 字元——排除 `//`（含行尾註解）、`/* */`、`{/* */}`；含 `{/* */}` JSX 註解則為 **29 行**。原估「兩檔 14 處」嚴重低估）：<br>**`src/app/(auth)/[eventId]/nfc-bind.tsx`（8 行）**：L37（`WRISTBAND` → `手環`）、L38（`CARD` → `卡片`）、L126（`① 輸入報名編號以查詢參加者`）、L150（`② 選擇 Badge 類型，然後將空白 NFC 卡靠近手機背面`）、L177（`開始寫入 NFC 卡`）、L178（`重新輸入`）、L185（`寫入中，請保持卡片靠近…`）、L197（`繼續下一張`）（L39 的 `QR_ONLY` → `QR` 無 CJK，不計）<br>**`src/app/(auth)/[eventId]/badges.tsx`（11 行）**：L28-32（`STATUS_LABELS` 五個中文狀態標籤）、L125（`找不到此 Badge`）、L128（`Badge 查詢失敗`）、L166（`查詢 Badge（輸入 tagUid）`）、L177（`查詢`）、L197（`綁定報名：`）、L211（`尚無 Badge` / `先建立批次或綁定 Badge`）<br>**`src/app/(auth)/home.tsx`（6 行）**：L29-34（`STATUS_LABEL` 六個中文狀態標籤）（⚠️ 這 6 行就是 **A2 ⓒ** 要改的同一個物件——**兩者必須同批處理**）<br>**`src/app/(auth)/[eventId]/overview.tsx`（1 行）**：L112 的 `?? '快速操作'` fallback（即 **A8**） |
| **與 A2 的關係（重要）** | `copy.zh-TW.ts` **目前沒有 `status` 命名空間**。A2 要求把 `ARCHIVED` 補進 `STATUS_LABEL`，若不一併建 namespace，就必留下硬編中文。<br>→ ✅ **裁決：`copy.eventStatus.*`（6 值活動狀態中文標籤）由 W-11 產出**；A2 ⓒ 改為**引用 `copy.eventStatus.archived`**（見 A2 節）<br>⚠️ **注意**：`home` 的是**活動狀態**（6 值，對應型別 `EventStatus`）、`badges` 的是 **badge 狀態**（5 值 `UNASSIGNED/BOUND/ACTIVE/DEACTIVATED/LOST`，對應型別 `BadgeStatus`）——**兩者語意不同，不可共用同一 namespace**。→ ✅ **裁決：分流為 `copy.eventStatus.*` 與 `copy.badgeStatus.*`**（直接鏡射既有型別詞彙）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **最小修法**             | ⓐ 在 `src/constants/copy.zh-TW.ts` **新增 3 個命名空間**：`badges.*`、`eventStatus.*`（6 值活動狀態）、`badgeStatus.*`（5 值 badge 狀態）；`nfc.*` 為**既有** namespace 之**擴充**（不新增）<br>ⓑ 逐處替換為 `copy.*`（共 26 行 / 4 檔）；<br>ⓒ **不要**在此時引入 i18n 框架（P-08 另議，屬超範圍）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **驗收標準**             | ① **這 4 檔內無 CJK 硬編字串**（`grep` 驗證，排除註解）；② `tsc`/lint 全綠；③ 畫面文字零變化（純重構）；④ `copy.eventStatus.*` 與 `copy.badgeStatus.*` 存在且分別被 `home` 與 `badges` 消費                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

### A7 ｜🟠 Medium ｜`payloadUrl` 硬編 production 域名

| 項           | 內容                                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **責任歸屬** | feiteng2015 → **W-11**                                                                                                                                                                                                                                                                                                   |
| **症狀**     | 在 **staging** 環境寫入 NFC 卡時，卡上寫入的 URI 指向 **production** `https://linkcard.xyz/u/…` → 現場測試寫出的卡片會在正式站查詢（若該 registrationId 不存在 → 查無資料），**且會污染 staging 測試結果**                                                                                                               |
| **根因**     | `src/app/(auth)/[eventId]/nfc-bind.tsx:89`：<br>`const payloadUrl = \`https://linkcard.xyz/u/${state.registrationId}\`;` ← 未隨 env 切換                                                                                                                                                                                 |
| **重現步驟** | staging 走 NFC 寫卡流程（Android + 空白卡）→ 用 NFC 讀取工具檢查寫入的 URI → 看到 production 域名                                                                                                                                                                                                                        |
| **最小修法** | ⓐ 在 `config.ts` 新增 `export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim() \|\| 'https://linkcard.xyz';`<br>ⓑ `nfc-bind.tsx:89` 改用 `WEB_BASE_URL`；<br>ⓒ 在 `.env.example`（W-09 產出）補上 `EXPO_PUBLIC_WEB_URL` 說明<br>⚠️ **不要**用 `API_BASE_URL` 推導——API origin 與用戶端網頁 origin 是不同部署 |
| **驗收標準** | ① staging 寫出的 URI 指向 staging 網頁 origin；② production build 仍指向 `linkcard.xyz`；③ `.env.example` 有對應說明                                                                                                                                                                                                     |

---

### A8 ｜🟡 Low ｜`?? fallback` 掩蓋 copy 缺鍵

| 項           | 內容                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬** | feiteng2015 → **W-02（順手）**                                                                                                                                            |
| **症狀**     | 無症狀（因為這兩個 key 確實存在）；但這**掩蓋了 copy 缺鍵的本來面目**——若日後 key 被誤刪，畫面會靜默顯示硬編中文而非報錯                                                  |
| **根因**     | `src/app/(auth)/[eventId]/overview.tsx:34`（`copy.event.badgesTitle ?? 'Badge'`）與 `:112`（`copy.event.quickActions ?? '快速操作'`）；兩 key 在 `copy.zh-TW.ts` 確實存在 |
| **最小修法** | 移除 `?? '…'` fallback，直接 `copy.event.badgesTitle` / `copy.event.quickActions`（TS 因 const 物件型別會直接保證存在）                                                   |
| **驗收標準** | ① 兩處 fallback 移除；② `tsc` 全綠；③ 畫面文字不變                                                                                                                        |

---

### A9 ｜🟡 Low ｜逾時碼分類過窄

| 項           | 內容                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **責任歸屬** | feiteng2015 → **W-23（順手）**                                                                                                                  |
| **症狀**     | 特定網路逾時情境下，登入顯示 `errorServer(status)`（後端錯誤）而非「網路逾時」——錯誤歸因錯誤，誤導使用者                                        |
| **根因**     | `src/utils/api-error.ts` 的 `isNetworkError` / `isServerError` 未覆蓋 `ECONNABORTED` 之外的 axios 逾時碼組合（⚠️ 行號未實測，**以符號名為準**） |
| **最小修法** | 納入 `ETIMEDOUT` / `ECONNABORTED` / `ENETUNREACH` / `ERR_NETWORK`（axios v1）等，並以 `error.code` 優先於 `error.message` 判斷                  |
| **驗收標準** | ① 斷網 / 逾時 / 5xx 三分類各自顯示正確文案；② `tsc`/lint 全綠                                                                                   |

---

## §3 契約相關（**不在本冊修，僅指向**）

| 項                                          | 為何不在本冊 | 去處                         |
| ------------------------------------------- | ------------ | ---------------------------- |
| 後端 6 個 token 端點未實作                  | 屬後端       | `09` §3 **B-1** / 後端 TODOs |
| `checkIn` 無 override                       | 屬後端       | **B-2**                      |
| 無閘口/地點欄位                             | 屬後端       | **B-3**                      |
| `VOLUNTEER` 無授權引用                      | 屬後端       | **B-4**                      |
| `by-code` 限流 20/5min/IP                   | 屬後端       | **B-5**                      |
| `EventStatus` 以外的契約漂移（D-1/D-2/D-3） | 屬 W-01      | handoff §5.1                 |
| Pagination 五種形狀                         | 決策未拍板   | **C-1**                      |

> 📌 **切勿在本冊自行補寫後端修法**——會造成兩份文件對同一問題給出不同藥方。

---

## §4 死碼清理清單（**可直接當 checklist**）

### 4.1 ✅ 可清理（真死，W-13，P2，buffer）

|  #  | 項目                                                                             | 路徑                                                                   | 處置                                                                                                                                              |
| :-: | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `SkeletonList` 元件                                                              | `src/components/ui/Skeleton.tsx`（L108-113 + `SkeletonListProps` L17） | 刪除（含 `layout.skeletonRows` 的消費）                                                                                                           |
|  2  | `iconStyles`                                                                     | `src/components/ui/Icon.tsx:255`                                       | 刪除                                                                                                                                              |
|  3  | `getEventById`                                                                   | `src/services/event.service.ts` 的 `getEventById()`                    | **刪除**（無任何呼叫端；若 W-05 日後需要再重建）                                                                                                  |
|  4  | `ApiErrorEnvelope`                                                               | `src/types/api.types.ts`                                               | 刪除（`api-error.ts` 另有 `ApiErrorShape`）                                                                                                       |
|  5  | `nfc-utils.buildUriNdefMessage`                                                  | `src/utils/nfc-utils.ts`                                               | 降為 module-private（**不刪**）                                                                                                                   |
|  6  | `theme` / `default` export                                                       | `src/constants/theme.ts:656,670`                                       | 刪除（0 import）                                                                                                                                  |
|  7  | `fontFamily` / `elevation` / `metaText` export                                   | `theme.ts:195,333,654`                                                 | **先讓 `home.tsx` / `badges.tsx` 改用 `metaText`（消掉兩處自寫的 `styles.metaText` / `styles.badgeMeta`），再由 W-13 刪除 theme 的這三個 export** |
|  8  | `radius.none` / `layout.buttonHeightSm` / `layout.iconBox`                       | `theme.ts:142,159,163`                                                 | 刪除                                                                                                                                              |
|  9  | npm 依賴 `expo-constants` / `expo-device` / `expo-image-picker` / `expo-linking` | `package.json`                                                         | 從依賴移除（**先確認 W-12/W-31 不使用**）                                                                                                         |
| 10  | `husky` / `lint-staged` 宣告                                                     | `package.json`（`prepare: husky`）                                     | 📌 **二選一**：補 `.husky/`（建議，成本 0.25d）或移除宣告（目前是**假承諾**）                                                                     |
| 11  | `dist/` 工作樹殘留                                                               | `dist/`（已 gitignore）                                                | 刪除                                                                                                                                              |

### 4.2 🚫 **絕對不可清理**（偽死，將被消費）

|  #  | 項目                                                      | 將由誰消費                         |
| :-: | --------------------------------------------------------- | ---------------------------------- |
|  1  | Icon `flash-on` / `flash-off`                             | **W-26**（手電筒）                 |
|  2  | Icon `plus` + `ScreenHeader.right`                        | **W-02**（新增入口）               |
|  3  | Icon `chevron-*` + `Card.showChevron`                     | W-03 / W-15（清單導引）            |
|  4  | Icon `copy` + `expo-clipboard`                            | **W-15**（tagUid 複製）            |
|  5  | Icon `clock`                                              | **W-26**（報到時間）               |
|  6  | copy `checkIn.attendee*` / `resultTitle` / `switchToScan` | **W-26**                           |
|  7  | copy `settings.nfcStatus` / `nfcSupported` / `appVersion` | **W-08**                           |
|  8  | copy `auth.loggedOut`                                     | W-08 / W-10                        |
|  9  | 型別 `CheckInResult`                                      | **W-26**                           |
| 10  | 型別 `EventStatus`                                        | **W-01**（改值域，非刪）           |
| 11  | `react-native-qrcode-svg`                                 | **W-31**（Credential QR）          |
| 12  | `react-native-nfc-manager`                                | 動態 import，**非死碼**            |
| 13  | `layout.touchGapMin` / `layout.breakpointNarrow`          | **C-15 / C-16** 若拍板要做，即需用 |

> ⚠️ **通則**：清理前先確認該符號**不在本表**。若誤刪，W-26 需要重新加回 icon/copy → **製造重工**。

---

## §5 與 W-ID 的對應

|       缺陷       |         W-ID         |       批次       |   執行者    | 人日  |
| :--------------: | :------------------: | :--------------: | :---------: | :---: |
|      **A0**      |       **W-09**       | **W0（移交前）** |  **用戶**   |  0.5  |
|   A1 / A4 / A5   |       **W-10**       |      批次 1      | feiteng2015 | 0.25  |
|     A6 / A7      |       **W-11**       |      批次 1      | feiteng2015 | 0.25  |
|        A2        | **W-01**（漂移 D-4） |      批次 1      | feiteng2015 | +0.25 |
|        A3        | **W-26**（AC 增補）  | 批次 2（可提前） | feiteng2015 | +0.25 |
|        A8        |   **W-02**（順手）   |      批次 1      | feiteng2015 |  +0   |
|        A9        |   **W-23**（順手）   |      批次 2      | feiteng2015 |  +0   |
| 死碼（真死子集） |       **W-13**       | 批次 1（buffer） | feiteng2015 |  0.5  |

---

## §6 變更記錄

| 版本    | 日期       | 變更                                                                                                                                                                                                                                                                                                                                                                                                                                       | 原因                                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| v1.0    | 2026-09-16 | 初版（A0..A9 缺陷冊 + 死碼清理清單 + 修復優先序）                                                                                                                                                                                                                                                                                                                                                                                          | Neo Loop（admin-app-completion-audit）                   |
| v1.0-r1 | 2026-09-16 | ① **A6 範圍/計數修正**：兩檔 14 處 → **4 檔 26 行**（附精確行號明細與定義；含 `{/* */}` JSX 註解則 29 行）；② **A6 與 A2 解耦**：`copy.eventStatus.*`（6 值活動狀態）與 `copy.badgeStatus.*`（5 值 badge 狀態）**語意不同不可共用**；③ A2 行號 `43-54` → **43-49**；④ **W-11 命名空間措詞**：新增 3 個（`badges.*` / `eventStatus.*` / `badgeStatus.*`）＋ `nfc.*` 為既有 namespace 之擴充；⑤ 異體字修正（`这`/`本册`/`驗証`/`骸架`/`则`） | VERIFY R2/R3 findings N-1 / N-5 / N-8 / N-10 / L-1 / M-1 |

---

**END OF FILE**
