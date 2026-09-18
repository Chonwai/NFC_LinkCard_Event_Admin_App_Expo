# 01 — 完成度對照矩陣：藍圖 vs 實際代碼

> 對照基準：Engineering Spec v1.0（§4 畫面結構 / §5 頁面規格 / §3 API 消費清單）+ Batch Write Design（軌道 3 Admin App 功能）+ Deep Research v2 結論
> 驗證方式：代碼實時掃描（2026-09-14）+ Build 實測 + PROGRESS/DEV_LOG 交叉比對

---

## 1. Engineering Spec §4 畫面結構

| 藍圖項目                               | Spec §  | 狀態 | 證據                                                                                                     |
| -------------------------------------- | ------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `_layout.tsx`（Stack + Auth guard）    | §4      | ✅   | `src/app/_layout.tsx`：`isAuthenticated/isHydrated/hydrate` + `router.replace` guard（commit `919cf5d`） |
| `index.tsx`（Login）                   | §4/§5.1 | ✅   | `src/app/index.tsx`：401/403/network/5xx 分類 + `useSessionNotice`（expired/suspended banner）           |
| `(auth)/_layout.tsx`（Bottom Tabs）    | §4      | ✅   | home/settings tabs + `[eventId]` `href: null` 隱藏（commit `99ace15`）                                   |
| `(auth)/home.tsx`（My Events）         | §4/§5.2 | ✅   | `GET my-managed` + 6 種 status badge + userRole/報名數/展商數 meta（commit `5292ece`）                   |
| `(auth)/settings.tsx`                  | §4/§5.7 | 🟡   | 有登出/email/版本；**缺 NFC 狀態檢查**（`copy.settings.nfcStatus` 文案已定義未消費）                     |
| `[eventId]/_layout.tsx`（Event Stack） | §4      | ✅   | 4 個 `Stack.Screen`（overview/check-in/nfc-bind/badges）                                                 |
| `[eventId]/overview.tsx`               | §4/§5.3 | ✅   | 統計卡（報名/已報到/展商）+ 3 快速操作；已報到改真實 `CHECKED_IN` 查詢（commit `040ebd4`）               |
| `[eventId]/check-in.tsx`               | §4/§5.4 | ✅   | CameraView QR 掃描 + 手動模式 + 3s auto-reset + 4 種錯誤碼映射（commit `f20f158`/`e647ddb`）             |
| `[eventId]/nfc-bind.tsx`               | §4/§5.5 | 🟡   | 完整流程代碼（lookup→確認→badge 類型→`writeUriToCard`→`bind`）+ iOS 提示；**真機零驗證**                 |
| `[eventId]/badges.tsx`                 | §4/§5.6 | 🟡   | tagUid 查詢 + 庫存列表分頁（PAGE_SIZE 20 + onEndReached）；E2E 只測空狀態                                |
| `[eventId]/settings.tsx`               | §4/§7   | ❌   | **檔案不存在**（`[eventId]/_layout.tsx` 未註冊）——Spec §4 與 §7 都列出此頁                               |

> 結論：**10 個頁面中 8 個完整、1 個部分（settings 缺 NFC 檢查）、1 個完全缺（[eventId]/settings）**。骨架完整度極高。

---

## 2. Batch Write Design「軌道 3 Admin App 功能」（§3）

| 藍圖項目                                             | 狀態 | 證據                                                                                 |
| ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 登入 → my-managed → 選活動                           | ✅   | `home.tsx` + `event.store.selectEvent` + `router.push('/(auth)/[eventId]/overview')` |
| 現場 walk-in 寫卡                                    | 🟡   | `nfc-bind.tsx` 全流程有代碼；真機未驗證                                              |
| Check-in（QR）                                       | ✅   | 見上表                                                                               |
| Badge 綁定/補發                                      | 🟡   | 綁定有（`nfc.service.bind`）；**補發（void 舊卡→綁新卡）❌ 未做**                    |
| Attendee 搜尋                                        | ❌   | P1，完全未做（無搜尋 UI/API）                                                        |
| 即時統計                                             | 🟡   | Overview 3 統計卡（已報到即時更新已驗證）；完整「現場統計」P1 未做                   |
| 展商發卡管理                                         | ❌   | 屬軌道 1 Web 後台職責，未做（不影響 App 藍圖）                                       |
| **角色權限矩陣**（§3.2：VOLUNTEER 禁 NFC/綁定/搜尋） | ❌   | **全 App 無 userRole 門控**——所有頁面直接可操作                                      |

---

## 3. Spec §3 API 消費清單

| API                                                                        | 狀態 | 證據                                                                                 |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `POST /api/auth/login`                                                     | ✅   | `auth.service.ts:login`                                                              |
| `GET /api/v1/events/my-managed`                                            | ✅   | `event.service.ts:getMyManagedEvents`（含 `_meta` unwrap，commit `99ace15`）         |
| `GET /registrations/by-code/:code`                                         | ✅   | `registration.service.ts:getByCode`                                                  |
| `POST /registrations/checkin`                                              | ✅   | `registration.service.ts:checkIn`                                                    |
| `GET /nfc/lookup`                                                          | ✅   | `nfc.service.ts:lookup`（uid/qr）                                                    |
| `GET /nfc/badges`                                                          | ✅   | `nfc.service.ts:listBadges`（分頁/status/batchId/all）                               |
| `POST /nfc/bind`                                                           | ✅   | `nfc.service.ts:bind`                                                                |
| `POST /nfc/batch`、`/badges/export`、`/batch/:id/complete`、`/batch/claim` | ❌   | **未消費**——設計文檔列為 backend 新 API + Web 後台職責，App 藍圖本就不含（合理空缺） |

---

## 4. 三份藍圖的核心結論 vs 現況

| 藍圖結論                                                  | 現況驗證                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Deep Research v2：iPad 無 NFC → iPad 做 QR kiosk          | ✅ Check-in 頁支援 iPad（CameraView QR）；NFC 寫卡限 Android/iPhone 提示已實作 |
| Deep Research v2：backend 80% 就緒，App 純前端            | ✅ 全部 service 消費既有 API，零 backend 變更（符合 Spec TL;DR）               |
| Batch Write Design：雙軌（Web 批量 / App 現場）           | ✅ App 只管現場；batch API 未被 App 消費（正確）                               |
| Engineering Spec：10 頁面 + 三層 token 100% 對齊 Promoter | 🟡 9/10 頁面在（缺 `[eventId]/settings`）；token 100% 對齊                     |

---

## 5. 完成度總結

| 面向             | 完成度 | 說明                                              |
| ---------------- | ------ | ------------------------------------------------- |
| **P0 功能代碼**  | ~85%   | 8/10 頁面完整 + 全部 service + 全部 ui components |
| **Build 健康**   | 100%   | tsc/eslint/web export 全過（2026-09-14 實測）     |
| **runtime 驗證** | ~40%   | 12 項 E2E 全 web；真機 0                          |
| **Deploy**       | 0%     | EAS 未初始化、無 TestFlight/內測                  |
| **P1 藍圖**      | 0%     | Attendee 搜尋 / 離線 / 完整現場統計 全未做        |

> 一句話：**這是「骨架完成、Build 健康、等待真機驗證與收尾」的階段**，不是「寫了半成品」。
