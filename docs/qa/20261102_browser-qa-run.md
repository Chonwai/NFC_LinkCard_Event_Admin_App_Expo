# 用真實瀏覽器掃 14 個已登入畫面（可重跑）

量測日期：2026-11-02
用途：在**後端跑不起來**、或者不想為了看一眼畫面而準備 seed 資料的情況下，把
每個已登入畫面真的渲染一次並量 DOM。

這份文件是**入口**，不是 CI。腳本刻意不進 repo：CI 沒有 Chrome，把一支需要
`--remote-debugging-port` 的腳本掛進 pipeline 只會變成第二個沒人跑的紅燈。
下面把必要的段落都抄齊了，五分鐘可以重建。

## 為什麼需要「攔截」而不是「登入」

合成 token 不夠。`/api/users/me` 必須成功，`hydrate()` 才會把
`isAuthenticated` 設成 `true`（`src/stores/auth.store.ts:68-110`）——否則
`src/app/_layout.tsx` 的守衛會立刻 `router.replace("/")`，你什麼都看不到
（只看得到登入頁，而且還以為是缺陷）。

所以：**用 CDP 的 `Fetch` 網域把 API 回應直接餵給頁面**。不需要後端、不需要
seed、不需要改 repo。

## 1. 起 Expo web

```bash
cd LinkCard_Event_Admin_App_Expo
./node_modules/.bin/expo start --web --port 8081
```

第一次啟動要等 Metro 打包，之後每個 route 的熱重載是即時的。確認：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/   # 期望 200
```

## 2. 起一支可以被驅動的 Chrome

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-qa-profile \
  about:blank
```

確認端點：

```bash
curl -s http://127.0.0.1:9222/json/version | head -3
```

> `--user-data-dir` 指到 `/tmp` 是為了每次都是乾淨的 profile；重用同一個目錄
> 可以把 `localStorage` 留著，但掃描本身會自己種 token，不需要。

## 3. 攔截的原理（三段）

腳本用 `ws` 直接講 CDP，沒有 puppeteer 依賴：

```js
// 1. 開一個 target 並 attach
const { targetId } = await send(ws, "Target.createTarget", {
  url: "about:blank",
});
const { sessionId } = await send(ws, "Target.attachToTarget", {
  targetId,
  flatten: true,
});
```

```js
// 2. 攔截每一支含 /api/ 的請求，直接 fulfill
await send(
  ws,
  "Fetch.enable",
  { patterns: [{ urlPattern: "*api*" }] },
  sessionId,
);

// 事件回呼裡：
send(
  ws,
  "Fetch.fulfillRequest",
  {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      // 這三行不能省：頁面在 8081，API 在別的 origin，沒有 CORS 標頭
      // 瀏覽器會直接把回應丟掉，你看到的是一個「請求成功但資料沒到」的畫面。
      { name: "Access-Control-Allow-Origin", value: "*" },
      { name: "Access-Control-Allow-Headers", value: "*" },
      { name: "Access-Control-Allow-Methods", value: "*" },
    ],
    body: Buffer.from(JSON.stringify(routeTable(url))).toString("base64"),
  },
  sessionId,
);
```

```js
// 3. 種 token —— 注意時機
await send(ws, 'Page.navigate', { url: `${BASE}/` }, sessionId);
await new Promise((r) => setTimeout(r, 4000));   // 先讓 App 啟動一輪
await send(ws, 'Fetch.enable', ...);             // 再開攔截
await send(ws, 'Runtime.evaluate', {
  expression: `localStorage.setItem('lc_event_admin_token','qa.synthetic.token')`,
});
```

token key 是 `lc_event_admin_token`（`src/constants/config.ts:157`）。

### 回應形狀：回**超集**

不同 service 從不同 key 解開（`{events}` / `{items}` / `{sections}` /
`{polls}` / `{sessions}` / `{orgRoles}` / `{badges}` / `{approvals}`）。一次回
多個 plausible key 比對「猜對服務」便宜得多，而且更誠實——真實後端也是這樣
（`{data: {events, pagination}}`）。例如：

```js
[/\/ticket-types/, () => ok({ ticketTypes: [] })],
[/\/registrations/, () => ok({ registrations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })],
[/\/api\/v1\/events/, () => ok({ events: [EVENT], items: [EVENT], pagination: { page: 1, limit: 20, total: 1 } })],
```

**路由表順序就是優先序**（第一個 match 勝出），所以 `/registrations/desk-lookup`
要排在 `/registrations` 前面。

## 4. 掃描哪些畫面

```
/(auth)/home
/(auth)/{eventId}/overview        registrations    badges
/(auth)/{eventId}/ticket-types    check-in         sessions
/(auth)/{eventId}/polls           bank-transfers   org-roles
/(auth)/{eventId}/exhibitors      content          profile
/(auth)/{eventId}/settings
```

`eventId` 用 `00000000-0000-4000-8000-000000000000`（合法 UUID 形態，避免
typed route 或後端參數驗證先擋掉）。

每個 route 給 4.5 秒：`Page.navigate` 是整頁重載，Metro 要重跑 bundle，太快量
到的會是骨架屏。

## 5. 量什麼

