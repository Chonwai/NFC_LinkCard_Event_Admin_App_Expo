# 06 — 執行紀錄（Execution Log）

分支：`audit/parity-20261022`，起點 `origin/main` = `7d0fcf5`。
**未 push、未 merge。** 全部為 local commit。

## 6.1 Commit 清單（按時間）

| #   | Commit    | 類型 | 內容                                                         |
| --- | --------- | ---- | ------------------------------------------------------------ |
| 1   | `284e188` | docs | 方法與範圍：三層模型、座標、判定規則                         |
| 2   | `5b14750` | docs | 端點級三方比對；指出唯一死路徑；兩個「前端才是錯的」反向發現 |
| 3   | `057ccd0` | docs | 畫面級能力矩陣（13 Web 模組 vs 10 App 畫面）                 |
| 4   | `7bf1d76` | docs | 12 條語意漂移登記簿（含嚴重度）                              |
| 5   | `4dcc88e` | docs | **修正自己的過度指控**：名單其實已有 403 專門文案            |
| 6   | `075f775` | fix  | 錢包：改讀 `balanceAfter`/`sourceType`，補分頁               |
| 7   | `031972f` | fix  | `Registration` 補退款／稽核欄位（純型別 + 範圍註記）         |
| 8   | `84cb423` | fix  | 補 `depositRefunded` / `boundOnly` 參數                      |
| 9   | `5bcdb53` | fix  | **移除呼叫不存在路由的覆核按鈕**（P0）                       |
| 10  | `7c19f0a` | feat | 契約閘門 + 快照 + CI step + 負向測試                         |
| 11  | `860404f` | fix  | Token placeholder 死連結改指名單                             |
| 12  | `9e3c7a2` | fix  | Overview 先問 `my-access` 再決定打哪些端點                   |
| 13  | `f4464a7` | docs | 三份深度研究原文（appendix，1,398 行）                       |
| 14  | `9fb8577` | docs | 研究綜述與裁決框架                                           |
| 15  | `d8a85c6` | docs | 同步計畫（已修／未修／不修）                                 |
| 16  | `219ed2b` | docs | 刻意差異登記簿（15 條）                                      |

小步提交的理由：每一筆都只做一件事，`git bisect` 與 code review 都還能用。
唯一的大型 commit 是 #10（閘門 + 測試 + CI），因為三者分開 commit 會讓 CI 在中間狀態失敗。

## 6.2 每個修復的判斷依據

### #6 錢包（S-2）

不是「照前端抄」，而是**照後端投影抄**：

```
BE: EventWalletService.getTransactionHistory.select
    id, type, amount, balanceAfter, description, sourceType, createdAt
```

`approvedBy` 在後端**完全不存在**。原本的 UI `tx.type · ${tx.approvedBy ?? "—"}`
等於每一行都宣稱「沒有人員記錄」。這是「型別說謊」造成使用者誤解，
不是單純的欄位缺失。

### #9 覆核按鈕（S-1）

考慮過三個選項：

| 選項                                | 為何否決                                                   |
| ----------------------------------- | ---------------------------------------------------------- |
| 改用 `POST /:registrationId/status` | 它對已 `CHECKED_IN` 回 `409`，且要 COORDINATOR。語意不同。 |
| 保留按鈕但改成 callable no-op       | 仍是「按了不會成功」的假動作。                             |
| **移除按鈕，改指詳情頁**（採用）    | 唯一的真出口；詳情頁有報到時間。                           |

### #10 閘門（新增）

設計上刻意接受三個限制，並寫在檔案開頭：

1. 快照是**某個 commit 的複本**，不會自動更新 → 記錄 `commit` + `generatedAt`。
2. `EVENT_ROUTE_MOUNTS` 是手寫的 → 後端新增 `router.use(...)` 時要同步加。
3. 非 events 端點（`/api/auth/login`、`/api/users/me`）用 `evidence: {file, needle}` 釘住，
   `--refresh` 會實際去讀檔確認。找不到就讓 refresh 失敗。

第 3 點是為了避免「快照裡躺著一條沒人驗證的端點」——那會是另一種形式的謊。

## 6.3 過程中發生的問題（誠實記錄）

### 6.3.1 多 session 交叉污染（已排除）

第一次 commit 時發現 HEAD 被切到 `feat/nfc-gate1-reader-spike`，而且我的
`00-method-and-scope.md` 被別人的 commit（`814a1a2`）掃進去。

處置：**不重寫對方歷史**，改用獨立 worktree：

```bash
git worktree add /tmp/lc-parity-wt -b audit/parity-20261022 origin/main
```

代價：需要 `ln -s` 主 worktree 的 `node_modules`。好處：之後所有 commit 都與其他 session 隔離。

### 6.3.2 後端在審計期間前進了 2 個 commit

基線是 `206b1483`，產生快照時 HEAD 已是 `64be09e7`。已確認
`git diff 206b1483..HEAD -- src/events/routes/` **為空**，所以快照對兩者都成立。

### 6.3.3 通道故障（不影響產出）

`runSubagent` 連 3 次回
`400 … The reasoning_content in the thinking mode must be passed back to the API`
（payload 340KB → 356KB）。改用獨立 process 的 `opencode run` 後全部成功。

三份研究 + 獨立驗證 **全部走外部 process**，所以本輪的「不同 instance 檢查」
是真正的不同 process，不只是不同 instance。

### 6.3.4 一次自家文件修正

`7bf1d76` 我寫「OPERATOR 看到所有入口，點進去 403」，暗示名單畫面一片潰敗。
`4dcc88e` 修正：名單**已**有 `getApiErrorStatus(err) === 403` 分流與專門文案
（`registrations.tsx:148`），overview 才沒有。

這條修正的意義：**自我複核要重跑數字，不是重讀文字。** 我原本是憑第一段閱讀的印象寫的。

## 6.4 沒有做的事（以及為什麼）

| 沒做                | 理由                                            |
| ------------------- | ----------------------------------------------- |
| 新增 badges 批次 UI | 需設計＋QA；且本輪授權是「核對與同步」          |
| 新增 session 報到   | 同上，且需要新的資訊架構                        |
| 報名資料編輯        | 後端沒有 `PATCH /registrations/:id`，需先做後端 |
| 產生 OpenAPI spec   | R3 建議的第二步；本輪先裝第一步（route guard）  |
| push / merge        | 使用者未授權；且分支需先 review                 |
