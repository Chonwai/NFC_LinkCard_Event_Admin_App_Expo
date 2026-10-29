# 獨立驗證報告

## 結論

VERDICT: FAIL

PASS 16/18 items

主要失敗：

- **A1**：受測報告的後端路由總數 111 無法重現；本次量到 121 條（`/api/v1/events` 下），若把另行掛載的 `exhibitor-invites` 也算進去是 123 條。受測報告漏掉 8 條 nested `/import` 路由與 2 條 `index.ts` 直接路由。
- **F16**：抽驗 6 個 file:line 引用，只有 1 個仍與現行原始碼相符；其餘 5 個已因後續修復而位移或失效，文件沒有標示這些引用是修復前的快照。

A–E 中唯一的 FAIL 是 A1；依規則整體判定 FAIL。F16 的 file:line 引用是測量事實，且文件沒有標示它們是修復前快照，因此也獨立構成誠實性 FAIL。

## 逐項結果

### A1 — 後端 distinct (method, path) 數量

**命令**

```bash
python3 /tmp/verify-parity/count_routes_clean.py
```

腳本：從 `BE/src/events/routes/*.ts` 抓 `router.<verb>('<path>'`，套用 `index.ts` 的 mount，並額外展開 `registrations.routes.ts` / `exhibitors.routes.ts` 內的 `router.use('/import', …)`。

**原始輸出**

```text
files: 12
events-router distinct (method,path): 121
all route files distinct (method,path): 123
nested /import routes: 8
index.ts direct routes: 2
exhibitor-invites separate: 2
```

**判定：FAIL**

**備註**

- 以 `/api/v1/events` 為 base、含 nested `/import`、不含另行掛載的 `exhibitor-invites`：**121**。
- 若把 `src/events/routes/exhibitor-invites.routes.ts` 也算進來（`app.ts:220` 掛在 `/api/v1/exhibitor-invites`）：**123**。
- 受測報告 `01-endpoint-parity.md` §1.3 寫「合計 111」。111 = 121 − 8（nested `/import`）− 2（`index.ts` 的 `POST /webhooks/stripe`、`POST /activation/claim`），也就是受測清單同時漏掉 nested import 與 index 直接路由。
- 受測報告自己的 `/tmp/parity/extract_be.py` 輸出是 **113**（漏 8 條 import，但有 index）；`/tmp/parity/groups.py` 才是 **111**（再漏 index）。兩個工具不一致，報告逕採 111。
- 這不是單純數字美觀問題：`scripts/backend-routes.snapshot.json` 也只有 113 條，代表契約閘門目前看不到 8 條 nested `/import` 路由。現在 App 沒打這些路由所以不會誤報；未來若 App 打 `/registrations/import/*` 或 `/exhibitors/import/*`，閘門會產生假違規。

### A2 — `checkin/override` 不存在

**命令**

```bash
cd BE && rg -n "checkin/override|checkin.*override|override.*checkin" src --glob '!*.map'
```

**原始輸出**

```text
（無輸出；exit 1）
```

另外 `rg -n "override" src/events` 只找到 ticket capability、company page overrides、註解與 DTO 欄位，沒有 route-shaped 的 checkin override。

**判定：PASS**

### A3 — status 修正路由存在，且已目標狀態會被拒絕

**命令**

```bash
cd BE && rg -n "registrationId/status" src/events/routes
cd BE && sed -n '1466,1500p' src/events/services/EventRegistrationService.ts
```

**原始輸出（節錄）**

```text
src/events/routes/registrations.routes.ts:132:    '/:registrationId/status',
```

```ts
// 先判「沒變」再判「不允許」：已是目標狀態時，明確回一個可區分的錯誤碼
if (fromStatus === toStatus) {
  throw new Error("REGISTRATION_STATUS_UNCHANGED");
}
```

**判定：PASS**

**備註**

路由是 `POST /:eventId/registrations/:registrationId/status`，掛在 `registrations.routes.ts:131-135`。拒絕無意義寫入的精確行是 `EventRegistrationService.ts:1489-1490`。

