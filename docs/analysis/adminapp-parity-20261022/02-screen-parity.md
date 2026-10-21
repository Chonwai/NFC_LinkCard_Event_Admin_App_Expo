# 02 — 畫面級功能對等矩陣（Capability Parity）

這一層**不該追求「一樣」**。兩個客戶端的職責不同。要問的是三件事：

1. Web 有的能力，App 該不該有？（屬於門側職責嗎）
2. App 有的能力，Web 沒有——是遺漏還是刻意？
3. 兩邊都有的能力，行為一致嗎？

## 2.1 Web 後台的 13 個模組 vs App 的 10 個畫面

Web 導覽的真實來源是 `app/(event)/manage/[eventId]/layout.tsx:168-190`。

| #   | Web 模組       | 路徑                                       | App 對應                                | 判定                                           |
| --- | -------------- | ------------------------------------------ | --------------------------------------- | ---------------------------------------------- |
| 1   | Overview       | `/manage/:eventId`                         | `overview.tsx`                          | **App 更強**（見 2.3）                         |
| 2   | Profile        | `/manage/:eventId/profile`                 | —                                       | 刻意差異（活動設定不在現場做）                 |
| 3   | Content        | `/manage/:eventId/content`                 | —                                       | 刻意差異                                       |
| 4   | Ticket Types   | `/manage/:eventId/ticket-types`            | —                                       | 刻意差異（但現場報名要**讀**票種，App 讀到了） |
| 5   | Badges         | `/manage/:eventId/badges`                  | `badges.tsx`                            | **能力缺 4 項**（見 2.4）                      |
| 6   | Registrations  | `/manage/:eventId/registrations`           | `registrations.tsx` + `registrant/[id]` | **能力缺 9 項**（見 2.5）                      |
| 7   | Check-in       | `/check-in/:eventId`                       | `check-in.tsx`                          | 基本一致；App 多一顆死按鈕                     |
| 8   | Exhibitors     | `/manage/:eventId/exhibitors` (+`/import`) | —                                       | 刻意差異                                       |
| 9   | Sessions       | `/manage/:eventId/sessions` (+2 子頁)      | —                                       | 刻意差異                                       |
| 10  | Polls          | `/manage/:eventId/polls`                   | —                                       | 刻意差異                                       |
| 11  | Bank Transfers | `/manage/:eventId/bank-transfers`          | —                                       | 刻意差異（財務覆核不在門口做）                 |
| 12  | Org Roles      | `/manage/:eventId/org-roles`               | —                                       | 刻意差異                                       |
| 13  | Settings       | `/manage/:eventId/settings`                | —                                       | 刻意差異                                       |

**App 獨有（Web 完全沒有）**：

| App 畫面              | 能力                             | Web 有嗎                                 |
| --------------------- | -------------------------------- | ---------------------------------------- |
| `nfc-bind.tsx`        | 真 NDEF 寫卡（Android）          | ❌ 結構性不可能（Web 沒有 `NDEFReader`） |
| `nfc-read.tsx`        | 讀卡取 UID                       | ❌                                       |
| `nfc-exchange.tsx`    | 兩人卡片交換                     | ❌                                       |
| `walk-in.tsx`         | 現場報名（選票種＋個資＋同意書） | ❌ **Web 沒有現場報名入口**              |
| `registrant/[id].tsx` | 參加者詳情＋錢包流水             | 部分（Web 在名單 drawer 內）             |
| `overview.tsx`        | 5 個即時統計                     | ❌ Web 的 overview 只有 3 張導覽卡       |

> 這一節的重點：**App 不是 Web 的子集**。它在門側場景是超集。

## 2.2 逐能力比對：兩邊都有的部分

### 報到（check-in）

