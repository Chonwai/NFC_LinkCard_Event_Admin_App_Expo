# LinkCard Event Admin App — PROGRESS

> 更新：2026-09-14（交接前開發藍圖 — 見 `docs/research/05-handover-blueprint.md`）
> 藍圖依據：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md` + `20260912_LinkCard_Batch_Write_Trigger_Admin_App_Design.md`

---

## 📌 交接前狀態（2026-09-14 審計更新）

> 完整分析見 `docs/research/`（05 份報告 + 本藍圖）

**現況一行**：Web 後台功能完整（12 個 manage 頁全在），Admin App 骨架完成（10 頁面、tsc/eslint/web export 全過）；**真機驗證 0、Deploy 0**。

**交接前必做 4 件事**（~10 小時）：
1. `[eventId]/settings.tsx` 補頁（登出 + Event 切換 + 版本 + NFC 狀態檢查，30 分）
2. Registrations 列表頁（status filter + 分頁 + 查看，2 小時）— `eventService.getRegistrations` 已存在
3. EAS 初始化 + projectId（30 分）
4. 真機 E2E（Android 優先：Check-in QR → NFC 寫卡 → 綁定 → Badge 查詢 → Registrations 列表；3 小時）

**關鍵發現**：後端 `GET /registrations` 無 search 參數（只支援 page/limit/status/ticketTypeId/visibility/depositRefunded，`EventRegistrationController.ts:70-150`）— by name/email 搜尋需新建 backend API，留給下個工程師。

**不適合移植到 App 的 Web 功能**（桌面管理面）：org-roles / ticket-types / bank-transfers / content / polls / profile / badges 批次管理。

---

## 📋 會議整合狀態（2026-09-15 更新）

> 完整分析見 `docs/research/`（05b/06/07/08）

**會議來源**：`docs/LinkCard Event related/20260914_LinkCard_Event_Admin_App_Meeting_1.md`（9/14 深度需求整理，11月 Macau Startup Festival 硬期限）

**三大發現**：
1. **Token v11.3 已有完整設計**（`LinkCard_ExpressJS_Backend/docs/development-cycles/v11.3-event-token-system/04-design-plan.md`，R3 PASS 93.00）— 內含 Admin App `wallet-counter` 畫面規格（§5.2）= 會議模組 B
2. **會議 7 模組中 4 個有既有資產**（QR 簽到 / Token / NFC / 名單 service）
3. **核心增量 = 未涵蓋的新功能**：三態簽到增強、四大功能卡、用戶詳情、現場補報名、工作人員權限、儀表板、Credential 統一模型

**整合產出**（10 個 P0 功能 F-01..F-10 + 9 個 P1 + 7 個 P2）：
- F-01 QR 簽到三態｜F-02 Token 櫃台（v11.3 §5.2）｜F-03 名單搜尋（需新 API）｜F-04 四大功能卡｜F-05 用戶詳情｜F-06 Credential 模型｜F-07 權限收緊｜F-08 EAS｜F-09 真機 E2E｜F-10 Badge 批次
- MVP 底線：掃碼簽到 + Token 增扣 + 名單查詢 + Email 自動建帳

**待決策**：會議 7 項（#4 NFC 綁定是最高風險，本週定人）+ v11.3 D1-D15（D14 top-up 上限建議 MOP 1,000/5,000）

---

## ✅ 完成狀態（16 commits）

| # | Commit | 內容 | 驗證 |
|---|---|---|---|
| 1 | `c569f83`/`53bc571` | **scaffold**：Expo app + theme.ts（100% 對齊 Promoter 三層 tokens）+ config + types + app.json 權限 | tsc ✅ |
| 2 | `919cf5d` | **auth**：Login 頁 + auth.store + api.ts（JWT interceptor + terminal auth）+ RootLayout auth guard | tsc ✅ |
| 3 | `5292ece` | **home**：My Events 列表（GET /my-managed）+ event.service/store + Bottom Tabs + status badge | tsc ✅ |
| 4 | `40578ff` | **event**：overview（統計卡 + 快速操作）+ [eventId] Stack layout + settings + placeholder | tsc ✅ |
| 5 | `f20f158` | **check-in**：CameraView QR 掃描 + 手動輸入 + 3s auto-reset + 錯誤映射 | tsc ✅ |
| 6 | `f794974` | **nfc**：walk-in 寫卡（writeUriToCard）+ nfc.service（lookup/bind）+ badge type 選擇 | tsc ✅ |
| 7 | `c076189` | **badges**：tagUid 查詢 + 庫存列表分頁（GET /nfc/badges） | tsc ✅ |
| 8 | `e590209` | **fix**：react-hooks pattern 對齊 Promoter + lint 全綠 | tsc+eslint ✅ |
| 9 | `a3b7d2e` | **fix**：nfc-utils web-safe（dynamic import）+ ScreenHeader paths + staging env | ✅ |
| 10 | `e7112af` | **fix**：Logo branding（Promoter→Event Admin）+ CORS port 對齊 | ✅ |
| 11 | `99ace15` | **fix**：service 路徑 `/api` prefix + `_meta` unwrap + 隱藏 `[eventId]` tab | tsc+eslint ✅ |
| 12 | `e647ddb` | **fix**：check-in 錯誤碼 unwrap（getApiErrorCode） | tsc+eslint ✅ |
| 13 | `040ebd4` | **fix**：overview 已報到統計真實查詢 CHECKED_IN | tsc+eslint ✅ |

## 🧪 完整端到端實測（2026-09-12，staging 真實帳號 chonwaiun@gmail.com）

| # | 測試 | 結果 | 備註 |
|---|---|---|---|
| 1 | 登入（email/password → staging） | ✅ | 成功導向 /home |
| 2 | My Events 列表 | ✅ | 4 活動顯示（role/報名人數正確）——修復 `/api` prefix bug |
| 3 | Tab bar | ✅ | 只剩 我的活動/設定（`[eventId]` 隱藏） |
| 4 | Event Overview | ✅ | 統計卡 + 快速操作（Check-in/NFC 寫卡/Badge） |
| 5 | Check-in 手動輸入（CONFIRMED code） | ✅ | 「報到成功」 |
| 6 | Check-in 重複報到 | ✅ | 「此報名已報到過」 |
| 7 | Check-in PENDING_PAYMENT | ✅ | 「此報名尚未確認」——修復錯誤碼 unwrap |
| 8 | Overview 已報到統計 | ✅ | 0→1 即時更新——修復硬編碼 0 |
| 9 | Badge 頁（空狀態） | ✅ | 「尚無 Badge」+ tagUid 查詢錯誤處理 |
| 10 | NFC 寫卡（查詢→選類型→寫入） | ✅ | Web 正確顯示「不支援」提示；重新輸入返回 |
| 11 | Settings + 登出 | ✅ | 回到登入頁 |
| 12 | 重新登入（auth guard） | ✅ | 完整 loop 通過 |

## 🔄 已知限制 / 待辦

- [x] **登入測試帳號**：staging 真實帳號驗證通過
- [ ] **Badge 綁定實測**：staging 4 活動皆無 badge 資料，待建立批次後驗證列表/綁定
- [ ] **真機 NFC 寫卡**：需 Android + NTAG 卡（web 只能顯示不支援）
- [ ] **P1 功能**：離線模式、Attendee 搜尋、現場統計
- [ ] **app icon/splash 客製化**：目前用 Promoter 資產（`assets/` 複製）
- [ ] **EAS Build → TestFlight**：需 Apple Developer 帳號

## � 外派交接狀態（2026-09-15 更新）

> **分工改變**：前端畫面 → 工程師 `feiteng2015`｜後端 API → 用戶本人
> 可行性複審 + 完整藍圖見 `docs/research/09-feasibility-review.md`

**可行性裁決（10 個 P0）**

| 裁決 | 數量 | 人日 | 功能 |
|---|:---:|:---:|---|
| ✅ 可立即開工（零後端依賴） | 5 | **9.5** | F-03 名單 / F-04 四大卡 / F-05 詳情 / F-08 EAS / F-10 Badge（含 W-10..W-15） |
| 🟡 部分可開工 | 1 | **1.0** | F-01 三態 UI 可先做（＝ W-26 1.0：三態重構 0.75 ＋ A3 回傳值消費 +0.25）；W-27/28/29 已計入 ❌ 列 |
| — | — | **2.5** | **未歸屬項**（非三分法可描述）：W-04 0.5（批次 1 但需 B-6）＋ W-32 1.5（真機 E2E）＋ W-33 0.5（整合驗收） |
| ❌ 後端阻斷 | 4 | **6.25** | F-02 Token（B-1）/ F-06 Credential（無模型）/ F-07 權限（B-4）/ F-01 部分 |
| — | — | **19.25** | **全 W-ID 逐項合計（30 個）**；小計合計 **18.25**、承諾交付 **17.25** |

> 📌 **本表已於 2026-09-16 重算**（原值 `0.75 / 2.0` 與 **8.0** 為 stale）：`8.0` 與 `09-feasibility-review.md` §2.1 的 `6.25` 不一致，現統一為 **6.25**（F-02 3.75 + F-06 0.5 + F-07 0.5 + F-01 阻斷 1.0 + W-29 0.5）。原 `7.0` 已因新增 W-10..W-15 升至 **9.5**。

**5 個硬阻斷項（後端待辦）**

| ID | 阻斷項 | 級別 | 證據 |
|:---:|---|:---:|---|
| B-1 | Token 帳務層未實作（缺 6 端點 + `REVERSAL` + `idempotencyKey` + `EventWalletAdjustment` 表） | 🔴 Critical | `premium.routes.ts:13-20`、`schema.prisma:1306-1312` |
| B-2 | `checkIn` 無條件拋 `ALREADY_CHECKED_IN`，無 override | 🔴 High | `EventRegistrationService.ts:1042-1044` |
| B-3 | 無閘口/地點欄位 | 🔴 High | `schema.prisma:802-803` |
| B-4 | `VOLUNTEER` 角色無任何 access 引用 | 🔴 High | `EventService.ts:424-458` |
| B-5 | `by-code` 限流 20 次/5 分鐘/**IP**（展館 NAT 必爆） | 🔴 **Critical** | `registrations.routes.ts:15-33` |

**⏰ 前端 W-01 的 3 個 hard blocker（需用戶即刻裁決）**

| ID | 裁決 | 建議 |
|:---:|---|---|
| C-1 | Pagination 方案（repo 內有 **5 種形狀**） | 維持 3 種實作 + 改正文件 + App 用兩型別 |
| C-2 | `Registration` 型別（`profile.fullName` vs flat `firstName`） | 前端改 flat |
| C-3 | `by-code` 限流 | `userId` 計 key + 提高上限 |

**複審新發現（DISCOVER 未列）**

- 🔴 **G-1**：`GET /registrations` 擋掉 OPERATOR，但 `checkin` 放行 → 閘口 staff 按名單卡 403（**W6 彩排才會爆**，修復僅 0.25 日）
- 🔴 **DEF-01**：自助 top-up 漏洞（參加者可自發 Token），**現存於 prod** → 建議最優先修
- 🟠 **Pagination 5 種形狀**：3 種 live + 1 種文件 + 1 種 App 型別（`/nfc/badges` 連 query 參數名都不同）

**交付文件**

| 文件 | 讀者 |
|---|---|
| `docs/20260915_AdminApp_Handoff_for_feiteng2015.md` | feiteng2015（**30 W-ID** × 3 批次） |
| `docs/20260915_AdminApp_API_Contract_Freeze_v1.md` | 雙方（**29 端點** + 錯誤碼 + 權限矩陣） |
| `docs/research/09-feasibility-review.md` | 用戶（裁決依據） |
| `docs/research/10-app-completion-audit.md` | 用戶（**完成度審計**，2026-09-16） |
| `docs/research/11-app-defect-register.md` | feiteng2015（**缺陷冊**，2026-09-16） |
| `LinkCard_ExpressJS_Backend/docs/20260915_AdminApp_Backend_TODOs.md` | 用戶（後端施工清單） |

---

## 🔎 App 完成度審計（2026-09-16 新增）

> 完整報告：`docs/research/10-app-completion-audit.md`（完成度）+ `docs/research/11-app-defect-register.md`（缺陷）

**核心事實**：

- ⏸️ **程式碼自 `040ebd4`（2026-09-12）起未再變動**；`src/` 共 **14 個 commit**（全在同一天），其後 32 個 commit 全為文件
- 📐 `src/` **36 檔 / 4674 行**；**7 個實際畫面**（10 個 route 檔含 3 個 layout）；**route 註冊 0 缺口**
- 📊 畫面功能完整 **4/7**；四態覆蓋 **21/28（75%）**；Service 完整驗證 **5/10**；Icon 使用率 **22/34**
- 🔴 驗證真相：**真機 0 / EAS build 0 / 自動化測試 0**；12 項 web E2E **全靠 `.env.local` 才成立**
- 🗑️ 死碼約 **48 項**（但 12 icon + 11 copy key 等為「偽死碼」，是後續 W-ID 的資產，**不可清理**；**可實際清理的只有 11 項**）

**新發現 10 個缺陷 A0..A9**（完整見 `11-app-defect-register.md`）：

| ID | 級別 | 症狀 | 歸屬 |
|:---:|:---:|---|---|
| **A0** | 🔴 Critical | 預設 base URL 構成雙重 `/api` → 任何沒有 `.env.local` 的環境（**新 clone / EAS build**）全 API 404 | **用戶（移交前 W0，W-09）** |
| **A1** | 🔴 High | `event.store` 吞錯不 rethrow → `home` 錯誤橫幅**永不顯示** | W-10 |
| A2 | 🟠 | `EventStatus` 幻覺 2 值（`REGISTRATION_OPEN`/`ENDED`）、缺 `ARCHIVED` | W-01（漂移 **D-4**） |
| A3 | 🟠 | 簽到成功**丟棄 API 回傳值**（無法顯示姓名/公司/票種/報到時間） | W-26 |
| A4 | 🟠 | `event.store.clear()` 從未被呼叫 → 登出不清快取（**跨帳號殘留**） | W-10 |
| A5 | 🟡 | `currentEventId` 只寫不讀（死狀態） | W-10 |
| A6 | 🟠 | **26 行（4 檔）**硬編中文字串繞過 copy 層 | W-11 |
| A7 | 🟠 | `payloadUrl` 硬編 production 域名 | W-11 |
| A8 | 🟡 | `?? fallback` 掩蓋 copy 缺鍵 | W-02 |
| A9 | 🟡 | 逾時碼分類過窄 | W-23 |

> ⏰ **移交前唯一必修 = A0**（W-09，0.5 日）。不修則新 clone 需**手動補 `.env.local`** 才能開發、**EAS build 產物**必然全 404；且 **9.5 人日**的批次 1 驗收會歸零。

---

## 🔗 相關文件

- Engineering Spec：`.edison/traces/event-admin-app/01-engineering-spec.md`
- Loop State：`.edison/state/loop-event-admin-app-dev.md`
- 藍圖：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md`
- **外派 handoff**：`docs/20260915_AdminApp_Handoff_for_feiteng2015.md`
- **契約凍結**：`docs/20260915_AdminApp_API_Contract_Freeze_v1.md`
- **可行性複審**：`docs/research/09-feasibility-review.md`
