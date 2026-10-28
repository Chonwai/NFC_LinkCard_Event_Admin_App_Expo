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
| 9   | Sessions       | `…/sessions`（＋名冊子頁）    | —                                  | `APP_GAP`           |
| 10  | Polls          | `…/polls`                     | —                                  | `BY_DESIGN`         |
| 11  | Bank Transfers | `…/bank-transfers`            | —                                  | `BY_DESIGN`         |
| 12  | Org Roles      | `…/org-roles`                 | —                                  | `BY_DESIGN`         |
| 13  | Settings       | `…/settings`                  | `settings.tsx`（App 偏好，非活動） | `BY_DESIGN`         |
| —   | NFC 診斷台     | `/nfc`                        | —                                  | `WEB_ONLY_INTERNAL` |

統計：`ALIGNED` 1（活動清單）、`ALIGNED_DEFECT` 1、`APP_GAP` 4、`BY_DESIGN` 8、
`WEB_ONLY_INTERNAL` 1，共 15 項，與 `parity/parity-registry.json` 逐項對應。

13 個活動內模組的分佈是：8 個 `BY_DESIGN`、4 個 `APP_GAP`、1 個 `ALIGNED_DEFECT`。

`BY_DESIGN` 的每一項都必須有一句可反駁的理由，見 §3.6。理由是判定的主體，
表格只是索引。

## 3.2 Overview：兩邊都有，App 對 OPERATOR 會壞

Web 現在每張入口卡都帶數字，全部來自一次 `GET /events/:eventId/manage-stats`
（`hooks/events/useManageStats.ts`，頁面檔頭 `app/(event)/manage/[eventId]/page.tsx:8-24`）。

App 的 `overview.tsx` 顯示報名數、已報到數、到場率（`overview.tsx:133-159`），
但它拿數字的方式是：

```ts
const [totalRes, checkedInRes] = await Promise.all([
  eventService.getRegistrations(eventId, { limit: 1 }),
  eventService.getRegistrations(eventId, { limit: 1, status: "CHECKED_IN" }),
]);
```

問題不在 `Promise.all`，在於 `GET /:eventId/registrations` 的閘門是
`getEventWriteAccess`，角色集不含 OPERATOR。而 `my-managed` 對任何 ACTIVE org role
都回傳，所以 OPERATOR 看得到活動、點得進來、然後兩個請求都 403。

更刺眼的是：這個數字**已經在手上**。`event.service.ts:38-48` 早就把
`_meta.registrationCount` unwrap 成 `event.registrationCount` 了。

判定 `ALIGNED_DEFECT`：能力存在，實作對一整個角色壞掉。

## 3.3 四個 `APP_GAP`

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

### G-B Registrations：App 只讀，Web 可管理

Web `registrations/page.tsx` 的動作（行號見檔內）：
`exportAttendeesCsv:29`、`hide/unhide:101,148`、`archive/unarchive:28,35,181-186`、
退款登記 modal `:106`、狀態更正 `:94`、`depositRefundFilter` `:140`。

App `registrations.tsx`：狀態篩選（5 種）、前端搜尋、排序（時間／姓名）、分頁。

差距本質：App 的名單是「查」的工具，Web 的名單是「改」的工具。這一項是四個
`APP_GAP` 裡最需要先問清楚的一個，因為「誰有權改報名資料」是政策問題，不是技術
問題（見 `04-gap-register.md` §G-6）。

### G-C Check-in：Web 現在是超集

| 能力                    | Web                                  | App                              |
| ----------------------- | ------------------------------------ | -------------------------------- |
| QR 掃碼                 | ✅ `@yudiel/react-qr-scanner`        | ✅ `expo-camera`                 |
| 手動輸入報名碼          | ✅                                   | ✅                               |
| 防連掃門閂              | ✅ `scanInFlight`                    | ✅ `scanInFlight:100`            |
| 成功後顯示 profile 路徑 | ✅                                   | ✅                               |
| 同一畫面寫卡            | ✅ `WriteCardPanel`（524 行）        | ❌ 要跳 `nfc-bind`               |
| 寫完自動綁卡            | ✅ `bindWrittenBadge`                | ✅ 在 `nfc-bind` 內              |
| 卡片上鎖（PWD_AUTH）    | ✅ `lib/nfc/globalPassword`          | ❌ 無對應層                      |
| 讀卡機連線／重連        | ✅ `DeskReaderBar`                   | ❌ 不適用                        |
| 失敗後的處置動作        | ✅ `retry/swap_card/skip/retry_bind` | ⚠️ 分散在文案                    |
| 重複報到的處理          | 顯示錯誤字串                         | 錯誤＋**「申請主管覆核」死按鈕** |

