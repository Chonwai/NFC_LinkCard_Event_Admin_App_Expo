# 附錄 — Loop State 摘要 + 根知識庫整合版

> 本文件（commit 5/5）彙整所有 .edison state 中 Event Admin App 相關 loop 的歷史摘要，
> 供下次重啟時快速了解「之前發生了什麼」。
> 同步在根知識庫建立完整整合版（若要跨專案可見）。

---

## A. Event Admin App 相關 Loop State 摘要

### 1. `loop-event-admin-app-research.md`（Status: **complete**，2026-09-11）
- **Goal**：深入研究「新建獨立 Admin App」可行性
- **核心結論**：iPad 全系無 NFC（假設修正）；獨立 App 正確（業界共識：Eventbrite/Cvent/Swapcard 全都做獨立）；Backend 80% 就緒（my-managed/EventOrgRole/NFC bind/lookup/check-in 全已存在）
- **交付**：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md`
- **重啟價值**：**架構決策已塵埃落定**——新建獨立 Expo App 是正確方向，無需重新評估

### 2. `loop-batch-write-trigger-admin-app.md`（Status: **complete**，2026-09-12）
- **Goal**：確認 ACR122U 批量寫卡觸發位置 + Admin App 雙軌設計
- **核心結論**：Web 管批次（USB 設備瀏覽器不可直接控制）+ 桌面工具（Node CLI 或 ACR122U 軟體）實際寫卡 + App 只管現場 walk-in
- **關鍵發現**：`EventNfcBadge.registrationId` nullable+unique → 原生支援「先建 badge 記錄（UNASSIGNED）→ 後續再綁」批量模式
- **交付**：`docs/LinkCard Event related/20260912_LinkCard_Batch_Write_Trigger_Admin_App_Design.md`
- **重啟價值**：**App 的職責邊界已明確**——App 不負責批量，只需 walk-in 寫卡/綁定/補發

### 3. `loop-batch-nfc-api-badge-page.md`（Status: **complete**，2026-09-12）
- **Goal**：Backend 5 個 batch NFC API + Web 後台 Badge 管理頁
- **交付**：backend 5 API + migration + 19 tests；frontend badges/page.tsx + 5 nfc 函數 + i18n
- **smith 審查**：R1 91.5/100 REPAIRABLE → 修復 → R2 **96/100 PASS**
- **重啟價值**：**Backend batch API 已完成部署**，Admin App 可直接消費 `GET /nfc/badges`（已實作）

### 4. `loop-startupfest-readiness-admin-app.md`（Status: **complete**，2026-09-11）
- **Goal**：StartupFest 支援度 + NFC on-site 操作需求
- **核心結論**：Event UI 完成度高（8/17 互動層已補齊）；需 Event 營運工具 → 最終建議新建 Admin App（本 app）
- **交付**：`docs/LinkCard Event related/20260911_LinkCard_Event_StartupFest_Readiness_Admin_App_Research.md`
- **重啟價值**：**業務需求已確認**——現場工具是 StartupFest 2026 的硬需求

### 5. `loop-event-admin-app-dev.md`（Status: **active**，但實質閉合，2026-09-12）
- **Goal**：用 Expo 開發完整 Admin App
- **Iterations**：DISCOVER → PLAN（Engineering Spec）→ EXECUTE（9 commits）→ VERIFY R1（smith 3 次 502 → Neo 自身驗證 → lint 修復）
- **最終交付**：10 commits（scaffold→auth→home→event→check-in→nfc→badges→lint fix）；tsc/eslint/web export 全通過
- **實質閉合原因**：無未修 bug、Circuit Breaker HEALTHY、Budget 0%；標記 active 是因為沒跑過真實 QA agent
- **重啟對策**：**不需要回 PLAN/EXECUTE**；直接進真機驗證（= VERIFY 的實際形式）

---

## B. 根知識庫整合版（建議位置）

若要讓其他專案（Web Frontend / Promoter App / Backend）也能快速了解 Admin App 現狀，
可在根目錄 `docs/LinkCard Event related/` 建立：

```
docs/LinkCard Event related/20260914_LinkCard_Event_Admin_App_Restart_Research_v1.0.md
```

（內容為 README.md + 三份深度報告的精簡整合版；待確認是否需要建立）

---

## C. 完整時間線

| 日期 | 事件 | 交付/狀態 |
|---|---|---|
| 2026-09-11 | Deep Research v2（硬體/業界/架構） | `.edison/state/loop-event-admin-app-research.md` complete |
| 2026-09-11 | StartupFest Readiness | `.edison/state/loop-startupfest-readiness-admin-app.md` complete |
| 2026-09-12 | Batch Write Design（雙軌） | `.edison/state/loop-batch-write-trigger-admin-app.md` complete |
| 2026-09-12 | Backend Batch API + Badge Page | `.edison/state/loop-batch-nfc-api-badge-page.md` complete（96/100 PASS） |
| 2026-09-12 | Admin App 開發（scaffold→badges） | 10 commits + 12 項 web E2E；loop state active |
| 2026-09-13 | `.project-context.md` 快取建立 | Last Updated 2026-09-13 |
| **2026-09-14** | **本研究：重啟導航** | 4 commits（docs/research/*）；Build 實測通過 |
| **重啟 Day 1**（建議） | Badge 批次 + Android 真機 | Step 1-2（~2.5h） |
| **重啟 Day 1-2** | settings 補頁 + iOS + EAS | Step 3-5（~2.5h） |
| **重啟 Day 2-3** | preview build + brand assets | Step 6-7（~2h） |