# 03 — 能力對等矩陣

<!-- citations: LinkCard_Frontend -->

座標見 `00-method-and-scope.md` §0.2。Web 側的模組清單取自導覽的真實來源
`LinkCard_Frontend@app/(event)/manage/[eventId]/layout.tsx:170-190`，共 13 項。

## 3.1 一覽

| #   | Web 模組       | 路徑                          | App 對應                           | 判定                |
| --- | -------------- | ----------------------------- | ---------------------------------- | ------------------- |
| —   | 活動清單       | `/manage/events`              | `home.tsx`                         | `ALIGNED`           |
| 1   | Overview       | `/manage/:eventId`            | `overview.tsx`                     | `ALIGNED_DEFECT`    |
| 2   | Profile        | `…/profile`                   | —                                  | `BY_DESIGN`         |
| 3   | Content        | `…/content`                   | —                                  | `BY_DESIGN`         |
| 4   | Ticket Types   | `…/ticket-types`              | 只讀票種（現場報名用）             | `BY_DESIGN`         |
| 5   | Badges         | `…/badges`                    | `badges.tsx`                       | `APP_GAP`           |
| 6   | Registrations  | `…/registrations`             | `registrations.tsx`＋詳情頁        | `APP_GAP`           |
| 7   | Check-in       | `/check-in/:eventId`          | `check-in.tsx`＋`nfc-bind.tsx`     | `APP_GAP`           |
| 8   | Exhibitors     | `…/exhibitors`（＋`/import`） | —                                  | `BY_DESIGN`         |
| 9   | Sessions       | `…/sessions`（＋名冊子頁）    | —                                  | `BY_DESIGN`         |
| 10  | Polls          | `…/polls`                     | —                                  | `BY_DESIGN`         |
| 11  | Bank Transfers | `…/bank-transfers`            | —                                  | `BY_DESIGN`         |
| 12  | Org Roles      | `…/org-roles`                 | —                                  | `BY_DESIGN`         |
| 13  | Settings       | `…/settings`                  | `settings.tsx`（App 偏好，非活動） | `BY_DESIGN`         |
| —   | NFC 診斷台     | `/nfc`                        | —                                  | `WEB_ONLY_INTERNAL` |

統計：`ALIGNED` 1（活動清單）、`ALIGNED_DEFECT` 1、`APP_GAP` 3、`BY_DESIGN` 9、
`WEB_ONLY_INTERNAL` 1，共 15 項，與 `parity/parity-registry.json` 逐項對應。

13 個活動內模組的分佈是：9 個 `BY_DESIGN`、3 個 `APP_GAP`、1 個 `ALIGNED_DEFECT`。

`BY_DESIGN` 的每一項都必須有一句可反駁的理由，見 §3.6。理由是判定的主體，
表格只是索引。

## 3.2 Overview：兩邊都有，403 那半已修、兩次請求那半未修

Web 現在每張入口卡都帶數字，全部來自一次 `GET /events/:eventId/manage-stats`
（`hooks/events/useManageStats.ts`，頁面檔頭 `app/(event)/manage/[eventId]/page.tsx:8-24`）。

App 的 `overview.tsx` 顯示報名數、已報到數、到場率（`overview.tsx:122-147`；
原引 `:133-159` 已漂），但它拿數字的方式是：

```ts
const [totalRes, checkedInRes] = await Promise.all([
  eventService.getRegistrations(eventId, { limit: 1 }),
  eventService.getRegistrations(eventId, { limit: 1, status: "CHECKED_IN" }),
]);
```

問題不在 `Promise.all`，在於 `GET /:eventId/registrations` 的閘門是
`getEventWriteAccess`，角色集不含 OPERATOR。而 `my-managed` 對任何 ACTIVE org role
都回傳，所以 OPERATOR 看得到活動、也點得進來。

**這個缺陷現在只修好一半（2026-10-29 深夜實測）。** 兩半要分開講——合成一句
「App 對 OPERATOR 會壞」現在是錯的：

