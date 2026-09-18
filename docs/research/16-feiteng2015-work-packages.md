# 16 — feiteng2015 施工工作包（階段化交棒）

> **文件類型**：規劃部 PLAN 階段交付物 — 工程規格撰寫者（Maker）
> **產出日期**：2026-09-18 ｜ Loop: `loop-adminapp-work-packages`
> **品質合約**：strict（Pass Threshold 93）/ L3 Deep Dive ｜ **Round 1/2**
> **交付目標**：直接交給 feiteng2015 施工的階段化工作包文件，回答「現有 App 可否交棒開發？交什麼？什麼順序？」
> **證據基準**：doc 13 `e3c68b8` / doc 14 `fe2ec4f` / doc 15 `0777210` / Handoff v1.0-r5 / Contract v1.0-r4 / Plan v1（模組 A–G）
> **Snapshot Cache**：`docs/.project-context.md` **STALE（LOCATOR-ONLY）**——關鍵結論一律引用 doc 13/14/15 實際內容
> **文件狀態**：撰寫中（§1–§5 依序交付，每節 hackathon commit）

---

## §1 交棒結論（一句話 + 全景表）

### 1.1 一句話回答

> **現有 App 可交棒開發，但只可交「骨架與現場終端補強」，不可交「模組 B/D 的功能空白」——後者必須等後端前置（B-1a / B-6 / T-1 / B-5）解鎖後才開工。**

此結論直接承接 doc 13 §6.1：「**現有 App 已具備『骨架交棒』條件，但尚未具備『功能交棒』條件。**」骨架（10 頁面、5 service、design token、auth 閉環、tsc/eslint 全過）品質足以讓工程師立刻開工；但缺三樣東西：① 任何執行期證據（真機 0 / 自動化測試 0）；② 模組 B（Token 櫃台）與 D（名單）的 App 端 UI **完全不存在**；③ 一個會計入關鍵路徑的後端前置（`by-code` 限流，T-2）未解，會讓模組 A 在開場尖峰直接 429。

doc 15 §2.1 已將 11 月範圍裁決為：**模組 A/B/C/D/F 納入、模組 E 延後、模組 G 用降級版**。本文件依此裁決，把 doc 13 的缺口罩（B-1a/B-5/B-6/B-7/B-8/T-1/T-2/M-3/M-4/N-2 等）轉譯為 **14 個編號連貫的工作包（WP-A1..A8 / WP-N1..N2 / WP-B1..B4）**。

### 1.2 全景表

> 缺口罩來源：doc 13 §3（逐模組缺口）、§4.2（T-1/T-2 真地雷）、§6.2/6.3（可交棒 / 須先解前置）。階段定義來源：doc 15 §2（Phase A/B/C）。

| 工作包 | 對應模組 | 階段 | 缺口來源（doc 13） | 可交棒？ | 前置依賴 | 負責人 | 人日 |
| :-: | :-: | :-: | --- | :-: | --- | :-: | :-: |
| **WP-A1** | F-08（EAS） | Phase A 硬前導 | §6.3「EAS build 從未執行」🔴；U-5 | ⚠️ 可開工，**需 Expo 帳號** | Contract P1-6 | feiteng2015 | 0.5 |
| **WP-A2** | F（權限） | Phase A 硬前導 | §4.2 **T-1**（OPERATOR 403，1 行修復）🔴 | ✅ 可立即開工 | 無（裁決 C-4 建議 (a)） | 用戶本人（後端） | 0.1 |
| **WP-A3** | A（簽到） | Phase A 硬前導 | §4.2 **T-2**（by-code 限流 429）🔴 **阻斷模組 A** | ✅ 可立即開工 | 裁決 C-3 建議 (a) | 用戶本人（後端） | 0.7 |
| **WP-A4** | B（Token 櫃台，Web） | Phase A 核心 | §3.2（兩端 UI 皆空白）、§6.3 **B-1a** 🔴、M-3/M-4 | 🚫 **待 B-1a** | **B-1a**（冪等 migration + 強化）、B-1b（調整 tab） | feiteng2015 + 用戶本人 | 7.5 |
| **WP-A5** | D（名單/搜尋/詳情） | Phase A 核心 | §3.4、§6.3 **B-6**、T-1 | 🚫 **待 B-6 + T-1** | B-6（search/sortBy）、T-1（OPERATOR 讀取）、C-9（NFC-08） | feiteng2015 + 用戶本人 | 4.0 |
| **WP-A6** | C（NFC 綁定頁） | Phase A 核心 | §3.3（換卡/補發/退卡四端皆無）、§6.2 | ⚠️ 部分可開工（錯誤路徑）；換卡待後端 | NFC Gate 1（9/28）；WP-N2（換卡端點） | feiteng2015 | 2.0 |
| **WP-A7** | A（簽到三態強化） | Phase A 強化 | §3.1、§6.2（W-26 補完、W-28）、T-3 | ✅ 大部分可開工 | C-10（音效套件）；WP-A3（B-5，現場可用） | feiteng2015 | 2.25 |
| **WP-A8** | G（降級儀表板）+ Web 入口 | Phase A 強化 | §6.2（降級版已可用）、**N-2**（Web check-in 不可達） | ✅ 可立即開工 | 無 | feiteng2015 | 1.0 |
| **WP-N1** | C（桌面寫卡 CLI） | Phase A（NFC 工具鏈） | doc 14 §5.5/§6（工具鏈結構）；§8.3 Gate 1–2 | 🚫 **待 NFC Gate 1**（9/28 spike） | 讀寫器到貨（9/22 下單）；Gate 1 通過 | 用戶本人 | 3.0 |
| **WP-N2** | C（batch 契約 + 換卡端點） | Phase A（NFC 工具鏈） | doc 14 §5.2 **U-1**（complete 格式未確認）；doc 13 §3.3（無作廢/退卡端點） | 🚫 **待實測確認** | 阿聰確認 batch 契約（9/28） | 阿聰 + 用戶本人 | 1.0 |
| **WP-B1** | E（Credential） | Phase B | §3.5（模型確認不存在）、§6.4（建議延後） | 🚫 **Phase B**（11 月不做，釋放 2.0 BE 人日） | B-8（`EventCredential` 模型） | 用戶本人 + feiteng2015 | 2.5 |
| **WP-B2** | F（權限分層） | Phase B | §3.6（無角色感知 UI）、N-3（資料層已通） | 🚫 **Phase B**（11 月用降級：共用帳號） | B-4（VOLUNTEER 定義）；D12/G-2 裁決 | feiteng2015 + 用戶本人 | 2.25 |
| **WP-B3** | G（完整儀表板） | Phase B | §3.7（無 stats 端點）、§6.3 **B-7** | 🚫 **Phase B**（11 月用降級版） | B-7（`/checkin-stats`）+ aggregate 端點 | 用戶本人 + feiteng2015 | 4.5 |
| **WP-B4** | 多語言（繁/簡/英/葡） | Phase B | doc 15 §2.2 **B-P2**；Contract §7（無 i18n 基建） | ✅ 可先行抽 i18n（批次 1–3 繁中已集中 `copy.zh-TW.ts`） | 翻譯資源；Phase A 文案凍結 | feiteng2015（+ 外部翻譯） | 4.0 |

