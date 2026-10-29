# 04 — 缺口登記冊

<!-- citations: LinkCard_Event_Admin_App_Expo -->

每一項都要能回答四個問題：多嚴重、誰該決定、要多少工、卡在誰身上。
沒有這四項的條目不算缺口，只是感想。

嚴重度定義：

- `P0` 現在就在產生錯誤結果，或讓操作員做不到本職工作。
- `P1` 做完能明顯縮短現場流程，或堵住一個會誤導人的顯示。
- `P2` 有價值的補強，可以排隊。

## 4.1 總表

| ID   | 項目                                     | 類別 | 嚴重度 | 決策者                    | 工作量 |
| ---- | ---------------------------------------- | ---- | ------ | ------------------------- | ------ |
| G-0  | 上一輪的修復沒有進主線                   | 流程 | P0     | 你                        | S      |
| G-1  | 「申請主管覆核」呼叫不存在的路由         | 缺陷 | P0     | —（無爭議）               | S      |
| G-2  | Token 畫面連到不存在的 Web 路由          | 缺陷 | P1     | —（無爭議）               | S      |
| G-3  | 錢包流水讀錯欄位且忽略分頁               | 缺陷 | P1     | —（無爭議）               | S      |
| G-4  | 名單型別缺退款／稽核欄位與兩個篩選參數   | 缺陷 | P1     | —（無爭議）               | S      |
| G-5  | 從不查 `/my-access`，角色只是裝飾        | 缺陷 | P1     | —（無爭議）               | S      |
| G-6  | 名單的管理動作（撤銷報到、封存、退款）   | 能力 | P1     | 你＋財務（兩選項見 §G-6） | M      |
| G-7  | Badge 批次生命週期（建立／回填／匯出）   | 能力 | P1     | 你（兩選項見 §G-7）       | M      |
| G-8  | 報到桌：同畫面寫卡＋綁卡＋上鎖           | 能力 | P1     | 你＋現場負責人            | L      |
| G-9  | 場次現場報到                             | 能力 | P2     | 你（兩選項見 §G-9）       | L      |
| G-10 | 總覽對 OPERATOR 失效，且多打一次請求     | 缺陷 | P1     | —（無爭議，非決策題）     | S      |
| G-11 | 契約閘門不在 CI 上                       | 流程 | P1     | —（無爭議）               | S      |
| G-12 | 授權只在 controller 層，路由層無角色閘門 | 缺陷 | P2     | 需決策（後端）            | M      |

`S` ≦ 半天、`M` ≦ 兩天、`L` 需要設計與驗收。

### 2026-10-29 更新：八項的去向

上表沒有狀態欄，所以狀態補在這裡。列 `1cb2b73` 合併前後有位移的七項；
G-6／G-7／G-8／G-9／G-12 的嚴重度與工作量都沒有變動，不列。

G-10 是例外：它的嚴重度與工作量同樣沒變，但**狀態**現在是全冊最混亂的一項
（兩個獨立問題只修好一個）。不列會被誤讀成「沒有人動過它」，所以補一列。

| ID   | 上一輪的狀態                  | 現在（2026-10-29）                     | 落在哪個 commit                                                                        |
| ---- | ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| G-0  | `open`（P0，等一個決定）      | **已決：合併**                         | merge `1cb2b73`                                                                        |
| G-1  | `fixed-on-branch`（在分支上） | `fixed`（本工作分支 `HEAD`）           | `5bcdb53`                                                                              |
| G-2  | `fixed-on-branch`             | `fixed`                                | `860404f` ＋ `bc27abc`                                                                 |
| G-3  | `fixed-on-branch`             | `fixed`                                | `075f775`                                                                              |
| G-4  | `fixed-on-branch`             | `fixed`                                | `031972f` ＋ `84cb423`                                                                 |
| G-5  | `fixed-on-branch`             | `fixed`                                | `9e3c7a2`                                                                              |
| G-10 | `open`（兩個獨立問題都還在）  | **部分修好**（403 已修、兩次請求未修） | `9e3c7a2` 只動了 403 那半（改問 `canManage` 後早退）；兩次請求未修                     |
| G-11 | `fixed-on-branch`             | `fixed`                                | `7c19f0a`（閘門本體）＋ `421ab7c`（補齊 8 條巢狀 `/import`，少了它閘門會誤報合法呼叫） |

「在工作分支 `HEAD` 上」是可驗證的，不是宣稱：

```
for c in 5bcdb53 860404f bc27abc 075f775 031972f 84cb423 9e3c7a2 7c19f0a 421ab7c; do
  git merge-base --is-ancestor "$c" HEAD && echo "$c yes" || echo "$c NO"
done
# → 九個全部 yes
```

同一組 hash 拿去比 `origin/main` 會全部 `NO`——那不是失效，是這批 commit 還沒 push。
這是預期的，也是上面用詞段存在的理由。