- **403 那半已修**（`9e3c7a2`）。`overview.tsx:200-210` 先問 `getMyAccess`，
  `if (!access.canManage)` 就早退：用本地已有的總數顯示，把已報到數與到場率
  誠實標成「未取得」，不再去打一個必定 403 的端點。
- **兩次請求那半未修。** `overview.tsx:212-218` 仍是 `Promise.all` 兩支
  `getRegistrations`（`{limit:1}` 與 `{limit:1, status:"CHECKED_IN"}`），只為了取
  兩個 `pagination.total`。

```
$ grep -n 'canManage\|getRegistrations' 'src/app/(auth)/[eventId]/overview.tsx'
204:        if (!access.canManage) {
213:          eventService.getRegistrations(eventId, { limit: 1 }),
214:          eventService.getRegistrations(eventId, {
```

更刺眼的是：這個數字**已經在手上**。`event.service.ts:62` 早就把
`_meta.registrationCount` unwrap 成 `event.registrationCount` 了（原引 `:38-48`
已漂）。所以真正該做的不是「修 403」，是**根本不要問兩次**——這一點沒動。

判定不變，仍是 `ALIGNED_DEFECT`：能力存在，實作偏離 Web 的做法（Web 一次
`manage-stats` 就拿到全部數字）。修好的是「壞掉」，沒修好的是「不必要」。

## 3.3 三個 `APP_GAP`

本節只有三項。原本的第四項 **G-D Sessions 已於 2026-10-29 移出 `APP_GAP`**
（`by-design`：活動不分場次）。它的**實測證據保留在本節末**，理由摘要進 §3.6——
不搬到 §3.6，是因為那裡是一張索引表，而 G-D 帶著三條一手量測與一段孤兒端點的
說明，擠進表格只會兩邊都變難讀。

### G-A Badges：App 能綁能換卡，缺的是發卡批次鏈

Web `badges/page.tsx` 匯入五個函式（`grep` 可重跑）：
`listNfcBadges`、`createNfcBatch`、`claimNfcBadge`、`completeNfcBatch`、
`exportNfcBadges`。

App 端的 `nfcService` 要看**全檔**，不能看片段（`wc -l` = 98 行）。四個方法、讀寫
各半：

| 方法             | 行  | HTTP | 路由                               |
| ---------------- | --- | ---- | ---------------------------------- |
| `lookup`         | :23 | GET  | `/v1/events/:eventId/nfc/lookup`   |
| `listBadges`     | :37 | GET  | `/v1/events/:eventId/nfc/badges`   |
| `bind`           | :60 | POST | `/v1/events/:eventId/nfc/bind`     |
| `recordExchange` | :84 | POST | `/v1/events/:eventId/nfc/exchange` |

**App 不是只有讀。** 寫入的兩條路都在，而且都已接線到畫面：
`nfc-bind.tsx:254` 呼叫 `nfcService.bind(...)`，
`nfc-exchange.tsx:135` 呼叫 `nfcService.recordExchange(...)`。

上一版這裡寫「App 只呼叫 `listBadges` 與 `lookup`（`nfc.service.ts:23-57`）」。那個
引用窗剛好停在 `bind`（`:60`）之前，於是讀出「App 只有讀」的假前提——**引用窗比被
描述的檔案短，缺掉的部分就會被當成不存在**。已於 2026-10-29 改為全檔引用。

所以 G-A 的缺口不是「沒有寫入能力」，而是 **batch lifecycle**：
`createNfcBatch`、`claimNfcBadge`、`completeNfcBatch`、`exportNfcBadges` 在
`src/` 內零命中（`grep -rn`），也就是「發卡／認領／回填／匯出」這條鏈沒有 API
包裝。判定維持 `APP_GAP`
（`LinkCard_Event_Admin_App_Expo@parity/parity-registry.json:95`），只換理由。

