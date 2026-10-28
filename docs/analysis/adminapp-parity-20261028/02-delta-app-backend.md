# 02 — App 與後端在同一個區間的變化

## 2.1 App：產品碼沒有動，但修復卡在兩個未合併分支上

`LinkCard_Event_Admin_App_Expo` 在 10-22 之後有三條分支：

| 分支                            | commits | 內容                          | 是否在 `main` |
| ------------------------------- | ------- | ----------------------------- | ------------- |
| `audit/parity-20261022`         | 28      | 上一輪對等審計＋7 個產品修復  | 否            |
| `feat/onsite-scope-decisions`   | 53      | 上述內容＋現場四項決策        | 否            |
| `feat/nfc-gate1-reader-spike`   | 59      | 讀卡機研究與文件（產品碼零改）| 否（但產品碼同 main） |

驗證方式：

```
git rev-list --count origin/main..audit/parity-20261022            # 28
git rev-list --count origin/main..feat/onsite-scope-decisions      # 53
git rev-list --count origin/main..feat/nfc-gate1-reader-spike      # 59
git diff --stat origin/main..feat/nfc-gate1-reader-spike \
  -- src tests scripts .github package.json                        # 空
```

## 2.2 端點層現況：15 個呼叫字面，14 條有效，1 條死路

這是本輪唯一用機械方式重跑過的量測。做法是用上一輪留下的契約閘門
（`scripts/check-backend-contract.mjs`）對今日的 App 原始碼跑一次：

```
node scripts/check-backend-contract.mjs
✗ 1 條呼叫在後端路由快照中找不到：
  - registration.service.ts:47 POST …/registrations/checkin/override
exit=1
```

也就是說：除了那一條死路，其餘 14 個呼叫在後端都存在。上一輪的 P0 診斷是對的，
但它沒有生效，因為修它的 commit 停在那條分支上。

**這代表「端點層對等」目前是 14/15，而不是 README 上一輪寫的 15/15。**

## 2.3 後端：23 個 commit，路由只多一條

比對基準 `49b2103a`（10-22 收工）→ `5b39cbd4`（今日），共 23 個 commit。
但 `src/events/routes` 與 `src/events/controllers` 在整段區間內零改動。

用上一輪的路由快照重新產生一次，差異只有一行：

| 項目       | 10-22 快照（後端 `64be09e`） | 今日（後端 `5b39cbd`） |
| ---------- | ---------------------------- | ---------------------- |
| events 路由 | 121                          | 122                    |
| 新增       | —                            | `GET /:eventId/manage-stats` |
| 移除       | —                            | 無                     |

命令：`node scripts/check-backend-contract.mjs --refresh --backend <後端路徑>`
（在臨時目錄跑，不動任何 repo）。

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
- Web：+20,907 行，集中在報到桌與讀卡機。
- App：0 行產品碼，修復停在工作分支。

因此「功能是否對齊」這個問題，本輪幾乎完全由能力層決定，
而不是由端點或 payload 的機械漂移決定。這也是 `03-capability-matrix.md` 佔篇幅最多的
原因。
