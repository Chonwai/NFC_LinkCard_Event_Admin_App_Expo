# 08 — 附錄：待決策對齊 + UAT + 證據

> 本附錄把會議紀錄的「待決策 7 項」與 v11.3 的「D1-D15」對齊，並提供 UAT 對照與證據清單。

---

## 1. 待決策對齊（會議 7 決策 ↔ v11.3 D 系列）

| 會議決策 | 問題 | 會議建議 | v11.3 對應 | 整合建議 |
|---|---|---|---|---|
| **#1** | 臨時密碼強制修改？ | 不強制，隨機強密碼 + 非阻斷提示 | —（新） | ✅ 採會議建議；需後端隨機密碼產生器 |
| **#2** | 憑證同一套底層機制？ | 統一 Credential 模型 | —（新，但與 v11.0 wallet 概念互補） | ✅ 採統一抽象（F-06），**W1 先做** |
| **#3** | Token 活動專屬/通用？ | 先活動專屬，預留 `scope` | v11.3 §2.1（event-scoped） | ✅ 一致；`scope` 欄位 v11.3 已設計 |
| **#4** | **NFC 綁定邏輯** | 🔴 最高風險，本週定人 | v11.3 OOS（tap-to-deduct 不做） | 🔴 **決策 #4 獨立於 v11.3**——NFC 綁定（發卡）與 tap-to-deduct 不同；前者要做、後者不做 |
| **#5** | Admin App 收款？ | P2，11月只記帳 | v11.3 DEF-13（金額上限） | ✅ 一致：記帳 + UI 預留「已收款」勾選 |
| **#6** | Token 活動後餘額？ | 作廢/兌換截止/轉 LinkCard 點數 | v11.3 §2.3（作廢 + 軟著陸）+ D15 | ✅ 採 v11.3（作廢 + 軟著陸 + 付費殘值報表）|
| **#7** | 多主辦方自助後台？ | 11月代配置，後租戶化 | — | ✅ 一致（P2 G-06） |

**v11.3 新增決策（D1-D15 中會議未涵蓋的關鍵項）**：
- **D1**：HK SVF 定性（multi/single-purpose）— 需律師意見
- **D5**：Stripe 定性
- **D7**：自助 top-up 去留（v11.3 建議移除）
- **D12**：OPERATOR 錢包檢視權
- **D13**：Token 對外用語
- **D14**：top-up 金額上限（建議單筆 MOP 1,000 / 每日 MOP 5,000）

---

## 2. UAT Checklist（合併會議 + v11.3）

| # | 驗收項 | 來源 |
|---|---|---|
| 1 | 非會員報名後 60 秒內收到含帳密 + QR 的 Email | 會議 |
| 2 | 已存在會員報名後不收密碼，僅確認信 + QR | 會議 |
| 3 | 掃 QR 1.5 秒內顯示正確簽到狀態 | 會議 |
| 4 | 已簽到者再次掃碼，明確提示「重複」且需權限覆核 | 會議 |
| 5 | Token 增值/扣減後用戶端 3 秒內同步 | 會議 + v11.3 AC-09 |
| 6 | 餘額不足無法扣減 | 會議 + v11.3 AC-10 |
| 7 | 所有 Token 操作可追溯操作員與時間 | 會議 + v11.3 AC-11 |
| 8 | 無網路時掃碼有明確錯誤提示 | 會議 |
| 9 | 四語言（繁/簡/英/葡）無溢出、無漏翻 | 會議 |
| 10 | 連續操作 2 小時無記憶體洩漏/相機崩潰 | 會議 |
| 11 | Admin App 可在真機完成 top-up/redeem/adjust 並看到審計欄位 | v11.3 AC-09 |
| 12 | T1 後 balance 回傳 `frozen: true`，前端顯示到期 banner | v11.3 AC-13 |

---

## 3. 證據清單（file:line）

| 證據 | 位置 |
|---|---|
| Admin App `QUICK_ACTIONS`（check-in/nfc/badges，需加 wallet） | `LinkCard_Event_Admin_App_Expo/src/app/(auth)/[eventId]/overview.tsx:27-30` |
| `check-in.tsx` 已支援 QR + 手動 + 錯誤映射 | `LinkCard_Event_Admin_App_Expo/src/app/(auth)/[eventId]/check-in.tsx:1-60` |
| `event.service.getRegistrations` 已存在 | `LinkCard_Event_Admin_App_Expo/src/services/event.service.ts:50` |
| overview 已消費 getRegistrations | `overview.tsx:56-57` |
| v11.3 wallet-counter 規格 | `LinkCard_ExpressJS_Backend/docs/development-cycles/v11.3-event-token-system/04-design-plan.md §5.2` |
| v11.3 P0-09 工期 2.0 人日 | 同上 §7.1 |
| v11.3 OOS（tap-to-deduct/離線/線上購買） | 同上 §5.4 |
| v11.3 權限收緊（P0-04） | 同上 §4.3 |
| 會議紀錄（7 模組/12 頁/7 決策/排期/UAT） | `docs/LinkCard Event related/20260914_LinkCard_Event_Admin_App_Meeting_1.md` |
| 交接藍圖（Sprint/差距矩陣） | `LinkCard_Event_Admin_App_Expo/docs/research/05-handover-blueprint.md` |

---

## 4. 戰略層整合（會議 §十 + v11.3）

| 戰略鉤子 | 會議建議 | 落地功能 | 數據埋點 |
|---|---|---|---|
| **會員獲取機器** | NFC 手帶 = Business Card 實體入口 | F-06 Credential + NFC 綁定 | 註冊轉化率 |
| **Token 激活留存** | Token 強迫反覆打開 App | F-02 wallet-counter | 活動後 30 天留存/DAU |
| **線下商業網絡** | 名片交換 + B2B 配對 + 通用積分 | G-05（P2） | NFC 名片交換次數 |

> **三個數據鉤子**（會議 §十）：① 註冊轉化率 ② 30 天留存/DAU ③ NFC 名片交換次數——建議在 v11.3 報表 + 儀表板中埋點。