| 能力                       | Web | App | 後端 | App 缺什麼     |
| -------------------------- | --- | --- | ---- | -------------- |
| 列出庫存（分頁/狀態/批次） | ✅  | ✅  | ✅   | —              |
| 查單張 badge               | ✅  | ✅  | ✅   | —              |
| `boundOnly` 篩選           | ✅  | ❌  | ✅   | 少一個查詢參數 |
| CSV 匯出                   | ✅  | ❌  | ✅   | 無 UI          |
| 建立批次                   | ✅  | ❌  | ✅   | 無 UI          |
| 批次認領                   | ✅  | ❌  | ✅   | 無 UI          |
| 回填真實 UID               | ✅  | ❌  | ✅   | 無 UI          |

「建立批次」與「回填 UID」是發卡流程的頭尾。目前活動當天要回 Web 做，或先在
Web 做好再帶平板出門。這一項的嚴重度不是「功能少」，是「流程被切成兩半」。

**產業對照（2026-10-29 針對這一步的補查，未重跑整份六家研究）：`回填 UID` 是
本產品特有的流程步驟。** 查了 Eventbrite、Whova、Cvent、zkipster、Swapcard、
Bizzabo 六個產品的官方文件，**沒有一個**有「回填真實 UID」這個步驟的對應物。
業界對應的概念是「寫入／編碼 badge」與「列印」，不是「事後回填 UID」。

這件事改的是**論證方式**，不是上面那一列的判定：`回填 UID` 的優先度**不能**用
「業界都有」來支撐——它撐不起來。要支撐它，靠的是**你們的卡片進貨方式**：卡片若
是預先燒好 UID 進貨，這一步直接消失；只有買空白卡、事後自行寫入的情況，它才存在。
換句話說，這一步該不該做，取決於採購合約而不是產品趨勢。

### G-B Registrations：App 只讀，Web 可管理

Web `registrations/page.tsx` 的動作（行號見檔內）：
`exportAttendeesCsv:29`、`hide/unhide:101,148`、`archive/unarchive:28,35,181-186`、
退款登記 modal `:106`、狀態更正 `:94`、`depositRefundFilter` `:140`。

App `registrations.tsx`：狀態篩選（5 種）、前端搜尋、排序（時間／姓名）、分頁。

差距本質：App 的名單是「查」的工具，Web 的名單是「改」的工具。這一項是四個
`APP_GAP` 裡最需要先問清楚的一個，因為「誰有權改報名資料」是政策問題，不是技術
問題（見 `04-gap-register.md` §G-6）。

### G-C Check-in：Web 現在是超集

| 能力                    | Web                                  | App                                            |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| QR 掃碼                 | ✅ `@yudiel/react-qr-scanner`        | ✅ `expo-camera`                               |
| 手動輸入報名碼          | ✅                                   | ✅                                             |
| 防連掃門閂              | ✅ `scanInFlight`                    | ✅ `scanInFlight:100`                          |
| 成功後顯示 profile 路徑 | ✅                                   | ✅                                             |
| 不必離開報到頁即可寫卡  | ✅ `WriteCardPanel`（568 行）        | ❌ 要跳 `nfc-bind`（**不是不能寫，是不同頁**） |
| 寫完自動綁卡            | ✅ `bindWrittenBadge`                | ✅ 在 `nfc-bind` 內                            |
| 卡片上鎖（PWD_AUTH）    | ✅ `lib/nfc/globalPassword`          | ❌ 無對應層                                    |
| 讀卡機連線／重連        | ✅ `DeskReaderBar`                   | ❌ 不適用                                      |
| 失敗後的處置動作        | ✅ `retry/swap_card/skip/retry_bind` | ⚠️ 分散在文案                                  |
| 重複報到的處理          | 顯示錯誤字串                         | 錯誤＋**「申請主管覆核」死按鈕**               |

最後一列是全份文件唯一的 P0，見 `04-gap-register.md` §G-1。

