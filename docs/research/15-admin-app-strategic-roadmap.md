# LinkCard Event Admin App — 長遠策略路線圖

> **文件類型**：規劃部 PLAN 階段交付物 — 三階段策略路線圖
> **產出日期**：2026-09-18 ｜ Loop: `loop-adminapp-strategic-roadmap`
> **品質合約**：strict（Pass Threshold 93）/ L3 Deep Dive
> **交付目標**：供 feiteng2015 與用戶決策 11 月活動的整體方向
> **證據基準**：doc 13 `e3c68b8` / doc 14 `fe2ec4f` / Plan v1 v1.0-r5 / Handoff v1.0-r5
> **文件狀態**：§1 願景與定位（1/5）

---

## §1 願景與定位

### 1.1 一句話願景

> **LinkCard Event Admin App 不是活動管理工具，而是一台「線下會員獲取機器」。**

此願景直接來自 Plan v1 §十（`docs/LinkCard Event related/20260917_LinkCard_Event_Admin_App_Plan_v1.md`，`:280-301`）：

> 「這不是一個活動管理工具，而是一台『會員獲取機器』。」
> 「獲客路徑：主辦方的活動流量 → LinkCard 註冊用戶。LinkCard 不需自己買量，靠澳門創業節這類活動零成本沉澱真實 B 端用戶。」

NFC 手帶是這台機器的物理載體——「活動結束、手帶被留下來，它同時是 LinkCard 電子名片的實體入口。用戶每次被問『你係邊個』，碰一下就是產品曝光」（Plan v1 `:287-289`）。

### 1.2 四端定位（實測驗證）

doc 13 §2.1 以實測驗證了 Plan v1 §一（`:8-21`）的端分工原則：

| 端 | 定位 | 主要使用者 | 11 月交付範圍 | 核心限制 |
| --- | --- | --- | --- | --- |
| **Admin App**（Expo） | 現場作戰終端 | 現場工作人員 / 攤位 / 督導 | 模組 A（QR 簽到）、C（NFC 發卡）、G（降級統計） | Android-only NFC；無名單頁；無 Token 頁 |
| **Admin Web**（Next.js） | 配置／管理中樞 | 主辦方 / 運營 | 模組 D（名單）、F（org-roles）、B（Token 櫃台建議） | 無 NFC 讀寫；check-in 路由不可達 |
| **Backend**（Express + Prisma） | 唯一真相來源 | — | A/B/C/D/F 端點 | `checkin-stats` 不存在；`EventCredential` 未建 |
| **Hardware**（NFC 卡／手帶） | 實體載體 | — | C（發卡） | 需 Android 裝置 + NDEF 預格式化 |

> 證據來源：doc 13 §2.1「四端定位對照」表；doc 13 §2.2-2.4 逐端實測；doc 13 §5.5「責任分工建議」。

**關鍵發現：App 的不可替代性在 NFC，不在掃碼。** Web 已有可用的相機掃碼簽到（`@yudiel/react-qr-scanner`，doc 13 §5.3），App 的獨佔功能是 NFC 寫卡（doc 13 §5.3「平台不可能——Web 無 NFC 讀寫」）。但多數功能應「雙端共用同一 API、UI 各自最適化」（doc 13 §5.4）。

### 1.3 11 月活動的成敗定義（KPI 導向）

Plan v1 §十（`:291-297`）明確要求埋下三個數據鉤子：

| # | 數據鉤子 | 為什麼重要 | 衡量方式 | 對應功能模組 |
| :-: | --- | --- | --- | --- |
| **KPI-1** | **註冊轉化率**（報名 → 成為 LinkCard 正式用戶） | 證明「活動即獲客」的商業假說 | 後台: 臨時帳戶轉正式帳號的比例 | A（簽到）+ D（補報名） |
| **KPI-2** | **活動後 30 天留存 / DAU** | Token 強迫用戶反覆打開 App，「註冊即活躍」 | 後台: 30 日 DAU / 報名人數 | B（Token）+ C（NFC 常用入口） |
| **KPI-3** | **NFC 名片交換次數** | 證明「線下硬體反向為線上導流」的結構 | NFC `/exchange` 端點計數（`event-ops.routes.ts:63`） | C（NFC 交換） |

**11 月活動的成敗判定**：

| 維度 | 成功基準 | 失敗基準 |
| --- | --- | --- |
| **功能** | QR 簽到 + Token 增扣 + NFC 發卡（降級可 QR）三閉環走通 | 簽到或 Token 任一環節無法運營 |
| **效能** | 掃碼 → 結果 ≤ 1.5s；5 分鐘 500 人開場不癱瘓 | 尖峰 429 導致排隊 > 3 分鐘 |
| **數據** | 三個 KPI 鉤子成功埋入且可回溯 | 任一 KPI 因功能缺失無法收集 |
| **降級** | NFC 失敗 → QR 手帶仍可完成全流程 | QR 降級亦無法運營（如限流 429） |

### 1.4 現況錨定（2026-09-18 實測）

| 層級 | 現況 | 信心等級 | 關鍵缺口 |
| --- | --- | :---: | --- |
| **App 骨架** | 10 頁面、5 service、design token、auth 閉環、tsc/eslint 全過 | ✅ 高 | 真機 0 / EAS build 0 / 自動化測試 0（doc 13 §2.5） |
| **Web 全功能** | 12 項管理頁面已實作；registrations 頁 1256 行 | ✅ 高 | check-in 路由在導覽中不可達（doc 13 N-2）；名單無搜尋/排序 |
| **Backend 端點** | A/B/C/D/F 模組端點齊全且已掛載 | ✅ 高 | OPERATOR 403（T-1）、by-code 限流 429（T-2）、checkin-stats 缺（B-7） |
| **NFC 硬體方案** | NTAG215 已定、ACR122U/1252U 已評估、桌面工具棧已選（Node.js + nfc-pcsc）| ✅ 高 | 讀寫器未採購（最後下單日 9/22）、spike 未做（Gate 1） |
| **交接文件** | Handoff v1.0-r5 + Contract Freeze v1 已就緒 | ✅ 高 | 5 處欄位漂移已標記（doc 13 §4）；3 個地雷仍成立（T-1/T-2/T-3） |

> 證據來源：doc 13 §6.1「一句話回答」——「App 已具備骨架交棒條件，但尚未具備功能交棒條件」；doc 13 §2.5「執行期證據的共同缺口」；doc 14 §4「替代方案比較表」；doc 13 §4「stale claim 更正表」。

### 1.5 本文件的策略框架

本路線圖以 **三階段** 展開：

```
Phase A（11 月 MVP）→ 11 月 Macau Startup Festival 首次實戰驗證
Phase B（12 月–2027 Q1）→ 補齊核心功能、跨平台完善、運營優化
Phase C（2027 Q2+）→ 戰略升級：NFC 社交 + B2B 配對 + 通用積分 + 多租戶
```

每階段的設計原則：
1. **Codebase Reality First**：所有範圍判定基於 doc 13 的實測差距矩陣，非理想規格
2. **Gate-Driven**：NFC 路線依 doc 14 §8.3 的 4 個 Gate 判定，不賭
3. **降級優先**：每個階段都有明確的降級路徑（doc 14 §8.2），確保最壞情境仍可交付
4. **KPI 導向**：三個數據鉤子貫穿三階段，每階段都需驗證或延伸

