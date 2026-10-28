# 00 — 方法、範圍與判定規則

本文件說明「這一輪怎麼比、憑什麼這樣判」，其餘檔案是證據。

## 0.1 這份審計回答什麼

問題原文是「App 的功能是不是基本上和 Web Event Admin 一模一樣」。

「一模一樣」不是可回答的目標，因為兩個客戶端的存在理由不同：Web 是活動主辦方的
設定與財務後台，App 是活動當天的門口櫃檯。所以問題被拆成三層，每層有不同的正確答案。

| 層   | 問的是                     | 該不該一致           |
| ---- | -------------------------- | -------------------- |
| 端點 | 兩邊打的是不是同一條路     | 應該 100% 一致       |
| 語意 | 送出去、收回來的形狀一樣嗎 | 應該一致             |
| 能力 | 各自能完成哪些工作         | 不該一致，但要說清楚 |

本輪只做「查清楚」與「列出該補什麼」，不改產品行為（唯一例外見 §0.6）。

## 0.2 量測座標（2026-10-29）

比對基準是三個 repo 的實際 HEAD，不是記憶中的版本。

| Repo                            | 分支                          | 量測時的 HEAD |
| ------------------------------- | ----------------------------- | ------------- |
| `LinkCard_Event_Admin_App_Expo` | `feat/nfc-gate1-reader-spike` | `c645f20`     |
| `LinkCard_Frontend`             | `development`                 | `c8508aa`     |
| `LinkCard_ExpressJS_Backend`    | `development`                 | `7d08daff`    |

產生上表的三條命令（互不相依，在 `LinkCard/` 這一層跑）：

```
git -C LinkCard_Event_Admin_App_Expo rev-parse --short HEAD   # c645f20
git -C LinkCard_Frontend          rev-parse --short HEAD      # c8508aa
git -C LinkCard_ExpressJS_Backend rev-parse --short HEAD      # 7d08daff
```

**這三個 SHA 會前進；重測前請先確認你量的和文件量的是同一個 HEAD。** 本節每一個
數字都是上表那三個 HEAD 上量到的。這批文件先前寫的 `6e58f0a`（Web）與 `5b39cbd4`
（Backend）已不是那兩條分支的 HEAD。

App 的 `c645f20` 是研究與文件分支。它的 **`src/`** 與 `origin/main`（`7d0fcf5`）
逐位元相同：

```
git diff --stat origin/main..HEAD -- src/
# 空輸出

git diff --name-only origin/main..HEAD -- src/ | wc -l
# 0
```

**這裡原本引用的命令已經失效，而原因值得留在文件裡。** 舊版寫的是
`git diff --stat origin/main..<branch> -- src tests scripts .github package.json`
並宣稱空輸出；今天同一條命令回 5 個檔、+807 行——因為**這一輪自己**在 `scripts/`、
`tests/`、`.github/workflows/ci.yml`、`package.json` 加了對等登記表閘門與引用測試。
量測工具改變了自己的讀數。所以正確的範圍是 `-- src/`，不是那五個路徑。

整條分支對 `origin/main` 的差異（同日重新量測）：

```
git diff --stat origin/main..HEAD | tail -1
# 62 files changed, 11656 insertions(+), 11 deletions(-)
```

分佈（`git diff --name-only origin/main..HEAD | awk -F/ '{print ($0 ~ /\// ? $1"/" : $0)}' | sort | uniq -c`，加總 62）：

| 位置               | 檔數 | 內容                                                              |
| ------------------ | ---- | ----------------------------------------------------------------- |
| `docs/`            | 31   | 研究與手冊文件                                                    |
| `tools/`           | 19   | `nfc-reader-spike/` 17 檔（獨立 Node CLI）＋`nfc-web-probe/` 2 檔 |
| `.edison/`         | 4    | 迴圈狀態                                                          |
| `tests/`           | 2    | 引用與登記表測試                                                  |
| `scripts/`         | 1    | 對等登記表閘門                                                    |
| `parity/`          | 1    | 能力登記表                                                        |
| `package.json`     | 1    | 兩個 `check:parity` script                                        |
| `eslint.config.js` | 1    | +18 行，只對 `tools/nfc-reader-spike/**` 給 Node globals          |
| `.prettierignore`  | 1    | 讓 `tools/` 不進 prettier 範圍                                    |
| `.github/`         | 1    | CI 加一步 `check:parity`                                          |

