# 04 — 缺口登記冊

<!-- citations: LinkCard_Event_Admin_App_Expo -->

每一項都要能回答四個問題：多嚴重、誰該決定、要多少工、卡在誰身上。
沒有這四項的條目不算缺口，只是感想。

嚴重度定義：

- `P0` 現在就在產生錯誤結果，或讓操作員做不到本職工作。
- `P1` 做完能明顯縮短現場流程，或堵住一個會誤導人的顯示。
- `P2` 有價值的補強，可以排隊。

## 4.1 總表

| ID   | 項目                                     | 類別 | 嚴重度 | 決策者              | 工作量 |
| ---- | ---------------------------------------- | ---- | ------ | ------------------- | ------ |
| G-0  | 上一輪的修復沒有進主線                   | 流程 | P0     | 你                  | S      |
| G-1  | 「申請主管覆核」呼叫不存在的路由         | 缺陷 | P0     | —（無爭議）         | S      |
| G-2  | Token 畫面連到不存在的 Web 路由          | 缺陷 | P1     | —（無爭議）         | S      |
| G-3  | 錢包流水讀錯欄位且忽略分頁               | 缺陷 | P1     | —（無爭議）         | S      |
| G-4  | 名單型別缺退款／稽核欄位與兩個篩選參數   | 缺陷 | P1     | —（無爭議）         | S      |
| G-5  | 從不查 `/my-access`，角色只是裝飾        | 缺陷 | P1     | —（無爭議）         | S      |
| G-6  | 名單的管理動作（撤銷報到、封存、退款）   | 能力 | P1     | 你＋財務            | M      |
| G-7  | Badge 批次生命週期（建立／回填／匯出）   | 能力 | P1     | 你（兩選項見 §G-7） | M      |
| G-8  | 報到桌：同畫面寫卡＋綁卡＋上鎖           | 能力 | P1     | 你＋現場負責人      | L      |
| G-9  | 場次現場報到                             | 能力 | P2     | 你（兩選項見 §G-9） | L      |
| G-10 | 總覽對 OPERATOR 失效，且多打一次請求     | 缺陷 | P1     | —（無爭議）         | S      |
| G-11 | 契約閘門不在 CI 上                       | 流程 | P1     | —（無爭議）         | S      |
| G-12 | 授權只在 controller 層，路由層無角色閘門 | 缺陷 | P2     | 需決策（後端）      | M      |

`S` ≦ 半天、`M` ≦ 兩天、`L` 需要設計與驗收。

> **讀 `status` 欄位之前先讀這段（2026-10-29 實測）。**
> `parity/parity-registry.json` 的 `fixed-on-branch` 意思是「**修法存在於某條
> 未合併的分支**」，**不是**「已修好」。它回答的是「有沒有人做過」，不是「現在
> 這棵樹上有沒有」。
>
> 判定依據是 `audit/parity-20261022` **不是** HEAD 的 ancestor：
>
> ```
> git merge-base --is-ancestor audit/parity-20261022 HEAD && echo '22 MERGED' || echo '22 NOT merged'
> # → 22 NOT merged
> git rev-list --count origin/main..audit/parity-20261022
> # → 28
> ```
>
> 所以標成 `fixed-on-branch` 的六項——`G-1 G-2 G-3 G-4 G-5 G-11`——在
> `feat/nfc-gate1-reader-spike`（本輪文件的 HEAD）上**有效修復數是 0**，六項
> **全部仍然存在**。逐項在 HEAD 上重跑的證據：
>
> - **G-1** — `src/services/registration.service.ts:50` 仍打
>   `…/registrations/checkin/override`。
> - **G-2** — `src/app/(auth)/[eventId]/token.tsx:49` 仍開
>   `${WEB_BASE_URL}/manage/${eventId}/wallet`。
> - **G-3** — 後端投影仍缺 `approvedBy`（見 §4.2 G-3）。
> - **G-4** — `depositRefunded`／`archivedAt`／`checkedInBy`／`boundOnly` 四個
>   字串在 `src/` 各命中 **0 檔**。
> - **G-5** — `grep -rn 'my-access' src/` 命中 **0**。
> - **G-11** — `scripts/check-backend-contract.mjs` 在 HEAD 不存在
>   （`ls` 回 No such file）；該檔在 `audit/parity-20261022` 上才存在。
>
> 一個容易誤讀的例外：`.github/workflows/ci.yml:46` **確實**有
> `npm run check:parity`。但那是**登記冊一致性**閘門，不是 G-11 講的**後端契約**
> 閘門；後者指 `scripts/check-backend-contract.mjs`。不要因為 CI 有一個 check
> 就以為 G-11 已解。
>
> 重跑（App repo 根目錄）：
>
> ```
> git merge-base --is-ancestor audit/parity-20261022 HEAD && echo '22 MERGED' || echo '22 NOT merged'
> git rev-list --count origin/main..audit/parity-20261022
> node -e "const r=require('./parity/parity-registry.json');console.log((r.gaps||[]).filter(g=>g.status==='fixed-on-branch').map(g=>g.id).join(' '))"
> ```
>
> 這不改變任何一項的 `status` 值——`fixed-on-branch` 本身是準確的，會誤導人的是
> 讀者的預設解讀。

