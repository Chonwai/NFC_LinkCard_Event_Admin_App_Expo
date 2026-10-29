# 09 — 分支、合併，與「合併會不會有影響」

<!-- citations: LinkCard_Event_Admin_App_Expo -->

**量測座標 `ffffbec`（`feat/nfc-gate1-reader-spike`，2026-10-29）。**

本文每個數字後面都跟著產生它的命令，重跑會複現。但數字會隨本分支每一次 commit
前進，**包括加入這份文件的那一次**；在別的 HEAD 上量到不同的讀數是正常的，那不是
漂移，是量的時刻不同。

> 若你手上的版本寫「ahead 169」，那是在 `2e2d97d`（`ffffbec` 的父）量的。
> `ffffbec` 只改了一行 `parity/parity-registry.json`：
>
> ```
> git rev-list --count origin/main..2e2d97d   # 169
> git rev-list --count origin/main..ffffbec   # 170
> ```
>
> 兩個數字都對。同理，「233」今日讀數是 234。**本文一律用重跑得到的值，不抄舊值。**

## 9.1 「合併」在這批文件裡指三件不同的事

這個詞在這批文件裡出現三次，指的是三件事。不看清楚就會把「已經發生過的」當成
「還沒發生的」，而兩者的風險差一個量級。

| #   | 從 → 到                                | 狀態              | 那次動了什麼                                                          | 影響範圍                                      |
| --- | -------------------------------------- | ----------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| ①   | `audit/parity-20261022` → 工作分支     | 已做（`1cb2b73`） | 30 檔：16 docs／**9 src**／2 scripts／1 tests／1 root／1 CI           | **會改變 App 行為**——三次裡唯一動產品碼的一次 |
| ②   | `audit/parity-20261028` → 工作分支     | 已做（`bc6ec47`） | 18 檔：11 docs／2 tests／2 root／1 scripts／1 parity／1 CI，**src 0** | 只加閘門與文件，不改變 App 行為               |
| ③   | `feat/nfc-gate1-reader-spike` → `main` | **還沒做**        | 待併 90 檔：46 docs／44 非 docs（其中 9 是 src）                      | ← **你問的是這個。** 9.3 逐級拆解             |

三列的產生命令（`1cb2b73^1` 要加引號，zsh 會把 `^` 當 glob）：

```
git --no-pager diff --name-only 1cb2b73^1 1cb2b73 | wc -l          # 30
git --no-pager diff --name-only 1cb2b73^1 1cb2b73 -- src/ | wc -l  # 9
git --no-pager diff --name-only bc6ec47^1 bc6ec47 | wc -l          # 18
git --no-pager diff --name-only bc6ec47^1 bc6ec47 -- src/ | wc -l  # 0
git --no-pager diff --name-only origin/main..HEAD | wc -l          # 90
git --no-pager diff --name-only origin/main..HEAD -- docs/ | wc -l # 46
```

① 與 ② 的差別值得記住：兩次合併的「合併」動作長得一樣，足跡卻完全不同類。
① 帶進 9 個 `src/` 檔，② 一個都沒有。所以「之前合併過，都沒事」**不能**推論到
③——之前那兩次從來沒有把產品碼送進 `main`，③ 會。

## 9.2 現在的分支長什麼樣

不是示意圖，是四條 ref 的實測值。

| 分支                          | HEAD      | 最後一顆 commit | 與 `HEAD` 的 ahead / behind |
| ----------------------------- | --------- | --------------- | --------------------------- |
| `origin/main`                 | `7d0fcf5` | 2026-10-16      | behind **0** / ahead 170    |
| `origin/development`          | `b58e95c` | 2026-09-22      | behind **0** / ahead 234    |
| `main`（本地，未推 2 顆）     | `fd996f0` | 2026-10-22      | behind **0** / ahead 168    |
| `feat/nfc-gate1-reader-spike` | `ffffbec` | 2026-10-29      | —（這就是 HEAD）            |

```
git rev-parse --short origin/main origin/development main HEAD
git log -1 --format='%ad' --date=short origin/main          # 2026-10-16
git log -1 --format='%ad' --date=short origin/development   # 2026-09-22
git rev-list --left-right --count origin/main...HEAD        # → 0    170
git rev-list --left-right --count origin/development...HEAD # → 0    234
git rev-list --left-right --count main...HEAD               # → 0    168
git rev-list --left-right --count origin/development...origin/main  # → 0  64
```

