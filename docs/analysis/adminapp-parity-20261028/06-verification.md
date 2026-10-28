# 06 — 這份文件自己被怎麼檢查

<!-- citations: LinkCard_Event_Admin_App_Expo -->

## 6.1 三層驗證

| 層       | 做法                                        | 抓到什麼                             |
| -------- | ------------------------------------------- | ------------------------------------ |
| 機械量測 | 重跑既有閘門與腳本，不引用記憶中的數字      | 端點現況、路由漂移                   |
| 獨立複核 | 另一個 process／另一個 agent 重跑 10 條斷言 | 2 個表述缺陷、1 個行號引用慣例的混淆 |
| 文件自檢 | 兩個測試讀文件本身                          | 12 個無法解析的引用                  |

## 6.2 獨立複核：10/10 PASS，但挑出兩個表述問題

複核由 `smith`（獨立 agent，另一個 process）執行，只給它工單，不給結論。
工單與原始報告的原稿收在附錄：
`appendix/independent-check-work-order.md`（121 行）、
`appendix/independent-check-report-raw.md`（241 行）。

兩份附錄是逐字原稿，不參與 `tests/parity-citations.test.mjs` 的引用檢查——
它們描述的是「當時跑了什麼」，不是「現在的 HEAD 長什麼樣」，硬讓它們跟著
HEAD 走反而會讓歷史失真。原文裡的 `/tmp` 路徑是當時的工作目錄。

結果 10 條全過，但它在「全部 PASS」之外多做了一件事：指出哪些 PASS **不代表**
我寫的那句話。

### A1：「產品碼與 main 逐位元相同」是過度陳述

它量到的事實：`feat/nfc-gate1-reader-spike` 對 `origin/main` 有 43 檔、+7,994 行
差異，包含 `eslint.config.js` 與 19 個 `tools/` 檔案。

我的原句是「產品碼與 `origin/main` 逐位元相同」，依據是一條**我自己挑的**路徑清單
（`src tests scripts .github package.json`）。清單內的 diff 確實是空的，但「我列的
路徑沒變」和「這條分支沒有產品面向的改動」不是同一件事。

它進一步指出為什麼這個差別重要：分支改了 lint 規則集合，所以「這條分支 lint 通過」
不能推論「`main` 的 lint 通過」。

**已修正**：`00-method-and-scope.md` §0.2 改成逐步列出差異內容，並補上
`eslint.config.js` 的變更作用域（只對 `tools/nfc-reader-spike/**` 給 Node
globals，不影響 `src/`）。

### A4：閘門回報的是呼叫起點，不是計算錯誤

契約閘門自報 `registration.service.ts:47`。實測 `:47` 是
`const res = await apiClient.post<` 這一行，也就是**呼叫表達式的起始行**；
URL 字面在第 50 行，因為泛型與參數跨了 3 行（`sed -n '44,52p'` 可直接看到）。

所以這不是「閘門算錯」，而是兩種引用慣例的差別：閘門給呼叫起點，文件問路由字面。

引用慣例：指「這條呼叫」用 `:47`；指「哪條路由／哪個 URL」用 `:50`。

這不影響 G-1 的判定（`1 條呼叫` 這個計數正確）。原本記為「工具瑕疵」是誤判，
已於 2026-10-29 更正；附錄的逐字原稿保留當時的措辭，不隨本次更正改寫。

**已修正**：`02-delta-app-backend.md` §2.2 改寫該段，改用上述引用慣例。

### A3：`| head -5` 會吃掉 exit code

工單裡我寫 `grep -rn … | head -5`，然後看 `$?`。管線的 exit code 來自 `head`，
所以永遠是 0。複核改用 `wc -l` 加 `pipestatus` 重測，才確認為零命中。

這是量測紀律問題，不是結論問題（結論本來就是零命中），但值得寫下來：**在「零命中
算證據」的場合，不要讓管線掩蓋 exit code。**

## 6.3 本輪跑過的機械量測

各列時點不同：多數量於 `89d9d5d`，缺口數那一列是 `fa111a7`。引用數會隨文件改動漂移，
重算命令見本節各列。

**本節刻意不寫引用數。** 那三個數字每改一次文件就變一次（連寫下它們的這一節本身
都會讓它們失效），寫在這裡只會製造第四個互斥的版本。要量就跑
`node --test tests/parity-citations.test.mjs`，讀它印出的 `MEASURED` 那行。

