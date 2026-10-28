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

量測於 `89d9d5d`；引用數會隨文件改動漂移，重算命令見本節各列。其中「引用座標」
那一列在寫完本節之後重測過——本節自己新增了一個引用，寫之前的數字已經不成立（寫之
前是 44 / 42 / 0，寫之後是 45 / 43 / 0）。

| 量測               | 命令                                                                 | 結果                           |
| ------------------ | -------------------------------------------------------------------- | ------------------------------ |
| App 端點契約       | `node scripts/check-backend-contract.mjs`（腳本不在 `HEAD`，見下）   | 1 條死路、exit 1               |
| 後端路由總數與差異 | `node scripts/check-backend-contract.mjs --refresh --backend <後端>` | 121 → 122，只加 `manage-stats` |
| 對等登記表         | `node scripts/check-parity-registry.mjs --web <web> --require-web`   | 18/18 頁、exit 0               |
| 引用座標           | `node --test tests/parity-citations.test.mjs`                        | 45 個引用、43 個可驗、0 個壞   |
| 全 repo 閘門       | `npm run typecheck`／`npm run lint`／`npm test`（三者分開跑）        | 216 pass／0 fail／3 todo       |

每一列的數字各自怎麼來的：

- **1 條死路**：`POST */registrations/checkin/override`，呼叫點在
  `src/services/registration.service.ts:47`。閘門回報的是呼叫表達式的起始行，路由
  字面在第 50 行（引用慣例見 §6.2 A4）。exit code 是 1，不是 0。
- **121 → 122**：`eventRoutes` 由 121 增至 122，`nonEventRoutes` 2 條不變；唯一
  新增的是 `GET /:eventId/manage-stats`。快照的 `generatedFrom` 由 `64be09e` 走到
  `5b39cbd`。
- **18/18 頁**：Web 掃到 18 個頁面、18 個已登記；登記表 15 個能力、12 個缺口。
- **45 個引用 / 43 個可驗 / 0 個壞**：43 個通過行號檢查、2 個無法唯一解析（上限
  3）、0 個指向不存在的檔案或超出行長、0 個被跳過。
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

**1. 引用下限的餘裕比看起來小。**

`tests/parity-citations.test.mjs` 的下限在 `89d9d5d` 之前是固定 25。單 repo 環境
（CI 只 checkout 本 repo）在改這一節**之前**的實測是 `checked=26`——離那個下限只差
一個引用。多寫一個引用、或少解析一個，就會紅，而紅的理由會看起來像「文件品質變
差」。（本節新增一個引用之後是 `checked=27`，餘裕仍然是同一個量級。）

`89d9d5d` 改成環境感知之後（兩個 sibling 都在 → 25，缺任一個 → 15，並在缺
sibling 時印 `SKIPPED:`），今天的餘裕是：三 repo 環境 `43 / 25`、單 repo 環境
`27 / 15`。單 repo 環境實測會過，不是會紅：`parity-citations` 1 pass、
`parity-registry` 7 pass / 0 fail / 1 skipped，兩者 exit 0。

但這只把門檻移到不會誤報的位置，**沒有解決「餘裕」這件事**：

- 另一個上限是硬性數字 `ambiguous <= 3`。三 repo 環境實測 2，單 repo 環境實測
  **3，剛好卡在上限**。
- 也就是說，這兩個數字今天是「剛好過」，不是「有空間」。任何一個新的裸檔名引用
  只要撞不到唯一命中，就立刻越線——而越線的訊息會指向引用，不會指向「門檻是人工
  挑的」。
- 真正該做的是讓解析在必要時明確退化（跳過並計數），而不是靠一個人工挑的門檻。

**2. `06 §6.3` 這種數字一定會過期。**

上面每一個數字都是 `89d9d5d` 那一天的快照。文件改一行、測試加一個、後端加一條
路由，它們就不成立了。所以真正的防線不是把數字寫對（寫不對才是常態），而是把
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

§6.3 的每一個數字都是 `89d9d5d` 那天的快照，本節的是 `72dfb57` 的。兩者都會過期。
所以這一節留下的不是數字，是**怎麼重算**：任何一列貼上命令，就知道今天還成不成立。

全部在 App repo 根目錄執行，需要後端或 Web 的地方會寫出來。