三句結論，每句都附上判定的命令：

**一、`main` 才是主線，`development` 自 2026-09-22 起沒動過，而且它已被 `main`
完全包含（dev-only 0／main-only 64）。**

```
git rev-list --left-right --count origin/development...origin/main   # 0   64
git log -1 --format='%ad' --date=short origin/development            # 2026-09-22
```

「dev-only 0」的意思是：`development` 上沒有任何一顆 commit 是 `main` 沒有的。
它已經不是一條獨立的分支，只是 `main` 的一個舊位置。

**二、工作分支對 `main` 是 ahead 170 / behind 0。**

```
git rev-list --left-right --count origin/main...HEAD   # 0   170
```

**三、⇒ 合併是 fast-forward。不可能有衝突，也不可能覆蓋掉 `main` 上任何東西。**

```
git merge-base --is-ancestor origin/main HEAD && echo YES    # YES
git rev-list --count HEAD..origin/main                        # 0
```

第二條命令是關鍵：「`main` 有而我們沒有」的 commit 數是 **0**。衝突需要兩邊各自
改過同一段，覆蓋需要「我們沒有、人家有」的內容——兩者的前提在這裡都是 0。
**這是可算的，不是我保證的。** 對本地 `main` 與 `origin/development` 同理，兩者
也都在 HEAD 的祖先鏈上：

```
for r in origin/main main origin/development; do
  printf '%-20s ⊂ HEAD ? ' "$r"
  git merge-base --is-ancestor "$r" HEAD && echo YES || echo NO
done
# origin/main ⊂ HEAD ? YES
# main        ⊂ HEAD ? YES
# origin/development ⊂ HEAD ? YES
```

⚠️ 一個容易誤讀的地方：本地 `main`（`fd996f0`）**比 `origin/main` 多 2 顆未推的
commit**，但那 2 顆已經在工作分支的歷史裡了，所以它仍然是工作分支的祖先、仍然可以
fast-forward。查這件事的命令：

```
git rev-list --left-right --count origin/main...main   # 0   2
git log --oneline origin/main..main                    # 2 顆：NFC spike 的 node package
git merge-base --is-ancestor main HEAD && echo YES     # YES
```

## 9.3 如果真的合併，會發生什麼

### (a) 會進 `main` 的東西

按「壞掉會怎樣」分三級，不是按檔案數分。影檔數也不代表風險低。

| 級別           | 檔數 | 內容                                                                                                     | 壞掉會怎樣                                                                      |
| -------------- | ---: | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **產品碼**     |    9 | `src/` 全部：報到台、總覽、報名者詳情、寫卡 token、`copy.zh-TW`、3 支 service、API 型別                  | App 當天的櫃檯行為改變。**App 沒有 E2E 或 runtime 閘門**，只有 `tsc` 與單元測試 |
| **工具與閘門** |   31 | `tools/` 19（讀卡機 spike 17 ＋ 網頁 NFC 探針 2）、`scripts/` 3、`tests/` 3、`parity/` 1、CI 1、根設定 4 | 閘門壞掉不會讓 App 壞，但會**讓閘門自己變鈍**——而沒有人會發現，因為它不叫       |
| **文件**       |   50 | `docs/` 46、`.edison/` 4（3 份 review artifact ＋ 1 份 loop state）                                      | 幾乎不會壞。唯一風險是「文件說的與程式做的不一致」，而這要人讀才會發現          |

三級的檔案數怎麼來的：

```
git --no-pager diff --name-only origin/main..HEAD -- src/     | wc -l   # 9
git --no-pager diff --name-only origin/main..HEAD -- tools/   | wc -l   # 19
git --no-pager diff --name-only origin/main..HEAD -- scripts/ | wc -l   # 3
git --no-pager diff --name-only origin/main..HEAD -- tests/   | wc -l   # 3
git --no-pager diff --name-only origin/main..HEAD -- parity/  | wc -l   # 1
git --no-pager diff --name-only origin/main..HEAD -- .github/ | wc -l   # 1
git --no-pager diff --name-only origin/main..HEAD -- docs/    | wc -l   # 46
git --no-pager diff --name-only origin/main..HEAD -- .edison/ | wc -l   # 4
```

