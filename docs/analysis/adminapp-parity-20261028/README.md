# App ↔ Web 功能對齊檢查（2026-10-28）

先讀這份。其餘檔案是證據。

## 這批文件在哪裡

就在**這個資料夾**，跟同類的兩份審計並排：

```
LinkCard_Event_Admin_App_Expo/docs/analysis/
├── adminapp-parity-20261015/
├── adminapp-parity-20261022/
└── adminapp-parity-20261028/   ← 本檔
```

三個入口：

| 你想做什麼             | 去哪                                            |
| ---------------------- | ----------------------------------------------- |
| 快速知道結論           | 本檔                                            |
| 轉述給別人、或要做決定 | `07-briefing.md`                                |
| 查某一項的證據         | `03-capability-matrix.md`、`04-gap-register.md` |

> **它一度不在這裡。** 這份報告原本只存在於 `audit/parity-20261028` 分支，
> 那條分支沒有被 checkout，所以資料夾看起來像「消失了」。2026-10-29 已把該分支
> 併入工作分支，之後就跟其他兩份一樣直接開得到。

## 會自己檢查自己的兩個測試

這份報告最容易壞的地方是「引用漂移」——寫的時候指到某個檔案的某一行，之後
程式碼一改，那句話就變成假的。所以有一組機械閘門盯著它：

| 檔案                                | 盯什麼                                         |
| ----------------------------------- | ---------------------------------------------- |
| `tests/parity-citations.test.mjs`   | 每個 `Repo@path:line` 的檔案存在、行號在範圍內 |
| `tests/parity-registry.test.mjs`    | 登記表本身的一致性（含反例測試）               |
| `scripts/check-parity-registry.mjs` | Web 頁面是否都登記了、P0/P1 缺口是否有計畫章節 |
| `parity/parity-registry.json`       | 15 個能力、12 個缺口的最終事實                 |

跑它們：`npm test`（含在內）、`npm run check:parity`、`npm run check:parity:full`
（最後一條需要 `../LinkCard_Frontend` 在旁邊）。

## 一句話回答

> **沒有對齊，而且這一週差距是往同一方向擴大的：Web 把「門口櫃檯」這件事做完了，
> App 沒有跟上。**

App 與 Web 在報到與寫卡上一度是「各做一半、合起來才完整」的關係。10-22 之後
Web 把另一半補上了：在同一個報到畫面裡寫卡、綁卡、上鎖，並有讀卡機的連線與電源
狀態。App 仍然停在「掃碼報到 → 跳另一頁用手機寫卡 → 不能上鎖」。

## 三層結論

| 層   | 該不該一致 | 結果                                                                                                       |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 端點 | 應該 100%  | 14 條在用的呼叫全部存在；另有 1 條指向不存在的路由（G-1）                                                  |
| 語意 | 應該一致   | 上一輪記的 12 處漂移，5 處修在未合併分支上，7 處仍待決策                                                   |
| 能力 | 不該一致   | 13 個活動內模組：8 個 BY_DESIGN、4 個 APP_GAP、1 個 ALIGNED_DEFECT；另有活動清單（ALIGNED）與 1 個內部工具 |

## 最該知道的三件事

### 1. 上一輪修好的東西，沒進主線

`audit/parity-20261022` 分支上有 28 個 commit，包含一顆 P0 修復：App 的
「申請主管覆核」按鈕呼叫 `POST /registrations/checkin/override`，而後端從來沒有
這條路由。這條呼叫今天仍在 `main` 上（`src/services/registration.service.ts:50`）。

分支沒有合併、沒有 push。也就是說：上一輪的診斷有效，但修復沒有生效。

### 2. Web 這一週把報到桌做完了

`2649530 feat(checkin): write and bind the badge on the check-in screen` 之後，
Web 的 `/check-in/:eventId` 在報到成功後可以直接寫卡並綁定，還會讀取卡片密碼把卡
上鎖。App 的同一件事要跨兩個畫面，而且沒有上鎖能力（`src/utils/nfc-utils.ts`
全檔沒有 lock/pwd/protect 字樣）。

這一項在上一輪被記為「App 超集」，今天反過來了。

### 3. 兩邊的「不能做」都是硬體限制，不是偷懶

Web 寫卡需要 Web Bluetooth 與 ACR1555U 讀卡機，不支援的環境會顯示
`write-card-blocked`；掃碼報到仍然可用。App 寫卡需要 Android 的
`react-native-nfc-manager`，iOS 直接阻擋。所以「哪一邊是超集」取決於現場帶了什麼
設備，這一點在 `03-capability-matrix.md` §3.4 有完整對照。

## 檔案導覽

| 檔案                          | 什麼時候讀                           |
| ----------------------------- | ------------------------------------ |
| `00-method-and-scope.md`      | 想知道判定規則、座標與證據紀律       |
| `01-delta-web.md`             | 想知道 10-22 之後 Web 多了什麼       |
| `02-delta-app-backend.md`     | 想知道 App 與後端這段時間的變化      |
| `03-capability-matrix.md`     | 想看逐能力的對照表與判定             |
| `04-gap-register.md`          | 想知道要補哪幾項、多嚴重、誰該決定   |
| `05-alignment-plan.md`        | 想知道接下來怎麼補、什麼不要補       |
| `06-verification.md`          | 想知道這份文件自己被怎麼檢查         |
| `07-briefing.md`              | 要轉述給別人、或開會前十分鐘讀       |
| `appendix/`                   | 獨立複核的工單與原始報告（逐字原稿） |
| `parity/parity-registry.json` | 機器可讀的能力登記表，閘門讀這一份   |

## 分支與狀態

`audit/parity-20261028`，起點 `origin/main` = `7d0fcf5`。

這條分支**沒有**checkout 在 `LinkCard_Event_Admin_App_Expo` 裡，所以直接開那個
資料夾是看不到的。它放在同層的另一個 worktree：
`LinkCard/20261028_App_Web_Parity_Report/`（同一個 git repo 的 branch checkout，
用 `git worktree` 建立，不是複本）。想看它就開那個資料夾，或在 App repo 執行
`git checkout audit/parity-20261028`。

用 worktree 而不是直接切換，是為了不干擾其他 session 在 `feat/nfc-gate1-reader-spike`
上的工作。

未 push、未合併。Frontend 與 Backend 兩個 repo 全程唯讀，零改動。

本輪**沒有改任何產品碼**，包含 G-1。理由見 `00-method-and-scope.md` §0.6。