```js
const READ_DOM = `(() => {
  const btnSel = 'button,[role="button"]';
  const buttons = [...document.querySelectorAll(btnSel)].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      label: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40),
      disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true',
      w: Math.round(r.width), h: Math.round(r.height),
    };
  });
  const text = (document.body?.innerText ?? '').replace(/\\n{2,}/g, '\\n').trim();
  return {
    chars: text.length,
    buttonCount: buttons.length,
    small: buttons.filter((b) => b.w > 0 && (b.w < 44 || b.h < 44)),
    disabled: buttons.filter((b) => b.disabled).map((b) => b.label).slice(0, 4),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;
```

判準：觸控目標 < 44（WCAG 2.5.5 下限；本案自己的門檻是 48，見
`src/constants/theme.ts:157`）、水平溢出、極短文字。

## 6. 這次量到什麼（1280×800，Android 平板橫向）

`git` 基準：`3de09ac`（修前）／`f2c52b8`（修後）

| 畫面             | chars | buttons | 修前               | 修後                 |
| ---------------- | ----: | ------: | ------------------ | -------------------- |
| `home`           |    91 |       4 | `BOUNCED-TO-LOGIN` | 同（**假象**，見下） |
| `overview`       |   195 |      17 | OK                 | OK                   |
| `registrations`  |   122 |      22 | **`SMALL:18`**     | **OK**               |
| `badges`         |   186 |       4 | OK                 | OK                   |
| `ticket-types`   |    84 |       4 | OK                 | OK                   |
| `check-in`       |    68 |       3 | OK                 | OK                   |
| `sessions`       |    27 |       3 | `NEARLY-BLANK`     | 同（**假象**，見下） |
| `polls`          |    59 |       4 | OK                 | OK                   |
| `bank-transfers` |    68 |       2 | OK                 | OK                   |
| `org-roles`      |    90 |       3 | OK                 | OK                   |
| `exhibitors`     |    57 |       3 | OK                 | OK                   |
| `content`        |    45 |       3 | OK                 | OK                   |
| `profile`        |   162 |       3 | OK                 | OK                   |
| `settings`       |   333 |       5 | OK                 | OK                   |

`chars` 與 `buttonCount` 在修前修後**完全相同**（122 / 22）。這是重點：F1 只
改了高度，沒有東西被擠掉或換行。

### 真的缺陷（1 個，已修）

**`registrations` 的 18 個可點元素低於 44px。** 分佈與成因：

| 數量 | 尺寸      | 樣式         | 內容                     |
| ---: | --------- | ------------ | ------------------------ |
|    8 | 298×38    | `filterItem` | 狀態篩選、email 狀態篩選 |
|    5 | 238×38    | `filterItem` | 可見性篩選               |
|    3 | 397×38    | `filterItem` | 押金退款篩選             |
|    1 | 68×38     | `sortItem`   | 報名時間                 |
|    1 | **42**×38 | `sortItem`   | 姓名（寬度也不足）       |

成因是高度從來沒有被寫下來，而是 padding 加出來的：
`20（caption 行高）+ 8×2 + 2（下底線）= 38`。

修法：`minHeight: layout.touchMin` ＋ `justifyContent: "center"`
（`f2c52b8`）。修後同一支探針回 **count=0**，該畫面 22 個目標全部 48px。

### 假象（2 個，都不是缺陷）

**① `home` 的 `BOUNCED-TO-LOGIN`** —— 偵測器條件是
`/活動現場營運工具/.test(text) && text.length < 120`。這串字是
`copy.app.tagline`，`home` **刻意**把它當副標題渲染（`home.tsx:210`）。沒有
活動時 `home` 全文只有 91 字 ⇒ 兩條件都成立 ⇒ 誤判。

實際時間軸：11.5 秒全程停在 `/home`、token 全程 present、兩支 API 都 200。
完整調查見 `docs/qa/20261102_home-bounce-investigation.md`。

**② `sessions` 的 `NEARLY-BLANK`** —— 門檻是 `chars < 30`，它量到 27。但渲染
出來的文字是有意義的：

```
工作坊管理 / 活動的場次與出席人數 / 尚無工作坊/活動場次
```

那是正常的空狀態，只是短。門檻訂得比「正常空狀態」還高，這個旗標就沒有鑑別
力。

## 7. 這份量測**看不到**什麼

- **不能**代替人工判斷視覺品質（間距節奏、對比、資訊層級）。它只回答「有沒有
  元素尺寸不對、有沒有溢出、有沒有爆掉」。
- 攔截回的是固定資料，所以**空狀態以外的資料量分支**（分頁、載入更多、長列表
  換行）都沒有被走到。
- 只量 1280×800 一個斷點。`layout.breakpointNarrow = 360` 以下的排版沒有驗。
- 每個 route 只有一次取樣，時序型缺陷（例如 request 競態）不會穩定重現——要用
  時間軸探針逐 500ms 取樣，而不是單點讀取。

## 8. 已知的坑

| 坑                 | 症狀                                                | 對策                                                                    |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| 忘了 CORS 標頭     | 請求 200 但畫面沒資料                               | `fulfillRequest` 一定要帶 `Access-Control-Allow-*`                      |
| 太早開攔截         | App 啟動時的 `/users/me` 沒被攔到，`hydrate()` 失敗 | 先 navigate 一次、等 4 秒，再 `Fetch.enable`                            |
| token 太晚種       | 守衛先把人踢回 `/`                                  | 種完 token 才 navigate 到各 route                                       |
| 認登入頁用錯字串   | `home` 被誤判成登入頁                               | 錨點用 `我的活動`（只在 home）或 `登入`（只在 login）                   |
| route 表順序       | `/registrations` 吃掉 `/registrations/desk-lookup`  | 特例排前面                                                              |
| 有請求逃出 `*api*` | 打到真後端，可能拿到 401 並真的登出                 | 在 `Fetch.requestPaused` 裡記錄 `!/api/.test(url)` 的請求，確認清單為空 |
| 想「看一眼」用截圖 | 吃掉一個 context、還看不到排版細節                  | 量 `getBoundingClientRect()`；文字用 CDP 讀 `innerText`                 |
