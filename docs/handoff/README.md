# 📂 Event Admin App — 工程師 Handoff 文件索引

> **為誰而寫**：feiteng2015（前端工程師）
> **建立日期**：2026-09-18
> **基準 commit**：`main` @ `3ff0b2c`
> **品質合約**：strict 93 / L3 Deep Dive
> **Loop State**：`loop-adminapp-vs-web-gap-strategy`（4 份研究 + 14 個工作包 + VERIFY PASS）

---

## 🎯 三件事你要先知道

1. **這是一個「會員獲取機器」**，不只是活動管理工具。11 月澳門創業節是驗證機會。
2. **App 的定位是「現場作戰終端」**（掃碼簽到 + NFC 發卡 + Token 增扣 + 名單查詢），不是配置中心（那是 Web 的事）。
3. **你第 1 天就能開工 WP-A1/A2/A3/A8/A7**（共 4.5 人日，零後端依賴）。模組 B/D 須等後端前置解鎖。

---

## 📖 閱讀順序（建議按順序）

|  #  | 文件                                                               | 重點                                          | 預估時間 |
| :-: | ------------------------------------------------------------------ | --------------------------------------------- | :------: |
|  1  | [`00-OVERVIEW.md`](./00-OVERVIEW.md)                               | 為什麼做這個 App、端的分工、11 月時程         |  5 分鐘  |
|  2  | [`01-FUNCTIONAL-SUMMARY.md`](./01-FUNCTIONAL-SUMMARY.md)           | 模組 A–G 功能摘要、P0/P1 優先級               | 10 分鐘  |
|  3  | [`02-API-CONTRACT-GUIDE.md`](./02-API-CONTRACT-GUIDE.md)           | 認證模型、Base URL、已知端點清單、⚠️ 地雷     | 10 分鐘  |
|  4  | [`03-DEVELOPMENT-GUIDE.md`](./03-DEVELOPMENT-GUIDE.md)             | Repo 結構、branch 策略、commit 慣例、測試指引 |  5 分鐘  |
|  5  | [`04-KNOWN-PITFALLS.md`](./04-KNOWN-PITFALLS.md)                   | **必讀**：5 個踩雷地圖 + 踩了怎麼辦           |  5 分鐘  |
|  6  | [`05-WORK-PACKAGES-QUICK-REF.md`](./05-WORK-PACKAGES-QUICK-REF.md) | 14 個工作包速查表 + 施工順序                  |  5 分鐘  |

---

## 📚 完整研究文件（深入時查閱）

| 文件              | 路徑                                                   | 用途                                          |
| ----------------- | ------------------------------------------------------ | --------------------------------------------- |
| doc 13 差距矩陣   | `research/13-app-vs-web-feature-gap-matrix.md`         | App/Web/Backend 逐模組差距 + stale claim 更正 |
| doc 14 NFC 硬體   | `research/14-nfc-hardware-and-batch-write-research.md` | ACR122U/NTAG215 評估 + 批次架構               |
| doc 15 策略路線圖 | `research/15-admin-app-strategic-roadmap.md`           | 三階段路線 + 風險 + 排期                      |
| doc 16 工作包     | `research/16-feiteng2015-work-packages.md`             | 完整工作包規格（WP-A1..B4）                   |
| API 契約          | `20260915_AdminApp_API_Contract_Freeze_v1.md`          | 全端點清單 + request/response 契約            |
| 交接文件          | `20260915_AdminApp_Handoff_for_feiteng2015.md`         | 既有 W-01..W-32 工作項 + B/C 編號             |

---

## 🔴 最重要的三個時間節點

| 日期      | 事件                   | 你的行動                  |
| --------- | ---------------------- | ------------------------- |
| **09-22** | NFC 硬體最後下單日     | 確認 PM 已下單            |
| **09-28** | NFC Gate 1 spike       | 與用戶本人一起驗證讀寫器  |
| **11-15** | Macau Startup Festival | 活動日（需提前 3 天彩排） |
