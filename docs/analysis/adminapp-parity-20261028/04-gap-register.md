# 04 — 缺口登記冊

<!-- citations: LinkCard_Event_Admin_App_Expo -->

每一項都要能回答四個問題：多嚴重、誰該決定、要多少工、卡在誰身上。
沒有這四項的條目不算缺口，只是感想。

嚴重度定義：

- `P0` 現在就在產生錯誤結果，或讓操作員做不到本職工作。
- `P1` 做完能明顯縮短現場流程，或堵住一個會誤導人的顯示。
- `P2` 有價值的補強，可以排隊。

## 4.1 總表

| ID   | 項目                                   | 類別 | 嚴重度 | 決策者         | 工作量 |
| ---- | -------------------------------------- | ---- | ------ | -------------- | ------ |
| G-0  | 上一輪的修復沒有進主線                 | 流程 | P0     | 你             | S      |
| G-1  | 「申請主管覆核」呼叫不存在的路由       | 缺陷 | P0     | —（無爭議）    | S      |
| G-2  | Token 畫面連到不存在的 Web 路由        | 缺陷 | P1     | —（無爭議）    | S      |
| G-3  | 錢包流水讀錯欄位且忽略分頁             | 缺陷 | P1     | —（無爭議）    | S      |
| G-4  | 名單型別缺退款／稽核欄位與兩個篩選參數 | 缺陷 | P1     | —（無爭議）    | S      |
| G-5  | 從不查 `/my-access`，角色只是裝飾      | 缺陷 | P1     | —（無爭議）    | S      |
| G-6  | 名單的管理動作（撤銷報到、封存、退款） | 能力 | P1     | 你＋財務       | M      |
| G-7  | Badge 批次生命週期（建立／回填／匯出） | 能力 | P1     | 你             | M      |
| G-8  | 報到桌：同畫面寫卡＋綁卡＋上鎖         | 能力 | P1     | 你＋現場負責人 | L      |
| G-9  | 場次現場報到                           | 能力 | P2     | 你             | L      |
| G-10 | 總覽對 OPERATOR 失效，且多打一次請求   | 缺陷 | P1     | —（無爭議）    | S      |
| G-11 | 契約閘門不在 CI 上                     | 流程 | P1     | —（無爭議）    | S      |

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
`src/events/services/EventWalletService.ts:43-51` 的 `select` 少了它。補一行
`approvedBy: true` 就會回傳，**免 migration、不動 schema**。

App 這端要改 **0 行**：`src/services/registration.service.ts:108` 已經宣告
`approvedBy?: string | null`，`[registrationId].tsx:186` 也已經在渲染。

但「每行從 `—` 變人名」需要拆成三步講，否則會低估：

1. **一行 select 換到的是 User UUID，不是姓名。** 寫入端存的是
   `approvedBy: operatorUserId`（`EventWalletService.ts:113`），該值來自
   `req.user.id`（`EventWalletController.ts:74`）＝`User.id`（uuid）。要顯示姓名
   得再一步把 id 換成 `User.display_name`。`approvedBy` 是裸 `String?`、**沒有
   relation**，所以這一步只能**另查 users**（不能 `include`；但也**不需要**為此
   建 FK 或跑 migration）。
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

## 4.3 不在這裡的東西

以下**刻意不列為缺口**，理由寫在 `03-capability-matrix.md` §3.6：
Profile、Content、Ticket Types、Exhibitors、Polls、Bank Transfers、Org Roles、
Settings。若你不同意其中任何一條，請針對那一條提供一個具體使用情境，我們再改判定。