| 量測               | 命令                                                                 | 結果                           |
| ------------------ | -------------------------------------------------------------------- | ------------------------------ |
| App 端點契約       | `node scripts/check-backend-contract.mjs`（腳本不在 `HEAD`，見下）   | 1 條死路、exit 1               |
| 後端路由總數與差異 | `node scripts/check-backend-contract.mjs --refresh --backend <後端>` | 121 → 122，只加 `manage-stats` |
| 對等登記表         | `node scripts/check-parity-registry.mjs --web <web> --require-web`   | 18/18 頁、exit 0               |
| 引用座標           | `node --test tests/parity-citations.test.mjs`                        | 看 `MEASURED` 那行（值不寫死） |
| 全 repo 閘門       | `npm run typecheck`／`npm run lint`／`npm test`（三者分開跑）        | 216 pass／0 fail／3 todo       |

每一列的數字各自怎麼來的：

- **1 條死路**：`POST */registrations/checkin/override`，呼叫點在
  `src/services/registration.service.ts:47`。閘門回報的是呼叫表達式的起始行，路由
  字面在第 50 行（引用慣例見 §6.2 A4）。exit code 是 1，不是 0。
- **121 → 122**：`eventRoutes` 由 121 增至 122，`nonEventRoutes` 2 條不變；唯一
  新增的是 `GET /:eventId/manage-stats`。快照的 `generatedFrom` 由 `64be09e` 走到
  `5b39cbd`。同一天稍晚另一次 `--refresh` 印的是 `1bc0602`——晚 6 個 commit。
  **兩次都沒有落地檔可驗**（`HEAD` 上沒有那份快照，兩次都在 `/tmp` 跑），所以這
  兩個 SHA 只能當「量測當時」的外框，不是可驗證的欄位；`02 §2.3` 有完整說明。
  122 這個數字本身不受影響：`src/events/routes` 從 `49b2103a` 到 `7d08daff` 零改動。
- **18/18 頁**：Web 掃到 18 個頁面、18 個已登記；登記表 15 個能力、13 個缺口
  （`fa111a7` 時；`7dd038c` 登記 G-12 之後由 12 變成 13）。
- **引用座標那一列**：數字一律看測試印出的
  `MEASURED checked=… skipped=… ambiguous=… floor=… problems=…`。`checked` 是通過
  行號檢查的引用數、`ambiguous` 是無法唯一解析的引用數（上限 3）、`skipped` 是因
  sibling 不在而沒驗的引用數、`problems` 是指向不存在的檔案或超出行長的引用數。
  `floor` 是「比對器還活著」的下限，不是品質指標。
- **216 pass**：共 219 個測試，其中 3 個是 `todo`。`typecheck` exit 0；`lint`
  0 error、1 warning（`tools/nfc-reader-spike/src/apdu-script.js` 的未使用
  `PAGE_SIZE`，既有問題、不在本次範圍）。

第一列的腳本**不在這條分支上**：`scripts/check-backend-contract.mjs` 與它的快照
目前只存在於未合併的 `audit/parity-20261022`（腳本新增於 `7c19f0a`）。本輪的跑法
是把這兩份檔案從該分支抽到 `/tmp`、放進 repo 的複本再執行，所以這兩個數字反映的
是**那個分支的腳本對現在的 `src/services` 所做的判定**，不是 `HEAD` 上的閘門結果。
換句話說，這條閘門今天在 `HEAD` 上根本跑不起來——它擋不擋得住漂移，取決於那份
分支有沒有被併進來。

`--refresh` 會改寫快照檔，所以是在 `/tmp` 的複本上跑，不動任何 repo。

### 6.3.1 兩個還沒被修掉的脆弱點

**1. 門檻是人工挑的，不是算出來的。**

`tests/parity-citations.test.mjs` 的下限一度是固定 25——單 repo 環境（CI 只 checkout
本 repo）離它只差一個引用就翻紅；`89d9d5d` 改成環境感知（兩個 sibling 都在 → 25，
缺任一個 → 15）。環境感知只把「靠環境決定會不會紅」換成「靠運氣決定」：兩個分支各自
貼著一個人工挑的數字，任何一邊多寫一個引用、或少解析一個，就翻紅，而紅的訊息會指向
引用，不會指向「門檻是人工挑的」。

2026-10-29 先收成**單一固定值 20**，同一個 round 內又收回 **25**：裸檔名補上 repo
前綴（`de0d291`、`4688c8f`）之後，單 repo 與三 repo 兩種環境的 `ambiguous` 都是 0，
兩個分支（25／15）就沒有存在的理由。但把下限降到 20 是把門檻降到人工挑的數字之下，
而這個下限不是品質指標，是「比對器還活著」的偵測器——設得比 25 低只是讓閘門更晚才
叫，調低門檻等於放寬自己的偵測器。所以現行值是 **25**，與
`tests/parity-citations.test.mjs` 的 `const floor = 25` 是同一個數字。

