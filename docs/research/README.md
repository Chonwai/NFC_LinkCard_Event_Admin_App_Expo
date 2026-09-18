# LinkCard Event Admin App — 重啟導航（2026-09-14 重啟前審計）

> 產出：Neo Loop Engine（JARVIS Agent Network）｜2026-09-14
> 品質合約：strict（threshold 93）/ L3 Deep Dive
> 研究方法：藍圖文件掃描（Deep Research v2 / Batch Write Design / Engineering Spec）+ 代碼實時掃描驗證 + Build 實測 + 既有 loop state 交叉比對
> Repo：`LinkCard_Event_Admin_App_Expo` @ HEAD `6ca3057`（22 commits，working tree clean）

---

## TL;DR（三句話告訴你現況）

1. **開發有進行、而且骨架完成度高**：Login → My Events → Event Overview → Check-in(QR+手動) → NFC 寫卡 → Badge 查詢 全部**有代碼**，2026-09-14 實測 `tsc 0 errors` / `eslint 0/0` / `npx expo export --platform web` 成功，**Build 完全健康**。
2. **但「代碼完成」≠「可用」**：12 項 E2E 全部是 **web + staging** 測的，現場工具的核心（真機 NFC 寫卡、相機 QR 掃描、Badge 綁定、SecureStore 真機行為）**零驗證**。完成度粗估：**P0 代碼 ~85%、runtime 驗證 ~40%、Deploy 0%**。
3. **重啟第一步不是「補代碼」，是「真機驗證」**：最大卡點是 staging 4 個活動皆無 badge 資料（需先建批次才能測綁定）；其次補 `[eventId]/settings.tsx` 缺頁、EAS 初始化、角色門控。

---

## 報告結構索引

| 文件                          | 內容                                                                                                                            | 對應你的問題                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `01-completion-audit.md`      | 藍圖 vs 完成度**對照矩陣**（Engineering Spec §4/§5 + 批量設計軌道 3 + API 消費清單）                                            | 「完成多少？」                          |
| `02-verification-gaps.md`     | **驗證層級盤點**（有代碼/E2E/真機三層）+ P0/P1/P2 **空缺清單**                                                                  | 「有進行到開發嗎？哪些可信？」          |
| `03-restart-roadmap.md`       | **重啟路徑 8 步**（含 EAS/TestFlight/CORS/品牌資產）+ 風險表                                                                    | 「怎麼重啟？」                          |
| `04-loop-state-appendix.md`   | 5 個歷史 loop state 摘要 + 完整時間線                                                                                           | 「之前發生過什麼？」                    |
| `05-handover-blueprint.md`    | **交接前開發藍圖**：Web vs App 差距矩陣 + 未開發功能盤點 + Sprint 計畫 + 證據清單                                               | 「下一步做什麼？交接前補哪些？」        |
| `05b-meeting-blueprint.md`    | **會議整合**：20260914 Meeting 1 + Token v11.3 + 交接藍圖 三來源覆蓋矩陣 + 整合方法                                             | 「會議討論的功能怎麼落地？」            |
| `06-feature-list.md`          | **功能開發清單**：差異分析（A1 完整/A2 增強/A3 新增/A4 不做）+ P0/P1/P2 完整功能表                                              | 「要做哪些功能？」                      |
| `07-mvp-schedule.md`          | **MVP 排期**：6 週倒推 + 依賴關鍵路徑 + 風險 + 施工順序                                                                         | 「11月前怎麼排？」                      |
| `08-appendix.md`              | **附錄**：會議 7 決策 ↔ v11.3 D 系列對齊 + UAT + 證據清單 + 戰略層整合                                                          | 「待決策項 & 驗收標準」                 |
| `09-feasibility-review.md`    | **交接可行性複審**：10 個 P0 逐項裁決（可開發/阻斷）+ 5 個硬阻斷項 + 契約漂移 + 外派協作風險 + 10 項待裁決                      | 「這些內容真的做得出來嗎？」            |
| `10-app-completion-audit.md`  | **App 完成度審計**：14 個 `src/` commit 逐條 + 7 畫面 × 四態 + 10 service 方法 + 48 項死碼 + 9 條旅程 + AU-01..AU-11 未驗證清單 | 「**我做到哪了？還缺什麼？**」          |
| `11-app-defect-register.md`   | **缺陷冊 + 死碼清理清單**：A0..A9 十個缺陷（症狀/根因/重現/最小修法/驗收/歸屬）+ 可刪 vs **絕對不可刪** 對照                    | 「**能 build 嗎？哪裡壞了？怎麼修？**」 |
| `12-app-feature-inventory.md` | **功能現況盤點（交接用）**：35 項可用功能 + 11 頁 × 四態 + 9 條旅程 + 與 09-16 審計的逐項差異 + 四分類缺口                      | 「**現在到底有什麼功能？**」            |