## 4.2 逐項說明

### G-0 上一輪的修復沒有進主線（P0，流程）

`audit/parity-20261022` 有 28 個 commit，含 G-1 至 G-5 的修法，未合併、未 push。
本輪重跑的契約閘門顯示 G-1 仍在 `main` 上。

這件事被列為 P0 而不是「家務事」的理由：G-1 至 G-5 都已經有人做過一次，重做的成本
是兩倍，而沒做的成本是活動當天。**決策只有一個：合併或丟棄。** 不要讓它停在
「等有空再看」的狀態，因為檔案會繼續漂移，越晚合併衝突越多。

建議動作：先跑一次 `npm run check:contract` 與測試確認分支仍綠，再開 PR。
若決定不合併，把分支砍掉並在文件標明「本輪不修」，讓下一個人不必重新判斷。

### G-1 「申請主管覆核」呼叫不存在的路由（P0，缺陷）

`src/services/registration.service.ts:42-57` 呼叫
`POST /api/v1/events/:eventId/registrations/checkin/override`。
後端 grep 零命中；`GET` 也一樣。

它不是單純的死路徑，是**誤導的死路徑**：畫面會顯示「覆核 API 尚未開放」的橫幅，
操作員因此以為有人會處理。這個宣稱牽涉三個不同位置，先前併寫成
`check-in.tsx:315,718-723` 是錯的引法——三件事分開引用：

1. **文案字串**在 `src/constants/copy.zh-TW.ts:277-278`
   （`overrideBlockedBanner`，字面為「覆核 API 尚未開放（BLOCKED／待後端 B-2）。
   現場請人工放行並記錄。」），不在 `check-in.tsx` 裡。同檔 `:276` 是按鈕標籤
   「申請主管覆核」；`:279` 的 `overrideBlockedToast` 全 repo 零引用，是死文案
   （`grep -rn 'overrideBlockedToast' src/` 只回定義那一行）。
2. **設定狀態**在 `check-in.tsx:315`
   （`setOverrideBanner(copy.checkIn.overrideBlockedBanner)`）；失敗分支再設一次，
   `check-in.tsx:330`。
3. **渲染**在 `check-in.tsx:714-731` 的 `duplicate` 分支：橫幅 `:716-719`，
   申請按鈕 `:720-724`。

先前寫的「覆核已送出／尚未就緒」也不精確：字面上沒有「已送出」，只有「尚未開放」。

修法（上一輪已做，`5bcdb53`）：移除按鈕，改指向詳情頁，那裡看得到實際報到時間。

不要嘗試用 `/registrations/:id/status` 頂替：它對已 CHECKED_IN 的紀錄回
`409 REGISTRATION_STATUS_UNCHANGED`，而且需要 COORDINATOR，不是門口的 OPERATOR。

**補充（2026-10-29 複核）：這個按鈕沒有任何角色閘門。**

`grep -n 'canOverride\|Gate\|role' 'src/app/(auth)/[eventId]/check-in.tsx'`
零命中（exit 1）。放寬到
`useAuth|permission|Permission|admin|operator|OPERATOR|organizer|staff|scope`
再跑一次，命中的行全部是 `expo-camera` 的**相機權限**（`:14`、`:83`、`:151-155`、
`:168`、`:467-481`），沒有一行是 RBAC。

`onRequestOverride`（`check-in.tsx:310-334`）唯一的守衛是 `:311` 的
`!eventId || state.phase !== "outcome" || state.kind !== "duplicate"`——那是**畫面
狀態**的守衛，不是**身份**的守衛。