所以正確的說法是兩句，不能併成一句：

1. **`src/`（App 的執行期產品碼）沒有變動。**
2. 這條分支**不是**「只有文件」——它多了 19 個 `tools/` 檔、一套閘門與測試，以及
   一段只作用於 `tools/nfc-reader-spike/**` 的 lint 例外。

`06-verification.md` §6.2 的 A1 記錄的是獨立複核**當時**的讀數（43 檔、+7,994 行）。
那個數字沒有錯，只是快照比本節早：中間多了本輪自己加的閘門與測試，以及後續文件。

若有人以為這條分支的 lint 通過等同 `main` 的 lint 通過，那個推論是錯的：它的 lint
規則集合確實不同。差別只在於，那些差異不會落到 app 程式碼上。

本輪所有 App 結論都對 `origin/main` 成立，不會因為換分支而漂移。

## 0.3 與 2026-10-22 審計的關係

`audit/parity-20261022` 分支上已有一輪同題審計（28 個 commit，離 `7d0fcf5`）。
本輪不重做那一輪的推導，只做兩件事：

1. 重測它宣稱的每一個事實，確認在今天的 HEAD 仍然成立。
2. 量它量不到的部分：10-22 之後三個 repo 各自往前走了一個星期。

這裡有一個必須先講的事實：那一輪的成果沒有合併、沒有 push。分支上的 7 個產品修復
（含一個 P0：呼叫一條後端從來不存在的路由）至今不在 `main`。詳細影響見
`04-gap-register.md` §G-0。

## 0.4 判定分類

每個能力只能落在下列一種，沒有「其他」。

| 判定                | 意思                                        |
| ------------------- | ------------------------------------------- |
| `ALIGNED`           | 兩邊都有，行為一致                          |
| `ALIGNED_DEFECT`    | 兩邊都有，但 App 這一側實作有明確缺陷，需修 |
| `APP_GAP`           | Web 有、App 該有而沒有                      |
| `BY_DESIGN`         | Web 有、App 刻意不做，附理由                |
| `APP_ONLY`          | App 獨有，Web 沒有或不打算有                |
| `WEB_ONLY_INTERNAL` | Web 獨有的內部工具，不是產品能力            |

`BY_DESIGN` 不是「先跳過」的同義詞。每一個 `BY_DESIGN` 都必須有一句可反駁的理由，
寫在 `03-capability-matrix.md` 的證據欄，否則一律降級成 `APP_GAP`。

## 0.5 證據規則

這一節存在的理由：上一輪的獨立驗證抓到 6 個引用點有 5 個對不上，因為同一天內既描述
了問題、又修掉了問題，沒標示哪個是修復前的快照。本輪的規則：

1. 每個事實都要有 `檔案:行號`，且該行在 §0.2 的 HEAD 上讀得到。
2. 每個數字都要附上產生它的命令，不寫「大約」。
3. 引用別人的結論時，標明來源分支與 SHA；不把別人的量測當自己的量測。
4. 修改過產品碼的 commit 不與審計文件混在同一批。

### 引用的寫法（機械可驗）

`tests/parity-citations.test.mjs` 會解析這些文件裡的每一個 `檔案:行號`，
檢查檔案存在、行號不超過長度。規則有三條：

1. 路徑寫完整，不寫「只給檔名、後面接一個行號」這種要靠上下文的縮寫。
2. 跨 repo 引用寫 `Repo@路徑`，例如
   `LinkCard_Event_Admin_App_Expo@src/services/nfc.service.ts:23`。
3. 同一份文件若整篇都在講同一個 repo，在標題下寫一行
   `<!-- citations: LinkCard_Frontend -->`，短路徑繼承它。

第 3 條存在的理由：01 那一節整張表都是 Web 的檔案，每列都寫全名會讓表格讀不下去。
但預設值必須寫在檔案裡，不能靠讀者的記憶。

## 0.6 本輪沒有產品碼變更

`05-alignment-plan.md` 列出的待補清單全部留在計畫階段。

原本預計順手修掉 G-1（呼叫不存在的路由），但它在上一輪已經修好、只差合併，
本輪再修一次會產生第二個修法，日後合併時多一個衝突點。
所以本輪唯一的動作是把「這件事還沒生效」記錄下來，並把判斷變成可重跑的測試。