### A4 — write access 角色與 `my-managed` 的 role 過濾

**命令**

```bash
cd BE && sed -n '361,391p' src/events/services/EventService.ts
cd BE && sed -n '502,535p' src/events/services/EventService.ts
cd BE && sed -n '75,96p' src/events/controllers/EventRegistrationController.ts
```

**原始輸出（節錄）**

```ts
// getEventWriteAccess
if (event.ownerId === userId) return 'ALLOWED';
role: { in: [EventOrgRoleType.SUPER_ADMIN, EventOrgRoleType.COORDINATOR] },
if (orgRole) return 'ALLOWED';
return 'FORBIDDEN';

// getMyManagedEvents
const orgRoles = await this.prisma.eventOrgRole.findMany({
    where: { userId, status: OrgRoleStatus.ACTIVE },
    select: { role: true, event: { ... } },
});

// listRegistrations
if (eventOwnerAccess !== 'ALLOWED') {
    return ApiResponse.forbidden(res, '你沒有權限查看報名列表', 'INSUFFICIENT_PERMISSION');
}
```

**判定：PASS**

**備註**

- `getEventWriteAccess` 允許：event owner、ACTIVE `SUPER_ADMIN`、ACTIVE `COORDINATOR`。
- `getMyManagedEvents` 的 org-role 查詢**沒有 role filter**，任何 ACTIVE org role 都會回傳活動；實務上 `OPERATOR`、`VOLUNTEER`、`MEDIA` 都會看到活動。
- `listRegistrations` 走 `getEventWriteAccess`，所以 OPERATOR 看得到活動、卻會在名單端點收到 403。受測報告的結論可重現。

### B5 — App `apiClient.<verb>` 呼叫清單

**命令**

```bash
python3 /tmp/verify-parity/extract_app_calls_clean.py
```

**原始輸出**

```text
COUNT 15
auth.service.ts:13 POST /api/auth/login
auth.service.ts:26 GET /api/users/me
event.service.ts:50 GET /api/v1/events/my-managed
event.service.ts:72 GET /api/v1/events/by-id/${encodeURIComponent(eventId)}
event.service.ts:86 GET /api/v1/events/${encodeURIComponent(eventId)}/my-access
event.service.ts:109 GET /api/v1/events/${encodeURIComponent(eventId)}/registrations
event.service.ts:124 GET /api/v1/events/${encodeURIComponent(eventId)}/ticket-types
nfc.service.ts:30 GET /api/v1/events/${encodeURIComponent(eventId)}/nfc/lookup?${params.toString()}
nfc.service.ts:56 GET /api/v1/events/${encodeURIComponent(eventId)}/nfc/badges?${query.toString()}
nfc.service.ts:69 POST /api/v1/events/${encodeURIComponent(eventId)}/nfc/bind
nfc.service.ts:95 POST /api/v1/events/${encodeURIComponent(eventId)}/nfc/exchange
registration.service.ts:20 GET /api/v1/events/${encodeURIComponent(eventId)}/registrations/by-code/${encodeURIComponent(code)}
registration.service.ts:34 POST /api/v1/events/${encodeURIComponent(eventId)}/registrations/checkin
registration.service.ts:80 POST /api/v1/events/${encodeURIComponent(eventId)}/registrations
registration.service.ts:109 GET /api/v1/events/${encodeURIComponent(eventId)}/wallet/${encodeURIComponent(registrationId)}/transactions
```

**判定：PASS**

**備註**

15 條 = 13 條 events 端點 + 2 條 auth/non-event。與受測報告 §1.1 的「13 + 2」一致（但受測報告是修復前，當時還含 override；現在 override 已移除）。

### B6 — App 不含 `registrations/checkin/override`

**命令**

```bash
cd APP && rg -n "checkin/override" src
```

**原始輸出**

```text
src/services/registration.service.ts:43:   * ⛔ 已移除：`POST …/registrations/checkin/override`
src/app/(auth)/[eventId]/check-in.tsx:309:   * 先前這裡會 POST `registrations/checkin/override`——但後端**沒有這條路由**
```