---

## ✅ A0-A9 修復完成（2026-09-17）

> **VERIFY 結果：PASS — 95.1 / 100**（strict 門檻 93）

| 缺陷      | 修復                                                         | 驗證 |
| --------- | ------------------------------------------------------------ | ---- |
| **A0** 🔴 | `config.ts` origin-only + fail-closed guard + `.env.example` | ✅   |
| **A1** 🔴 | `home` 錯誤橫幅改讀 store `error`                            | ✅   |
| **A2** 🟠 | `EventStatus` 對齊後端 enum（6 值）                          | ✅   |
| **A3** 🟠 | `checkIn` 回傳值 → 結果卡 5 欄身分核對                       | ✅   |
| **A4** 🟠 | 登出清活動快取（dynamic import 避 cycle）                    | ✅   |
| **A5** 🟡 | 移除死狀態 `currentEventId`                                  | ✅   |
| **A6** 🟠 | 26 行硬編中文 → copy 層（3 新 namespace）                    | ✅   |
| **A7** 🟠 | `payloadUrl` 改用 `WEB_BASE_URL`                             | ✅   |
| **A8** 🟡 | 移除 `?? fallback` 掩蓋                                      | ✅   |
| **A9** 🟡 | 逾時碼分類放寬（4 碼 + `code` 優先）                         | ✅   |

**額外修復**（VERIFY 過程發現）：

- **N1** 🔴 **跨帳號活動污染**：`clear()` 後舊 in-flight 回應仍寫回 store → 加 `requestId` 世代守衛（harness 實測兩種時序皆 `LEAK=NO`）
- **F1/F2/L2/L3/N2/N4**：`clear()` 重置 `loading`、共用 `event-status`、統一 fallback、抽出世代述詞、可達 fallback、檔尾換行

**技術債淨減少**：死 copy key 11 → **4**、死 icon 12 → **10**、死 npm 依賴 6 → **4**、四態 21/28 → **23/28（82%）**

---

## 🔍 App 完成度審計（2026-09-16）

> 回答「**之前開發到那些地步 / 那些做了 / 那些還沒做（排除後端 API）**」

| 文件                                       | 讀者            | 用途                               |
| ------------------------------------------ | --------------- | ---------------------------------- |
| `docs/research/10-app-completion-audit.md` | **用戶**        | 完成度量化 + 我做了什麼 + 缺少什麼 |
| `docs/research/11-app-defect-register.md`  | **feiteng2015** | 施工前的必修缺陷 + 死碼處理指引    |

**核心結論**：

- ⏸️ **App 程式碼自 2026-09-12（`040ebd4`）起完全未變動**——14 個 `src/` commit 全在同一天；其後 32 個 commit 全是文件
- 📐 **規模**：`src/` 36 檔 / 4674 行；**7 個實際畫面**（10 個 route 檔含 3 layout）；route 註冊 **0 缺口**
- 📊 **完成度**：畫面功能完整 **4/7**；四態覆蓋 **21/28（75%）**；Service 完整驗證 **5/10**；Icon 使用率 **22/34**
- 🔴 **驗證真相**：**真機 0 / EAS build 0 / 自動化測試 0**；12 項 web E2E **全靠 `.env.local` 才成立**
- 🔴 **新發現 10 個缺陷 A0..A9**（既有研究未載），最關鍵 **A0**：預設 base URL 構成雙重 `/api` → **任何沒有 `.env.local` 的環境（新 clone、EAS build）全 API 404**（本輪已實測確認）
- 🗑️ **死碼約 48 項**；但 **12 個 icon + 11 個 copy key 等「偽死碼」是後續 W-ID 的資產，不可清理**（**可實際清理的只有 11 項**，見 `11-app-defect-register.md` §4）
- ⏰ **移交前唯一必修：A0（W-09，0.5 日）**——不修則新 clone 需手動補 `.env.local` 才能開發、**EAS build 產物**必然全 404

---

## 🆕 外派交接（2026-09-15）

> **新前提**：前端畫面 → 工程師 `feiteng2015`｜後端 API → 用戶本人
>
> 當功能清單從「一人做」變成「兩人分工」，**契約必須先凍結**，否則介面會漂移。