> **2026-10-29 註：上面「寫卡」那一列的文字改了括號，末兩句沒有改。** 括號是為了
> 阻止一種誤讀——「❌ 要跳 `nfc-bind`」講的是**步數**，不是**能力**：App 確實會寫卡
> （`LinkCard_Event_Admin_App_Expo@src/app/(auth)/[eventId]/check-in.tsx:673-685`
> 的 CTA + `tests/check-in-write-handoff.test.mjs`），只是
> 在另一頁完成。這個區別在 `04 §G-8` 的〈2026-10-29 補充〉裡展開。
>
> 末兩句**已經過期，但本輪不動它**，只把它標示出來：① 提到的「申請主管覆核」死按鈕
> 已經不存在（`04 §G-1` 為 `fixed`，`fixedOn: 5bcdb53`；現況是橫幅
> 「重複報到無法在 App 內放行：後端目前沒有覆核端點。現場請人工放行並記錄。」
> 加兩顆**可用**的按鈕：查看詳情 → 報名詳情頁、繼續掃碼，
> `LinkCard_Event_Admin_App_Expo@src/app/(auth)/[eventId]/check-in.tsx:712-725`）。
> ② 「全份文件唯一的 P0」也不再
> 成立（`G-0` 也是 `P0`，同樣 `fixed`）。兩處都需要重寫這一列與下面那句，但那屬於
> **另一件事**（本輪的範圍是 G-8／G-13 的決策記錄），所以在這裡留下座標而不是順手
> 改掉——**表格不會自己過期，是有人看見了卻沒說**，這一行就是「說了」。

### G-D Sessions（**已移出 `APP_GAP`：`by-design`，2026-10-29**）：兩邊都沒有做「現場報到」，但 Web 至少有骸架

> **已決（2026-10-29）：`BY_DESIGN`。這一項永遠不做。**
>
> **理由是營運模型，不是優先度。** 入場簽到時就一併完成報到，並派發 NFC 手環與
> 掛牌；之後**有掛牌就能自由進出會場**。因此：
>
> - **沒有「場次」這個營運單位**——一場活動就是一個單位，票上沒有場次要選。
> - **出入權靠掛牌人工目視**，不是靠系統掃描。
>
> 所以「逐場次出席紀錄」不是一個還沒做的需求，是一個**不存在的需求**。
>
> **下面保留三條實測，因為它們是事實，不因判定改變而失效**——它們證明的
> 「後端就緒、兩個前端都沒接」仍然成立。改變的只是：這件事**不再待辦**。
>
> **誠實註記（不屬本判定）：** 後端
> `POST /sessions/:sessionId/checkin`（`LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:39`）
> 與 `GET /sessions/:sessionId/registrations`（同檔 `:30`）仍然存在且無 UI 使用
> ⇒ 這是**孤兒端點**。「要不要刪」是一個獨立的清理決定，**不在本判定內**。
> 判定只說「不做這個能力」，沒說「端點該留還是該刪」。

Web 有 session CRUD（`createSession`/`listEventSessions`/`updateSession`/
`deleteSession`）＋每場次的名冊子頁。App 完全沒有 session 概念。

這一項在上一輪的產業研究裡被列為真缺口（Cvent、Whova、zkipster 都把場次報到放在
行動端）。但它不是「把 Web 頁面搬過來」能解決的：App 需要新的資訊架構
（活動 → 場次 → 名冊），成本是四個缺口裡最高的。

#### 2026-10-29 更正：這一項的框架要改

上面那段讀起來像「Web 有能力、App 缺」。**實際是「Web 也只能看，不能記出席」**
——這是**產品缺一個功能**，不是 App 缺一個功能。三條實測：

**一、Web 名冊頁只能顯示，不能改。**
`LinkCard_Frontend@app/(event)/manage/[eventId]/sessions/[sessionId]/registrations/page.tsx`
全長 242 行，裡面只有兩顆 `<button>`，在 `:218` 與 `:226`，兩顆都是上一頁／下一頁
分頁（`onClick` 是 `setPage`）。全檔沒有 `post(`／`patch(`／`put(`。它能**顯示**
`ATTENDED`／`NO_SHOW`（判定在 `:27`，渲染在 `:189`、`:193`），但**沒有任何方法改它**。