**判定：PASS**

**備註**

只有兩處「已移除」註解，沒有任何 `apiClient.post` 呼叫。B5 的 15 條清單也證實沒有 override。

### B7 — `getWalletTransactions` 的參數與型別

**命令**

```bash
cd APP && sed -n '104,113p' src/services/registration.service.ts
cd APP && sed -n '132,155p' src/types/api.types.ts
```

**原始輸出（節錄）**

```ts
async getWalletTransactions(
  eventId: string,
  registrationId: string,
  params?: { page?: number; limit?: number },
): Promise<WalletTransactionList> {
  const res = await apiClient.get<ApiResponse<WalletTransactionList>>(
    `/api/v1/events/${encodeURIComponent(eventId)}/wallet/${encodeURIComponent(registrationId)}/transactions`,
    { params },
  );
```

```ts
balanceAfter: number;
sourceType?: string | null;
// ⚠️ 這裡沒有 `approvedBy`：後端的 select 從來沒有這個欄位。
```

**判定：PASS**

**備註**

(a) 接受 `{ page, limit }` 並原樣轉發；(b) 宣告 `balanceAfter: number`；(c) 宣告 `sourceType?: string | null`；(d) 沒有宣告 `approvedBy`（只有註解提到它不存在）。

### B8 — 後端 wallet projection 與 App 型別

**命令**

```bash
cd BE && nl -ba src/events/services/EventWalletService.ts | sed -n '34,60p'
```

**原始輸出（節錄）**

```ts
select: {
    id: true,
    type: true,
    amount: true,
    balanceAfter: true,
    description: true,
    sourceType: true,
    createdAt: true,
},
```

**判定：PASS**

**備註**

後端 select 有 `balanceAfter`、`sourceType`，沒有 `approvedBy`。App 的 `WalletTransactionItem` 也正好有這 7 個欄位（`balanceAfter` 必填、`sourceType` 可選），且沒有 `approvedBy`。兩邊投影一致。

### B9 — `my-access` 呼叫次數與 response 型別

**命令**

```bash
cd APP && rg -n "my-access" src/services/event.service.ts
cd APP && rg -n "apiClient[^;]*my-access" src
```

**原始輸出**

```text
src/services/event.service.ts:24: * 呼叫者在這場活動的實際權限（`GET /v1/events/:eventId/my-access`）。
src/services/event.service.ts:79:   * GET /v1/events/:eventId/my-access — 呼叫者在這場活動能做什麼。
src/services/event.service.ts:87:      `/api/v1/events/${encodeURIComponent(eventId)}/my-access`,
```

```ts
export interface EventAccess {
  canManage: boolean;
  canOperate: boolean;
  canInviteAdmins?: boolean;
  role?: string | null;
}
```

**判定：PASS**

**備註**

`apiClient` 的 `/my-access` 呼叫剛好 1 次（`event.service.ts:86-88`）；另外兩處是註解。response 型別含 `canManage`、`canOperate`。

### C10 — Web 錢包死連結

**命令**

```bash
FE=/Users/chonwai/Desktop/Self/Lab/LinkCard/LinkCard_Frontend
test -d "$FE/app/(event)/manage/[eventId]/wallet"; echo $?
rg -n "wallet|rewrite|manage" "$FE/next.config.js" "$FE/middleware.ts"
cd APP && rg -n "manage/.*wallet|wallet.*manage/" src
```

**原始輸出（節錄）**

```text
exists_exit=1
middleware.ts:51:        '/manage/:path*',
middleware.ts:55:        '/events/manage/:path*',
middleware.ts:58:        '/my-tickets/:path*', // Personal ticket sub-pages (e.g. wallet)
APP/src/app/(auth)/[eventId]/token.tsx:15: * `Linking.openURL(`${WEB_BASE_URL}/manage/${eventId}/wallet`)`，
```

**判定：PASS（有保留）**

**備註**