最後一列是全份文件唯一的 P0，見 `04-gap-register.md` §G-1。

### G-D Sessions：兩邊都沒有做「現場報到」，但 Web 至少有骨架

Web 有 session CRUD（`createSession`/`listEventSessions`/`updateSession`/
`deleteSession`）＋每場次的名冊子頁。App 完全沒有 session 概念。

這一項在上一輪的產業研究裡被列為真缺口（Cvent、Whova、zkipster 都把場次報到放在
行動端）。但它不是「把 Web 頁面搬過來」能解決的：App 需要新的資訊架構
（活動 → 場次 → 名冊），成本是四個缺口裡最高的。

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

## 3.6 八個 `BY_DESIGN` 的理由

每一條都要能被反駁；若反駁不了，它就該降級成 `APP_GAP`。

| 模組           | 理由                                                                                     | 何時該重新考慮                     |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Profile        | 改活動名稱、時間、地點是**活動前**的事，且需要看整份報名表單的欄位設計                   | 出現「活動當天改時間」的實際需求   |
| Content        | 落地頁文案與區塊編輯是長文本工作，手機不是合適的輸入裝置                                 | 平板成為主要營運裝置               |
| Ticket Types   | 票種與語意綁定（`hasInvalidSemanticBinding` 等）是設定層，App 只需在現場報名時**讀**票種 | 出現現場改價／改名額的授權需求     |
| Exhibitors     | 廠商審核與匯入是批次工作，現場不做                                                       | 出現「攤位現場報到」需求（目前無） |
| Polls          | 即時投票的建立與計票是主持端工作                                                         | 主持人改用平板操作                 |
| Bank Transfers | 匯款覆核是財務職責，需要雙人核可與完整稽核軌跡                                           | 財務明確要求行動覆核               |
| Org Roles      | 授權他人是治理動作，應在有大螢幕與完整說明的環境完成                                     | 無（不建議）                       |
| Settings       | 活動整體設定（狀態、報名開關）屬於活動前準備                                             | 出現「臨時關閉報名」的現場需求     |

**這八條的產業依據沿自 2026-10-22 那一輪的六家研究，本輪未重跑。**

上一輪把六家（Eventbrite、Whova、Cvent、zkipster、Expo Pass、Swapcard）收斂成
四層模型（設定層／內容層／現場執行層／參與層）。本輪做的只是把這張表重新對到上面
八個模組：對應關係仍是 1:1，八項全部落在設定層、內容層或財務層，沒有一項落在現場
執行層。

**證據等級：一度成立、未經本輪複核。** 上一輪的原始研究在
`audit/parity-20261022:docs/analysis/adminapp-parity-20261022/05-industry-research.md`
與 `appendix/r1-vendor-capability-split.md`（450 行／53 個來源），而該分支**尚未併入
`main`**——`git merge-base --is-ancestor audit/parity-20261022 HEAD` 為假，
`git ls-tree HEAD` 下該目錄只有 `00-method-and-scope.md`。也就是說**在本分支上這個
引用是打不開的**，要讀原文得 `git show audit/parity-20261022:<path>`。

**重跑條件：不必全跑。** 只有當上表某一列的「何時該重新考慮」真的發生（例如出現
「活動當天改時間」的實際需求、或財務要求行動覆核），才針對**那一列**去重跑對應廠商
的公開文件，並只更正那一列。右欄同時是這八條可被反駁的入口——某條觸發後重跑若站不
住，它就得從 `BY_DESIGN` 降級成 `APP_GAP`（判準見本節開頭）。