同樣的問題在 `ambiguous <= 3` 上更明顯：3 不是從資料算出來的。要判斷「今天離上限
多遠」、「下限還夠不夠」，唯一可靠的做法是看測試印出的那一行（**不論通過或失敗都印**）：

```
node --test tests/parity-citations.test.mjs
# MEASURED checked=… skipped=… ambiguous=… floor=… problems=…
```

所以這一節不記數字：記下來的每一個都會在下一次改文件時過期。

**歷史上確實紅過一次，而同一個 round 內就修掉了。** 上一輪記的「`ambiguous` 上限已
滿、CI 會紅」不是誤判：`72dfb57` 時單 repo 環境是 `ambiguous=12 → RC=1`。
`de0d291`（補完 gap register 的後端引用前綴）與 `4688c8f`（補完 method 與 README
的最後幾支）之後，兩個環境都是 `ambiguous=0 → RC=0`。所以現在的待決問題不是「要不
要修」，而是**「上限憑什麼是 3」**——兩個環境今天都是 0，收成 0 做得到，但那要明講。
時間線與重跑命令在 `08-cto-review-20261029.md` §8.4-5。

**2. `06 §6.3` 這種數字一定會過期。**

上面多數列量於 `89d9d5d`，缺口數那一列是 `fa111a7`。文件改一行、測試加一個、後端
加一條路由，它們就不成立了。所以真正的防線不是把數字寫對（寫不對才是常態），而是把
每一列的產生命令集中成一份**重算索引**，讓下一輪能整批重跑，而不是逐節找命令。
已補在 §6.6。

## 6.4 無法驗證的事（誠實邊界）

1. **行為層完全沒驗。** 這是靜態審計：沒有真機、沒有讀卡機、沒有 staging 帳號。
   「Web 能在報到畫面寫卡」是讀程式碼得出的，不是操作得出的。
2. **122 條路由是產生器的輸出，不是後端自己的宣告。** 產生器曾經漏收巢狀掛載的
   `/import` 路由（上一輪修過）。本輪的重點放在「差異只有一行」，那個結論對漏收
   不敏感；絕對值則仍然依賴產生器。
3. **產業對照沿用上一輪的六家研究，未重跑。**
4. **`manage-stats` 的回應形狀未實際呼叫。** 形狀取自 controller 與 service 原始碼。
5. **引用閘門驗不出語意漂移。** `tests/parity-citations.test.mjs:211-224` 只做兩件
   事：`resolved.status === "missing"` 時報「引用不存在的檔案」，以及
   `from > total || to > total` 時報「行號超出檔案長度」。**它不讀那一行的內容。**

   這個邊界在本輪被實證過。`LinkCard_Frontend@app/check-in/[eventId]/page.tsx:90`
   一度被用來指「卡片密碼來源」；今天那一行是 bind 的 409 家族註解（`sed -n '90p'`
   可看到「這位已經有卡」那段），真正的來源在 `:19`
   （`} from '@/lib/checkin/cardPassword';`）。檔案存在、`90 ≤ 967`（該檔全長）⇒
   閘門 `problems=0`、全綠。**它抓到的是「引用壞掉」，不是「引用漂移」。**

   所以本批文件的引用正確性有兩層：機械層只保證「指得到東西」，
   「指到的是不是那個東西」仍然要靠人讀。這一條也是 `README.md`
   「會自己檢查自己的三個測試」與 `05-alignment-plan.md` §5.1、
   `08-cto-review-20261029.md` §8.5 三處同時改寫的理由——先前那些句子把
   「擋得住壞掉」講成了「擋得住漂移」。

## 6.5 本輪自己犯的錯

寫下來是因為下一輪會再遇到，而這份文件存在的目的就是讓下一輪便宜一點。

1. **`git add -A` 把 `node_modules` 符號連結加進了 commit。** 根目錄 `.gitignore`
   寫的是 `node_modules/`（只匹配目錄），符號連結不算目錄。已 `git rm --cached`
   後 amend。教訓與 `2026-10-19` 那次 `build/` 被忽略的事件同源：**只看
   `git status` 不夠，要看 `git show --stat`。**
2. **先寫結論再驗證，導致 A1 過度陳述。** 順序應該是「先跑 diff、再寫那句」，
   而不是「先寫那句、再跑一條支持它的 diff」。