- `test -d` 回 1，路徑不存在；`next.config.js` 沒有 rewrite 指到 wallet；`middleware.ts` 只有 matcher，沒有 rewrite。
- APP/src 的 grep 不是空的：`token.tsx:15` 仍保留一行「原本這樣做」的註解，但實際的 `Linking.openURL` 已移除，改成導向 App 名單頁。也就是「可執行的舊 deep link 已消失」，但字面字串仍在註解裡。
- 另一個小問題：`token.tsx:16` 的註解寫 `app/(event)/(manage)/[eventId]/wallet`，實際 FE 結構是 `app/(event)/manage/[eventId]/wallet`（沒有 `(manage)` route group）。兩者都不存在，但註解的路徑寫法不精確。

### D11 — `npx tsc --noEmit`

**命令**

```bash
cd APP && npx tsc --noEmit
```

**原始輸出**

```text
（無輸出）
```

**判定：PASS（exit 0）**

### D12 — `npx eslint .`

**命令**

```bash
cd APP && npx eslint .
```

**原始輸出**

```text
（無輸出）
```

**判定：PASS（exit 0，無 error/warning）**

### D13 — `npm test`

**命令**

```bash
cd APP && npm test
```

**原始輸出（結尾）**

```text
1..182
# tests 216
# suites 6
# pass 213
# fail 0
# cancelled 0
# skipped 0
# todo 3
```

**判定：PASS（exit 0）**

**備註**

`# tests 216` = pass 213 + fail 0 + todo 3。沒有 fail，但有 3 個 todo；受測報告若聲稱「全數通過」需注意這 3 個未執行項目。

### D14 — `npm run check:contract`

**命令**

```bash
cd APP && npm run check:contract
```

**原始輸出**

```text
> linkcard_event_admin_app_expo@1.0.0 check:contract
> node scripts/check-backend-contract.mjs

✓ 15 條 App 呼叫全部對得上後端路由快照
```

**判定：PASS（exit 0）**

**備註**

這裡的「15 條」與 B5 的 15 條一致。快照本身是 commit `64be09e`、`generatedAt 2026-10-21T17:31:14.454Z`；BE HEAD 目前也是 `64be09e7`。

### E15 — 契約閘門的鑑別力

**命令**

```bash
rm -rf /tmp/verify-parity/neg
mkdir -p /tmp/verify-parity/neg/src
cp -R APP/src/services /tmp/verify-parity/neg/src/services

# 注入不存在的路由
cat >> /tmp/verify-parity/neg/src/services/registration.service.ts <<'TS'
export async function __negProbeOverride(id: string) {
  return apiClient.post(`/api/v1/events/${id}/registrations/checkin/override`, {});
}
TS

node /tmp/verify-parity/run_check.mjs /tmp/verify-parity/neg
```

**原始輸出（負向）**

```json
{
  "checked": 16,
  "violations": [
    {
      "method": "POST",
      "raw": "/api/v1/events/${id}/registrations/checkin/override",
      "file": "registration.service.ts",
      "line": 118,
      "key": "POST */registrations/checkin/override"
    }
  ],
  "unknownBase": []
}
```

**原始輸出（正向）**

把注入改成存在的 `/registrations/${registrationId}/status` 後重跑：

```json
{
  "checked": 16,
  "violations": [],
  "unknownBase": []
}
```

**判定：PASS**

**備註**

- 不存在的路由：**恰好 1 條 violation**，且 `raw` 明確指出 `.../checkin/override`。
- 存在的路由：**0 條 violation**，證明閘門不是永遠失敗。
- `checkContract()` 是直接 import 自 `APP/scripts/check-backend-contract.mjs`，不是只跑 CLI。
- 這個測試只證明「單一錯誤路徑會被抓到」與「合法路徑不會被誤殺」，不證明快照涵蓋所有後端路由（A1 已指出 nested `/import` 缺口）。

### F16 — `03-semantic-drift.md` 的 file:line 抽查

抽驗 6 個引用，對照現行 worktree：