> **〔歷史說明〕下面這段寫於 2026-10-29 上午，同日下午 `1cb2b73` 合併後已失效。**
> 保留它，是因為 `fixed-on-branch` 這個值曾經讓整份登記冊被誤讀，而誤讀的方式
> 值得留一份記錄。
>
> `fixed-on-branch` 的意思是「**修法存在於某條未合併的分支**」，**不是**「已修好」。
> 它回答「有沒有人做過」，不是「現在這棵樹上有沒有」。當時的判定依據是
> `audit/parity-20261022` **不是** HEAD 的 ancestor，所以標成這個值的六項在當時的
> HEAD 上有效修復數是 0，六項全部仍然存在——連
> `scripts/check-backend-contract.mjs` 都在 HEAD 上 `ls` 回 No such file。
>
> 那段時間裡還有一種誤讀值得單獨記下來，因為它**今天仍然成立**：
> `.github/workflows/ci.yml` **一直**有 `npm run check:parity`。但那是**登記冊
> 一致性**閘門，不是 G-11 講的**後端契約**閘門；後者指
> `scripts/check-backend-contract.mjs`。CI 上已經有一個 check，不代表 G-11 已解。
>
> 判斷現況請用上面的小表與這條命令，不要靠這段的敘述：
>
> ```
> git merge-base --is-ancestor audit/parity-20261022 HEAD && echo '22 MERGED' || echo '22 NOT merged'
> node -e "const r=require('./parity/parity-registry.json');console.log(r.gaps.map(g=>g.id+':'+g.severity+':'+g.status).join('\n'))"
> ```

## 4.2 逐項說明

### G-0 上一輪的修復沒有進主線（P0，流程）— **已決：合併**

> **用詞**：本批文件說「已修」一律指「**在工作分支 `feat/nfc-gate1-reader-spike` 的
> HEAD 上可驗證**」。它**不是**「已在 `origin/main` 上」——`origin/main` 仍是
> `7d0fcf5`，這串 commit 尚未 push（差多少跑 `git rev-list --count
origin/feat/nfc-gate1-reader-spike..HEAD`）。
> 驗證命令：`git merge-base --is-ancestor <commit> HEAD`（對 `origin/main` 會是
> NO，那是預期的）。

**狀態（2026-10-29）**：已決並已執行。merge `1cb2b73`，parents 是 `8aeef71` ＋
`b05744b`；`audit/parity-20261022` 現在是 HEAD 的 ancestor。

**為什麼當初列為 P0（歷史，不改寫）。** `audit/parity-20261022` 有 28 個 commit，
含 G-1 至 G-5 的修法，未合併、未 push；本輪重跑的契約閘門顯示 G-1 仍在 `main` 上。
這件事被列為 P0 而不是「家務事」的理由：G-1 至 G-5 都已經有人做過一次，重做的成本
是兩倍，而沒做的成本是活動當天。**決策只有一個：合併或丟棄。** 不要讓它停在
「等有空再看」的狀態，因為檔案會繼續漂移，越晚合併衝突越多。

**決策：合併。**

併入的三類東西：

| 併入什麼                | 具體內容                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| G-1～G-5 的修復         | `5bcdb53`／`860404f`＋`bc27abc`／`075f775`／`031972f`＋`84cb423`／`9e3c7a2`                            |
| 契約閘門                | `scripts/check-backend-contract.mjs` ＋ `scripts/backend-routes.snapshot.json`（`7c19f0a`、`421ab7c`） |
| 2026-10-22 的審計資料夾 | `docs/analysis/adminapp-parity-20261022/`，作為歷史證據保留，理由見下面第二個地雷                      |

#### 併入時處理的兩個地雷

兩個都不是「注意一下」等級，是會讓下一個人真的卡住的東西。

**① 那條分支把 `node_modules` 以 symlink 形式 commit 進去了。**

`.gitignore` 寫的是 `node_modules/`（帶斜線），只匹配**目錄**；分支上被 commit 的
是一個 **symlink**，不是目錄，所以完全沒被忽略。代價出現在合併 checkout 的時候：

1. git 把工作區裡**真正的** `node_modules` 目錄換成那個 symlink；
2. 那個 symlink 指向自己（`node_modules -> node_modules`），等於什麼都沒有；
3. `npm test` 因此以 **exit 194** 失敗，而且**沒有任何 TAP 輸出**。

第 3 點是最貴的部分：訊息長得像測試框架壞了，不像依賴壞了，所以第一反應會去查
測試，而真正的問題在依賴。修法三步：

```
git rm --cached node_modules
rm node_modules
npm ci
```

**任何要合併這條分支的人都會踩到同一個坑**，所以寫在這裡而不是只寫在 commit
message 裡。事後的驗收：`git ls-files node_modules | wc -l` 應為 `0`。

**② 舊審計的文件沒有併進 `adminapp-parity-20261028/`，兩個資料夾並存。**

