# 獨立複核工單：App ↔ Web 對等審計（2026-10-28）

你的角色是**獨立查核者**。你不是作者，不要讀作者的結論再照抄；
用下面的命令自己量一次，只回報量到的東西。

工作目錄（三個 repo 都在 `LinkCard/` 底下）：

- App：`/Users/chonwai/Desktop/Self/Lab/LinkCard/LinkCard_Event_Admin_App_Expo`
- Web：`/Users/chonwai/Desktop/Self/Lab/LinkCard/LinkCard_Frontend`
- Backend：`/Users/chonwai/Desktop/Self/Lab/LinkCard/LinkCard_ExpressJS_Backend`

審計工作區（含本輪文件與閘門）：
`/tmp/lc-parity28-wt`

禁止事項：

- 不要修改任何 repo 的檔案，不要 commit、不要 push。
- 不要讀 `.env*` 或任何憑證檔。
- 不要執行 `npm install`。
- 只用唯讀命令（git log / git diff / grep / find / node 讀檔 / 既有的檢查腳本）。

## 要驗的 10 條斷言

對每一條，回報 `PASS` 或 `FAIL`，附上**你跑的命令**與**原始輸出的關鍵幾行**。
如果命令失敗，回報 `ERROR` 並貼錯誤。不要猜。

**A1.** App 分支 `feat/nfc-gate1-reader-spike` 的產品碼與 `origin/main` 相同。

```
cd <app> && git diff --stat origin/main..feat/nfc-gate1-reader-spike -- src tests scripts .github package.json
```

期望：空輸出。

**A2.** App 的 `src/services/registration.service.ts` 仍在呼叫
`/registrations/checkin/override`。

```
cd <app> && grep -n 'checkin/override' src/services/registration.service.ts
```

期望：至少一行。

**A3.** 後端沒有這條路由。

```
cd <backend> && grep -rn 'checkin/override' src/ | head -5
```

期望：零命中。

**A4.** App 的契約閘門在今日原始碼上只抓到 1 條死呼叫。

```
cd /tmp/lc-appcheck && node scripts/check-backend-contract.mjs; echo "exit=$?"
```

期望：輸出含 `1 條呼叫` 與 `checkin/override`，`exit=1`。

**A5.** 後端 events 路由在 10-22 之後只多了 `manage-stats`，總數 122。

```
cd /tmp/lc-contract-probe && node scripts/check-backend-contract.mjs --refresh --backend <backend>
cd /tmp/lc-contract-probe && node -e "const a=require('./snapshot-1022.json'),b=require('./scripts/backend-routes.snapshot.json');const k=r=>r.method+' '+r.path;const A=new Set(a.eventRoutes.map(k)),B=new Set(b.eventRoutes.map(k));console.log('old',A.size,'new',B.size,'added',[...B].filter(x=>!A.has(x)),'removed',[...A].filter(x=>!B.has(x)))"
```

期望：`old 121 new 122 added [ 'GET /:eventId/manage-stats' ] removed []`。

**A6.** Web 的報到頁現在會寫卡與綁卡（不是只有掃碼）。

```
cd <web> && grep -n "WriteCardPanel\|useNfcReader\|bindNfcBadge" 'app/check-in/[eventId]/page.tsx' | head -5
```

期望：三個字串都出現。

**A7.** App 沒有卡片上鎖能力。

```
cd <app> && grep -niE 'lock|pwd|password|protect' src/utils/nfc-utils.ts | head -5
```

期望：零命中。

**A8.** Web 在 manage 底下沒有 wallet 路由。

```
cd <web> && find app -type d -name '*wallet*'
```

期望：只有 `app/(personal)/(shell)/my-tickets/[registrationId]/wallet`，沒有 manage 底下的。

**A9.** Web 的 manage 導覽現在包含 check-in（13 個模組）。

```
cd <web> && grep -c "label: t('layout\." 'app/(event)/manage/[eventId]/layout.tsx'
```

期望：13。

**A10.** 對等登記表閘門在三個 repo 都在時通過，且掃到 18 個 Web 頁面。

```
cd /tmp/lc-parity28-wt && node scripts/check-parity-registry.mjs --web <web> --require-web; echo "exit=$?"
```

期望：含 `Web 頁面掃描：18 個頁面`，`exit=0`。

## 交付

把結果寫成一份 Markdown 到 `/tmp/parity-verify-report.md`，格式：

```
# 獨立複核報告
A1 PASS/FAIL — 命令 — 關鍵輸出
…
## 總結：n/10 PASS
## 我認為文件裡最不可信的一條斷言是：…
```

寫完後在回覆中貼出「總結」那一行與你認為最不可信的一條。
