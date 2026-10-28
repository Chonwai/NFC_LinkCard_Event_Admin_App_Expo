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

它不是單純的死路徑，是**誤導的死路徑**：畫面會顯示「覆核已送出／尚未就緒」的
橫幅（`check-in.tsx:315,718-723`），操作員因此以為有人會處理。

修法（上一輪已做，`5bcdb53`）：移除按鈕，改指向詳情頁，那裡看得到實際報到時間。

不要嘗試用 `/registrations/:id/status` 頂替：它對已 CHECKED_IN 的紀錄回
`409 REGISTRATION_STATUS_UNCHANGED`，而且需要 COORDINATOR，不是門口的 OPERATOR。

### G-2 Token 畫面連到不存在的 Web 路由（P1，缺陷）

`src/app/(auth)/[eventId]/token.tsx:48` 開 `${WEB_BASE_URL}/manage/${eventId}/wallet`。
Web 沒有這條路由（`find app -name '*wallet*'` 只有參加者視角的
`my-tickets/[registrationId]/wallet`）。

這是「placeholder 假裝自己有下一步」的典型：整個畫面本來就是 `EmptyState`，
卻還給了一個會 404 的次要動作。

### G-3 錢包流水讀錯欄位且忽略分頁（P1，缺陷）

`LinkCard_Event_Admin_App_Expo@src/app/(auth)/[eventId]/registrant/[registrationId].tsx:186`
渲染 `tx.approvedBy`，後端投影沒有這個欄位
⇒ 每一行顯示 `—`。同時 `getWalletTransactions` 沒有帶分頁參數，預設 20 筆，
超過的部分無聲消失。

這一項的危險不是少顯示，而是**顯示了一個不存在的否定事實**（看起來像「沒有人員
記錄」）。

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
