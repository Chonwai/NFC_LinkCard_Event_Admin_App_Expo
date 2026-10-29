# 02 — App 與後端在同一個區間的變化

<!-- citations: LinkCard_ExpressJS_Backend -->

## 2.1 App：`audit/parity-20261022` 已合併；`feat/onsite-scope-decisions` 仍未合併

`LinkCard_Event_Admin_App_Expo` 在 10-22 之後有三條分支。commit 數於 2026-10-29
重新量測（量測時的 HEAD = `c645f20`）：

| 分支                          | commits | 內容                                                               | 是否在 `main`                     |
| ----------------------------- | ------- | ------------------------------------------------------------------ | --------------------------------- |
| `audit/parity-20261022`       | 28      | 上一輪對等審計＋7 個產品修復                                       | 否                                |
| `feat/onsite-scope-decisions` | 53      | 上述內容＋現場四項決策                                             | 否                                |
| `feat/nfc-gate1-reader-spike` | 111     | 讀卡機研究、文件、對等登記表閘門，以及 `1cb2b73` 帶進來的 G-1～G-5 | 否（`src/` 已與 main 不同，見下） |

驗證方式：

```
git rev-list --count origin/main..audit/parity-20261022            # 28
git rev-list --count origin/main..feat/onsite-scope-decisions      # 53
git rev-list --count origin/main..feat/nfc-gate1-reader-spike      # 111
git diff --stat origin/main..feat/nfc-gate1-reader-spike -- src/   # 9 files, +302/−133
```

第三條會隨這條分支的每一個 commit 前進，本節自己的 commit 也算在內，所以重跑時看到
比 111 大是正常的；看到比它小才要回頭確認你量的是哪條分支。

**最後一條不再回空輸出（2026-10-29 複核）。** `1cb2b73` 把 `audit/parity-20261022`
併進本分支之後，`-- src/` 是 **9 檔、+302/−133**，那就是 G-1～G-5 的修復。所以
上表那一格「`src/` 同 main」是**合併前**（`fa111a7`）的讀數，不是現在的值——
`00-method-and-scope.md` §0.2 的「合併之後」小節跑同一條命令、寫同一個 9 檔，
兩節現在一致。

「`src/` 零改」**只在 `fa111a7` 上成立**，也不等於「這條分支沒改東西」。這條分支對
`origin/main` 還有一批差異
（`git diff --stat origin/main..HEAD | tail -1`），分佈於 `docs/`、`tools/`
（`nfc-reader-spike/` 17 檔＋`nfc-web-probe/` 2 檔）、`.edison/`、`tests/`、
`scripts/`、`parity/`、`package.json`、`.github/`、`.prettierignore`、`.gitignore`，
以及 `eslint.config.js` 一段只作用於 `tools/nfc-reader-spike/**` 的 Node globals
例外。

**這一節不寫檔數與行數。** 這條分支每加一個 commit 它們就變一次，而這份文件本身就在
這條分支上。先前版本寫的「62 檔、+11,656 行」是 `44f6bd9` 的讀數；`e188071` 上是
63 檔、+11,946 行（多一個 `.gitignore`）。兩個都對，只是時點不同；要看現值就跑上面
那條命令。完整位置清單在 `00-method-and-scope.md` §0.2。

先前版本這裡寫的是 `-- src tests scripts .github package.json` 並宣稱空輸出。那條
命令今天會回 5 個檔、+807 行，因為本輪自己往 `scripts/`、`tests/`、`.github/`、
`package.json` 加了閘門。正確的範圍是 `-- src/`。

「`src/` 零改」在那個時點的意義只到「執行期行為與 `main` 相同」，不包含 lint 規則
集合相同。見 `06-verification.md` §6.2 的 A1。

### 那條分支上有什麼、本批審計讀到哪裡

上表把 `feat/onsite-scope-decisions` 寫成「53 commits／上述內容＋現場四項決策」。
那句話是對的，但它**漏掉一個必要的事實：那條分支上有一份專門回答那四項決策的
說明書，而本批審計從沒讀過它。** 這一小節補上，並記下代價。

**一、25 個 commit 不在本分支的歷史裡。**

```
git rev-list --count HEAD..feat/onsite-scope-decisions   # 25
```

上表的 53 是 `origin/main..feat/onsite-scope-decisions` 的讀數。兩者的差（53 − 28）
就是從 `audit/parity-20261022` 帶過來、**已經**併進本分支的那 28 顆。所以 **25**
才是「這條分支獨有、本分支沒有」的部分；不要拿 53 去推論「還有 53 件事沒做」。

**二、那 25 顆改了什麼：20 個檔，`src/` 零改動。**

