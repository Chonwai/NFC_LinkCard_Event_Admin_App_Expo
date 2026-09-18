# LinkCard Event Admin App — 現場功能開發（掃碼簽到 + Token + NFC + 名單）

> 指派給：**feiteng2015**（前端工程師）｜ 指派者：LinkCard 團隊
> 建立日期：2026-09-18 ｜ 硬期限：**11月 Macau Startup Festival（澳門創業節）**
> 相關研究：`docs/research/16-feiteng2015-work-packages.md`（完整工作包規格）

---

## 背景

LinkCard Event 生態中，**Admin App 是「現場作戰終端」**（非配置中心）。11 月澳門創業節是硬期限，需以「MVP 優先、可上線」為原則。

現況：**App 骨架已完整**（10 頁面、5 services、design token、auth 閉環、tsc/eslint 全過），但缺三樣：

1. **任何執行期證據**（真機 0／自動化測試 0／EAS build 從未執行）
2. **模組 B（Token 櫃台）與 D（名單）的 App 端 UI 完全不存在**
3. **2 個後端地雷未解**（OPERATOR 403、by-code 限流 429）——會讓模組 A 開場直接 403/429

**交棒結論**（doc 16 §1.1）：✅ 可交「骨架與現場終端補強」；🚫 模組 B/D 功能空白須等後端前置（B-1a/B-6/T-1/B-5）解鎖後才開工。

---

## 目標

1. **WP-A1** EAS Build 驗證（App 從未 build）
2. **WP-A7** 簽到三態強化（震動/大字/音效）
3. **WP-A8** 降級儀表板 + Web check-in 入口修正
4. **WP-A6** NFC 綁定強化（換卡/補發/退卡）
5. **WP-A4** Token 櫃台（Web）— 待 B-1a 解鎖
6. **WP-A5** 名單/搜尋/詳情 — 待 B-6 + T-1 解鎖

---

## 具體任務（依施工順序）

### 第 1 天可開工（零後端依賴，共 ~4.5 人日）

#### ① WP-A1 — EAS Build 驗證（0.5 人日）🔴

- 設定 Expo EAS（`eas.json`）、連接 Expo 帳號（需 Contract P1-6 帳號）
- `eas build -p android` 產出 APK（iOS 需 Apple Developer 帳號，無則跳過）
- 確認 `EXPO_PUBLIC_API_URL` 指向 staging（`https://staging-api.link-card.xyz`）
- **DoD**：EAS build URL + 真機登入截圖

#### ② WP-A7 — 簽到三態強化（2.25 人日）

- 簽到結果頁三態：✅ 有效（姓名/公司/票種/Token）、⚠️ 重複（需主管覆核）、❌ 無效（快速補報名入口）
- 成功：**震動 + 大字綠色畫面 + 音效**（現場嘈雜環境必需）
- 頂部單日/單場次簽到計數
- **DoD**：三態截圖 + 重複簽到覆核流程錄影

#### ③ WP-A8 — 降級儀表板 + Web 入口（1.0 人日）

- 降級版儀表板：報名數/已簽到數/到場率、Token 總發放/消耗
- Web check-in 導覽入口修正（`app/check-in/[eventId]` 目前不可達）
- **DoD**：儀表板截圖 + 導覽路徑實測

### 核心功能（需後端前置解鎖）

#### ④ WP-A6 — NFC 綁定強化（2.0 人日）⚠️ 部分可開工

- 錯誤路徑（無效 tagUid/重複綁定/已綁他卡）可直接做
- 換卡（void 舊卡→綁新卡）、補發、退卡 → **待 WP-N2 後端端點**（阿聰確認）
- **前置**：NFC Gate 1（9/28 spike）、WP-N2
- **DoD**：真機 NFC 綁定/換卡錄影

#### ⑤ WP-A4 — Token 櫃台（Web，7.5 人日）🚫 待 B-1a

