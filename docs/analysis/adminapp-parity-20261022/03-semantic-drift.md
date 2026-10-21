# 03 — 語意漂移登記簿（Semantic Drift Register）

> **引用座標說明（重要）**
>
> 本檔的 file:line 有兩種，混用會誤導讀者：
>
> - `base` — **審計當時**（commit `7d0fcf5`）的位置，用來說明「原本錯在哪」。
> - `fixed` — **本輪修完後**的位置，用來讓讀者驗證修正確實落地。
>
> 2026-10-22 的獨立驗證指出：第一版全部標成單一座標，讀者分不出哪些是修復前的
> 快照，於是 6 個抽驗點有 5 個對不上現行 HEAD。已修正為雙座標。詳見
> `07-verification.md` F16。

> **引用座標說明（重要）**
>
> 本檔的 file:line 有兩種：
>
> - `base 7d0fcf5` — **審計當時**的位置。用來描述「原本錯在哪」。
> - `fixed` — **本輪修完後**的位置。用來讓讀者驗證修正確實落地。
>
> 2026-10-22 的獨立驗證指出：第一版全部標成單一座標，讀者分不出哪些是修復前的
> 快照，於是 6 個抽驗點有 5 個對不上現行 HEAD。這個問題已修正——每條都標明是哪
> 一種。詳見 `07-verification.md`。

「路徑對」不等於「接法對」。這一節記錄**同一條端點、兩邊用法不同**的地方。

嚴重度：

- **P0** — 必定錯誤，使用者看得到
- **P1** — 靜默地錯／不完整，或整條角色路徑壞掉
- **P2** — 後端已就緒、App 沒做
- **P3** — 體驗／一致性

## 總表

| ID   | 嚴重度 | 一句話                                                | 證據位置                                                                                 |
| ---- | ------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| S-1  | **P0** | 呼叫一條不存在的路由                                  | base `registration.service.ts:50` → fixed `:43`（已移除）                                |
| S-2  | **P1** | 錢包流水只看到前 20 筆，且讀一個不存在的欄位          | base `registrant/[registrationId].tsx:186` → fixed `:207`；`registration.service.ts:104` |
| S-3  | **P1** | `Registration` 型別缺退款／稽核欄位                   | base `types/api.types.ts:63-100` → fixed `:111-120`（已補）                              |
| S-4  | **P1** | 名單缺 `depositRefunded` 篩選                         | base `event.service.ts:62-90` → fixed `:93-106`（已補）                                  |
| S-5  | **P1** | 現場報名的回應只留 4 個欄位，付款資訊全丟             | `registration.service.ts` 的 `createRegistration`（未修）                                |
| S-6  | **P1** | 完全不呼叫 `/my-access`，角色只是裝飾                 | base `src/` 全庫 0 命中 → fixed `event.service.ts:85`                                    |
| S-7  | **P1** | overview 用受限端點借數字，OPERATOR 必 403            | base `overview.tsx:133-142` → fixed `:187,201`                                           |
| S-8  | **P1** | Token placeholder 深連結到不存在的 Web 路由           | base `token.tsx:48-51` → fixed `:50`（改指名單）                                         |
| S-9  | P2     | badges 缺 `boundOnly`                                 | base `nfc.service.ts:37-70` → fixed `:44`（已補參數）                                    |
| S-10 | P2     | 名單硬寫 `visibility: "active"`，無法看隱藏/封存      | `registrations.tsx:136,169,194`（未修，位置不變）                                        |
| S-11 | P3     | 錯誤處理不讀 `normalizedCode` / `compatibleCodes`     | `utils/api-error.ts:30-31`                                                               |
| S-12 | P3     | 詳情頁路由參數叫 `registrationId`，但實際靠 `code` 查 | `registrant/[registrationId].tsx:54,70,78`（未修；base 為 45-50,72）                     |

---

## S-1（P0）呼叫不存在的路由

```
POST /api/v1/events/:eventId/registrations/checkin/override
```

- **App（base 7d0fcf5）**：`registration.service.ts:50`，UI 在 `check-in.tsx:303-330`
  → **本輪已移除**（fixed `registration.service.ts:43` 的說明註解、`check-in.tsx` 改指詳情頁）
- **後端**：`registrations.routes.ts` 只有 `/checkin` 與 `/:registrationId/status`
- **前端**：沒有這個呼叫（Web 的 check-in 只顯示錯誤訊息）

**為什麼不能順手改用 `/status`**：

|          | App 想要的語意                | `/status` 的實際語意                                    |
| -------- | ----------------------------- | ------------------------------------------------------- |
| 定位     | `registrationCode`            | `registrationId`                                        |
| 目標狀態 | 已是 `CHECKED_IN`，想「放行」 | 已是 `CHECKED_IN` ⇒ `409 REGISTRATION_STATUS_UNCHANGED` |
| 權限     | OPERATOR                      | owner / SUPER_ADMIN / COORDINATOR                       |
| 必填     | —                             | `reason`                                                |