所以 G-1 的性質比「呼叫不存在的路由」更重：那條路由就算補上，**任何能開到這個畫面
的操作者都能按下去**，畫面上不會有任何角色差異。只補後端而以為前端已有限制，會做出
一條沒有授權邊界的覆核通道。

這也是**不另立 gap ID** 的理由：角色閘門與路由存在性綁在同一個按鈕上，依上述修法把
按鈕整個移除後，兩件事一起消失。日後若要做成真的可用的覆核入口，屆時再依「誰可以
覆核」重新立項，而不是現在拆一條沒有實作位置的缺口。

### G-2 Token 畫面連到不存在的 Web 路由（P1，缺陷）

`src/app/(auth)/[eventId]/token.tsx:49` 開 `${WEB_BASE_URL}/manage/${eventId}/wallet`。
Web 沒有這條路由（`find app -name '*wallet*'` 只有參加者視角的
`my-tickets/[registrationId]/wallet`）。

**引用行號的更正（2026-10-29）。** 上述行號原本寫 `:48`，那是 `Linking.openURL(`
的呼叫起點，URL 字面在下一行的 `:49`。`07-briefing.md §7.11` 從一開始就寫 `:49`
（該節是在併入後的 HEAD 上重跑 `grep -n 'wallet'` 得到），**是 03／04 兩份文件寫錯**，
不是 briefing 寫錯。矛盾的來源是「呼叫起點 vs 字面行」這兩種引用慣例混用：指涉
「哪一條 URL」時一律引用字面行。

這是「placeholder 假裝自己有下一步」的典型：整個畫面本來就是 `EmptyState`，
卻還給了一個會 404 的次要動作。

上一輪的做法（`860404f`）是把它改指向 App 自己的名單頁——因為「誰有 token 流水」
這件事在 App 內就查得到（參加者詳情頁），不需要把人送去 Web。

### G-3 錢包流水讀錯欄位且忽略分頁（P1，缺陷）

`LinkCard_Event_Admin_App_Expo@src/app/(auth)/[eventId]/registrant/[registrationId].tsx:186`
渲染 `tx.approvedBy`，後端投影沒有這個欄位
⇒ 每一行顯示 `—`。同時 `getWalletTransactions` 沒有帶分頁參數，預設 20 筆，
超過的部分無聲消失。

這一項的危險不是少顯示，而是**顯示了一個不存在的否定事實**（看起來像「沒有人員
記錄」）。

**修法成本（2026-10-29 實測）。** 這是全冊最便宜的一項，因為欄位**已經在 DB
裡**：`LinkCard_ExpressJS_Backend@prisma/schema.prisma:1313` 已有
`approvedBy String? @map("approved_by")`（可為 null）。卡住的只是後端投影——
`LinkCard_ExpressJS_Backend@src/events/services/EventWalletService.ts:43-51` 的
`select` 少了它。補一行 `approvedBy: true` 就會回傳，**免 migration、不動 schema**。

App 這端要改 **0 行**：`src/services/registration.service.ts:108` 已經宣告
`approvedBy?: string | null`，`[registrationId].tsx:186` 也已經在渲染。

但「每行從 `—` 變人名」需要拆成三步講，否則會低估：

1. **一行 select 換到的是 User UUID，不是姓名。** 寫入端存的是
   `approvedBy: operatorUserId`
   （`LinkCard_ExpressJS_Backend@src/events/services/EventWalletService.ts:113`），
   該值來自 `req.user.id`
   （`LinkCard_ExpressJS_Backend@src/events/controllers/EventWalletController.ts:74`）
   ＝`User.id`（uuid）。要顯示姓名得再一步把 id 換成 `User.display_name`。
   `approvedBy` 是裸 `String?`、**沒有 relation**，所以這一步只能**另查 users**
   （不能 `include`；但也**不需要**為此建 FK 或跑 migration）。
2. **只有 TOP_UP 類的行會變。** 三個寫入點裡只有 `topUp` 帶 operator；
   `deductToken`（`:167`）與 `allocateInitialTokens`（`:203`）寫入時都沒帶，所以
   DEDUCTION／INITIAL_ALLOCATION 無論投影怎麼改仍是 `—`。要補的是 `deductToken`
   的**參數簽名**（controller 手上已有 `req.user.id`，只是沒往下傳）——同樣 S
   級、不動 schema。