這是刻意的，不是漏做。理由有兩個，第二個比較不容易想到：

- 引用閘門的 `DOC_DIR` 只掃**一個**資料夾：
  `scripts/check-parity-registry.mjs` 的 `checkDocs()` 取
  `join(APP_ROOT, registry.audit.docPath)`，而登記表的 `docPath` 是
  `docs/analysis/adminapp-parity-20261028`。放第二個資料夾進去，那份文件不會被
  任何閘門檢查到。
- 每一輪的行號只對**自己量測的那個 HEAD** 有意義。把兩輪的檔案混進同一個目錄，
  等於讓行號互相污染——一份寫 `:49`、一份寫 `:48`，卻都宣稱指向同一個檔案的同一
  件事。`04 §G-2` 那個「呼叫起點 vs 字面行」的矛盾就是這樣長出來的。

可重跑的驗收：

```
git merge-base --is-ancestor audit/parity-20261022 HEAD && echo merged
# → merged
```

### G-1 「申請主管覆核」呼叫不存在的路由（P0，缺陷）

**狀態（2026-10-29）**：已修，`5bcdb53`。按鈕已移除，`check-in.tsx` 的
`duplicate` 分支現在只剩三件東西：`copy.checkIn.overrideBlockedBanner` 橫幅、
`copy.roster.viewDetail`（指向詳情頁，那裡看得到實際報到時間）、
`copy.checkIn.continueScan`。

在 HEAD 上重跑什麼就看不到它了：

```
grep -rn 'checkin/override' src/
# → 只剩兩行註解、都標著「已移除」：check-in.tsx:309、registration.service.ts:43
grep -rn 'requestOverride' src/
# → exit 1（0 命中）：按鈕與它的 handler 一起消失了
```

以下是這個缺口為什麼存在的證據，不改寫：

`src/services/registration.service.ts:42-54` **曾經**呼叫
`POST /api/v1/events/:eventId/registrations/checkin/override`——現在那一段是一份
「⛔ 已移除、不要加回來」的註解（`5bcdb53`）。後端 grep 零命中；`GET` 也一樣。

它不是單純的死路徑，是**誤導的死路徑**：畫面會顯示「重複報到無法在 App 內放行」
的橫幅，操作員因此以為有人會處理。這個宣稱牽涉三個不同位置，先前併寫成
`check-in.tsx:315,718-723` 是錯的引法——三件事分開引用。**以下行號是 2026-10-29
深夜重新量的；原本那組行號已全部漂移，因為 `5bcdb53` 刪掉了其中兩件東西。**

1. **文案字串**在 `src/constants/copy.zh-TW.ts:283-284`（`overrideBlockedBanner`，
   現在的字面是「重複報到無法在 App 內放行：後端目前沒有覆核端點。現場請人工放行
   並記錄。」），不在 `check-in.tsx` 裡。原引 `:277-278` 現在是
   `invalidHeadline`／`continueScan`。
2. **沒有設定狀態了。** 原引 `check-in.tsx:315`／`:330` 的
   `setOverrideBanner(copy.checkIn.overrideBlockedBanner)` 已不存在
   （`grep -rn 'setOverrideBanner' src/` 零命中）；橫幅改由 `duplicate` 分支直接
   渲染，不是 state。
3. **渲染**在 `check-in.tsx:711-727` 的 `duplicate` 分支：橫幅 `:713-716`，
   按鈕 `:717-720`（`copy.roster.viewDetail` → 詳情頁，就是修法做的那件事）與
   `:721-725`（繼續掃碼）。

**`overrideBlockedToast` 這個函式已被移除，所以引用它的行號必然失效。** 原引
「`:279` 的 `overrideBlockedToast` 全 repo 零引用，是死文案」——`5bcdb53` 直接把它
刪了，現在 `grep -rn 'overrideBlockedToast' src/` 是**零命中（連定義都沒有）**，
`:279` 現在是一件註解的開頭。同一個修法也刪掉了那顆按鈕：原引「`:276` 是按鈕標籤
『申請主管覆核』」，但 `:276` 現在是 `duplicateHeadline`，而「主管覆核」四個字在
`src/` 裡同樣零命中。

先前寫的「覆核已送出／尚未就緒」也不精確：字面上沒有「已送出」，只有「尚未開放」。
（現行字面已改寫成上面第 1 點那句。）

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

**狀態（2026-10-29）**：已修，`860404f` ＋ `bc27abc`。次要動作改指向 App 自己的
名單頁 `/(auth)/[eventId]/registrations`，不再把人送去 Web。

在 HEAD 上重跑什麼就看不到它了：

```
grep -n 'wallet' 'src/app/(auth)/[eventId]/token.tsx'
# → exit 1（0 命中）
```

以下是這個缺口為什麼存在的證據，不改寫：

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