| 能力                         | Web                                                                                      | App                             | 判定                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------- | -------------------- |
| QR 掃碼                      | ✅ `@yudiel/react-qr-scanner`                                                            | ✅ `expo-camera`                | 一致                 |
| 手動輸入報名碼               | ✅                                                                                       | ✅                              | 一致                 |
| 掃描同步門閂（防連掃雙報到） | ✅ `scanInFlight` ref                                                                    | ✅ `scanInFlight` ref           | 一致                 |
| 成功後顯示 profileUrl        | ✅                                                                                       | ✅                              | 一致                 |
| 成功後一鍵接續寫卡           | ✅ 連結帶 `?code=`                                                                       | ✅                              | 一致                 |
| 不自動重置（留時間寫卡）     | ✅                                                                                       | ✅                              | 一致                 |
| 重複報到的處理               | 只顯示錯誤字串                                                                           | 錯誤 + **「覆核」按鈕（死路）** | **App 多一顆死按鈕** |
| 錯誤碼對照                   | 4 個（`ALREADY_CHECKED_IN` / `NOT_CONFIRMED` / `NOT_FOUND` / `INSUFFICIENT_PERMISSION`） | 同 4 個 + 網路錯誤              | 一致                 |

### 寫卡（NFC bind）

| 能力               | Web                  | App                      | 判定                         |
| ------------------ | -------------------- | ------------------------ | ---------------------------- |
| 以報名碼查人       | ✅                   | ✅                       | 一致                         |
| 寫入 payload 預覽  | ✅                   | ✅                       | 一致                         |
| 真正寫入 NFC tag   | ❌ 只能手抄 UID 貼上 | ✅ Android NDEF          | **App 超集**                 |
| `?code=` 預填      | ✅                   | ✅                       | 一致                         |
| 換卡 / 補發 / 退卡 | ❌ 不存在            | UI 有、**永久 disabled** | 兩邊都沒有（後端也確實沒有） |

## 2.3 App 的 overview 比 Web 強，但對 OPERATOR 會壞

App 的 `overview.tsx` 顯示報名數、已報到數、到場率、token 發行/消耗。
Web 的 overview 只有 3 張導覽卡（`page.tsx:10-30`）。

但 App 的算法是**向受限端點借資料**：

```ts
// src/app/(auth)/[eventId]/overview.tsx:133-142
const [totalRes, checkedInRes] = await Promise.all([
  eventService.getRegistrations(eventId, { limit: 1 }),
  eventService.getRegistrations(eventId, { limit: 1, status: "CHECKED_IN" }),
]);
const total = totalRes.pagination?.total ?? 0;
```

`GET /:eventId/registrations` 的守門是 `getEventWriteAccess`
（`EventRegistrationController.ts:81-96`），角色集是 **owner / SUPER_ADMIN / COORDINATOR**（`EventService.ts:361-393`）。

**OPERATOR 不在裡面。** 但 `getMyManagedEvents` 用的是「任何 ACTIVE org role」（`EventService.ts` 的 `eventOrgRole.findMany({ where: { userId, status: ACTIVE } })`，**沒有角色篩選**）——
所以 OPERATOR 會看到這場活動、點進 overview、然後**兩個請求都 403**，畫面顯示 `copy.home.loadFailed`。

**而這個數字其實已經在手上**：`getMyManagedEvents` 回傳的 `_meta.registrationCount` 就是報名總數，
App 的 `event.service.ts:40-46` 已經 unwrap 它了，`overview.tsx:123` 的 `event` 物件裡就有。
⇒ 這裡是「有資料不用、改用一個會被 403 的端點」。

## 2.4 Badges：App 缺 4 個能力

Web `manage/[eventId]/badges/page.tsx` 匯入 5 個 API 函式：

```
claimNfcBadge, completeNfcBatch, createNfcBatch, exportNfcBadges, listNfcBadges
```

App 只呼叫 `listNfcBadges` + `lookup`。

| 能力                                           | Web | App | 後端有嗎                    | 判定             |
| ---------------------------------------------- | --- | --- | --------------------------- | ---------------- |
| 列出庫存（分頁／status／batchId）              | ✅  | ✅  | ✅                          | 一致             |
| 查單張 badge                                   | ✅  | ✅  | ✅                          | 一致             |
| `boundOnly` 篩選                               | ✅  | ❌  | ✅                          | **參數缺（P1）** |
| CSV 匯出                                       | ✅  | ❌  | ✅ `GET /nfc/badges/export` | **能力缺（P2）** |
| 建立批次（`POST /nfc/batch`）                  | ✅  | ❌  | ✅                          | **能力缺（P1）** |
| 批次認領（`POST /nfc/batch/claim`）            | ✅  | ❌  | ✅                          | **能力缺（P2）** |
| 回填真實 UID（`POST /nfc/batch/:id/complete`） | ✅  | ❌  | ✅                          | **能力缺（P1）** |