`EventRegistrationService.ts:1462` 的註解寫得很清楚：
「已是目標狀態（拒絕無意義寫入，並讓前端發現過期畫面）」。
⇒ **後端刻意沒有「重複報到放行」這個能力。**

**目前的實際行為**：按鈕按下去 → 404 → catch → 顯示 `overrideBlockedBanner`。
結果正確，但代價是每次現場人員按一下，就打一條必定失敗的請求（也會污染後端 404 告警）。

---

## S-2（P1）錢包流水：截斷 + 讀錯欄位

後端回應（`EventWalletService.getTransactionHistory`）：

```jsonc
{
  "transactions": [
    {
      "id": "...",
      "type": "TOP_UP",
      "amount": 10,
      "balanceAfter": 15, // ← App 沒讀
      "description": "...",
      "sourceType": "MANUAL", // ← App 沒讀
      "createdAt": "...",
      // 沒有 approvedBy ← App 卻在讀
    },
  ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "pages": 3 }, // ← App 沒讀
}
```

App 的型別（`registration.service.ts:98-126`）宣告 `approvedBy?`，並且 UI：

```tsx
// registrant/[registrationId].tsx:186
label={`${tx.type} · ${tx.approvedBy ?? copy.checkIn.dash}`}
```

⇒ 每一行永遠顯示 `TOP_UP · —`。
**這不是「沒有操作員」，是這個欄位根本不存在。** 使用者會以為系統沒有記錄是誰操作的。

同時：`page`/`limit` 預設 1/20，App 不傳參數也不讀 `pagination`
⇒ **超過 20 筆的流水永遠看不到，而且沒有任何提示。**

對照前端：`lib/events/wallet.ts:34-52` 有 `page`/`limit`，型別有 `balanceAfter`、`sourceType`，
UI（`my-tickets/[registrationId]/wallet/page.tsx:268`）顯示 `balanceAfter`。

---

## S-3（P1）`Registration` 型別缺退款／稽核欄位

後端 `listRegistrations` 的 select 含：

```
depositRefundedAt, depositRefundedBy, depositRefundedAmount,
depositRefundedReference, depositRefundedNote,
checkedInBy, archivedAt
```

- 前端型別（`lib/events/types.ts:521-542`）**全部有**
- App 型別（`types/api.types.ts:63-100`）**一個都沒有**

⇒ 就算 App 之後要顯示退款狀態，型別會逼你 `any`。先補型別是零風險的前置工作。

---

## S-4（P1）名單缺 `depositRefunded` 篩選

後端 `EventRegistrationController.ts:130-152` 支援 `depositRefunded=refunded|not_refunded`。
前端 `registrations/page.tsx:126` 有送。
App 的 `getRegistrations`（`event.service.ts:62-90`）只有 `page/limit/status/ticketTypeId/visibility`。

> 注意：`registrantType` 是**前端**的死參數（後端 controller 0 命中），不要跟著抄。

---

## S-5（P1）現場報名的回應被砍到 4 個欄位

後端 `POST /:eventId/registrations` 回傳的 `registration` 至少含：

```
id, registrationCode, status, paymentMethod,
tokenBalance, amount, currency, breakdown, bankDetails,
stripeCheckoutUrl, bankTransferInstructions
```

前端 `RegistrationResult`（`lib/events/registrations.ts:20-32`）**全部建模**。
App（`registration.service.ts:63-95`）只留 `id / registrationCode / status / paymentMethod / stripeCheckoutUrl`。

現場影響：付費票的**金額、幣別、價格明細、銀行轉帳指示**在 App 內拿不到。
目前 App 只用「有沒有 `stripeCheckoutUrl` 或是不是 `PENDING_PAYMENT`」判斷要不要付款
（`walk-in.tsx:94-97`）——這對「現場收現金」的流程不夠。

另外前端 `createRegistration` 支援 `?code=`（access code，私有活動用），App 沒有。

---

## S-6（P1）角色只是裝飾，`/my-access` 從未被呼叫

後端：

```ts
// EventController.ts:133-158
GET /:eventId/my-access
→ { canManage, canOperate, canInviteAdmins, role }
```

- 前端：`manage/[eventId]/layout.tsx:125` 用 `getMyEventAccess()` 的 `canManage` 當閘門
- App：**0 次呼叫**

後果（不是理論，是必然）：

`getMyManagedEvents` 對「任何 ACTIVE org role」都回傳活動（`EventService.ts` 的 `eventOrgRole.findMany` 無角色篩選）。
⇒ OPERATOR 看得到活動 → 點進去 → `GET /registrations` 走 `getEventWriteAccess`（only owner/SUPER_ADMIN/COORDINATOR）
⇒ **403**。