3. **第一版引用有 12 個解析不到。** 其中 10 個是「Web 路徑沒加前綴」、2 個是
   「後端路徑被當成 App 路徑」。是測試自己抓到的，不是複核抓到的——這說明機械自檢
   比再讀一遍有效。
4. **把測試門檻設成 40，而實際只能解析 29 個。** 那個數字是憑感覺寫的，第一次跑就
   失敗。改成 25 並在註解寫明「這是偵測比對器壞掉的下限，不是品質指標」。

## 6.6 重算索引（下一輪從這裡開始）

§6.3 多數列量於 `89d9d5d`（缺口數那一列是 `fa111a7`），本節的是 `72dfb57` 的。三者
都會過期。所以這一節留下的不是數字，是**怎麼重算**：任何一列貼上命令，就知道今天
還成不成立。

全部在 App repo 根目錄執行，需要後端或 Web 的地方會寫出來。

| 你要知道的事                                        | 命令                                                                                                                                                                                                                                                                                                                                                                                                                                      | 你會看到什麼                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 三個 repo 的座標                                 | `for r in LinkCard_Event_Admin_App_Expo LinkCard_Frontend LinkCard_ExpressJS_Backend; do printf '%-32s %s\n' "$r" "$(git -C "$r" rev-parse --short HEAD)"; done`                                                                                                                                                                                                                                                                          | 三行短 hash（本輪的值見 `00 §0.2` 的座標表——那是唯一一份，不在這裡複寫）。再跑                                                                                                                                                                                                                            |
| `git status --porcelain src/`：空 ⇒ `src/` 零漂移。 |
| 2. 對等登記表一致性 ＋ Web 頁面掃描                 | `npm run check:parity`（Web 不在旁邊也能跑）／`npm run check:parity:full`（要 Web）                                                                                                                                                                                                                                                                                                                                                       | 有 Web：`Web 頁面掃描：18 個頁面，18 個已登記` ＋ `✓ 對等登記表一致：15 個能力（…）、13 個缺口`，exit 0（缺口數會隨新增缺口前進，`fa111a7` 時為 13；要現值就看這條命令的輸出）。無 Web：`SKIPPED: Web repo 不在旁邊，跳過頁面掃描`，`check:parity` 仍 exit 0，`--require-web` 則 exit 1。                 |
| 3. 引用是否仍解析                                   | `node --test tests/parity-citations.test.mjs`                                                                                                                                                                                                                                                                                                                                                                                             | 一行 `MEASURED checked=… skipped=… ambiguous=… floor=… problems=…`（**不論通過或失敗都印**），再加 `# pass 1`／`# fail 0`。這一行就是本檔的輸出介面：`checked` 通過、`skipped` 缺 sibling 未驗、`ambiguous` 無法唯一解析、`problems` 壞引用。                                                             |
| 4. 全套閘門                                         | `npm test`                                                                                                                                                                                                                                                                                                                                                                                                                                | `# fail 0`／`# todo 3`（通過數會隨本 repo 測試增減，不寫死；要看就跑這條命令）。fail 不是 0 時先懷疑這一節的引用——文件引用也在 `npm test` 的範圍內。                                                                                                                                                      |
| 5. App 端點契約                                     | 腳本**不在 `HEAD`**，先把它放進 App 的暫存複本：`git show audit/parity-20261022:scripts/check-backend-contract.mjs > $TMP/scripts/check-backend-contract.mjs`（快照 `backend-routes.snapshot.json` 同法），再於 `$TMP` 跑 `node scripts/check-backend-contract.mjs`                                                                                                                                                                       | `✗ 1 條呼叫在後端路由快照中找不到：` 加一條 `registration.service.ts:47 POST …/registrations/checkin/override`，exit 1。`HEAD` 上這條命令跑不起來（`ls scripts/check-backend-contract.mjs` 回 No such file）。                                                                                            |
| 6. 後端路由總數與差異                               | `node scripts/check-backend-contract.mjs --refresh --backend ../LinkCard_ExpressJS_Backend`（同樣在暫存複本裡跑，`--refresh` 會改寫快照）                                                                                                                                                                                                                                                                                                 | `已寫入 backend-routes.snapshot.json：122 條 events 路由（後端 <你當時的 HEAD>）`。上一輪是 121，多出來的是 `GET /:eventId/manage-stats`。括號裡的 SHA 是**你跑的那一刻**，不是固定值：上一輪兩次跑分別印過 `5b39cbd` 與 `1bc0602`（相差 6 個 commit）。要驗只能重跑，因為兩次都沒有落地檔（`02 §2.3`）。 |
| 7. 「未合併分支上的修復」還在不在                   | `git merge-base --is-ancestor audit/parity-20261022 HEAD && echo '22 MERGED' \|\| echo '22 NOT merged'`；再跑 `git rev-list --count origin/main..audit/parity-20261022`                                                                                                                                                                                                                                                                   | `22 NOT merged` ＋ `28`。前者哪天變成 `MERGED`，就代表 G-0 被解決，第 8 列的六項才有機會翻成「已修」。                                                                                                                                                                                                    |
| 8. 六個 `fixed-on-branch` 缺口在 HEAD 是否仍存在    | 逐項（判定依據見 §4.1）：`grep -n 'checkin/override' src/services/registration.service.ts`／`grep -n 'wallet' 'src/app/(auth)/[eventId]/token.tsx'`／`grep -n 'approvedBy' ../LinkCard_ExpressJS_Backend/src/events/services/EventWalletService.ts`／`for f in depositRefunded archivedAt checkedInBy boundOnly; do echo "$f $(grep -rl "$f" src/ \| wc -l)"; done`／`grep -rn 'my-access' src/`／`ls scripts/check-backend-contract.mjs` | 依序：`:50`／`:49`／投影 `select` 裡沒有 `approvedBy`／四個字串各 0 檔／0 命中／No such file ⇒ 六項全部仍在。任何一項開始有命中，就是它被修了。                                                                                                                                                           |
| 9. CI 實際跑了哪些檢查                              | `grep -n 'run:' .github/workflows/ci.yml`                                                                                                                                                                                                                                                                                                                                                                                                 | 八行：`npm ci`、`require-node-version`、`regenerate:typed-routes`、`typecheck`、`lint`、`format:check`、`check:parity`、`npm test`。**沒有** `check:parity:full`、**沒有**契約閘門、也**沒有** checkout 其他 repo。                                                                                       |
| 10. 「Web 是否已超集」怎麼重判                      | 讀 `../LinkCard_Frontend/app/check-in/[eventId]/page.tsx` 的三個符號：`useNfcReader`（`:9` 匯入、`:200` 呼叫）、`DeskReaderBar`（`:12` 匯入、`:707` 使用）、`Web Bluetooth` 分支（`:666`、`:917`）                                                                                                                                                                                                                                        | 三個都在 ⇒ Web 仍把「報到後不換頁寫卡＋讀卡機狀態」做完了，判定維持 Web 超集。少任一個就要重看 `03-capability-matrix.md` §3.4，不要沿用本輪的結論。                                                                                                                                                       |