| #   | 文件引用                                                                | 現行實際內容                                                                                                                                 | 相符？ |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | S-1 `registration.service.ts:50`（宣稱是 override 呼叫）                | `* COORDINATOR 以上權限（見 parity 報告 §S-1）。`                                                                                            | no     |
| 2   | S-2 `registrant/[registrationId].tsx:186`（宣稱讀 `approvedBy`）        | `/>`（報到時間 Row 的結尾；檔案內已無 `approvedBy`）                                                                                         | no     |
| 3   | S-3 `types/api.types.ts:63-100`（宣稱缺退款／稽核欄位）                 | 63 行 `export interface Registration {`；100 行空白；欄位其實已在 111-120 行（`checkedInBy`、`archivedAt`、`depositRefunded*`）              | no     |
| 4   | S-4 `event.service.ts:62-90`（宣稱是 `getRegistrations`）               | 62 行 `registrationCount: item.registrationCount ?? meta?.registrationCount,`；`getRegistrations` 實際從 93 行開始，且已含 `depositRefunded` | no     |
| 5   | S-8 `token.tsx:48-51`（宣稱有 `Linking.openURL`）                       | 48 行 `router.replace("/(auth)/home");`；51 行 `secondaryLabel={eventId ? copy.event.tokenOpenRoster : undefined}`；openURL 已移除           | no     |
| 6   | S-10 `registrations.tsx:136,169,194`（宣稱硬寫 `visibility: "active"`） | 三行都是 `visibility: "active",`                                                                                                             | yes    |

**判定：FAIL（1/6 相符）**

**備註**

這些引用大多指向**修復前**的程式碼；`03` 文件時間是 01:16，後續修復 commit 才移除 override、改錢包、補型別、改 token 連結。若文件是刻意保留成「審計當時的快照」，應該在檔頭標明 commit 或「line numbers are pre-fix」；目前沒有，讀者會以為引用對應現行 HEAD。另外，`03` 的總表寫 `registrant/[id].tsx:186`，但實際檔名是 `registrant/[registrationId].tsx`；`[id].tsx` 不存在。

補充抽查（不在上述 6 個內）：

- S-6 `registrations.tsx:148` → `const forbidden = getApiErrorStatus(err) === 403;` → yes。
- S-9 `EventNfcBatchController.ts:88` → `const boundOnly = req.query.boundOnly === 'true';` → yes。

### F17 — 「badges: App 缺 4 項」

**命令**

```bash
FE=.../LinkCard_Frontend
sed -n '13,19p' "$FE/app/(event)/manage/[eventId]/badges/page.tsx"
rg -n "export async function (claimNfcBadge|completeNfcBatch|createNfcBatch|exportNfcBadges|listNfcBadges)" "$FE/lib/events/nfc.ts"
cd APP && rg -n "async (lookup|listBadges|bind|recordExchange)|claim|complete|createBatch|export|boundOnly" src/services/nfc.service.ts
```

**原始輸出（節錄）**

```text
badges/page.tsx imports:
  claimNfcBadge,
  completeNfcBatch,
  createNfcBatch,
  exportNfcBadges,
  listNfcBadges,

FE lib/events/nfc.ts:
123: export async function createNfcBatch(
134: export async function listNfcBadges(
151: export async function exportNfcBadges(
164: export async function completeNfcBatch(
176: export async function claimNfcBadge(

APP nfc.service.ts methods:
23: async lookup
37: async listBadges
63: async bind
87: async recordExchange
45/54: boundOnly?: boolean; query.set("boundOnly", "true")
```

**判定：PASS**

**備註**

- Web badges 頁匯入 5 個 badge API；App 只有 `listBadges`（對應 `listNfcBadges`）與 `lookup`，缺 `createNfcBatch`、`claimNfcBadge`、`completeNfcBatch`、`exportNfcBadges` 共 **4 個 API 函式**。「缺 4 項」在 API 函式層級成立。
- 但文件 §2.4 的表格把 `boundOnly` 也列為缺（❌）；現行 App 已在 `nfc.service.ts:45,54` 支援 `boundOnly`。這一行是修復後已過時，不能再用「5 個缺項」理解。
- App 另有 `bind`、`recordExchange`，不在 Web badges 頁的 5 個匯入函式內，所以不影響「缺 4 項」的結論。