**狀態（2026-10-29）**：已修，`075f775`。修法與下面那份成本分析**不同**：不是補
後端投影的 `approvedBy`，而是**停止渲染一個後端從來沒有的欄位**。每一行現在顯示
`type · sourceType`、`amount`、`balanceAfter`。

在 HEAD 上重跑什麼就看不到它了：

```
grep -rn 'approvedBy' src/
# → 三行，全部是「這裡沒有 approvedBy」的註解：
#   src/types/api.types.ts:109,145、src/services/registration.service.ts:102
```

分頁那一半要說清楚，否則會高估：`getWalletTransactions` 現在**轉發**
`page`／`limit`（`registration.service.ts:104-112`），但畫面**沒有翻頁器**——只有
`txTotal > transactions.length` 時顯示一行 `copy.roster.tokenPagingHint`。也就是
「不再無聲截斷」，不是「可以翻頁」。完整分頁仍是未做的工作。

以下是這個缺口為什麼存在的證據，不改寫：

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

**狀態（2026-10-29）**：已修，`031972f`（型別）＋ `84cb423`（service 參數）。

在 HEAD 上重跑什麼就看不到它了：

```
grep -rln 'depositRefunded\|archivedAt\|checkedInBy\|boundOnly' src/
# → 3 檔：src/types/api.types.ts、src/services/event.service.ts、src/services/nfc.service.ts
```

以下是這個缺口為什麼存在的證據，不改寫：

`Registration` 型別缺退款與稽核欄位（`depositRefunded*`、`archivedAt`、
`checkedInBy`），`getRegistrations` 缺 `depositRefunded`、`boundOnly` 兩個後端已
支援的參數。

注意一個容易誤用的細節：`GET /registrations/by-code/:code` 的 select **不含**這些
欄位，只有名單端點會回。所以詳情頁不能渲染它們，除非改成從名單端點取。

### G-5 從不查 `/my-access`（P1，缺陷）

**狀態（2026-10-29）**：已修，`9e3c7a2`。`eventService.getMyAccess()` 已存在，
`overview.tsx:201` 是它的呼叫點。

在 HEAD 上重跑什麼就看不到它了：

```
grep -rn 'my-access' src/
# → src/services/event.service.ts:24,79,87
grep -rn 'getMyAccess' src/
# → src/services/event.service.ts:85（定義）、src/app/(auth)/[eventId]/overview.tsx:201（呼叫）
```

射程要說清楚：本輪只有**總覽**這一頁改成問 `/my-access`。`userRole` 仍出現在
`home.tsx:115,123`，但那裡是顯示用的角色標籤，不是能力判斷。

以下是這個缺口為什麼存在的證據，不改寫：

App 目前用 `my-managed` 回傳的 `_meta.userRole` 當角色判斷來源。那是「你在這場
活動有沒有角色」，不是「你能不能做這件事」。兩者在 OPERATOR 身上就會分岔。

後端有現成的 `GET /events/:eventId/my-access` → `{canManage, canOperate,
canInviteAdmins, role}`，Web 早就在用。App 打一次，把四個布林當作畫面開關，
就可以把 G-10 與一半的誤導訊息一起解掉。

### G-6 名單的管理動作（P1，能力，需要決策）

Web 能匯出 CSV、隱藏／封存、登記退款、更正狀態。App 只能查。

2026-10-29 實測的 App 現況：`registrations.tsx`（644 行）只有篩選、複製 email、
進入報名詳情。全庫
`grep -rn 'depositRefund\|archive\|unarchive\|refund' src/` 共 5 個命中，全部無關
（`overview.tsx` 的 `archive` 圖示、`copy.zh-TW.ts` 的「已封存」、
`event-status.ts` 的 `ARCHIVED`、`Icon.tsx` 的 `archive` 圖示定義）——名單的管理
動作是 **0**。

**後端那一半已經在了，而且它改變了這一項的形狀。** 五個端點都已註冊
（`LinkCard_ExpressJS_Backend@src/events/routes/registrations.routes.ts:158-170`）：
`POST /:registrationId/hide`、`/unhide`、`/archive`、`/unarchive`，以及
`POST /:registrationId/deposit-refund`。退款那支的路由註解自己寫明了它的性質：
「押金退款追蹤（參展商押金，**離線銀行轉賬退回**）」——它呼叫 `markDepositRefund`，
寫入 `deposit_refunded_at / _by / _amount / _reference / _note` 五個欄位
（`prisma/schema.prisma:834-838`，並有 `[eventId, depositRefundedAt]` 索引供名單
篩選）。**系統不會把錢退回去**：`src/` 裡沒有任何 `refunds.create` 一類的 gateway
退款呼叫，被呼叫的只有收款側的 payment intent。換句話說，這支端點記錄的是
「**已經在線下退掉的款**」，不是「按下去就退款」。

這推翻了原本被拿來當理由的兩個假設：

- 稽核軌跡**不缺**（五個欄位與操作者都在），所以不能用「需要稽核軌跡」當作不給
  的理由。