| 你要知道的事                                     | 命令                                                                                                                                                                                                                                                                                                                                                                                                                                      | 你會看到什麼                                                                                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 三個 repo 的座標                              | `for r in LinkCard_Event_Admin_App_Expo LinkCard_Frontend LinkCard_ExpressJS_Backend; do printf '%-32s %s\n' "$r" "$(git -C "$r" rev-parse --short HEAD)"; done`                                                                                                                                                                                                                                                                          | 三行短 hash；本輪是 `72dfb57`、`b38316b`、`1bc06028`。再跑 `git status --porcelain src/`：空 ⇒ `src/` 零漂移。                                                                                                               |
| 2. 對等登記表一致性 ＋ Web 頁面掃描              | `npm run check:parity`（Web 不在旁邊也能跑）／`npm run check:parity:full`（要 Web）                                                                                                                                                                                                                                                                                                                                                       | 有 Web：`Web 頁面掃描：18 個頁面，18 個已登記` ＋ `✓ 對等登記表一致：15 個能力（…）、12 個缺口`，exit 0。無 Web：`SKIPPED: Web repo 不在旁邊，跳過頁面掃描`，`check:parity` 仍 exit 0，`--require-web` 則 exit 1。           |
| 3. 引用是否仍解析                                | `node --test tests/parity-citations.test.mjs`                                                                                                                                                                                                                                                                                                                                                                                             | `ok 1 - 審計文件裡的每一個引用都能解析`、`# pass 1`、`# fail 0`。**引用數不會印出來**，只有門檻失守時才出現在錯誤訊息裡；要量就用 §6.6.1 的複本把 `: 15;` 改成 `: 9999;`，它會自己講「解析成功 N、跳過 N、無法唯一解析 N」。 |
| 4. 全套閘門                                      | `npm test`                                                                                                                                                                                                                                                                                                                                                                                                                                | `# pass 216`／`# fail 0`／`# todo 3`。fail 不是 0 時先懷疑這一節的引用——文件引用也在 `npm test` 的範圍內。                                                                                                                   |
| 5. App 端點契約                                  | 腳本**不在 `HEAD`**，先把它放進 App 的暫存複本：`git show audit/parity-20261022:scripts/check-backend-contract.mjs > $TMP/scripts/check-backend-contract.mjs`（快照 `backend-routes.snapshot.json` 同法），再於 `$TMP` 跑 `node scripts/check-backend-contract.mjs`                                                                                                                                                                       | `✗ 1 條呼叫在後端路由快照中找不到：` 加一條 `registration.service.ts:47 POST …/registrations/checkin/override`，exit 1。`HEAD` 上這條命令跑不起來（`ls scripts/check-backend-contract.mjs` 回 No such file）。               |
| 6. 後端路由總數與差異                            | `node scripts/check-backend-contract.mjs --refresh --backend ../LinkCard_ExpressJS_Backend`（同樣在暫存複本裡跑，`--refresh` 會改寫快照）                                                                                                                                                                                                                                                                                                 | `已寫入 backend-routes.snapshot.json：122 條 events 路由（後端 1bc0602）`。上一輪是 121，多出來的是 `GET /:eventId/manage-stats`。                                                                                           |
| 7. 「未合併分支上的修復」還在不在                | `git merge-base --is-ancestor audit/parity-20261022 HEAD && echo '22 MERGED' \|\| echo '22 NOT merged'`；再跑 `git rev-list --count origin/main..audit/parity-20261022`                                                                                                                                                                                                                                                                   | `22 NOT merged` ＋ `28`。前者哪天變成 `MERGED`，就代表 G-0 被解決，第 8 列的六項才有機會翻成「已修」。                                                                                                                       |
| 8. 六個 `fixed-on-branch` 缺口在 HEAD 是否仍存在 | 逐項（判定依據見 §4.1）：`grep -n 'checkin/override' src/services/registration.service.ts`／`grep -n 'wallet' 'src/app/(auth)/[eventId]/token.tsx'`／`grep -n 'approvedBy' ../LinkCard_ExpressJS_Backend/src/events/services/EventWalletService.ts`／`for f in depositRefunded archivedAt checkedInBy boundOnly; do echo "$f $(grep -rl "$f" src/ \| wc -l)"; done`／`grep -rn 'my-access' src/`／`ls scripts/check-backend-contract.mjs` | 依序：`:50`／`:49`／投影 `select` 裡沒有 `approvedBy`／四個字串各 0 檔／0 命中／No such file ⇒ 六項全部仍在。任何一項開始有命中，就是它被修了。                                                                              |
| 9. CI 實際跑了哪些檢查                           | `grep -n 'run:' .github/workflows/ci.yml`                                                                                                                                                                                                                                                                                                                                                                                                 | 八行：`npm ci`、`require-node-version`、`regenerate:typed-routes`、`typecheck`、`lint`、`format:check`、`check:parity`、`npm test`。**沒有** `check:parity:full`、**沒有**契約閘門、也**沒有** checkout 其他 repo。          |
| 10. 「Web 是否已超集」怎麼重判                   | 讀 `../LinkCard_Frontend/app/check-in/[eventId]/page.tsx` 的三個符號：`useNfcReader`（`:9` 匯入、`:200` 呼叫）、`DeskReaderBar`（`:12` 匯入、`:707` 使用）、`Web Bluetooth` 分支（`:666`、`:917`）                                                                                                                                                                                                                                        | 三個都在 ⇒ Web 仍把「報到後不換頁寫卡＋讀卡機狀態」做完了，判定維持 Web 超集。少任一個就要重看 `03-capability-matrix.md` §3.4，不要沿用本輪的結論。                                                                          |

### 6.6.1 單 repo 環境怎麼模擬（CI 就是這個環境）

CI 只 checkout 本 repo，所以 `check:parity:full` 與跨 repo 引用在那裡驗不到。要重現
CI 的判定，把 repo 複製到一個**沒有 sibling** 的目錄再跑：

```
mkdir -p /tmp/ci-sim
rsync -a --exclude node_modules --exclude .git --exclude ios --exclude .expo ./ /tmp/ci-sim/LinkCard_Event_Admin_App_Expo/
cd /tmp/ci-sim/LinkCard_Event_Admin_App_Expo
node scripts/check-parity-registry.mjs --web ../LinkCard_Frontend   # SKIPPED，exit 0
node --test tests/parity-citations.test.mjs                          # 這一條現在會紅
```

複本裡沒有 `.git` 不影響結論：CI 有 `.git`，但它的父目錄同樣沒有 sibling，
`findSiblingRepo()` 兩邊都回 `null`。

2026-10-29 在 `72dfb57` 上實測：三 repo 環境 `解析成功 70、跳過 0、無法唯一解析 2`
（下限 25、上限 3，兩者都過）；單 repo 環境 `解析成功 32、跳過 28、無法唯一解析
12`——下限 15 過關，**上限 3 被 12 突破，`npm test` 在 CI 上會紅**。原因與處置寫在
`08-cto-review-20261029.md` §8.4。

**本節的所有命令都在 `72dfb57` 上實跑過；若你看到不同的輸出，是程式碼或文件動了，
不是命令壞了。**
