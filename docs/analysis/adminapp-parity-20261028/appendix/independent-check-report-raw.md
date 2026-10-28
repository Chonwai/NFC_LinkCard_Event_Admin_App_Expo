# 獨立複核報告

- 日期：2026-10-28
- 角色：獨立查核者（未讀作者結論，全部自行量測）
- 工作目錄：`LinkCard_Event_Admin_App_Expo` / `LinkCard_Frontend` / `LinkCard_ExpressJS_Backend`
- 審計工作區：`/tmp/lc-appcheck`、`/tmp/lc-contract-probe`、`/tmp/lc-parity28-wt`
- 全程唯讀；未修改任何 repo 檔案、未 commit、未 push、未執行 `npm install`、未讀 `.env*`。

---

## A1 — PASS

命令：
```
cd <app> && git diff --stat origin/main..feat/nfc-gate1-reader-spike -- src tests scripts .github package.json
```

關鍵輸出：**空**（`A1_exit=0`）。

```
58affea (HEAD -> feat/nfc-gate1-reader-spike, origin/feat/...) docs(handbook): record the latest gate run ...
7d0fcf5 (origin/main, origin/HEAD) docs(handbook): put the callout legend beside the picture
```

**附帶量測（重要）**：兩分支 HEAD 不同，全路徑 diff 為 `43 files changed, 7994 insertions(+), 11 deletions(-)`，分佈如下：

```
   3 .edison/artifacts
   1 .edison/state
   1 docs/analysis
  11 docs/handbook
   1 docs/handoff
   6 docs/research
   1 eslint.config.js
  17 tools/nfc-reader-spike
   2 tools/nfc-web-probe
```

判定：斷言在其**列舉路徑**內成立（0 檔）。但分支並非「無產品碼變更」的分支——它改了 `eslint.config.js`，且 `tools/` 有 19 檔——只是那些路徑不在本斷言的清單內。

---

## A2 — PASS

命令：
```
cd <app> && grep -n 'checkin/override' src/services/registration.service.ts
```

關鍵輸出：
```
50:      `/api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin/override`,
```

上下文（45–55 行）確認是真實的 `apiClient.post` 呼叫，路徑為 `/api/v1/events/{eventId}/registrations/checkin/override`。

---

## A3 — PASS

命令：
```
cd <backend> && grep -rn 'checkin/override' src/ | head -5
cd <backend> && grep -rn 'checkin/override' src/ | wc -l
```

關鍵輸出：**零命中**。
```
       0
grep_exit=1
```

（註：原命令以 `| head -5` 串接，`$?` 會被 `head` 汙染成 0，故另以 `wc -l` + `pipestatus` 重測。真值為 grep exit 1 ＝ 無命中。）
放寬查 `override` 全字：`30` 命中，皆非本路由。

---

## A4 — PASS

命令：
```
cd /tmp/lc-appcheck && node scripts/check-backend-contract.mjs; echo "exit=$?"
```

關鍵輸出：
```
✗ 1 條呼叫在後端路由快照中找不到：
  - registration.service.ts:47 POST /api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin/override
    shape: POST */registrations/checkin/override
A4_exit=1
```

符合期望：含 `1 條呼叫`、含 `checkin/override`、`exit=1`。

**證據瑕疵（不影響 PASS）**：閘門報 `registration.service.ts:47`，實際 grep 為 **第 50 行**。閘門的行號定位偏移 3 行（疑因跨行泛型 `apiClient.post<…>(` 的行數計算方式），任何引用「閘門指到哪一行」的敘述都應以 grep 結果為準。

---

## A5 — PASS

命令：
```
cd /tmp/lc-contract-probe && node scripts/check-backend-contract.mjs --refresh --backend <backend>
cd /tmp/lc-contract-probe && node -e "…(如工單所述)…"
```

關鍵輸出：
```
已寫入 backend-routes.snapshot.json：122 條 events 路由（後端 5b39cbd）
old 121 new 122 added [ 'GET /:eventId/manage-stats' ] removed []
```

與期望逐字相符。

**副作用揭露**：`--refresh` 會改寫 `/tmp/lc-contract-probe/scripts/backend-routes.snapshot.json`。已確認該目錄 **不是 git repo**（`fatal: not a git repository`），故未動到任何受版控檔案。

---

## A6 — PASS（加強驗證）

命令：
```
cd <web> && grep -n "WriteCardPanel\|useNfcReader\|bindNfcBadge" 'app/check-in/[eventId]/page.tsx' | head -5
grep -n 'WriteCardPanel' 'app/check-in/[eventId]/page.tsx'
```

關鍵輸出：
```
9:import { useNfcReader } from '@/hooks/useNfcReader';
13:import WriteCardPanel from '@/components/checkin/WriteCardPanel';
24:import { bindNfcBadge } from '@/lib/events/nfc';
212:        const { previous = null } = await bindNfcBadge(eventId, registrationId, tagUid);
876:                        <WriteCardPanel
```

三個字串全出現。**加嚴檢查**：`WriteCardPanel` 不只被 import，第 876 行有實際 JSX 渲染；`bindNfcBadge` 在 212 行被 await 呼叫。非死匯入。

---