### 6.6.1 單 repo 環境怎麼模擬（CI 就是這個環境）

CI 只 checkout 本 repo，所以 `check:parity:full` 與跨 repo 引用在那裡驗不到。要重現
CI 的判定，把 repo 複製到一個**沒有 sibling** 的目錄再跑：

```
mkdir -p /tmp/ci-sim
rsync -a --exclude node_modules --exclude .git --exclude ios --exclude .expo ./ /tmp/ci-sim/LinkCard_Event_Admin_App_Expo/
cd /tmp/ci-sim/LinkCard_Event_Admin_App_Expo
node scripts/check-parity-registry.mjs --web ../LinkCard_Frontend   # SKIPPED，exit 0
node --test tests/parity-citations.test.mjs                          # 看 MEASURED 那行；現行 HEAD 是 ambiguous=0 → RC=0
```

對照用：同一套複本手法在 `72dfb57` 上跑（`git archive 72dfb57 | tar -x -C /tmp/at-72dfb57/LinkCard_Event_Admin_App_Expo`）當時是 `ambiguous=12`、`RC=1`
——那是真的紅過，但已在同一個 round 內被 `de0d291` + `4688c8f` 修掉（時間線見
`08-cto-review-20261029.md` §8.4-5）。

複本裡沒有 `.git` 不影響結論：CI 有 `.git`，但它的父目錄同樣沒有 sibling，
`findSiblingRepo()` 兩邊都回 `null`。

兩個環境各跑一次，把各自印出的 `MEASURED` 那行記下來——**兩行都要留**，因為同一條
引用在兩邊的判定不同：三 repo 環境靠 basename 索引唯一命中，只有本 repo 時無從解析，
會落進 `skipped` 或 `ambiguous`。不要在這份文件裡記「今天是多少」，那個值隨文件增減
而變；要比較就看你自己跑出來的那兩行。

**本節的命令在 `72dfb57` 與 `4688c8f` 兩個座標上都實跑過；若你看到不同的輸出，是程式碼
或文件動了，不是命令壞了。**