```
wc -l '…/registrations/page.tsx'                        # 242
grep -nE '<button|post\(|patch\(|put\(' '…/page.tsx'    # 218、226（兩顆都在分頁列）
grep -nE 'ATTENDED|NO_SHOW' '…/page.tsx'                # 27、189、193（全部是讀）
```

**二、Web 從來不呼叫那條端點。**

```
grep -rn 'sessions/.*checkin' app components lib hooks
echo "rc=$?"        # rc=1，零命中
```

**三、後端已經做完了，而且權限是對的。**
`LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:39` 就是
`POST /sessions/:sessionId/checkin`（路徑字串在 `:40`），掛的 role gate 在 `:42`：
`eventAccessFactory.create({ level: 'OPERATOR', eventIdSource: 'params' })`
——門口工讀生的角色。這條 role gate 在 events 模組的 **124 條路由裡是唯一一條**：

```
grep -rhoE "router\.(get|post|patch|put|delete)\(" src/events/routes/ | wc -l  # 124
grep -rn 'eventAccessFactory.create' src/ | wc -l                              # 1
```

⇒ **正確的敘述是「後端就緒、兩個前端都沒接」。** 把它當成「App 要追上 Web」會讓
優先順序錯：做完 App 之後 **Web 還是缺**，等於同一件事要做兩次而只做了一次。

**這一條的實作成本比本節原本暗示的低。** 端點存在、權限已正確、測試與 QA script
都已經有人在用，所以剩下的不是「新的資訊架構」，而是**兩邊各一個頁面、各加一顆
按鈕**。（本資料夾不估工時，這句是定性判斷。）

這個框架不是本節首創。未合併分支 `feat/onsite-scope-decisions` 上有一份決策簡報
把 D3 寫成「後端有、Web 和 App 都沒有」，用
`git show feat/onsite-scope-decisions:docs/analysis/onsite-scope-20261022/05-decision-brief.md`
可讀到那一節。它放在另一條分支上，所以這裡用 `git show` 的形式引用、不寫成
`檔案:行號`（引用閘門解析不到那條分支）。上面三條命令是本節的**獨立驗證**，不是
轉抄——本批審計先前從未讀過那份簡報，這件事記在 `02-delta-app-backend.md` §2.1。

**判定已於 2026-10-29 改為 `BY_DESIGN`（不再是 `APP_GAP`）。** 原本那一格的穩定
意思是「App 相對 Web 少了那個頁面」，那仍然成立——Web 有名冊頁、App 連場次概念
都沒有。但它不是一個待辦：**活動沒有場次，所以那個頁面沒有存在的必要**。

留下來的那個觀察仍然有效，只是不再指向 G-9：**「App 落後 Web」與「兩個前端都
落後於後端」是兩件不同的事**，而 `APP_GAP` 這個桶分不出它們。未來的「兩邊都缺」
能力可以直接用這個區分（結構分析見 `04-gap-register.md` §G-9 的〈分類問題〉）。

## 3.4 硬體分野：誰才是超集，取決於現場帶了什麼

這一節存在的理由：如果不寫清楚，結論會被讀成「Web 比較強，App 要追」。

| 情境                         | 寫卡                              | 綁卡 | 上鎖 | 報到 |
| ---------------------------- | --------------------------------- | ---- | ---- | ---- |
| Web＋ACR1555U 讀卡機＋Chrome | ✅                                | ✅   | ✅   | ✅   |
| Web，沒有讀卡機／非 Chrome   | ❌ `write-card-blocked`           | ❌   | ❌   | ✅   |
| App，Android                 | ✅ NDEF                           | ✅   | ❌   | ✅   |
| App，iOS                     | ❌ 硬阻擋（`nfc-bind.tsx:84-85`） | ✅   | ❌   | ✅   |