```
git diff --name-only HEAD...feat/onsite-scope-decisions | wc -l            # 20
git diff --name-only HEAD...feat/onsite-scope-decisions -- docs/ | wc -l   # 13
git diff --name-only HEAD...feat/onsite-scope-decisions -- scripts/ | wc -l # 4
git diff --name-only HEAD...feat/onsite-scope-decisions -- tests/ | wc -l  # 1
git diff --stat HEAD...feat/onsite-scope-decisions -- src/                 # 空輸出
```

組成是 13 份文件、`scripts/` 4 檔（2 支 `.mjs` 閘門＋2 份 `.json` 資料）、`tests/`
1 檔、`.github/workflows/ci.yml`、`package.json`，合計 +4,433/−9。
**`src/` 是零改動** ⇒ 它不會改變 App 行為，是一支「決策與閘門」分支，不是一支
「功能」分支。

**三、裡面有一份 `05-decision-brief.md`，就是那四項決策的說明書。**
`docs/analysis/onsite-scope-20261022/` 底下是 00–06 七份文件＋`README.md`＋4 份
appendix；其中 05（343 行）是寫給決策者看的那一份。它主張的核心事實是：
**場次報到「後端有、Web 和 App 都沒有」**，所以它是「接線」問題，不是「追平」問題。

**四、它主張的那件事，本節獨立驗證成立——以下是驗證，不是轉抄。**

```
# Web 名冊頁只能顯示、不能改
wc -l '…/sessions/[sessionId]/registrations/page.tsx'                # 242
grep -nE '<button|post\(|patch\(|put\(' '…/page.tsx'                 # 218、226（都是分頁鈕）
grep -rn 'sessions/.*checkin' app components lib hooks; echo "rc=$?" # rc=1，零命中

# 後端已就緒，而且這條 role gate 是全 events 模組唯一一條
grep -n 'checkin' '…/src/events/routes/sessions-polls.routes.ts'     # 40
grep -rn 'eventAccessFactory.create' '…/src/' | wc -l                # 1
grep -rhoE "router\.(get|post|patch|put|delete)\(" '…/src/events/routes/' | wc -l  # 124
```

展開的引用：名冊頁是
`LinkCard_Frontend@app/(event)/manage/[eventId]/sessions/[sessionId]/registrations/page.tsx:218`
（第二顆分頁鈕在 `:226`；它顯示 `ATTENDED`／`NO_SHOW` 卻沒有任何方法改），端點是
`LinkCard_ExpressJS_Backend@src/events/routes/sessions-polls.routes.ts:39`。完整推論
與「為什麼這會讓優先順序錯」寫在 `03-capability-matrix.md` §3.3 的 G-D 更正段。

**五、誠實揭露：本批審計先前只在表格裡提過這條分支，沒有讀那份簡報。**
代價已經發生一次：`03-capability-matrix.md` §3.3 的 G-D 原本寫成「Web 有、App 缺」，
讀起來像「App 落後」；正確框架是「**兩個前端都落後於後端**」，該節已於 2026-10-29
加上更正段。**簡報不是權威，上面的命令才是**——但它比本批審計早一週抵達同一個
結論，這一點應該記下來。

## 2.2 端點層現況：15 個呼叫字面，15 條有效（那條死路已修）

這是本輪唯一用機械方式重跑過的量測。做法是用上一輪留下的契約閘門
（`scripts/check-backend-contract.mjs`）對今日的 App 原始碼跑一次。
**以下是 10-28 那輪的輸出，保留為歷史——今天再跑一次不是這樣，見本節末尾：**

```
node scripts/check-backend-contract.mjs
✗ 1 條呼叫在後端路由快照中找不到：
  - registration.service.ts:47 POST …/registrations/checkin/override
    shape: POST */registrations/checkin/override
exit=1
```

那個 `:47` 是閘門回報的**呼叫表達式起始行**（該行是
`const res = await apiClient.post<`），不是「算錯」。URL 字面在
`LinkCard_Event_Admin_App_Expo@src/services/registration.service.ts:50`——泛型與
參數跨了 3 行，所以字面落在第 50 行（`sed -n '44,52p'` 可直接看到）。

引用慣例：指「這條呼叫」用 `:47`；指「哪條路由／哪個 URL」用 `:50`。兩者都對，
只是指的東西不同。這一點由獨立複核發現（`06-verification.md` §6.2 的 A4）。
（那條呼叫已被移除，所以 `:47`／`:50` 現在落在註解區間——上面的慣例只作為歷史
引用規則保留，不要再拿它去定位現行呼叫。）

也就是說：除了那一條死路，其餘 14 個呼叫在後端都存在。上一輪的 P0 診斷是對的，
但它當時沒有生效，因為修它的 commit 停在那條分支上。

**那一條死路已經修好了。** 修它的 commit 是 `5bcdb53`（「stop calling a route that
has never existed」），由 `1cb2b73` 併進本工作分支。修法不是讓後端補路由，而是
讓 App 不再呼叫它：`registration.service.ts:42-54` 現在是一段「⛔ 已移除、不要加
回來」的註解，不是呼叫。