## A7 — PASS（加強驗證）

命令：
```
cd <app> && grep -niE 'lock|pwd|password|protect' src/utils/nfc-utils.ts | head -5
```

關鍵輸出：**零命中**。

**加嚴檢查**（斷言只限單檔，故另掃全 `src/`）：
```
grep -rniE '\block|pwd|password|protect' src/   → 24 命中
排除 src/app/index.tsx 後              → 14 命中
內容全為登入密碼 UI：index.tsx 的 password state、
copy.zh-TW.ts 的 revealPassword / passwordLabel、
remembered-login.ts、auth.service.ts、components/ui/FieldInput.tsx
另查 src/app/_layout.tsx:13 → WEB_VIEWPORT_STYLE_ID = "lc-admin-viewport-lock"（CSS，非卡片鎖）
卡片鎖語彙 lockTag|lockCard|cardLock|latch|readProtect|writeProtect → 0 命中
```

判定：不只 `nfc-utils.ts`，整個 `src/` 都沒有卡片上鎖能力。斷言成立且比其自我表述更強。

---

## A8 — PASS

命令：
```
cd <web> && find app -type d -name '*wallet*'
```

關鍵輸出（單一路徑）：
```
app/(personal)/(shell)/my-tickets/[registrationId]/wallet
```

manage 底下無 wallet 目錄。

---

## A9 — PASS（加強驗證）

命令：
```
cd <web> && grep -c "label: t('layout\." 'app/(event)/manage/[eventId]/layout.tsx'
```

關鍵輸出：`13`

**加嚴檢查**（確認 13 個是哪 13 個、且含 check-in）：
```
170 overview   175 profile   176 content   177 ticketTypes   178 badges
179 registrations   180 checkIn   181 exhibitors   182 sessions
183 polls   185 bankTransfers   189 orgRoles   190 settings
```

13 項，含 `checkIn`（第 180 行）。數字本身正確。注意第 184、186–188 行為空行／非 nav 項，故總數確為 13 而非目錄全長。

---

## A10 — PASS

命令：
```
cd /tmp/lc-parity28-wt && node scripts/check-parity-registry.mjs --web <web> --require-web; echo "exit=$?"
```

關鍵輸出：
```
Web 頁面掃描：18 個頁面，18 個已登記
✓ 對等登記表一致：15 個能力（ALIGNED=1 ALIGNED_DEFECT=1 BY_DESIGN=8 APP_GAP=4 WEB_ONLY_INTERNAL=1）、12 個缺口
A10_exit=0
```

含 `Web 頁面掃描：18 個頁面`，`exit=0`。

（上面這段是 2026-10-28 的原始輸出，逐字保留不改：`12 個缺口` 是那天的值。
`7dd038c` 登記 G-12 之後變成 13，現值以 `npm run check:parity:full` 的輸出為準，
見 `08 §8.2`。）

**環境註記**：`/tmp/lc-parity28-wt` **是 App repo 的 git worktree**（`…/LinkCard_Event_Admin_App_Expo/.git/worktrees/lc-parity28-wt`），`git status --porcelain` 只有 `?? node_modules`（未追蹤，非本輪產生）。腳本為唯讀，未改動工作區。

---

## 逐條總表

| # | 結果 | 一句話依據 |
|---|------|-----------|
| A1 | PASS | 列舉路徑 diff 空；但分支另改 43 檔（含 `eslint.config.js`） |
| A2 | PASS | `registration.service.ts:50` 實際 POST checkin/override |
| A3 | PASS | 後端 `src/` 零命中（grep exit 1） |
| A4 | PASS | `1 條呼叫` + `checkin/override` + exit=1 |
| A5 | PASS | `old 121 new 122 added ['GET /:eventId/manage-stats'] removed []` |
| A6 | PASS | 三字串皆在，且 `WriteCardPanel` 於 876 行實際渲染 |
| A7 | PASS | 單檔零命中；全 `src/` 亦無卡片鎖語彙 |
| A8 | PASS | 只有 personal 的 wallet 目錄 |
| A9 | PASS | 13 項，含 `checkIn` |
| A10 | PASS | 18 頁面、exit=0 |

## 總結：10/10 PASS

## 我認為文件裡最不可信的一條斷言是：A1

理由：它的成立**完全依賴一份手工挑選的路徑清單**。`git diff --stat` 對 `src tests scripts .github package.json` 是空的，於是「產品碼與 `origin/main` 相同」被寫成 PASS；但同一條分支對 `origin/main` 實際有 **43 檔、+7994 行** 的差異，其中包含 **`eslint.config.js`（lint 規則變更）** 與 19 個 `tools/` 檔案。也就是說，這條斷言只證明「我列出的這些目錄沒變」，不證明「這條分支沒有產品面向的改動」。若讀者把它理解成後者（分支名 `feat/nfc-gate1-reader-spike` 極易誘發這種理解），就會得到錯誤結論。

次弱的是 **A4 的行號**：閘門自報 `registration.service.ts:47`，實測在 **50**。`1 條` 這個計數是可靠的，但閘門對「缺陷在哪一行」的定位偏移 3 行，任何以閘門行號為基礎的後續引用都不可信。