App 有 `userRole`（`home.tsx:115-123` 還把它渲染成徽章），卻沒有拿它做任何事。

**必須說準的部分**：名單畫面**已經**處理了 403——
`registrations.tsx:148`（及 176／200）用 `getApiErrorStatus(err) === 403` 分流到
`copy.roster.operatorForbidden`（文案是「閘口帳號暫時讀不了名單…請改用那類帳號」）。
所以不是「一片潰敗」，而是「**每個入口都要先進去撞牆才知道**」。

真正還錯的是：

1. `overview.tsx:179` 的 catch 只有一種文案（`copy.home.loadFailed`），同一個 403 在這裡看起來像系統故障。
2. 沒有任何入口依角色預先隱藏或標示。
3. `token.tsx` / `badges.tsx` 同樣沒有依 `canManage` 分流。

---

## S-7（P1）overview 用「會被 403 的端點」借數字

見 `02-screen-parity.md` §2.3。摘要：

- `overview.tsx:133-142` 打兩次 `GET /registrations?limit=1` 讀 `pagination.total`
- 這條端點對 OPERATOR 是 403
- 而 `_meta.registrationCount` 已經在 `event` 物件裡（`event.service.ts:40-46` 已 unwrap）

額外成本：每次進 overview 都是 **2 個多餘請求**，而且與名單畫面共享同一條受限端點。

---

## S-8（P1）Token placeholder 的死連結

```tsx
// token.tsx（base 7d0fcf5）:48-51 → 本輪已移除
void Linking.openURL(`${WEB_BASE_URL}/manage/${eventId}/wallet`);
```

- `LinkCard_Frontend/app/(event)/manage/[eventId]/wallet/` **不存在**（已用 `test -d` 驗證）
- Web 的錢包頁在 `/my-tickets/[registrationId]/wallet`（**參與者**視角，不是主辦方）
- `next.config.js` / `middleware.ts` 沒有對應 rewrite

⇒ 使用者按「在 Web 開啟」會得到 404。文案說「完整櫃台在 Web」，但那個櫃台沒有地址。

---

## S-9（P2）badges 缺 `boundOnly`

後端 `EventNfcBatchController.ts:88` 讀 `boundOnly === 'true'`；前端 `nfc.ts:134-149` 有送。
App 的 `listBadges` 沒有這個參數。

---

## S-10（P2）名單硬寫 `visibility: "active"`

`registrations.tsx:136,169,194` 三處都寫死 `visibility: "active"`。
後端支援 `all | active | hidden | archived`，前端有下拉選單。
⇒ App 永遠看不到被隱藏／被封存的報名，而且沒有任何提示「這裡還有 N 筆」。

---

## S-11（P3）不讀 403 的相容碼

後端 `ApiResponse.error`（`src/utils/apiResponse.ts:192-194`）：

```ts
response.error.normalizedCode = "FORBIDDEN";
response.error.compatibleCodes = ["FORBIDDEN", "PERMISSION_DENIED"];
```

前端有 `isForbiddenError()`（`lib/events/apiClient.ts:70-100`）同時看
`code` / `normalizedCode` / `compatibleCodes`。
App 的 `getApiErrorCode`（`utils/api-error.ts:30-31`）只看 `code: string`。

⇒ 之後若後端新增 403 的別名碼，App 會漏接。目前無立即錯誤，但這是同一個契約家族。

---

## S-12（P3）詳情頁參數命名與實際查法不一致

```tsx
// registrant/[registrationId].tsx:54（fixed 座標；base 為 :45-50）
const { eventId, registrationId, code } = useLocalSearchParams<{
  eventId: string;
  registrationId: string;
  code?: string;
}>();
// :70（base 為 :72）—— 決定能不能載入的是 code，不是 registrationId
if (!eventId || !code) {
  /* 空狀態 */
}
// :78（base 為 :72-75）
const { registration: next } = await registrationService.getByCode(
  eventId,
  code,
);
```

路由參數叫 `registrationId`，但**真正決定能不能載入的是 `code`**。
從名單點進來沒問題（`registrations.tsx:375-384` 兩個都帶），
但任何直接 deep-link（例如通知、QR）只帶 `registrationId` 就會看到空畫面。

---

## 漂移的方向統計

| 方向             | 條數 | 說明                                                  |
| ---------------- | ---- | ----------------------------------------------------- |
| 後端有、App 沒接 | 9    | S-4, S-5(部分), S-6, S-9, 以及 §2.4/§2.5 的 13 項能力 |
| App 接了但接錯   | 4    | S-1, S-2, S-7, S-8                                    |
| 型別過窄         | 2    | S-3, S-5                                              |
| 兩邊都沒接       | 1    | S-11 的相容碼（前端有、App 沒有）                     |
| **前端本身有錯** | 1    | `registrantType` 死參數（見 01 §1.4）                 |
