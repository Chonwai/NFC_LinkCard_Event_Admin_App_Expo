# App ↔ Web 功能對齊檢查（2026-10-28）

先讀這份。其餘檔案是證據。

## 一句話回答

> **沒有對齊，而且這一週差距是往同一方向擴大的：Web 把「門口櫃檯」這件事做完了，
> App 沒有跟上。**

App 與 Web 在報到與寫卡上一度是「各做一半、合起來才完整」的關係。10-22 之後
Web 把另一半補上了：在同一個報到畫面裡寫卡、綁卡、上鎖，並有讀卡機的連線與電源
狀態。App 仍然停在「掃碼報到 → 跳另一頁用手機寫卡 → 不能上鎖」。

## 三層結論

| 層   | 該不該一致 | 結果                                                                                 |
| ---- | ---------- | ------------------------------------------------------------------------------------ |
| 端點 | 應該 100%  | 14 條在用的呼叫全部存在；另有 1 條指向不存在的路由（G-1）                            |
| 語意 | 應該一致   | 上一輪記的 12 處漂移，5 處修在未合併分支上，7 處仍待決策                             |
| 能力 | 不該一致   | 13 個 Web 模組：8 個 BY_DESIGN、4 個 APP_GAP、1 個 ALIGNED_DEFECT；另有 1 個內部工具 |

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

| 檔案                          | 什麼時候讀                         |
| ----------------------------- | ---------------------------------- |
| `00-method-and-scope.md`      | 想知道判定規則、座標與證據紀律     |
| `01-delta-web.md`             | 想知道 10-22 之後 Web 多了什麼     |
| `02-delta-app-backend.md`     | 想知道 App 與後端這段時間的變化    |
| `03-capability-matrix.md`     | 想看逐能力的對照表與判定           |
| `04-gap-register.md`          | 想知道要補哪幾項、多嚴重、誰該決定 |
| `05-alignment-plan.md`        | 想知道接下來怎麼補、什麼不要補     |
| `06-verification.md`          | 想知道這份文件自己被怎麼檢查       |
| `parity/parity-registry.json` | 機器可讀的能力登記表，閘門讀這一份 |

## 分支與狀態

`audit/parity-20261028`，起點 `origin/main` = `7d0fcf5`，在獨立 worktree
（`/tmp/lc-parity28-wt`）內作業，避免與其他 session 的 checkout 互相踩。

未 push、未合併。Frontend 與 Backend 兩個 repo 全程唯讀，零改動。