### F18 — 「Web 沒有現場報名入口」

**命令**

```bash
cd FE
rg -n -i "walk-in|walkin|walk_in|現場報名" \
  --glob '!node_modules/**' --glob '!.next/**' .
```

**原始輸出（節錄）**

```text
components/event/RegistrationFlow/ConsentCheckbox.tsx:15: ... shared ... registration + walk-in surfaces.
__tests__/events/consentNamecardDisclosure.test.tsx:12: ... 現場 walk-in ...
__tests__/journeys/j-walkin-consent.test.tsx:2: ... 現場代填 ...
docs/2026-08-10-v11.0-v11.1-all-modules-master-qa-test-plan.md:7668: | 6 | 現場報名（Walk-in） | 任何 Phase 均未規劃 ...
docs/v11.0-v11.1-master-qa-test-plan.md:3028: ... 現場報名（Walk-in）... 屬 v11.2+ ...
docs/release-qa/2026-10-20-qa-feedback-remediation/06-production-safety-disclosure.md:58: ... walk-in ...
```

**判定：PASS（有保留）**

**備註**

- 沒有任何 `app/.../walk-in` 頁面或 admin walk-in route；命中的都是註解、測試與舊 QA 文件。
- 但 FE 確實有公開自助報名頁 `app/(event)/events/[eventId]/register/page.tsx`，會呼叫 `createRegistration`。所以「Web 完全沒有任何報名入口」是錯的；受測報告的「沒有現場報名入口」只有在「沒有專屬櫃台／walk-in 模式」這個語意下成立。若主辦方在現場打開公開報名頁代填，技術上是可行的，只是不是專用流程。

## 與受測報告不一致之處

1. **後端路由總數：報告 111，實測 121（或 123）。**
   - `01-endpoint-parity.md` §1.3「合計 111」。
   - 本次以 `/api/v1/events` 為 base、含 nested `/import`、不含另行掛載的 `exhibitor-invites`：121。
   - 含 `exhibitor-invites`（`/api/v1/exhibitor-invites`）全部 route 檔：123。
   - 111 正好等於 121 − 8（nested import）− 2（index 直接路由）。受測報告沒有說明這個排除條件。
   - 受測報告自己的 `extract_be.py` 輸出 113，`groups.py` 輸出 111；兩個工具不一致，報告採用 111。
   - 連帶影響：`scripts/backend-routes.snapshot.json` 只有 113 條，漏掉 8 條 nested `/import`。閘門對目前 App 呼叫沒有假陰性，但對未來 import 呼叫會產生假陽性。

2. **`03-semantic-drift.md` 的引用多數已過時。**
   - S-1 `registration.service.ts:50` 現在是「COORDINATOR 權限」註解，不是 override 呼叫。
   - S-2 `registrant/[registrationId].tsx:186` 現在是 Row 結尾 `/>`，不是 `approvedBy`。
   - S-3 說 `Registration` 型別缺退款／稽核欄位；現行 `types/api.types.ts:111-120` 已有 `checkedInBy`、`archivedAt`、`depositRefunded*`。
   - S-4 說 `getRegistrations` 在 `event.service.ts:62-90`；現行 `getRegistrations` 從 93 行開始，且已含 `depositRefunded`。
   - S-6 說 App「`/my-access` 0 次呼叫」；現行剛好 1 次（B9）。
   - S-8 說 `token.tsx:48-51` 有 `Linking.openURL`；現行已移除（C10）。
   - S-9 說 App 缺 `boundOnly`；現行 `nfc.service.ts:45,54` 已支援。
   - 上述有些是「修復前的事實」，但文件沒有標示版本／commit，現在不能當成現行狀態引用。

3. **`02-screen-parity.md` §2.4 的 `boundOnly` 列已過時。**
   - 表格寫 `boundOnly` Web 有、App 缺；現行 App 已送 `boundOnly=true`。不過 4 個缺失的 badge API 函式仍然成立（F17）。

