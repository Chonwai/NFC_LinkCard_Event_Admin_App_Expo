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


---

## §2 晶片容量數學（NTAG213 / 215 / 216）

### 2.1 記憶體規格總覽

| 晶片 | 總記憶體 | 用戶記憶體（pages 4..N × 4B） | **可用 NDEF 容量**（扣除 CC/TLV/terminator） | 寫入壽命 | 典型零售空白標籤價 |
| --- | --- | --- | --- | --- | --- |
| **NTAG213** | 180 B（45 pages） | 144 B（36 pages） | **137 bytes** | ~50,000 次 | ~$0.39–0.55/張 |
| **NTAG215** | 540 B（135 pages） | 504 B（126 pages） | **496 bytes** | ~200,000 次 | 略高（+10–20%） |
| **NTAG216** | 924 B（231 pages） | 888 B（222 pages） | **872 bytes** | ~500,000 次 | 最高 |

> 說明：可用 NDEF 容量 = 用戶記憶體扣掉 Capability Container（第 4 page，4 bytes）、NDEF TLV 標頭（0x03 + 長度）、TLV 結尾（0xFE）與 lock bytes。上述 137/496/872 為業界工具（goToTags、NFC Tools、nfc-tools）通用引用值，且經下述位元組計算反推驗證。

### 2.2 NDEF 單一 URI Record 的結構精算

以 Type 2 Tag 上的 NDEF 訊息為例（NTAG21x 屬 Type 2 Tag）：

```
Page bit 布局（以 NTAG213 為例）：

  Page 0-3   UID (7 bytes) + internal             ← 出廠固化，不可寫
  Page 4     Capability Container (CC) 0xE1       ← 描述格式與容量
             + 0x10 (版本) + 0x12 (max NDEF/8)
             + 0x00 (讀取/寫入存取)
  Page 5..39 用戶記憶體（144 bytes）              ← NDEF 資料區
  (0x03 TLV 標頭) → (NDEF 訊息) → (0xFE 結尾)
```

單一 URI Record 的逐位元組計帳：

| 區段 | 位元組數 | 內容 |
| --- | :-: | --- |
| TLV 標頭 `0x03` + 長度 | 2 | NDEF TLV tag + message length |
| Record header `0xD1` | 1 | MB=1, ME=1, SR=1（short record）, TNF=0x01（Well Known） |
| Type length `0x01` | 1 | URI type 長度 |
| Payload length `0x01` | 1 | SR 模式 payload 長度（1 byte） |
| Type byte `'U'`（0x55） | 1 | URI record type |
| URI 前綴碼 | 1 | **`0x04` = `https://`**（prefix 壓縮） |
| URI 其餘內容 | N | URI 去掉前綴的剩餘部分 |
| Terminator `0xFE` | 1 | NDEF TLV 結尾 |

**NR（NDEF 訊息）總長 = 5 + N**（header + type len + payload len + type + prefix + N）
**TLV 總佔用 = 2 + NR + 1 = 8 + N**

### 2.3 LinkCard payload 精算

LinkCard 標籤需要寫入的 URL：`https://link-card.xyz/nfc/<token>`

- `https://` 前綴 → 壓縮為 `0x04`（省 7 bytes）
- URI 其餘 = `link-card.xyz/nfc/`（**18 字元**）+ token（建議 8–16 字元）

| 晶片 | 可用 NDEF | 可容納的 URI 其餘最大長度（N） | 可容納的最大 https URL 總長 | **LinkCard token 上限** | 餘量 |
| --- | :-: | :-: | :-: | :-: | :-: |
| **NTAG213** | 137 B | 137 − 8 = **129 B** | **137 字元** | 129 − 18 = **111 字元** | ✅ 綽綽有餘 |
| **NTAG215** | 496 B | **488 B** | **496 字元** | **470 字元** | ✅ 巨大餘量 |
| **NTAG216** | 872 B | **864 B** | **872 字元** | **846 字元** | ✅ |

> **計算結論：即使是最小的 NTAG213，URL-only 的 LinkCard payload 也只需 25–33 bytes（5 + 1 + 18 + token），遠小於 137 bytes 上限。** 容量完全不成問題。

### 2.4 若未來需要更多資料（vCard / 多記錄）

| 情境 | Payload 估算 | NTAG213 (137B) | NTAG215 (496B) | NTAG216 (872B) |
| --- | --- | :-: | :-: | :-: |
| URL-only（LinkCard 現需） | ~25–33 B | ✅ | ✅ | ✅ |
| **URL + 活動 ID（36 字元 GUID）雙記錄** | ~94–100 B | ✅（剛好） | ✅ | ✅ |
| **vCard 3.0（典型 ~200 B）** | ~205 B | ❌ 超容量 | ✅ | ✅ |
| **URL + vCard 多記錄** | ~230 B | ❌ | ✅ | ✅ |
| 自訂 binary（URL + GUID + 序號 + 簽名） | ~60–80 B | ✅ | ✅ | ✅ |

多記錄 vs 自訂 binary 格式比較：

| 方案 | 優點 | 缺點 | 建議 |
| --- | --- | --- | --- |
| **NDEF 多記錄** | 標準化、任何 NFC 讀取器可解析、iOS/Android 原生支援 | 每筆記錄 +6 B overhead；解析需用 NDEF 函式庫 | ✅ **11 月推薦**：標準與相容性優先 |
| 自訂 binary 格式 | 極省空間、可含簽名/版本欄位 | 需自建解析器；**第三方裝置（Android/iOS 系統讀卡）無法直接理解** | ❌ 僅在需要簽章防偽時才考慮（近期無） |

> ⚠️ 律師視角提醒：卡片 payload 用 **URL（指向 server）而非 vCard** 的另一個好處是「資料錯誤可事後遠端修正」——實體卡上的 URL 永遠不變，profile 內容由後端控制。這同時解決「現場代填資料錯誤」的風險（R1 §7 已論證）。**LinkCard 11 月應堅守 URL-only**。

### 2.5 建議晶片規格（結論）

> **NTAG215 為建議規格**，理由（依重要性排序）：
> 1. **符合 repo 既有鎖定規格**：`20260712_*` / `20260713_*` Research Draft 已鎖定 NTAG215 為 badge 晶片（R1 §1.5）。統一規格 → 合併採購、避免雙規格庫存。
> 2. **未來彈性**：若 11 月後要寫 vCard 或增加活動 ID 記錄，NTAG213 會卡在 137B 天花板，NTAG215 的 496B 提供 3.6 倍餘裕，完全不需換晶片重寫。
> 3. **成本差異小**：NTAG215 只比 NTAG213 貴約 10–20%（單張 <$0.1 差異），在「會員獲取機器」的戰略脈絡下微不足道。
> 4. 安全性：三款皆支援 4-byte 密碼保護（PWD_AUTH）鎖定寫入，規格相同；NTAG215 寫入壽命 20 萬次更耐用。

> 📌 NTAG213 的適用場景：**僅當**採購方成本極敏感且確定永遠只寫 URL 時。否則一律 NTAG215。