- 增值（top-up）快捷金額（+10/+50/+100 後端可配置）、自訂金額、來源標記
- 扣減（deduct）依兌換品項清單、餘額不足置灰
- 交易流水表（時間/操作員/金額/類型/備註）、二次確認
- ⚠️ **動詞用 `deduct`**（不是 `redeem`！）
- **前置**：B-1a（冪等 migration + `initiatedBy` 欄位，用戶本人做後端）
- **DoD**：Web 操作錄影 + 流水表截圖 + 用戶端 App 同步截圖

#### ⑥ WP-A5 — 名單/搜尋/詳情（4.0 人日）🚫 待 B-6 + T-1

- 搜尋（姓名/手機/Email/編號）、篩選（票種/簽到/公司/Token）、排序
- 用戶詳情頁（資料/報名/簽到/Token 流水/NFC/社團）
- 現場補報名（精簡表單 → 觸發 Email）
- **前置**：B-6（search/sortBy，用戶本人）、T-1（OPERATOR 讀取，用戶本人）
- **DoD**：搜尋 3 種條件 + 詳情頁截圖

---

## 參考資源

- **工作包主文件**：`docs/research/16-feiteng2015-work-packages.md`（14 個 WP 完整規格）
- **差距矩陣**：`docs/research/13-app-vs-web-feature-gap-matrix.md`
- **NFC 硬體**：`docs/research/14-nfc-hardware-and-batch-write-research.md`
- **策略路線圖**：`docs/research/15-admin-app-strategic-roadmap.md`
- **API 契約**：`docs/20260915_AdminApp_API_Contract_Freeze_v1.md`
- **Handoff 文件夾**：`docs/handoff/`（README 起手，含踩雷地圖）
- **需求整理**：`docs/LinkCard Event related/20260917_LinkCard_Event_Admin_App_Plan_v1.md`

---

## 環境

- repo：`LinkCard_Event_Admin_App_Expo`（branch `main` / `development`）
- 框架：Expo (React Native) + expo-router + TypeScript + Zustand
- 開發：`npx expo start`（本地）；`npx tsc --noEmit` + `npm run lint`（品質門檻）
- API：staging `https://staging-api.link-card.xyz`（`EXPO_PUBLIC_API_URL`）
- 認證：JWT Bearer（`expo-secure-store`）；**登入必須用 promoter 端點**
- 部署：EAS Build（Android 優先）

---

## DoD（Definition of Done）

- [ ] **WP-A1** EAS build 成功產出可安裝 APK + 真機登入成功
- [ ] **WP-A7** 簽到三態齊備 + 震動/大字/音效 + 重複覆核
- [ ] **WP-A8** 降級儀表板數據正確 + Web check-in 可達
- [ ] **WP-A6** NFC 綁定/換卡/補發流程跑通（待 WP-N2）
- [ ] **WP-A4** Token 增值/扣減/流水/二次確認 + 用戶端同步（待 B-1a）
- [ ] **WP-A5** 搜尋/篩選/排序/詳情/補報名（待 B-6 + T-1）
- [ ] 每個 WP：`tsc --noEmit` 0 error + `lint` 0 error
- [ ] 每個 WP：真機/瀏覽器截圖或錄影（**tsc 過 ≠ 可用**）
- [ ] commit：hackathon 式小步（每子功能一 commit，含 WP 編號）

> ⚠️ **DoD 條件化**：WP-A4/A5/A6 的後端前置（B-1a/B-6/T-1/WP-N2）由用戶本人/阿聰負責；若前置未如期解鎖，改為先做錯誤路徑與 UI 骨架，功能驗證延後。

## 時間錨點

| 日期      | 事件                       | 你的行動             |
| --------- | -------------------------- | -------------------- |
| 09-22     | NFC 硬體最後下單日         | 確認 PM 已下單       |
| 09-28     | NFC Gate 1 spike           | 與用戶本人驗證讀寫器 |
| 10-13     | 工具 Alpha                 | 若做 NFC CLI         |
| 11-12     | 現場演練                   | 提前 3 天彩排        |
| **11-15** | **Macau Startup Festival** | **活動日**           |

## Reference

`20260918_Event_Admin_App_Assign_Notion_Card.md`（本文件）