3. **分頁是獨立的一半。** 它與欄位無關：模型端點已支援 `page`／`limit`，只是 App
   的 `getWalletTransactions`（`registration.service.ts:98`）沒帶參數。

所以更正後的說法是：**先變成一個可辨識的操作者 id（一行 select），再變成姓名
（多一次 users 查詢）**，而且只有 TOP_UP 那類行會變。工作量維持 `S`——它仍是
登記冊裡唯一一項「後端一行、App 零行、無 migration」的缺口，只是「體感」要把
「顯示 id」與「顯示人名」分開看。

### G-4 名單型別缺欄位與篩選（P1，缺陷）

`Registration` 型別缺退款與稽核欄位（`depositRefunded*`、`archivedAt`、
`checkedInBy`），`getRegistrations` 缺 `depositRefunded`、`boundOnly` 兩個後端已
支援的參數。

注意一個容易誤用的細節：`GET /registrations/by-code/:code` 的 select **不含**這些
欄位，只有名單端點會回。所以詳情頁不能渲染它們，除非改成從名單端點取。

### G-5 從不查 `/my-access`（P1，缺陷）

App 目前用 `my-managed` 回傳的 `_meta.userRole` 當角色判斷來源。那是「你在這場
活動有沒有角色」，不是「你能不能做這件事」。兩者在 OPERATOR 身上就會分岔。

後端有現成的 `GET /events/:eventId/my-access` → `{canManage, canOperate,
canInviteAdmins, role}`，Web 早就在用。App 打一次，把四個布林當作畫面開關，
就可以把 G-10 與一半的誤導訊息一起解掉。

### G-6 名單的管理動作（P1，能力，需要決策）

Web 能匯出 CSV、隱藏／封存、登記退款、更正狀態。App 只能查。

技術上不難（都是既有端點）。難的是政策：門口 OPERATOR 該不該有「封存報名」的權限？
這不是程式問題，所以它必須由人決定，而不是由實作進度決定。

建議的切法（可在不改後端的前提下做到）：

- 匯出 CSV：不給。名單分析是主辦方工作，且手機不便處理檔案。
- 隱藏／封存：只給 COORDINATOR 以上，且要二次確認與原因輸入（Web 已有原因欄位）。
- 退款登記：不給。財務動作需要稽核軌跡與雙人核可。

### G-7 Badge 批次生命週期（P1，能力）

建立批次 → 認領 → 回填 UID → 匯出，四步都在後端就緒。App 只做了「查」。
活動當天若要臨時補一批卡，目前必須回 Web。

這一項與 G-8 的關係很密切：如果 G-8 決定「App 不做現場寫卡」，那 G-7 的優先度
會上升，因為 App 至少要有能力處理卡片資料；反之若 G-8 做了，G-7 可以排後面。

**2026-10-29 的定向補查把這一項切成兩件事，而不是一件。** 六家產品的一致切法是
「**內容製作與批次匯出在 Web，單張即時輸出在 App**」：

| 產品       | 批次／內容製作                              | 單張即時輸出                       |
| ---------- | ------------------------------------------- | ---------------------------------- |
| Swapcard   | Studio → People → Export badges（Web）      | SwapAccess 自助報到完成後自動列印  |
| zkipster   | Name Badge Editor（瀏覽器）                 | App 的 `Auto Print`：check-in 出牌 |
| Cvent      | —（OnArrival 的 badge printing 屬 Premium） | 綁在 OnArrival 的報到流程          |
| Eventbrite | 建立／匯出 name badges 屬**網站**權限       | App 只有 check-in                  |

所以真正要選的不是「搬多少模組」，而是「**批次生命週期要不要上手機**」。

**選項 A（現行建議）**：把批次生命週期搬進 App——建立批次、回填 UID、匯出，
範圍見 `05-alignment-plan.md` §5.3 軌道 A；不做批次認領（那是活動前準備工作）。

- 好處：活動當天臨時補一批卡時不必離開手機；App 具備完整的卡片資料處理能力，
  G-8 若決定寫卡也有現成入口。
- 代價：`M`（≦ 兩天）；四步都要在手機上做出可用介面，其中「匯出」在手機上難以
  成立（CSV 要給誰、存哪裡）；且要逐一確認四個端點在行動端的錯誤處理。
- 選它等於承認：**我們相信操作員會在手機上做批次作業**——六家產品全部沒有這樣
  做，而我們沒有任何現場證據說有人會這樣用。