所以正確的敘述是：Web 在有讀卡機時是超集，App 在只有手機時是唯一可行解。
兩者不是替代關係，是同一條流程的兩種設備配置。

## 3.5 App 獨有的三項，以及一項要撤回

| 能力                | App 落點                | Web 有嗎                    | 判定                       |
| ------------------- | ----------------------- | --------------------------- | -------------------------- |
| 現場報名（walk-in） | `walk-in.tsx`（304 行） | ❌ 全庫無 walk-in 頁        | `APP_ONLY`                 |
| 卡片交換的 UI       | `nfc-exchange.tsx`      | ⚠️ 只有 API 綁定，無頁面    | `APP_ONLY`                 |
| 手機直接感應讀 UID  | `nfc-read.tsx`          | ➖ 改用讀卡機，等價能力存在 | `APP_ONLY`（裝置路徑不同） |

**要撤回的一項：Token 帳本。** 上一輪把「Token 帳本」列為 App 差異化，這一輪讀了
原始碼後必須更正：

- `src/app/(auth)/[eventId]/token.tsx` 是一個 **placeholder**，內容是
  `EmptyState`（`token.tsx:28-55`），沒有任何帳本。
- 這個判定的證據不必讀到畫面：**整檔只有 68 行**（`wc -l` 實測）。其中
  `export default function TokenPlaceholderScreen()` 在 `:16`、
  `StyleSheet.create` 在 `:61-68`，`EmptyState` 元素佔 `:28-55`。全檔對
  `useEffect|useState|fetch|apiClient|service|useQuery|await` **零命中**
  （grep exit 1）——68 行裡沒有任何一次資料請求，一個沒有請求的畫面不可能有帳本。
  先前寫 `token.tsx:28-59` 是引到元件函式的收尾大括號（`:59`），不是元素的收尾。
- 它的次要動作會開 `WEB_BASE_URL/manage/:id/wallet`（`token.tsx:49`），
  而 Web 沒有這條路由：`find app -name '*wallet*'` 只找到
  `app/(personal)/(shell)/my-tickets/[registrationId]/wallet`（參加者視角）。

  引用慣例：`:48` 是 `Linking.openURL(` 的呼叫起點，URL 字面在 `:49`。
  本文原本寫 `:48`，那是把呼叫起點當成字面行，已於 2026-10-29 更正。

真正的錢包流水在 `registrant/[registrationId].tsx`，但它有兩個缺陷（沿用上一輪
診斷，今日仍在 `main`）：

1. 渲染 `tx.approvedBy`
   （`LinkCard_Event_Admin_App_Expo@src/app/(auth)/[eventId]/registrant/[registrationId].tsx:186`），
   而後端的交易投影
   沒有這個欄位 ⇒ 每一行都顯示 `—`，看起來像「沒有經手人」。
2. 沒有分頁 ⇒ 超過 20 筆的流水看不到，也沒有提示。

## 3.6 九個 `BY_DESIGN` 的理由

每一條都要能被反駁；若反駁不了，它就該降級成 `APP_GAP`。**（九條裡有兩種類型的
反駁，差別在「要推翻什麼」，見本節末的小表。）**

| 模組           | 理由                                                                                     | 何時該重新考慮                                       |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Profile        | 改活動名稱、時間、地點是**活動前**的事，且需要看整份報名表單的欄位設計                   | 出現「活動當天改時間」的實際需求                     |
| Content        | 落地頁文案與區塊編輯是長文本工作，手機不是合適的輸入裝置                                 | 平板成為主要營運裝置                                 |
| Ticket Types   | 票種與語意綁定（`hasInvalidSemanticBinding` 等）是設定層，App 只需在現場報名時**讀**票種 | 出現現場改價／改名額的授權需求                       |
| Exhibitors     | 廠商審核與匯入是批次工作，現場不做                                                       | 出現「攤位現場報到」需求（目前無）                   |
| Polls          | 即時投票的建立與計票是主持端工作                                                         | 主持人改用平板操作                                   |
| Bank Transfers | 匯款覆核是財務職責，需要雙人核可與完整稽核軌跡                                           | 財務明確要求行動覆核                                 |
| Org Roles      | 授權他人是治理動作，應在有大螢幕與完整說明的環境完成                                     | 無（不建議）                                         |
| Settings       | 活動整體設定（狀態、報名開關）屬於活動前準備                                             | 出現「臨時關閉報名」的現場需求                       |
| Sessions       | 活動**不分場次**：入場簽到即派發手環＋掛牌，出入靠掛牌人工目視，不需要逐場次的出席紀錄   | 活動改成多場次制（同一張票要選場次、每場有獨立容量） |