4. **`02-screen-parity.md`「Web 沒有現場報名入口」需要加限定。**
   - 沒有專屬 walk-in 頁面是事實；但公開 `/events/[eventId]/register` 存在且可建立報名。應寫成「沒有專屬現場／櫃台 walk-in 流程」，而不是「Web 沒有報名入口」。

5. **`01-endpoint-parity.md` §1.1 row 7 的「App 呼叫 override」是修復前狀態。**
   - 現行 App 已無此呼叫（B6）。這是預期中的修復差異，不是新錯誤；但報告章節沒有更新，直接讀會以為現在仍在打。

6. **`01-endpoint-parity.md` 的「13 條事件端點」仍可重現。**
   - 本次 B5 為 13 條 events + 2 條 auth；這部分與報告一致。差異只在「其中 1 條 dead」已修掉。

## 你無法驗證的部分

- **Runtime / production 行為**：沒有啟動 BE、沒有連 DB、沒有打真實 HTTP；所有後端結論都是靜態路由與 service 原始碼推導。
- **Web / App 的實際畫面**：沒有啟動 Next.js 或 Expo，沒有用瀏覽器或模擬器；畫面相關結論只來自檔案與字串。
- **歷史 commit 的原始狀態**：本次只量現行 worktree（APP HEAD `bc27abc`、BE HEAD `64be09e7`）。文件中標榜的「審計當時」數字，沒有 checkout 到當時 commit 重跑。
- **`npm test` 的覆蓋品質**：只記錄 exit code 與 TAP 統計，沒有逐條檢查 216 個測試是否真的斷言了正確行為。
- **快照與後端未來版本**：`backend-routes.snapshot.json` 對得上 BE 目前 HEAD，但沒有驗證 production 部署是否同版。
- **`view_image` 相關檢查**：依指示完全未使用。

## 建議

1. **修正路由抽取器，讓 nested mount 與 index 路由都進快照。**
   - `extractBackendEventRoutes()` 目前只讀 `EVENT_ROUTE_MOUNTS` 的 8 個檔，沒有遞迴展開 `router.use('/import', …)`；index 的 2 條有進快照，所以 snapshot 是 113，而不是 121。受測報告的 111 則是另外再漏掉 index 2 條。
   - 建議加一個測試：`snapshot.eventRoutes.length === 實際展開數`，並明確斷言 8 條 import 路由存在。否則未來 App 打 import 端點會被閘門誤判。

2. **把「後端路由總數」改成有定義的數字。**
   - 明確寫出：base 是 `/api/v1/events` 還是包含 `/api/v1/exhibitor-invites`；是否含 nested `/import`；是否含 index direct。
   - 目前 111 / 113 / 121 / 123 四個數字並存，讀者無法知道哪個是權威。

3. **文件引用改成版本化或符號化。**
   - 若 `03` 是審計快照，檔頭加 `at commit <sha>` 與「line numbers are pre-fix」。
   - 否則修復後應更新 line numbers；用 `function name` + 短 code quote 比純 line number 耐用。

4. **App 的 OPERATOR 入口應先用 `canManage` 隱藏名單／badges。**
   - 後端 `listRegistrations` 對 OPERATOR 是 403（A4），目前 App 仍讓 OPERATOR 進得去再撞牆。`my-access` 已經接了（B9），應把 `canManage` 接到導航／名單入口，而不是只用在 overview 的請求分流。

5. **Badges 的 parity 決策要寫清楚。**
   - 現行缺 4 個 API 函式（create / claim / complete / export）。若本輪不做，應在 `08-intentional-differences.md` 明列為刻意差異，而不是讓 `02` 的「缺 4 項」與現行程式碼的 `boundOnly` 已補並存造成混亂。

6. **現場報名語意要對齊。**
   - 若產品要「Web 沒有現場報名」，應定義為「沒有專屬 walk-in / 櫃台代填流程」；公開 `/events/[eventId]/register` 仍是可用的報名入口。分開寫，避免過度宣稱。