- 真正缺的是**雙人核可**——`markDepositRefund` 只記一個 `operatorId`，沒有第二個
  核可者。這一條若財務要求，才是後端要動的地方。

**產業界線不是「手機 vs 桌機」，而是「錢是否已撥出」。** 2026-10-29 針對這一題的
定向補查：

- Eventbrite Organizer 可在手機上全額／部分退款（Orders → Refund → Process
  Refund），但官方同時明寫「已收到款項就回網站退款」。
- Cvent 可在 invitee record 上 `Pay`／`Shop`／`Substitute`，並支援 Tap to Pay。
- 「封存／隱藏報名」在六家產品裡**沒有任何一家在手機做**。
- CSV 匯出普遍留在 Web（Whova 的 dashboard export、Swapcard Studio 的修正與匯出）。

**選項 A：只讀，退款一律不做；封存／隱藏／匯出都不給。**

- 好處：零工期、零新權限面；與六家在「封存／隱藏」上的做法一致；不必先回答
  「誰能按退款」這個財務問題，其他 P1 可以照原順序推進。
- 代價：活動當天若真的要退一筆押金，操作員必須離開手機回 Web，而 Web 做的也只是
  登記、實際退款仍是線下轉賬——這條路徑沒有變短，只是被留在原地。
- 選它等於承認：**押金退款不是現場動作，是活動後的財務作業**——這是對營運事實的
  斷言，不是優先度判斷。

**選項 B：依業界界線「款項未撥出時」App 可退款；封存／隱藏仍不做、CSV 匯出
仍不做。**

- 好處：端點與稽核欄位都已在（見上），增量是 App 側一張表單（金額、銀行參考號、
  備註、二次確認）加上名單列的退款狀態顯示，不是新端點；它同時補上 G-4 缺的退款
  ／稽核欄位，兩項可一起做。封存／隱藏與匯出留在 Web，與六家做法一致。
- 代價：`M`（≦ 兩天），且必須先把「誰能按」講清楚——後端只認
  `getEventWriteAccess`（COORDINATOR 以上），沒有第二核可者。**若財務要求雙人
  核可，後端就必須新增核可欄位與第二條審批路徑，工作量由 `M` 上調為 `L`**；理由
  是那屬於 schema 變更，不是一個 UI 欄位。另有一個結構性弱點：「款項未撥出」在本
  系統沒有機器可讀的訊號——押金走線下轉賬，系統直到按下這支端點才知道錢走了，
  所以那條界線只能靠操作員自律。
- 選它等於承認：**「退款登記」與「退款」是兩件事**——我們給的是前者（記帳），
  不是後者（撥款）；而要不要雙人核可，直接決定它是 `M` 還是 `L`。

**兩個獨立註記（與選項名分開，不讓標籤替讀者先下判斷）：**

- **本節原本的立場是 A。** 理由是不必先回答「誰能按退款」這個財務問題，其他 P1
  可以照原順序推進。
- **2026-10-29 產業補查指向的方向，兩半不同。** 封存／隱藏這一半指向 A（六家
  無一家在手機做——是反面證據，已降級為待驗）；退款這一半指向 B（Eventbrite 在
  App 內可退款，只有「已收到款項」才回網站）。所以 A 不是被整體推翻，是被拆成
  兩半之後，只剩一半站得住。

**證據等級：** 本節產業依據為 2026-10-29 針對該題的定向補查；**非**整份產業研究
重跑。Eventbrite 的「App 可退款／已收款回網站」與 Cvent 的 Pay／Shop／Substitute
是直接條目；Whova 與 Swapcard 只到「匯出在 Web」這半邊；「封存／隱藏六家都不做」
屬**反面證據**（查不到 ≠ 業界不做），依此降級為**待驗**。

出處（本節）：`eventbrite.com/help/en-us/articles/305489`（App 內退款，含「已收到
款項就回網站退款」）與 Eventbrite 的退款專文；Cvent invitee record 的
`Pay`／`Shop`／`Substitute` 與 Tap to Pay；Whova 的 dashboard export；Swapcard
Studio 的修正與匯出。

**待驗：** ① 「封存／隱藏」是否真的沒有任何一家在手機做——需要正面清單而非缺席
推論。② 雙人核可是否為財務要求（政策，不是技術）。這兩題都不影響 A／B 的選擇
形狀，只影響 B 的價格。

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

**選項 A：把批次生命週期搬進 App——建立批次、回填 UID、匯出；不做批次認領
（那是活動前準備工作）。**

範圍見 `05-alignment-plan.md` §5.3 軌道 A。

- 好處：活動當天臨時補一批卡時不必離開手機；App 具備完整的卡片資料處理能力，
  G-8 若決定寫卡也有現成入口。
- 代價：`M`（≦ 兩天）；四步都要在手機上做出可用介面，其中「匯出」在手機上難以
  成立（CSV 要給誰、存哪裡）；且要逐一確認四個端點在行動端的錯誤處理。