### 1.3 交棒判定速覽

| 判定 | 工作包 | 說明 |
| :-: | --- | --- |
| ✅ **可直接交棒（零後端依賴）** | WP-A1、WP-A2、WP-A3、WP-A8、WP-A7（大部分） | 第 1 天即可開工（doc 13 §6.2 清單對應） |
| ⚠️ **部分可交棒** | WP-A6 | 錯誤路徑可直接做；換卡/補發需 WP-N2 後端端點 |
| 🚫 **須先解前置** | WP-A4（B-1a）、WP-A5（B-6+T-1）、WP-N1（Gate 1）、WP-N2（契約確認） | 前置清單見 §3 拓撲排序 |
| ⏭️ **Phase B 再做** | WP-B1..B4 | 11 月活動不承諾（doc 15 §2.2） |

### 1.4 與既有文件的對應關係（避免 feiteng2015 迷失）

| 本文件工作包 | Handoff W-ID（§4） | Contract 端點/裁決 | 後端施工項 |
| :-: | --- | --- | --- |
| WP-A1 | W-06 | P1-6（Expo 帳號） | — |
| WP-A2 | W-03/W-30 前置 | REG-01；C-4 | T-1（`getEventWriteAccess`→`getEventOperatorAccess`，doc 13 §4.2） |
| WP-A3 | W-21/W-26 前置 | CHK-01；C-3 | B-5（限流改 key，`registrations.routes.ts:12-26`） |
| WP-A4 | W-20..W-25、W-22b | WAL-01..10；C-5/C-6 | **B-1a**（冪等 migration + M-3）、**B-1b**（adjust + M-4） |
| WP-A5 | W-03、W-04、W-05 | REG-01/02；C-1/C-2/C-9 | B-6（search/sortBy/sortOrder）、C-9（NFC-08） |
| WP-A6 | W-07、W-15 | NFC-01..08；C-9 | WP-N2（換卡/補發/退卡端點） |
| WP-A7 | W-26、W-27、W-28 | CHK-02/03；C-6/C-10 | B-2（override）、B-3（gateId） |
| WP-A8 | W-29（降級）、W-02 | CHK-04；C-7/C-12；N-2 | B-7（或 fallback） |
| WP-N1 | W-07（staging 驗證） | NFC-03..07 | —（桌面工具） |
| WP-N2 | — | NFC-06；doc 14 U-1 | `/nfc/batch/complete` 契約確認 + 換卡端點 |
| WP-B1 | W-31 | CRD-01；C-13 | B-8（`EventCredential` 模型） |
| WP-B2 | W-30 | G-1/G-2；C-4/C-5 | B-4（VOLUNTEER 定義） |
| WP-B3 | W-29（完整版） | CHK-04 | B-7 + aggregate 端點 |
| WP-B4 | §6 多語言 | §7 落差 | — |

> 若 Handoff 的 W-ID 行號與本文件衝突，**以函式名/路由字串為準**（Handoff TL;DR #15 與 Contract §2 自我聲明）。

---

<!-- 續寫 §2 工作包流水 -->