> **「非文件檔 40 個」與「44 個」的差別。** 把 `docs/` 濾掉之後有 **44** 檔
> （30 新增／14 修改）；再濾掉 `.edison/`（4 檔：3 份 review artifact ＋ 1 份
> loop state）才是 **40**（26 新增／14 修改）。`.edison/` 是 agent 的工作紀錄，
> 不是專案碼，所以分級表不放它——但它**確實會被合併帶進 `main`**，而且它沒被
> `.gitignore` 擋掉（`git check-ignore .edison/...` 回空）。要不要帶，是一個可以
> 單獨決定的問題。
>
> ```
> git --no-pager diff --name-status origin/main..HEAD | grep -vE '^(.)\s+docs/' | wc -l   # 44
> git --no-pager diff --name-status origin/main..HEAD | grep -vE '^(.)\s+docs|\.edison' | wc -l  # 40
> ```

**產品碼那 9 檔全部來自合併 ①，② 一檔未動**（見 9.1 的命令）。這一點很重要：
它們不是在這條分支上新寫的，是 10-22 那一輪的修復，已經在工作分支上跑了一段時間
——但**從來沒有 CI 驗過**（9.4）。

### (b) 不會發生的事

這一節比 (a) 重要，因為誤解通常發生在這裡。

**一、不會部署。** 這個 repo 沒有任何自動部署設定：

```
for f in vercel.json netlify.toml app.yaml render.yaml fly.toml Dockerfile Procfile; do
  [ -e "$f" ] && echo "存在: $f" || echo "不存在: $f"
done
# 七個全部「不存在」
```

`package.json` 的 `scripts` 也沒有任何 `deploy`／`release`／`eas build` 條目：

```
sed -n '/"scripts"/,/}/p' package.json     # start/android/ios/web/lint/format/prepare/
                                           # check:*/typecheck/regenerate:*/test
grep -nE '"(deploy|release|eas|publish)' package.json
```

> **誠實補充：`eas-cli` 在 devDependencies 裡（`LinkCard_Event_Admin_App_Expo@package.json:33`），`eas.json` 也
> 存在。** 所以「有人手動跑 `npx eas build` 就能出 build」是成立的。缺的不是能力，
> 是**觸發點**：沒有任何腳本或 CI step 會在你 push 之後自動做這件事。`main` 上
> 曾經有過 10 次 CI run，全部是 `ci` workflow 的 `push`，沒有一次是 build。

**二、不會改版本號。** `app.json` 與 `eas.json` 和 `origin/main` 位元相同：

```
git --no-pager diff --stat origin/main..HEAD -- app.json eas.json   # 空輸出
git rev-parse origin/main:app.json HEAD:app.json                     # 同一個 blob
git rev-parse origin/main:eas.json HEAD:eas.json                     # 同一個 blob
```

`app.json:5` 的 `"version": "1.0.0"` 從 `main` 到 HEAD 沒有動過，而且
`eas.json:4` 是 `"appVersionSource": "remote"`——版本號的權威來源在 EAS 伺服器上，
不在這個 repo 的檔案裡。**所以「合併會不會不小心升版」這個問題沒有立足點**：
合併不改這兩個檔，而就算改了，也不是版本的權威。

**三、不會覆蓋 `main` 上的東西。** 見 9.2 結論三：`behind = 0`，
`git rev-list --count HEAD..origin/main` 回 0。

**四、不會帶進憑證。** 170 顆 commit 的 diff 裡沒有任何 `.env*` 或 secret 類檔名：

```
git --no-pager log --format= --name-only origin/main..HEAD \
  | grep -icE '(^|/)\.env|\.(pem|p12|p8|key|keystore|jks)$'   # 0
git ls-files | grep -E '(^|/)\.env'                            # 只有 .env.example
```

`.env.example` 是範本（值為佔位符），`.env.local` 存在於工作目錄但**未被追蹤**。
這條命令只比對檔名，不讀內容——**沒有任何一次讀取 `.env*` 的內容**。

## 9.4 合併真正的好處（一條，但很實在）

**那兩支閘門從來沒有真正跑過。**