- 選它等於承認：**我們相信操作員會在手機上做批次作業**——六家產品全部沒有這樣
  做，而我們沒有任何現場證據說有人會這樣用。

**選項 B：縮成「報到成功 → 單張發卡」，批次生命週期留在 Web；App 只保留查詢
（現況）＋單張發卡的入口整理。**

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

**兩個獨立註記（與選項名分開，不讓標籤替讀者先下判斷）：**

- **本節原本的立場是 A**（批次生命週期搬進 App），範圍見
  `05-alignment-plan.md` §5.3 軌道 A。
- **2026-10-29 產業補查指向的方向是 B。** 六家的切法一致：內容製作與批次匯出在
  Web、單張即時輸出在 App；其中四家對「批次在 Web」有直接條目。也就是說，**A 被
  它自己這一節引用的證據反對**——這正是原本那個帶推薦意味的括號標籤必須拿掉的
  原因，不是因為 A 不可能，而是因為它不該被寫成預設答案。

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

在回答之前，若兩案都通過，可另外做一件與選項無關的低成本動作：把 `nfc-bind` 的
入口從報到成功頁直接帶 `?code=` 預填（目前已是如此），並在 App 的寫卡頁明確寫出
「這張卡是否已上鎖」。這樣即使不上鎖，操作員也知道風險。

**這一節原本只有「要回答的三個問題」，沒有可選的方案**，但 `07-briefing.md`
§7.9 把它列為要 CTO 決定的一項。以下補上同一套模板的兩個選項，**不代人選**。

**選項 A：App 不做寫卡與上鎖，把「App 在報到桌的定位」寫清楚。**

報到頁只做「掃碼 → 報到 → 顯示結果」，寫卡與上鎖留在 Web 的報到桌（或留在現有
的 `nfc-bind` 畫面而不擴充）。定位寫清楚的意思是：App 是**掃碼與查核**的工具，
不是發卡台。

- 好處：零新風險。不必碰 raw APDU，不必驗中斷回復，也不必處理「平板寫到一半、
  手機同時在綁」的雙寫情境；iOS 的限制直接消失，因為這個選項在兩個平台上行為
  一致。工期近 `S`（真要做的事只剩文案與入口整理）。
- 代價：只有手機在現場時，發卡流程會斷成兩段——先在 App 報到、再回 Web 或另一
  個畫面寫卡。活動當天臨時要發一張卡，操作員仍需要第二個裝置或第二個畫面。
- 選它等於承認：**報到桌的寫卡是平板的工作，手機只負責掃碼**——這是對現場設備
  配置的斷言。若現場常常只有手機，這個斷言就是錯的。

**選項 B：做，但先過三個前置。**

三個前置任何一個不成立，B 就不成立，而不是「先做再修」：

1. **APDU 中斷回復要驗。** 寫入中途斷線（藍牙斷、App 切背景、卡片離開感應範圍）
   的卡片能否回到可再用狀態，必須在真機上跑過，不能只靠「理論上可以送 raw
   APDU」推論。
2. **iOS 不可能。** 寫卡在 iOS 沒有路，只有 `QR_ONLY`。介面不能只用小字帶過，
   否則 iOS 操作員會以為是自己操作錯。
3. **平板＋手機並存時，綁定狀態以後端為準。** 兩邊不能各記一份「已綁定」；
   否則同一張卡會在平板上顯示已綁、在手機上顯示未綁。

- 好處：這是唯一讓「只有手機」的現場也能完整發卡的路徑；寫卡、綁卡、上鎖在同一
  個畫面完成，與 Web 的報到桌行為對齊，也讓 G-7 的單張發卡有落點。
- 代價：`L`。三個前置裡第 1 項是**真機驗證**（排程風險，不是寫程式風險），
  第 3 項是**後端一致性設計**（可能要一支查詢端點或把狀態收斂到既有 projection），
  第 2 項是介面必須誠實降級。上鎖本身還有一層風險：密碼若寫錯或寫入半途失敗，
  卡片可能變成現場無法自救的磚。
- 選它等於承認：**手機也要能發卡**，因此必須接受「同一件事在兩種裝置上有不同
  完成度」（iOS 只能 QR、Android 可寫卡），並且願意為此維護兩套現場說明。

**兩個選項都不便宜的地方，是它們不是同一個問題的兩種答案。** A 回答的是「App
在報到桌的角色是什麼」，B 回答的是「手機能不能取代讀卡機」。前者是定位問題，
後者是能力問題；先回答定位，B 的範圍會自己縮小。

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

**選項 A：維持 P2，留在登記表上。**

- 好處：零工期；不押注在一個還沒確認的產品前提上；不與 G-7／G-8 搶同一個 sprint。
- 代價：如果活動真的有場次，這會是現場最常被問「為什麼 App 沒有」的一項；而等到
  活動前才做，`L` 的工期就變成排程風險。