**選項 B（依 2026-10-29 產業補查調整）**：縮成「報到成功 → **單張**發卡」，
批次生命週期留在 Web。App 只保留查詢（現況）＋單張發卡的入口整理。

- 好處：增量小。後端現有的是 `POST /nfc/batch/claim`，但它是**指派給展商**
  （`exhibitorId`，見
  `LinkCard_ExpressJS_Backend@src/events/controllers/EventNfcBatchController.ts:147`），
  不是發給參加者；發給參加者走的是 `POST /nfc/bind`，
  App 已經在做（報到成功頁已帶 `?code=` 預填）。也就是說 B 的增量主要是入口與
  文案，不是新端點。
- 代價：臨時補 10 張卡時要重複 10 次單張流程，或回 Web 建批次。另外業界語彙的
  「列印」在我們這裡沒有對應物——我們的發卡是「把實體卡 UID 綁到報名」，
  **本輪未查是否已有印表機整合**，沿用它時必須自己換算。
- 選它等於承認：**批次作業是活動前準備工作，手機不是它的裝置**——與我們對
  Content／Ticket Types 的既有判斷一致。

**證據等級：** 本節產業依據為 2026-10-29 針對該題的定向補查（六家官方文件）；
**非**整份產業研究重跑。本節用到其中四家：「批次在 Web」這一半四家都有直接條目；
「單張在 App」這一半只有 Swapcard 與 zkipster 有直接條目，Cvent 與 Eventbrite
只到「不在 App」的半邊。

出處（本節）：`help.swapcard.com/en/articles/9346007`（Studio → Export badges）、
`help.swapcard.com/en/articles/8159010`（SwapAccess 自助報到自動列印）、
`support.zkipster.com/en/articles/3728947`（Name Badge Editor 在瀏覽器）、
`support.zkipster.com/en/articles/4535273`（App `Auto Print`）、
`eventbrite.com/help/en-us/articles/362073`（badge 建立／匯出屬網站權限）。
Cvent 只取得「OnArrival 的 badge printing 屬 Premium」這一層敘述，**本節未取得
可直接引用的頁面**，所以它不算一條獨立證據。

**待驗：** 選項 B 的增量是否真的只有入口——若單張發卡在權限、庫存或稽核上還有缺口，
B 會從 `S` 回到 `M`。開工前用一次 `grep` 確認，不要沿用本節的假設。

### G-8 報到桌：同畫面寫卡＋綁卡＋上鎖（P1，能力，需要決策）

Web 已經做到。App 要做到，需要回答三個問題：

1. 手機的 `react-native-nfc-manager` 在 Android 可以送 raw APDU，理論上能上鎖；
   但要驗證曾發生寫入中途斷線的卡片能否回復。
2. iOS 完全做不到寫卡，只有 `QR_ONLY` 這條路。介面必須誠實說出這件事。
3. 若現場用平板（Web）＋手機（App）並存，兩邊的「已綁定」狀態要靠後端一致，
   不能各記一份。

在回答之前，建議先做一件成本極低的事：把 `nfc-bind` 的入口從報到成功頁直接帶
`?code=` 預填（目前已是如此），並在 App 的寫卡頁明確寫出「這張卡是否已上鎖」。
這樣即使不上鎖，操作員也知道風險。

### G-9 場次現場報到（P2，能力）

App 沒有 session 概念。要做的話是新的資訊架構（活動 → 場次 → 名冊 → 報到），
不是搬頁面。產業上這是行動端的標準能力，但它的前置是「活動有場次」這件事在你們的
使用情境裡是否成立。

2026-10-29 的定向補查把「產業上」補成可引用的句子：**查到的 5 個產品全部有**，
而且其中一個明寫支援離線。

- Whova — 場次層級的現場報到
  （`whova.zendesk.com/hc/en-us/articles/360020638492`）
- Swapcard — SwapAccess Onsite Session Tracking，**支援離線**
- Bizzabo — Onsite Command App
- zkipster — check-in by Session
- Cvent — OnArrival 的 session tracking 屬 Premium

**本輪另查到一個實作事實，它改變這一項的價格，但不改變決策：後端那一半已經在了。**
`GET /sessions/:sessionId/registrations`（場次名冊）與
`POST /sessions/:sessionId/checkin`（掛 `OPERATOR` 的 event access）都已註冊——
見 `LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:29-44`；
而 App 對 `sessions/` 的呼叫是 **0 次**（`grep -rn 'sessions/' src/`）。
所以這一項的成本幾乎全在前端 IA。