`ci.yml` 的 `push` 觸發被分支白名單限制在 `[main, master, develop, development]`
（`.github/workflows/ci.yml:5`），而工作分支不在名單裡：

```
grep -n 'branches:' .github/workflows/ci.yml   # 5:      branches: [main, master, develop, development]
```

這條分支也從來沒有開過 PR，所以 GitHub 上一次 run 都沒有：

```
gh run list --branch feat/nfc-gate1-reader-spike --limit 20    # 0 行輸出
gh run list --limit 10                                         # 10 筆，branch 欄全是 main
```

而 `main` **在**那張白名單裡 ⇒ 合併是讓閘門第一次真的咬的最短路徑。

單一 job `quality`（`.github/workflows/ci.yml:13`），9 個具名 step：

```
grep -cE '^\s+- name:' .github/workflows/ci.yml   # 9
```

九個 step 依序是 Install、Node version guard、Regenerate typed routes、Typecheck、
Lint、Format check、**Parity registry**（`.github/workflows/ci.yml:49`）、
**Backend contract**（`.github/workflows/ci.yml:56`）、**Test**
（`.github/workflows/ci.yml:59`）。前六個是常規檢查，後三個才是這輪新增的閘門
——「Parity registry」與「Backend contract」則是**它們的第一次真實執行**。

> **一個必須說清楚的機制細節。** 「沒跑過」的原因**不是** workflow 看不見 feature
> 分支。`.github/workflows/ci.yml:6` 有 `pull_request:`，而且**沒有分支白名單**
> ⇒ 只要開 PR，CI 就會跑。真正的因果是：**沒有 PR，所以沒有 run**。
>
> 這個差別不是文字潔癖——它正好是 9.5 選項 A 之所以有效的理由：開 PR 是唯一能
> **在合併之前**看到那兩支閘門結果的方法。

## 9.5 三條路，與各自的代價

**不替你選。** 三條都合法，代價不同。

### A — 開 PR → 等 CI 綠 → merge

- **好處**：唯一能**先看到閘門結果**再決定要不要合的路。`Parity registry` 與
  `Backend contract` 在 `main` 上跑第一次之前，你會先在 PR 上看到它們紅或綠。
  PR 上也會留下「這兩支閘門是什麼時候第一次通過」的紀錄。
- **代價**：多一到兩個步驟。而且**要把分支先推上去**——目前 `origin/feat/...` 停在
  `81f8fa8`，本地還有 2 顆沒推：
  ```
  git rev-list --left-right --count origin/feat/nfc-gate1-reader-spike...HEAD  # 0  2
  ```
  另外 `Parity registry` 這一步在 CI 上是**降級執行**的：Web repo 不在 checkout
  範圍內，所以完整掃描（會抓到「Web 新增一頁但沒登記」）不會發生（見
  `06-verification.md` §6.4 第 5 條）。綠燈的意義比看起來窄。
- **選它等於承認**：你願意為「先知道結果」多付一輪等待。

### B — 直接 fast-forward push `main`

- **好處**：最快。技術上可行，`main` **沒有分支保護**：
  ```
  gh api repos/Chonwai/NFC_LinkCard_Event_Admin_App_Expo/branches/main/protection
  # {"message":"Branch not protected", ... "status":"404"}
  ```
  而 fast-forward 之所以安全，是因為 `behind = 0`（9.2）。
- **代價**：CI 在 push **之後**才跑，等於事後才知道。如果 `Parity registry` 或
  `Backend contract` 紅了，那 170 顆 commit 已經在 `main` 上——回退需要另一輪動作，
  而回退一個 fast-forward 就是把 ref 指回去（歷史還在，但 `main` 的紀錄會多一次
  錯誤的前進）。
- **選它等於承認**：你接受「先上、紅了再處理」，並且相信本機的閘門（`npm test`
  已全綠）與 CI 的判準一致。**這兩者一致嗎？本文沒有驗證過**——見 9.7。

### C — 只挑 9 個 `src` 檔單獨開 PR

- **好處**：面積最小。CI 只需要驗產品碼，`tools/` 的 19 檔與 `docs/` 的 46 檔
  不必一起進來。