- 選它等於承認：**我們的活動模型目前沒有場次，或場次報到在現場不是高頻動作**——
  這是一個產品事實的斷言，不是優先度判斷。

**選項 B：升為 P1，納入下一輪。**

- 好處：5/5 的對照，共識基礎強；一旦確認有場次，它直接升 P1，排在 G-7／G-8 之後
  即可；後端端點已在（見上），不必先排後端工作。
- 代價：前端是 `L`——新的一層 IA（活動 → 場次 → 名冊 → 報到），不是搬頁面；名冊
  要處理「這位參加者沒報名這個場次」與「只有部分場次有報名」兩種空狀態。
- 選它等於承認：**場次是真實的營運單位**，App 的資訊架構必須為它多一層。

**兩個獨立註記（與選項名分開，不讓標籤替讀者先下判斷）：**

- **本節原本的立場是 A**（維持 P2，本輪不做）。
- **2026-10-29 產業補查指向的方向是 B**（5/5 有這個能力，其中一個明寫支援
  離線）。但這裡要誠實：**A 與其說是立場，不如說是「還沒回答」**——它在實務上
  等於默默選了不做。這也是標籤必須中性化的理由：把「尚未決定」包裝成一個帶推薦
  意味的預設答案，會讓一個空白被讀成一個結論。

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

### G-11 契約閘門不在 CI 上（P1，流程）— **已修**

**狀態（2026-10-29）**：已修，`7c19f0a`（閘門本體）＋ `421ab7c`（補齊 8 條巢狀
`/import` 路由）。原本的問題是 `scripts/check-backend-contract.mjs` 只存在於
`audit/parity-20261022`，G-1 之所以能活這麼久就是因為沒有任何自動檢查。

現在三件東西都在 HEAD 上，缺一項這個閘門就不成立：

| 位置                                         | 內容                                                          | 怎麼確認                                            |
| -------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `scripts/check-backend-contract.mjs` ＋ 快照 | 閘門本體與 `scripts/backend-routes.snapshot.json`             | `ls scripts/check-backend-contract.mjs`             |
| `package.json:59`                            | `"check:contract": "node scripts/check-backend-contract.mjs"` | `grep -n 'check:contract' package.json`             |
| `.github/workflows/ci.yml:57`                | `- name: Backend contract` → `run: npm run check:contract`    | `grep -n 'check:contract' .github/workflows/ci.yml` |

在 HEAD 上實跑：

```
npm run check:contract
# → ✓ 15 條 App 呼叫全部對得上後端路由快照（exit 0）
```

**誠實邊界：快照是後端某一個 commit 的複本，不是活的後端。**

`scripts/backend-routes.snapshot.json` 的 `generatedFrom` 是
`LinkCard_ExpressJS_Backend@64be09e`（`generatedAt` 2026-10-21T18:36:36Z）。所以：

- 後端**改**了路由而快照沒重跑 ⇒ 閘門驗的是一份**過期的世界**。它會對一條已經
  不存在的路由說「對得上」，同時對一條新加的路由說「後端沒有」。
- 重跑方式：`node scripts/check-backend-contract.mjs --refresh --backend <後端路徑>`。
- 這個閘門**不會**自己去後端 repo 拉新版本，CI 上尤其如此——CI 沒有 checkout
  後端 repo。它守的是「App 與**快照**一致」，不是「App 與**今天的後端**一致」。

換句話說，G-11 修好的是「有沒有一個會叫的檢查」，不是「檢查永遠新鮮」。後者需要
一個排程或 hook 去定期重跑 `--refresh`，本輪沒有做。

### G-12 授權只在 controller 層，路由層無角色閘門（P2，缺陷）

**待驗事實（2026-10-29 實測，`LinkCard_ExpressJS_Backend@7d08daff`）。**

`src/events/routes/` 共 12 個 `.ts`（含 `index.ts`）、**124 條** `router.<verb>`
註冊。路由層的授權形態是三類，不是兩類：

| 類別                                                          | 條數    | 路由層長什麼樣                      |
| ------------------------------------------------------------- | ------- | ----------------------------------- |
| (1) 有 `authMiddleware`／`optionalAuthMiddleware`，無角色閘門 | **112** | 只驗「你是誰」，不驗「你能不能」    |
| (2) **連 `authMiddleware` 都沒有**                            | **11**  | 只有限流或上傳 middleware，或全無   |
| (3) 有 `CheckEventAccessPermissionFactory`                    | **1**   | `POST /sessions/:sessionId/checkin` |

三類加總 124。產生這張表的方式，是把每一條 `router.<verb>(…)` 的括號內容展開
（含跨行的 middleware 參數）後，檢查其中是否出現 `authMiddleware`／
`optionalAuthMiddleware`／`eventAccessFactory`。**不能用單行 `grep`**：多數註冊
跨行，單行檢查會把「第二行才掛 auth」的誤判成沒有。

