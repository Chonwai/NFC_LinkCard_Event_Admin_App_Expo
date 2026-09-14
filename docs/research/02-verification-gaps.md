# 02 — 驗證層級盤點 + 空缺清單

> 目的：區分「有代碼」vs「有 runtime 驗證」vs「真機/集成驗證」——因為現場工具 App 的核心價值在真機行為，web E2E 通過 ≠ 可用。
> 驗證：代碼實時掃描（2026-09-14）+ PROGRESS.md 記錄交叉比對

---

## 1. 驗證層級盤點

| 功能 | 有代碼？ | E2E 驗證？（web+staging 9/12） | 真機/集成驗證？ | 備註 |
|---|---|---|---|---|
| 登入 + auth guard | ✅ | ✅（測試 1、12） | ❌ | SecureStore 真機行為未測 |
| My Events 列表 | ✅ | ✅（測試 2） | ❌ | 4 活動正確顯示 |
| Tab bar | ✅ | ✅（測試 3） | ❌ | `[eventId]` 隱藏 |
| Event Overview 統計 | ✅ | ✅（測試 4、8） | ❌ | 已報到即時更新（修復 `040ebd4`） |
| Check-in 手動輸入 | ✅ | ✅（測試 5、6、7） | ❌ | CONFIRMED/重複/PENDING_PAYMENT 三態 |
| Check-in QR 掃描 | ✅ | ❌（web 無 camera） | ❌ **需真機** | CameraView 未實測 |
| NFC 寫卡流程 | ✅ | ✅（測試 10：只驗「web 顯示不支援」） | ❌ **需 Android + NTAG** | 核心功能！ |
| Badge 綁定（bind API） | ✅ | ❌（staging 無 badge 資料） | ❌ | 被批次資料卡住 |
| Badge 庫存列表 | ✅ | ✅（測試 9：僅空狀態） | ❌ | 分頁/多狀態未驗 |
| Settings + 登出 | ✅ | ✅（測試 11） | ❌ | |
| 錯誤映射（ALREADY/PENDING/PERMISSION） | ✅ | ✅（測試 6、7） | ❌ | `getApiErrorCode` 修復 `e647ddb` |
| Badge 補發（void→綁新） | ❌ | — | — | 未實作 |
| Attendee 搜尋 | ❌ | — | — | P1 未實作 |
| 角色權限門控 | ❌ | — | — | 全 App 無 userRole 檢查 |

**PROGRESS 12 項 E2E 可信度：中高** —— git log 完全佐證修復 commit（`040ebd4`/`e647ddb`/`99ace15` 與紀錄吻合）、`dist/` 產出（9/14 15:27）佐證 export 真實。**但全部 web runtime**，與真機（NFC、相機權限、SecureStore、平台分支）有本質差距。

---

## 2. 空缺清單（分優先序）

### P0 — 重啟必須處理

| # | 空缺 | 證據 | 影響 |
|---|---|---|---|
| 1 | `[eventId]/settings.tsx` 不存在 | read_file 404；`[eventId]/_layout.tsx` 未註冊 | Spec §4/§7 藍圖頁缺一；Event 內無設定入口 |
| 2 | Settings 缺 NFC 狀態檢查 | `(auth)/settings.tsx` 全文無 `NfcManager.isSupported`；`copy.settings.nfcStatus/nfcSupported/nfcNotSupported` 文案**已定義未消費** | Spec §5.7 未達標 |
| 3 | 真機驗證零覆蓋 | PROGRESS 自認「Badge 綁定待批次」「真機 NFC 需 Android+卡」 | 現場工具核心未實測 |
| 4 | 角色權限門控未實作 | 全 App 無 userRole 檢查 | 批量設計 §3.2 矩陣未落地；VOLUNTEER 可誤寫卡 |
| 5 | EAS 未初始化 | `app.json` 無 `extra.eas.projectId`（grep 實測 = 0） | `eas build` 無法提交，Deploy 全斷 |

### P1 — 重啟後短期

| # | 空缺 | 狀態 |
|---|---|---|
| 6 | 補發流程（void 舊卡 → 綁新卡） | 無 UI/API 消費 |
| 7 | Badge 批次資料建立（staging 4 活動皆無 badge） | **阻擋 Badge 綁定/列表 E2E** |
| 8 | icon/splash 客製 | `assets/` 仍為 Promoter 複製（`theme.ts:1` 檔頭仍寫「LinkCard Promoter App」） |
| 9 | `app.json` 無 `.env.example` | 新成員 onboarding 缺參照 |
| 10 | 無 test framework / test files | 專案 0 個自有測試 |

### P2 — 藍圖 P1 功能（未排程）

- Attendee 搜尋、離線模式、完整現場統計
- `src/hooks/` 目錄（Spec §7 規劃；目前 `useFocusRing` 放 `components/ui/`）
- `event.types.ts`（型別全塞 `api.types.ts`，可接受）

---

## 3. 上次 loop 的實質閉合狀態

`.edison/state/loop-event-admin-app-dev.md`（Status: **active**, VERIFY stage）：
- **實際已閉合**：無未修 bug（VERIFY R1 的 lint 修復全數完成）、Circuit Breaker HEALTHY、Budget 0%
- **標記 active 的原因**：當時以「Neo 自身嚴格驗證」替代 smith（smith agent 無回應），並未真正跑過真實 QA agent —— 這是唯一未閉合項，重啟對策 = **直接進 VERIFY（真實 QA 或真機測試）**，不需要回 PLAN/EXECUTE

---

## 4. 一句話總結

> **「有 85% 的代碼、40% 的 web 驗證、0% 的真機驗證、0% 的部署」** —— 重啟第一優先不是補功能，是把核心功能放到真機上驗證（NFC 寫卡 + QR 掃描 + 綁定），再補 2 個小缺頁與 EAS。