- **代價**：**會把「修復」與「它的證據」切開**。`04-gap-register.md` 記錄的缺口
  關閉狀態、`06-verification.md` 的驗證、`08` 的批判複核，全都指向那 9 檔；只併
  9 檔會讓 `main` 上有一批修好的程式碼，而說明它為什麼這樣修的 46 份文件留在
  分支上。下一次有人讀 `main` 會看到沒有理由的改動。
  另外 `parity/parity-registry.json` 與 `scripts/check-parity-registry.mjs` 也會
  被留在外面，於是**「9 檔修復所對應的登記表」不在 `main` 上**，Parity registry
  這支閘門在 `main` 上等於沒有資料可驗。
- **選它等於承認**：你認為文件可以晚一點到，而程式碼的風險高於文件的價值。

## 9.6 一個要先回答的副作用：`development` 怎麼辦

合併之後 `development` 會落後更多。它現在已經落後 64（9.2），和 `main` 合併後
至少再 +170。

三種處置，不替你選：

| 處置                     | 好處                           | 代價                                                 |
| ------------------------ | ------------------------------ | ---------------------------------------------------- |
| **退休**（刪本地＋遠端） | 不會再有人誤以為它是 staging   | 若真有外部流程指向它，會斷。要先確認沒有人用它       |
| **定期 reset 到 `main`** | 它永遠等於 `main`，不會腐爛    | 需要一個「誰在什麼時候 reset」的約定，否則還是會爛   |
| **繼續當 staging 用**    | 保留一條可以放未完成東西的地方 | 它與 `main` 的差距會持續變大，而**差距本身就是風險** |

**不決定也是一種決定。** 不決定的結果是：它會愈來愈像一個沒人用的分支，而**有人
可能以為它是真的**——名字叫 `development`、存在於遠端、出現在 `ci.yml:5` 的觸發
白名單裡（`.github/workflows/ci.yml:5` 確實列了它）。一個被 CI 承認、卻沒有人推
東西上去的分支，比一個被刪掉的分支更危險。

## 9.7 這份文件的邊界

- **沒有跑過 CI。** 那正是本文的主題——9.4 講的是「它沒跑過」，不是「它會綠」。
  9.5 選項 B 假設「本機 `npm test` 全綠 ⇒ CI 也會綠」，**這個假設本文沒有驗證**。
  已知的差異至少有兩項：CI 不 checkout Web repo（Parity registry 降級執行），而
  CI 是 `ubuntu-latest` + Node 22，本機是 macOS。
- **沒有驗證 EAS build。** 合併不觸發它（9.3(b) 第一條），所以本文也沒有理由驗。
- **170 顆 commit 沒有逐個讀。** 我讀的是**差異的形狀**：檔數、目錄分佈、commit
  類型分佈、`src/` 那 9 個檔的來源。逐個讀 170 顆是另一件工作，那件事沒做。
- **沒有替任何人做決定。** 9.5 的三條路、9.6 的三種處置，都是並列。本文只提供
  「選它等於承認什麼」，不提供推薦。
- **數字有時效。** 每一個都附了命令。若你的讀數與本文不同，先確認
  `git rev-parse --short HEAD` 是否仍是 `ffffbec`（或它的後代），再判斷是不是真有
  不一致。

## 9.8 直接回答：能不能開工

**不能整包開工——因為「現在就能做的」已經做完了；剩下的不是任務，是決定。**

（嚴格說還剩**一件半**：G-10 的後半。那是小時級別的修改，不是一個 sprint。它在
9.9 與 9.11 都只有一行。）

13 個缺口按「現在能不能動」分三堆，只有中間那一堆是工作：

| 已做完（7）                                   | 現在就能開工（1）                                            | 卡在決定（5）                                 |
| --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| G-0、G-1、G-2、G-3、G-4、G-5、G-11（`fixed`） | G-10（`ready-to-implement`）——**只剩後半**：兩次請求降成一次 | G-6、G-7、G-8、G-9、G-12（`decision-needed`） |

這三堆的邊界不是我分的，是登記表的 `status` 分的：