**選項 A（現行建議）**：維持 P2 待定，留在登記表上，本輪不做。

- 好處：零工期；不押注在一個還沒確認的產品前提上；不與 G-7／G-8 搶同一個 sprint。
- 代價：如果活動真的有場次，這會是現場最常被問「為什麼 App 沒有」的一項；而等到
  活動前才做，`L` 的工期就變成排程風險。
- 選它等於承認：**我們的活動模型目前沒有場次，或場次報到在現場不是高頻動作**——
  這是一個產品事實的斷言，不是優先度判斷。

**選項 B（依 2026-10-29 產業補查調整）**：承認它是行動端標配 ⇒ 這一項的成立
與否**只取決於「你們的活動模型有沒有場次」**，不取決於優先度。

- 好處：5/5 的對照，共識基礎強；一旦確認有場次，它直接升 P1，排在 G-7／G-8 之後
  即可；後端端點已在（見上），不必先排後端工作。
- 代價：前端是 `L`——新的一層 IA（活動 → 場次 → 名冊 → 報到），不是搬頁面；名冊
  要處理「這位參加者沒報名這個場次」與「只有部分場次有報名」兩種空狀態。
- 選它等於承認：**場次是真實的營運單位**，App 的資訊架構必須為它多一層。

**這兩個選項不是優先度之爭，是同一條事實的兩種答案。** 有場次 → B（升 P1）；
沒有場次 → 從登記表移到 `BY_DESIGN`（判準與 `03-capability-matrix.md` §3.3 相同）。
**留在 P2 不動，其實等於默默選了 A。**

**證據等級：** 本節產業依據為 2026-10-29 針對該題的定向補查（六家官方文件）；
**非**整份產業研究重跑。五個產品各有一條官方條目，但只有 Whova 一條取得可直接
引用的網址；其餘四條取得的是官方文件標題（SwapAccess Onsite Session Tracking／
Onsite Command App／check-in by Session／OnArrival session tracking）。這些標題
**足以支撐「有這個能力」，不足以支撐「這家公司怎麼稱呼它」**；Cvent 那一條仍屬
Premium 商業包裝，不是能力差異。

### G-10 總覽對 OPERATOR 失效（P1，缺陷）

見 `03-capability-matrix.md` §3.2。兩個獨立問題：

1. 用了 OPERATOR 讀不到的端點去算一個**已經在手上**的數字。
2. 兩次請求，其中一次可以用 `manage-stats` 取代——但這不會修好 (1)，
   因為 `manage-stats` 的閘門也是 write access。

正確做法：先用 `event.registrationCount`（已 unwrap）當總數；已報到數若真的需要，
再問後端要不要放寬一個 OPERATOR 可讀的計數端點。不要把兩件事綁成一個 PR。

### G-11 契約閘門不在 CI 上（P1，流程）

`scripts/check-backend-contract.mjs` 只存在於 `audit/parity-20261022`。
G-1 之所以能活這麼久，就是因為沒有任何自動檢查。這一項的最小版本是一個 CI step，
加上一份帶 commit 戳記的快照。

### G-12 授權只在 controller 層，路由層無角色閘門（P2，缺陷）

**待驗事實（2026-10-29 實測，`LinkCard_ExpressJS_Backend`）。**

`src/events/routes/` 共 12 個路由檔、**124 條** `router.<verb>` 註冊。這 12 個檔
從 middleware 匯入的角色檢查只有**一個**：`CheckEventAccessPermissionFactory`，
而且它只在 `sessions-polls.routes.ts` 出現一次，掛在
`POST /sessions/:sessionId/checkin`（`:40` 路徑、`:42`
`eventAccessFactory.create({ level: 'OPERATOR', eventIdSource: 'params' })`）。
其餘 **123 條**路由的路由層只有 `authMiddleware`，或 `optionalAuthMiddleware` 與
上傳 middleware。

真正的角色判斷寫在 **controller**，而且不是一種寫法，是**三套**：

