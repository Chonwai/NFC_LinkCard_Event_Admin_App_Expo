# 06 — 這份文件自己被怎麼檢查

<!-- citations: LinkCard_Event_Admin_App_Expo -->

## 6.1 三層驗證

| 層       | 做法                                        | 抓到什麼                   |
| -------- | ------------------------------------------- | -------------------------- |
| 機械量測 | 重跑既有閘門與腳本，不引用記憶中的數字      | 端點現況、路由漂移         |
| 獨立複核 | 另一個 process／另一個 agent 重跑 10 條斷言 | 2 個表述缺陷、1 個工具瑕疵 |
| 文件自檢 | 兩個測試讀文件本身                          | 12 個無法解析的引用        |

## 6.2 獨立複核：10/10 PASS，但挑出兩個表述問題

複核由 `smith`（獨立 agent，另一個 process）執行，只給它工單，不給結論。
工單与原始報告在 `/tmp/parity-verify-spec.md`、`/tmp/parity-verify-report.md`。

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

### A4：閘門的行號是錯的，計數是對的

契約閘門自報 `registration.service.ts:47`，實際呼叫在第 50 行。原因是
`apiClient.post<…>(` 跨行時閘門的行數計算少了 3 行。

這不影響 G-1 的判定（`1 條呼叫` 這個計數正確），但任何「閘門指到哪一行」的敘述都
會跟著錯。

**已修正**：`02-delta-app-backend.md` §2.2 在引用閘門輸出處加註，指明權威行號以
grep 為準。

### A3：`| head -5` 會吃掉 exit code

工單裡我寫 `grep -rn … | head -5`，然後看 `$?`。管線的 exit code 來自 `head`，
所以永遠是 0。複核改用 `wc -l` 加 `pipestatus` 重測，才確認為零命中。

這是量測紀律問題，不是結論問題（結論本來就是零命中），但值得寫下來：**在「零命中
算證據」的場合，不要讓管線掩蓋 exit code。**

## 6.3 本輪跑過的機械量測

| 量測               | 命令                                                                    | 結果                           |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------ |
| App 端點契約       | `node scripts/check-backend-contract.mjs`（worktree 內）                | 1 條死路、exit 1               |
| 後端路由總數與差異 | `node scripts/check-backend-contract.mjs --refresh --backend <後端>`    | 121 → 122，只加 `manage-stats` |
| 對等登記表         | `node scripts/check-parity-registry.mjs --web <web> --require-web`      | 18/18 頁、exit 0               |
| 引用座標           | `node --test tests/parity-citations.test.mjs`                           | 29 個解析、28 個可驗、0 個壞   |
| 全 repo 閘門       | `npm run typecheck && npm run lint && npm run format:check && npm test` | 215 pass / 0 fail              |

`--refresh` 會改寫快照檔，所以是在 `/tmp` 的複本上跑，不動任何 repo。

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