```
node -e "const r=require('./parity/parity-registry.json');const m={};for(const g of r.gaps)m[g.status]=(m[g.status]||0)+1;console.log(r.gaps.length+' gaps',m)"
# 13 gaps { fixed: 7, 'decision-needed': 5, 'ready-to-implement': 1 }

node -e "const r=require('./parity/parity-registry.json');for(const g of r.gaps)console.log(g.id.padEnd(5),g.severity.padEnd(3),String(g.status).padEnd(20),g.owner)"
# G-6   P1  decision-needed      product+finance
# G-7   P1  decision-needed      product
# G-8   P1  decision-needed      product+ops
# G-9   P2  decision-needed      product
# G-10  P1  ready-to-implement   none-needed
# G-12  P2  decision-needed      backend
```

**「已做完」那一堆有一個縫隙，先說在前面。** G-3 的 `status` 是 `fixed`，但它的
驗收條件在 10-29 被改寫成「有提示、翻頁器未做」——`05-alignment-plan.md` §5.2 的
驗收欄自己這樣寫。所以「7 項已做完」的準確讀法是「7 項的**改寫後**驗收都達成」。
要不要補翻頁器，是一個新問題：它不在任何一張 backlog 上，也不阻擋別的東西。

## 9.9 逐項：誰在等誰

每列的問句都是**能讓工程師當天開工**的粒度，不是「要怎麼對齊」這種抽象問題。
答完那一句，對應的缺口就從 `decision-needed` 換成 `ready-to-implement`，或換成
一個寫了理由的 `BY_DESIGN`。

| gap  | 現在能不能動       | 卡在誰          | 最小可回答的一句話                                                                                         |
| ---- | ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------- |
| G-6  | 不能               | product+finance | 「門口 OPERATOR 能不能封存／隱藏報名？退款只做到『款項未撥出』可以嗎？」                                   |
| G-7  | 不能               | product         | 「現場臨時補卡，是要 App 能單張發卡，還是接受回 Web 做批次？」                                             |
| G-8  | 不能               | product+ops     | 「報到桌要不要在 App 上寫卡＋上鎖？如果不做，下一輪就把它改判 `BY_DESIGN`。」                              |
| G-9  | 不能               | product         | 「你們的活動有沒有場次？」——**這一題不回答，G-9 就永遠是懸空的 P2**                                        |
| G-12 | 不能               | backend         | 「路由層授權要不要現在補？（A：現在就掛既有 factory／B：排 P2，只加防漏檢查）」                            |
| G-10 | **能（只有後半）** | 無              | 不用問任何人。只有真要顯示「已報到數」時，才需要後端回答一句：「能不能放寬一個 OPERATOR 可讀的計數端點？」 |

**這五個「卡在決定」的缺口，卡的是選擇，不是研究。** `04-gap-register.md` 給
G-6、G-7、G-8、G-9、G-12 每一節都寫了 A／B 兩個具體選項與各自的代價。所以真正缺
的是「有人指一個」，不是「再多分析一輪」。

> **G-7 的狀態在 `ffffbec` 變過，讀舊版的人要注意。** 它原本是 `open`（看起來像
> 沒人看過），`ffffbec` 之後是 `decision-needed`（看過了、有 A／B、等人選）。
> `ffffbec` 當時只改了 `parity/parity-registry.json`，`05-alignment-plan.md` §5.7
> 沒跟上——那一節還寫著「G-7（P1）是 `open`」、引用的判準輸出也還是
> `G-7  P1  open`。本輪已把那一句與那段引文同步成 `decision-needed`，引文也換成
> 實跑輸出，因此登記表與計畫文件現在一致；上面那條歷史記述保留，是因為讀舊版
> （`ffffbec` 之前）的人仍需要知道它為什麼看起來像「沒人認領」。

## 9.10 不開工也能先做的三件事（半天內）

**一、開一個 PR，讓 CI 第一次真的跑。** 理由在 9.4：`push` 觸發有分支白名單、
`pull_request` 沒有，所以 PR 是唯一能在**合併之前**看到 `Parity registry` 與
`Backend contract` 結果的方法。

**不做的代價**：合併 ① 帶進來的那 9 個 `src/` 檔，到今天**沒有被任何 CI 驗過**。
你會在合併當天、在 `main` 上，才知道它們紅不紅——而 `main` 沒有分支保護
（9.5 選項 B），紅了也擋不住。

**二、決定 `development` 的去留。** 三種處置與代價在 9.6。