**這九條的產業依據分兩批，不能混為一談。** 前八條沿自 2026-10-22 那一輪的六家
研究（本輪未重跑）；第九條（Sessions）的依據恰好相反——2026-10-29 的定向補查
查到 5 個產品**全部**有場次報到，它是唯一一條「產業有、我們決定不做」的
`BY_DESIGN`（見下方限定）。

上一輪把六家（Eventbrite、Whova、Cvent、zkipster、Expo Pass、Swapcard）收斂成
四層模型（設定層／內容層／現場執行層／參與層）。本輪做的只是把這張表重新對到上面
八個模組：對應關係仍是 1:1，八項全部落在設定層、內容層或財務層，沒有一項落在現場
執行層。

**2026-10-29 加入第九條之後，上面那句必須限定。** Sessions 落在**現場執行層**——
它是第一條「產業標配、我們仍然決定不做」的 `BY_DESIGN`，而它的理由與前八條**不是
同一種**：

|              | 前八條                                       | Sessions                                                 |
| ------------ | -------------------------------------------- | -------------------------------------------------------- |
| 理由的種類   | 裝置不合適（輸入太長、需要大螢幕、財務職責） | **營運單位不存在**（活動不分場次）                       |
| 要推翻什麼   | 指出某個現場情境真的需要手機操作             | 推翻「活動沒有場次」這個事實                             |
| 推翻成功之後 | 回到 `APP_GAP`（確實該做）                   | 也回到 `APP_GAP`——但這是「需求成立」，不是「手機變合適」 |

兩者的落點相同（都是回頭變成待辦），但**被推翻的對象不同**：前八條推翻的是「這個
裝置不行」的判斷，Sessions 推翻的是「這個單位不存在」的事實。混淆這兩者的代價是
把 Sessions 讀成一條「未來有空再做」的待辦，而它實際上需要的是**先證明場次存在**。

這張小表存在的理由：如果只把 Sessions 當成表格的第九列，讀者會用它跟其他八條一樣
的方式理解它（「因為手機不方便」），然後在下一次有人提「場次」時重新問一次。它被
判 `BY_DESIGN` 的原因不是「不方便」，是**對象不存在**。

**證據等級：一度成立、未經本輪複核。** 上一輪的原始研究在
`audit/parity-20261022:docs/analysis/adminapp-parity-20261022/05-industry-research.md`
與 `appendix/r1-vendor-capability-split.md`（450 行／53 個來源），而該分支**尚未併入
`main`**——`git merge-base --is-ancestor audit/parity-20261022 HEAD` 為假，
`git ls-tree HEAD` 下該目錄只有 `00-method-and-scope.md`。也就是說**在本分支上這個
引用是打不開的**，要讀原文得 `git show audit/parity-20261022:<path>`。

**重跑條件：不必全跑。** 只有當上表某一列的「何時該重新考慮」真的發生（例如出現
「活動當天改時間」的實際需求、或財務要求行動覆核、或活動改成多場次制），才針對
**那一列**去重跑對應廠商的公開文件，並只更正那一列。右欄同時是這九條可被反駁的
入口——某條觸發後重跑若站不住，它就得從 `BY_DESIGN` 降級成 `APP_GAP`（判準見本節
開頭）。
