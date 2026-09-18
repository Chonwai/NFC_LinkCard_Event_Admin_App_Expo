# LinkCard Event — NFC 硬體方案與批次寫入架構深度研究

> 產出日期：2026-09-18 ｜ Loop: `loop-adminapp-vs-web-gap-strategy`
> 品質合約：strict（threshold 93）/ L3 Deep Dive
> 報告類型：外部硬體 × 批次寫卡架構 × 成本供應 × 決策建議

---

## §1 決策問題定義 + 既有研究覆蓋盤點

### 1.1 本文件要回答的 6 個決策問題

| # | 決策問題 | 關聯模組 | 決策後果 |
| --- | --- | --- | --- |
| Q1 | **NFC 寫卡可行性**：ACR122U（或替代方案）能否在 macOS 上可靠地批量寫入 NTAG 標籤？ | 模組 C（NFC 發卡綁定） | 決定 11 月活動是否包含 NFC 寫卡功能 |
| Q2 | **容量充足性**：NTAG213/215/216 的記憶體是否足以容納 LinkCard 所需的 NDEF payload？ | 模組 C | 決定採購哪款晶片 |
| Q3 | **Mac 工具鏈**：Node.js `nfc-pcsc` 是否能在 macOS（含 Apple Silicon）上穩定運行？驅動相容性如何？ | 批次工具 | 決定開發工具棧與最低 Mac 版本要求 |
| Q4 | **批次架構**：Web 後台 ↔ 桌面工具 ↔ Backend API 的端到端流程如何設計？ | Web + Backend + 桌面工具 | 決定工程實作方案 |
| Q5 | **成本與到貨期**：以 2026-09-18 起算，最後可接受下單日是什麼時候？ | 採購與物流 | 決定採購行動 Deadline |
| Q6 | **降級路徑**：若 NFC 方案失敗或來不及，11 月活動怎麼辦？ | 全局 | 決定 Plan B 的觸發條件 |

### 1.2 既有研究覆蓋盤點

| # | 檔案 | 行數 | 覆蓋範圍 | 與本文件的差異 |
| --- | --- | --- | --- | --- |
| R1 | `docs/LinkCard Event related/20260815_LinkCard_NFC_Onboarding_App_Research_v1.0.md` | 441 | iOS Core NFC / Android NFC / 微信小程序 NFC 限制 / 臨時帳號設計 / 合規分析 / 競品分析 | 聚焦**手機端** NFC（App 寫卡 vs 小程序限制），**未覆蓋** USB 讀寫器（ACR122U）的詳細評估、macOS 驅動分析、批次架構 |
| R2 | `docs/LinkCard Event related/20260817_LinkCard_Phase0_Spike_S1_NFC_Research_v1.0.md` | ~100 | NFC spike 快速驗證 | 早期 spike，**內容已被 R1 與 R3 超越** |
| R3 | `docs/LinkCard Event related/20260912_LinkCard_Batch_Write_Trigger_Admin_App_Design.md` | 258 | 批量寫卡觸發位置 + Admin App 雙軌設計 + Backend API 設計 + 路線圖 | **最相關的既有研究**——已定義「Web 管批次 + 桌面工具寫卡 + App 管現場」的三軌架構、5 個 Backend 新端點、桌面工具技術建議。但：(a) ACR122U 評估停留在「知識庫推論」而非實測；(b) 未覆蓋替代方案比較表；(c) 未覆蓋成本供應鏈與到貨期；(d) 未覆蓋晶片容量精算（僅提 NTAG215） |

### 1.3 本文件的增量價值

本文件在 R3 基礎上補充以下 **四個未覆蓋區塊**：

1. **NTAG213/215/216 位元組級容量精算**（含 NDEF overhead、URI prefix 壓縮、多記錄格式比較）
2. **ACR122U × macOS 深度評估**（PC/SC driver、Apple Silicon 兼容性、已知坑、替代方案比較表帶價格）
3. **批次寫卡工具鏈完整實作路徑**（Node.js CLI 架構、冪等性、序號管理、與 Backend `/nfc/batch*` 端點的精確對接）
4. **成本供應鏈與到貨期倒推**（含最後可接受下單日）