**不做的代價**：它會繼續被 `.github/workflows/ci.yml:5` 的觸發白名單承認、繼續
出現在 `git branch -r`、繼續落後。一個被 CI 承認卻沒有人推東西上去的分支，比一個
被刪掉的分支更危險——它看起來還在運作。

**三、把 `ambiguous` 從 2 降到 0。** 那兩個都是裸檔名的 `package.json`（第 59
行；修法就是補 repo 前綴，例如 `LinkCard_Event_Admin_App_Expo@package.json:59`）。
它們一處在 `04-gap-register.md` 的 G-11 證據表，一處在 `05-alignment-plan.md`
§5.7 的實跑引文。

```
node --test tests/parity-citations.test.mjs 2>&1 | grep MEASURED
# MEASURED checked=121 skipped=0 ambiguous=2 floor=25 problems=0
```

**不做的代價**：上限是 3（`tests/parity-citations.test.mjs` 的 `ambiguous <= 3`），
只剩 **1 格**。下一次任何一份文件多寫一個裸引用就紅；而紅的理由與內容好壞無關，
讀者會學會「這個紅燈不重要」——那比紅燈本身貴。這是三件事裡唯一一件**清掉紅燈
來源**而不是**建立新流程**的事。

## 9.11 如果你今天就要開一個 sprint

一個不需要任何人做決定的 sprint，只有三件半：

| #   | 內容                              | 出自         |
| --- | --------------------------------- | ------------ |
| 1   | G-10 後半：總覽的兩次請求降成一次 | 9.9 最後一列 |
| 2   | 開 PR，讓兩支閘門第一次真的跑     | 9.10 第一件  |
| 3   | 決定 `development` 的去留         | 9.10 第二件  |
| 4   | `ambiguous` 2 → 0                 | 9.10 第三件  |

**這個 sprint 不會讓 App 更接近 Web。** 它做的是把「閘門與座標」弄可信：讓 CI
真的咬過一次、讓分支狀態有意義、讓測試紅燈只在該紅的時候紅。

若你要的是「App 追上 Web」，那就必須先回答 9.9 的五句話——沒有那五句，任何追趕
的排程都建立在「不知道要做什麼」之上。

## 9.12 這半的邊界

- **「可開工」的判定依據是三個機械條件，不是我的直覺**：① 登記表的 `status`
  （9.8 的兩條命令）、② `04` 有沒有 A／B 選項、③ `05` 有沒有給它一個階段。
  三個都查了。G-12 就是這輪被補上的那一個——`05` 對它的提及次數從 **0** 變成
  **11**，補上的那一節是 `05-alignment-plan.md` 的第五階段（本節刻意不引用它的
  行號，因為行號會隨下一次編輯失效）。
- **我沒有估算工時。** `04` 的 `S`／`M`／`L` 是原作者的估法，我沒有重估，也沒有
  換算成人日。9.11 說「三件半」用的是件數，不是天數。
- **沒有替任何人選。** 9.9 的六列給的是**問句的形狀**，不是答案；9.10 的三件事
  之所以列得出來，正是因為它們不需要任何答案。
- **沒有重算 9.1–9.7 的數字。** 那幾節的座標是 `ffffbec`；9.8 之後的重跑座標是
  `dc63d54`（後者比前者多一顆只動文件的 commit：把 G-12 放進 `05`）。兩處讀數
  不可混用。

---

**Commit 類型分佈**（供 9.3 的「差異形狀」對照，非結論）：170 顆中 docs 109、
fix 26、feat 15、chore 10、test 5、merge 2、非 conventional 3。

```
git --no-pager log --format='%s' origin/main..HEAD \
  | sed -E 's/^([a-z]+)(\([^)]*\))?!?:.*/\1/' | sort | uniq -c | sort -rn
git rev-list --count origin/main..HEAD   # 170
```

`merge` 那 2 顆就是 9.1 的 ① 與 ②：

```
git --no-pager log --merges --oneline origin/main..HEAD
# 1cb2b73 merge: bring the 2026-10-22 parity audit into the working branch (G-0)
# bc6ec47 merge: bring the 2026-10-28 App/Web parity audit into the working branch
```

model_used: OpenCode Go / Deepseek V4.1 Flash
