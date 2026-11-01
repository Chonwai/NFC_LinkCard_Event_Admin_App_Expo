# `/(auth)/home` 會不會彈回登入頁？— 不是缺陷，是偵測器的假象

量測日期：2026-11-02
環境：Expo web（`127.0.0.1:8081`）＋ Chrome for Testing，CDP `Fetch` 攔截 API
解析度：1280×800（Android 平板橫向）
HEAD：`3de09ac`（+ `f2c52b8` 的 F1 修正）

## 上報的症狀

自動化掃描 14 個已登入畫面時，只有 `/(auth)/home` 被標成 `BOUNCED-TO-LOGIN`：
畫面先渲染出「我的活動」，數秒後被判定為已回到登入頁。其餘 13 個畫面（含
`overview`）都正常停留。

若為真，那是嚴重缺陷——清單載入失敗不該等同登入失效。

## 結論：不是缺陷

`home` 沒有彈回。**掃描腳本用來認登入頁的字串，`home` 也有。**

### 假象是怎麼產生的

掃描腳本的判定是：

```js
onLogin: /活動現場營運工具/.test(text) && text.length < 120,
```

`活動現場營運工具` 是 `copy.app.tagline`（`src/constants/copy.zh-TW.ts:11`）。
它在兩個地方出現：

| 檔案                      | 行  | 用途                                |
| ------------------------- | --- | ----------------------------------- |
| `src/app/index.tsx`       | 185 | 登入頁副標題                        |
| `src/app/(auth)/home.tsx` | 210 | **Home 的副標題**（刻意沿用同一句） |

而 `home` 在「沒有任何活動」時的全部可見文字只有 91 字：

```
LinkCard Event Admin 我的活動 活動現場營運工具 建立活動 沒有管理中的活動 …
```

`91 < 120` ⇒ 兩條件同時成立 ⇒ 判定為「回到登入頁」。**它其實一直停在
`/home`。**

### 時間軸（修前就是這樣，沒有東西需要修）

`/(auth)/home`，每 500ms 取樣一次，共 11.5 秒：

```
t=  500ms /home  token=present chars=91  我的活動 / 活動現場營運工具 / 建立活動
t= 6000ms /home  token=present chars=91  我的活動 / 活動現場營運工具 / 建立活動
t=11500ms /home  token=present chars=91  我的活動 / 活動現場營運工具 / 建立活動
```

- `location.pathname` 全程 `=/home`
- `localStorage['lc_event_admin_token']` 全程 `present`
- 攔到的 API 只有兩支，都是 200：`GET /api/v1/events/my-managed?limit=100`、
  `GET /api/users/me`
- 沒有 request 逃出 `*api*` 攔截模式（所以不存在「打到真後端拿到 401」這條路）
- 沒有任何 console error

## 真正的問題：清單失敗會不會結束 session？

不會。這才是「彈回登入」值得驗的那一半，所以直接把
`GET /api/v1/events/my-managed` 弄壞，看 session 撐不撐得住：

| 故障模式  | 注入方式                                           | token       | 停留 `home` | 畫面                               |
| --------- | -------------------------------------------------- | ----------- | ----------- | ---------------------------------- |
| `ok`      | 正常回 `{ events: [] }`                            | present     | ✅          | 空狀態                             |
| `500`     | HTTP 500 `{ error: { code: "INTERNAL_ERROR" } }`   | **present** | ✅          | 「載入活動失敗，請稍後再試」＋重試 |
| `shape`   | HTTP 200 但 body 是 `{}`                           | **present** | ✅          | 空狀態（**無**錯誤橫幅）           |
| `offline` | CDP `Fetch.failRequest`（傳輸層失敗，無 response） | **present** | ✅          | 「載入活動失敗，請稍後再試」＋重試 |

四種全部沒有清 token、沒有導頁。程式碼上這是有意的，不是巧合：

| 位置                              | 行為                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `src/stores/event.store.ts:24-41` | `loadEvents()` **不 rethrow**，失敗收進 `state.error`，畫面顯示可重試橫幅           |
| `src/services/api.ts:38-55`       | 只有 `getTerminalAuthReason()` 非 null 才 `logout()`                                |
| `src/utils/api-error.ts:54-71`    | 終止態只有兩種：`401`、`403` ＋ code 在 `{USER_SUSPENDED, INVALID_TOKEN}`           |
| `src/stores/auth.store.ts:68-110` | `hydrate()` 遇到非終止態（網路錯誤／5xx）**保留 token**，進入「已登入但身分未取得」 |

全 repo 只有兩處呼叫 `logout()`：`src/services/api.ts:50`（上表的攔截器）與
`src/app/(auth)/settings.tsx:184`（使用者自己按）。沒有任何畫面會因為清單載入
失敗而登出。

## Home 依賴的回應形狀

```jsonc
// GET /api/v1/events/my-managed?limit=100
{ "success": true,
  "data": { "events": [ /* ManagedEventItem[] */ ], "pagination": { … } } }
```

`src/services/event.service.ts:57-70` 取的是 `res.data.data`，再
`(data.events ?? []).map(...)`。所以：

- **必須有** `data.events`（缺了不會炸，會被 `?? []` 接住）
- `data.events[]` 的每一項只保證 `id` / `name` / `status` 等基本欄位；
  `userRole` / `registrationCount` / `exhibitorCount` 允許缺席，service 會從
  非標準的 `_meta` 補（`event.service.ts:60-68`）

掃描腳本一次回 `{ events, items, pagination }`（超集）就能同時餵 `home` 與
其他用到 `items` 的服務，不需要為每個形狀重跑一次。

## 一個順帶量到的觀察（**未修**，超出 F2 範圍）

`FAULT=shape` 那一列：HTTP 200 但缺 `data.events`，畫面落成**空狀態**，而且
**沒有**錯誤橫幅——「後端回傳壞掉」與「你真的沒有活動」看起來一模一樣。

成因就是上面那句 `?? []`：防禦性預設把「形狀錯誤」吃成了「空的」。
`loadEvents` 的 catch 完全不會被觸發，所以 `copy.home.loadFailed` 這條橫幅
在這條路徑上不可達。

判斷：不在此修。理由——

1. 這是「見不到就等於沒有」的**可觀測性**問題，不是 F2 問的 session 問題。
2. 修法有兩個方向（service 對缺欄位丟錯／store 區分 `empty` 與 `malformed`），
   哪一個對要看後端 contract 的意圖，需要與 `LinkCard_ExpressJS_Backend` 對齊；
   該 repo 目前由其他 session 修改中，只讀。
3. 現行行為不會造成資料錯誤或 session 遺失，只是診斷訊息變少。

留給獨立審查決定要不要開票。

## 給下一個人的動作

- 掃描腳本要判「在不在登入頁」時，**不要**用 `活動現場營運工具`（Home 也有），
  也不要只看字數門檻。可用的錨點是 `我的活動`（只在 Home）與登入頁的
  `登入`／表單存在。
- 重跑方式見 `docs/qa/20261102_browser-qa-run.md`。