**(2) 的 11 條完整清單。**

| 端點                          | 位置                                                                          | 程式碼裡有理由嗎                                           |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /`（`listPublicEvents`） | `LinkCard_ExpressJS_Backend@src/events/routes/events.routes.ts:20`            | 語意自明（handler 名稱）                                   |
| `POST /webhooks/stripe`       | `LinkCard_ExpressJS_Backend@src/events/routes/index.ts:36`                    | 有（`:35`：必須在 `express.json()` 之前掛）                |
| `POST /activation/claim`      | `LinkCard_ExpressJS_Backend@src/events/routes/index.ts:37`                    | **路由層沒有**；controller `:14` 只說用途、沒說為何免 auth |
| `GET /export/exhibitors`      | `LinkCard_ExpressJS_Backend@src/events/routes/event-ops.routes.ts:93`         | 有（`:92`：exhibitors 公開、attendees 要 auth）            |
| `GET /nfc/lookup`             | `LinkCard_ExpressJS_Backend@src/events/routes/event-ops.routes.ts:77`         | 有（`:44`、`:76`：明寫 PUBLIC，另加 IP 限流）              |
| `GET /:token`（展商邀請）     | `LinkCard_ExpressJS_Backend@src/events/routes/exhibitor-invites.routes.ts:51` | 語意自明（路徑就是憑證）＋限流                             |
| `GET /by-code/:code`          | `LinkCard_ExpressJS_Backend@src/events/routes/registrations.routes.ts:118`    | 有（`:117` 說明用途；`:30-33` 說明兩層共用 429）           |
| `GET /sessions/:sessionId`    | `LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:28`    | **沒有**                                                   |
| `GET /polls`                  | `LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:53`    | 有（`:52`：results public，kiosk／大螢幕）                 |
| `POST /polls/:pollId/vote`    | `LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:57`    | 有（同上 `:52`）                                           |
| `GET /polls/:pollId/results`  | `LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:58`    | 有（同上 `:52`）                                           |

**這 11 條不必然是缺陷，而且 9 條已經在程式碼裡寫了理由。** 這一點決定了缺口的
性質：它主要不是「有人忘了掛 auth」，而是「有些端點刻意公開，而公開的理由是否
一致、是否寫在現場旁邊」並不總是清楚。

**本輪不斷言那 2 條是缺陷。** `GET /sessions/:sessionId` 與 `POST
/activation/claim` 可能是刻意公開；這裡只主張一件事：**若是公開端點，應該在
程式碼裡留下理由**——同一個目錄已經示範了怎麼寫，而這 2 條沒有。順帶一個觀察
（不是缺陷）：`GET /sessions`（`:27`）掛 `optionalAuthMiddleware`，緊鄰的
`GET /sessions/:sessionId`（`:28`）卻完全沒有，兩者的可見範圍差異沒有寫在任何
地方。

真正的角色判斷寫在 **controller**，而且不是一種寫法，是**三套**：

| helper 家族                                                       | 代表呼叫點                                                                                                                                                                                                                                                                                                                                                | 角色語意                                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EventService.getEvent*Access`                                    | `LinkCard_ExpressJS_Backend@src/events/controllers/EventTicketTypeController.ts:30`、`LinkCard_ExpressJS_Backend@src/events/controllers/EventSessionController.ts:76`、`LinkCard_ExpressJS_Backend@src/events/controllers/EventNfcBatchController.ts:38-39`、`LinkCard_ExpressJS_Backend@src/events/controllers/EventRegistrationImportController.ts:128` | `LinkCard_ExpressJS_Backend@src/events/services/EventService.ts:361` 的 `getEventWriteAccess`，角色集在 `:384` 為 SUPER_ADMIN／COORDINATOR |
| `ExhibitorService.getEventOwnerAccess`／`getExhibitorWriteAccess` | `LinkCard_ExpressJS_Backend@src/events/controllers/ExhibitorController.ts:47,185,251`、`LinkCard_ExpressJS_Backend@src/events/controllers/ExhibitorPageContentController.ts:284`                                                                                                                                                                          | 展商側自己一套                                                                                                                             |
| `utils/registrationAccess.assert*`                                | `LinkCard_ExpressJS_Backend@src/events/controllers/EventWalletController.ts:6`（`assertRegistrationOwnershipOrOperator`）                                                                                                                                                                                                                                 | 報名擁有者或操作員                                                                                                                         |

**與原始描述的差異（照實標示）。** 簡報所述「路由層無角色閘門」在**結果**上成立
（123／124 條如此），但**機制**上不完全成立：
`src/events/middleware/checkEventAccessPermission.ts` 裡有一支**專為此目的寫的**
factory，它的檔頭註解自己寫著「在 route 層強制檢查 event 管理權限…避免各
controller 手動檢查容易漏掛」（`LinkCard_ExpressJS_Backend@src/events/middleware/checkEventAccessPermission.ts:17-18`）。

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