| helper 家族                                                       | 代表呼叫點                                                                                                                                        | 角色語意                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `EventService.getEvent*Access`                                    | `EventTicketTypeController.ts:30`、`EventSessionController.ts:76`、`EventNfcBatchController.ts:38-39`、`EventRegistrationImportController.ts:128` | `EventService.ts:361` 的 `getEventWriteAccess`，角色集在 `:384` 為 SUPER_ADMIN／COORDINATOR |
| `ExhibitorService.getEventOwnerAccess`／`getExhibitorWriteAccess` | `ExhibitorController.ts:47,185,251`、`ExhibitorPageContentController.ts:284`                                                                      | 展商側自己一套                                                                              |
| `utils/registrationAccess.assert*`                                | `EventWalletController.ts:6`（`assertRegistrationOwnershipOrOperator`）                                                                           | 報名擁有者或操作員                                                                          |

**與原始描述的差異（照實標示）。** 簡報所述「路由層無角色閘門」在**結果**上成立
（123／124 條如此），但**機制**上不完全成立：
`src/events/middleware/checkEventAccessPermission.ts` 裡有一支**專為此目的寫的**
factory，它的檔頭註解自己寫著「在 route 層強制檢查 event 管理權限…避免各
controller 手動檢查容易漏掛」（`checkEventAccessPermission.ts:17-18`）。

這一點讓缺口**更明確而不是更輕**：修法已經存在、論證已經寫在程式碼裡，缺的是
**套用**。所以工作量不是「設計一個閘門」，而是「逐條掛上去並確認等級」。

**四問。**

- **多嚴重**：`P2`。它不是「現在就開放」——本輪掃過的 20 支 controller 中，凡是
  會改資料的動作都找得到上述三套 helper 之一。它是**前瞻風險**：新增一條特權路由
  時，路由層只需要 `authMiddleware`，沒有任何 lint、型別或 CI 要求你補上角色檢查；
  漏掉的那一條不會壞、不會紅燈，只會安靜地對所有已登入者開放。這正是 factory 註解
  所預言的失效模式。
- **誰該決定**：後端 owner，而且是**架構決策**而不是實作決策——要決定授權歸屬在
  route 層還是 controller 層。三套 helper 並存本身就說明這個問題從來沒有被統一定調。
- **多少工**：`M`。機制已存在，難的是 123 條路由的**分級**：哪一條要 `WRITE`、
  哪一條 `OPERATOR`、哪一條本來就該公開。等級選錯會讓現場操作員直接 403——
  這比「多一個檢查」風險高，因為它會在活動當天擋住人。
- **卡在誰**：卡在後端 repo 的 PR 排程。**本輪 App 端無事可做，也不該做**——
  App 無法從外部補上後端的授權邊界。

**兩條路（不代人選）。**

- **A — 現在就掛既有 factory。** 用 `CheckEventAccessPermissionFactory` 覆蓋既有的
  高權限路由，先挑「動錢、動別人的報名、動角色」三類。代價 `M`，且必須逐條跑既有
  整合測試確認等級正確；主要風險是等級選錯造成的 403 回歸，需要一次 staging 驗證。
- **B — 排 P2，先加一道便宜的防漏。** 不動既有路由，只加一條「新增
  `router.<verb>` 時必須同時出現 `eventAccessFactory`，或該檔白名單聲明自己公開」
  的檢查（代價 `S`）。它不會修好既有 123 條，但會阻止第 124、125 條繼續累積——
  效果是**止血而非治癒**。

兩條不互斥：B 在任何情況下都划算，A 取決於你要不要在本輪之後動後端。

**這是後端 repo 的改動，不在本輪範圍。本輪只記錄，不改程式。**

**未驗證、因此不斷言的部分。** `grep` 在下列 5 支 controller 找不到任何 access
helper：`CompanyPageController`、`ExhibitorInviteController`、
`ConnectionRequestController`、`EventActivationController`、
`EventNfcExchangeController`。其中至少「公開頁」「邀請 token 即憑證」「操作自己
的資源」三類**本來就不該有活動角色檢查**，所以 grep 不到不等於有缺口。要斷言其中
任何一條有問題，必須逐支讀端點語意與其路由的 auth 形態，那個動作不在本輪。寫在這裡
是為了讓下一個人不必從零重新猜，而不是預先定罪。

## 4.3 不在這裡的東西

以下**刻意不列為缺口**，理由寫在 `03-capability-matrix.md` §3.6：
Profile、Content、Ticket Types、Exhibitors、Polls、Bank Transfers、Org Roles、
Settings。若你不同意其中任何一條，請針對那一條提供一個具體使用情境，我們再改判定。