| 文件                    | 位置                                                                 | 讀者        | 用途                                                      |
| ----------------------- | -------------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| **前端施工計畫**        | `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`                  | feiteng2015 | **30 個 W-ID** × 三批次 × 前置條件 × mock 策略            |
| **API 契約凍結規格 v1** | `docs/20260915_AdminApp_API_Contract_Freeze_v1.md`                   | 雙方        | 29 端點 🟢🟡🔴 + 錯誤碼 + 權限矩陣                        |
| **可行性複審**          | `docs/research/09-feasibility-review.md`                             | 用戶        | 裁決依據 + 待決策清單                                     |
| **後端待辦**            | `LinkCard_ExpressJS_Backend/docs/20260915_AdminApp_Backend_TODOs.md` | 用戶        | 5 阻斷項 + 2 交付判定項（**B-6 / B-7**）施工化 + 排序論證 |

**核心結論**：

- ✅ **5 個 P0 可立即開工**（**9.5** 人日，零後端依賴）：F-03 名單 / F-04 四大卡 / F-05 詳情 / F-08 EAS / F-10 Badge（含 2026-09-16 新增的 W-10..W-15）
- 🚫 **4 個 P0 被後端阻斷**：F-02 Token（B-1）/ F-06 Credential（無模型）/ F-07 權限（B-4）/ F-01 部分（B-2、B-3）
- 🔴 **5 個硬阻斷項**：B-1 帳務層 6 端點+冪等全缺 / B-2 checkIn 無覆核 / B-3 無閘口欄位 / B-4 VOLUNTEER 無授權 / B-5 by-code 限流 20次/5min/IP
- 🔴 **2 個複審新發現**：**G-1** `GET /registrations` 擋 OPERATOR 但 `checkin` 放行（現場 403）/ **DEF-01** 自助 top-up 漏洞（**現存於 prod**）
- ⏰ **前端 W-01 有 3 個 hard blocker**：裁決 C-1（pagination）/ C-2（Registration 型別）/ C-3（限流）

---

## 關鍵數字速覽

| 面向             | 現況                                                | 證據                                        |
| ---------------- | --------------------------------------------------- | ------------------------------------------- |
| Commits          | 27+5（scaffold→docs snapshot + handover blueprint） | `git log` @ `3e038a2`                       |
| Build 健康度     | ✅ tsc 0 / eslint 0 / web export 成功               | 2026-09-14 實測                             |
| P0 功能代碼      | ✅ 8/10 頁面 + 全部 service                         | `src/app/` 22 檔案                          |
| E2E 驗證         | 🟡 12 項全為 web+staging（9/12）                    | `PROGRESS.md`                               |
| 真機驗證         | ❌ 0 項（NFC/相機/SecureStore/bind）                | PROGRESS 自認 + 代碼掃描                    |
| Deploy           | ❌ EAS 未初始化、icon 為 Promoter 複製              | `app.json` 無 projectId                     |
| 上次 loop 狀態   | active（VERIFY stage）但實質閉合                    | `.edison/state/loop-event-admin-app-dev.md` |
| **Web 後台功能** | ✅ 12/13 個 manage 頁全在                           | `LinkCard_Frontend` `find` 實測             |

---

## 交接前重點（2026-09-14 補充）

> 完整分析見 `05-handover-blueprint.md`

**下一步策略**：Web 後台功能已完整（不需大改）；**Admin App 補強現場功能 + Deploy 基建**是主軸。

**交接前必做 4 件事**（~10 小時）：

1. `[eventId]/settings.tsx` 補頁（30 分）
2. Registrations 列表頁（status filter + 分頁 + 查看，2 小時）— service 已存在
3. EAS 初始化 + projectId（30 分）
4. 真機 E2E（Android + iOS，3 小時）

**關鍵發現**：後端 `GET /registrations` **無 search 參數**（只支援 page/limit/status/ticketTypeId/visibility/depositRefunded）— by name/email 搜尋需新建 backend API，建議留給下個工程師。

---

## 背景文件（藍圖，皆已存在）

- **Deep Research v2**（20260911）：硬體能力（iPad 無 NFC）+ 業界共識（獨立 Staff App 正確）+ backend 80% 就緒
- **Batch Write Design**（20260912）：雙軌架構（Web 管批次 ACR122U / App 管現場）+ 5 個新 backend batch API
- **Engineering Spec v1.0**（.edison/traces）：畫面結構 / 頁面規格 / API 消費清單 / commit 策略
- **StartupFest Readiness**（20260911）：Event UI 完整度 + NFC on-site 操作需求

> 完整詳情見 `01/02/03` 三份深度報告。根知識庫整合版：`docs/LinkCard Event related/20260914_LinkCard_Event_Admin_App_Restart_Research_v1.0.md`