> 後端全部就緒，純粹是 App 沒做。其中「建立批次」與「回填 UID」是**現場發卡的核心流程**，
> 目前必須回 Web 做——這在活動當天是很實際的痛點。

## 2.5 Registrations：App 缺 9 個能力

Web 的 `registrations/page.tsx`（1,470 行）匯入：

```
hideRegistration, unhideRegistration, archiveRegistration, unarchiveRegistration,
updateRegistrationStatus, markDepositRefund, getRegistrationActivationLink,
resendRegistrationActivationEmail, listAdminTicketTypes, listRegistrations
```

App 只有 `getRegistrations`（瀏覽）＋ `getByCode`（詳情）。

| 能力                                      | Web | App                 | 後端有嗎       | 判定             |
| ----------------------------------------- | --- | ------------------- | -------------- | ---------------- |
| 名單瀏覽／分頁                            | ✅  | ✅                  | ✅             | 一致             |
| 依 status 篩選                            | ✅  | ✅                  | ✅             | 一致             |
| 依 ticketType 篩選                        | ✅  | ❌                  | ✅             | **能力缺（P2）** |
| visibility 切換（active/hidden/archived） | ✅  | ❌（硬寫 `active`） | ✅             | **能力缺（P2）** |
| depositRefunded 篩選                      | ✅  | ❌                  | ✅             | **能力缺（P2）** |
| 本地搜尋                                  | ✅  | ✅                  | —              | 一致             |
| 隱藏 / 取消隱藏                           | ✅  | ❌                  | ✅             | **能力缺（P2）** |
| 封存 / 取消封存                           | ✅  | ❌                  | ✅             | **能力缺（P2）** |
| 狀態修正（撤銷報到／人工報到）            | ✅  | ❌                  | ✅ `/status`   | **能力缺（P1）** |
| 退款登記（deposit refund）                | ✅  | ❌                  | ✅             | **能力缺（P2）** |
| 重寄確認信                                | ✅  | ❌                  | ✅             | **能力缺（P3）** |
| 取 activation link                        | ✅  | ❌                  | ✅             | **能力缺（P3）** |
| 顯示退款資訊                              | ✅  | ❌                  | ✅（在回應內） | **型別缺（P1）** |

## 2.6 錢包：App 只有唯讀的一半

| 能力                | Web                                   | App                                                                  | 判定                                   |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| 餘額                | ✅ `GET …/balance`                    | ❌                                                                   | 缺                                     |
| 交易流水（分頁）    | ✅ 有 `page`/`limit`，讀 `pagination` | ❌ 無分頁，**只會看到前 20 筆**                                      | **語意漂移（P1）**                     |
| 顯示 `balanceAfter` | ✅                                    | ❌ 型別沒有                                                          | 漂移                                   |
| 加值                | ✅ `POST …/top-up`                    | ❌                                                                   | 刻意差異（`token.tsx` 是 placeholder） |
| Token 櫃台          | ✅                                    | **placeholder → 深連結到 `/manage/:eventId/wallet`（該路由不存在）** | **死連結（P1）**                       |

## 2.7 「入口」本身的一致性問題

App 的 `home.tsx` 會把 `userRole` 顯示成徽章（`home.tsx:115-123`），但**從來沒有拿它做任何判斷**。

```
$ grep -rn "userRole" src/
src/types/api.types.ts:57        宣告
src/app/(auth)/home.tsx:115,123  顯示
src/services/event.service.ts:44 unwrap
```

⇒ 角色只是裝飾。於是 OPERATOR 看到所有入口，點進去 403。
對照 Web：`manage/[eventId]/layout.tsx:125` 用 `getMyEventAccess()` 的 `canManage` 做真正的閘門。

**後端早就提供 `GET /:eventId/my-access` → `{ canManage, canOperate, canInviteAdmins, role }`
（`EventController.ts:133-158`），App 一次都沒呼叫。**
這是整個對等問題裡**最便宜的一個修法**：接一支端點，換掉四處 403。