```
node scripts/check-backend-contract.mjs
✓ 15 條 App 呼叫全部對得上後端路由快照
rc=0
```

**所以「端點層對等」現在是 15/15、exit 0。** 上面那段 14/15 是 10-28 那輪的量測，
不是今天的現況——本節標題原本也跟著錯，已改。

## 2.3 後端：32 個 commit，路由只多一條

比對基準 `49b2103a`（10-22 收工）→ `7d08daff`（今日 HEAD），共 32 個 commit
（`git rev-list --count 49b2103a..7d08daff`）。上一輪記的 23 是 `5b39cbd` 當時的
讀數（`49b2103a..5b39cbd` = 23），`5b39cbd` 之後又走了 9 個 commit。但
`src/events/routes` 與 `src/events/controllers` 在整段區間內零改動
（`git diff --stat 49b2103a..7d08daff -- src/events/routes src/events/controllers`
空輸出）。

用上一輪的路由快照重新產生一次，差異只有一行：

| 項目        | 10-22 快照（後端 `64be09e`） | 今日（後端 `7d08daff`）      |
| ----------- | ---------------------------- | ---------------------------- |
| events 路由 | 121                          | 122                          |
| 新增        | —                            | `GET /:eventId/manage-stats` |
| 移除        | —                            | 無                           |

命令：`node scripts/check-backend-contract.mjs --refresh --backend <後端路徑>`
（在臨時目錄跑，不動任何 repo）。

**`generatedFrom` 這一個欄位要另外說清楚，因為它留有兩個值。** 兩次 `--refresh`
分別印過不同的時點：`5b39cbd`（本節與 `06 §6.3`）與 `1bc0602`（`06 §6.6` 第 6 列）。
兩者相差 6 個 commit（`git rev-list --count 5b39cbd..1bc0602` = 6），`1bc0602` 在後。
**沒有任何落地的檔案能證明哪一個才是那一行輸出的來源**：`HEAD` 上根本沒有
`scripts/backend-routes.snapshot.json`（它只在未合併的 `audit/parity-20261022` 上，
那份寫的是 `64be09e`），兩次 `--refresh` 都在 `/tmp` 的複本裡跑、跑完就沒了。
所以要確認 `generatedFrom` 只能重跑一次 `--refresh`。

**但「122」這個數字不受影響，這件事可以驗。** `src/events/routes` 從 `49b2103a`
到 `7d08daff` 全程零改動，所以 `5b39cbd`、`1bc0602`、`7d08daff` 三個 SHA 上都產生
同一份路由集合。差的是標籤，不是結論。

所以在契約層面，這個星期**後端沒有給 App 帶來任何需要跟上的東西**，除了
`manage-stats` 這一支。

## 2.4 `manage-stats` 解決了什麼、沒解決什麼

它把「每個狀態分頁各打一次 `limit:1` 列表」換成一次 groupBy
（`src/events/services/EventService.ts:633`）。Web 的總覽頁與各分頁計數都改用它。

但它**沒有**解決 App 的 OPERATOR 問題，因為它的閘門一樣是
`getEventWriteAccess`：

```
src/events/controllers/EventController.ts:189-196
const access = await this.eventService.getEventWriteAccess(eventId, req.user?.id);
if (access !== 'ALLOWED') return ApiResponse.forbidden(…, 'INSUFFICIENT_PERMISSION');
```

Write access 的角色集不含 OPERATOR。所以：

- 若 App 改用 `manage-stats`：請求數從 2 降到 1，但 OPERATOR 仍然 403。
- 若要修 OPERATOR 看到數字：必須改用一個 OPERATOR 也能讀的來源
  （`my-managed` 的 `_meta.registrationCount`，App 已經 unwrap 了）或請後端放寬閘門。

這兩件事在 `05-alignment-plan.md` 被拆成兩個獨立步驟，不混為一談。

## 2.5 總結：這一輪的問題不在契約，在能力

三個 repo 的變化方向很不對稱：

- 後端：+1 條路由，App 沒用到。
- Web：+21,341 行／64 檔，集中在報到桌與讀卡機（`git diff --stat b52c08c..c8508aa
-- app/check-in components/checkin components/nfc lib/nfc lib/checkin
hooks/useNfcReader.ts 'app/(event)/manage' | tail -1`，量於 `c8508aa`；同一條命令
  對 `6e58f0a` 是 +20,907 行／62 檔）。
- App：0 行產品碼，修復停在工作分支。

因此「功能是否對齊」這個問題，本輪幾乎完全由能力層決定，
而不是由端點或 payload 的機械漂移決定。這也是 `03-capability-matrix.md` 佔篇幅最多的
原因。
