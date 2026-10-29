# 05 — 產業對標與契約治理（研究綜述）

三份原始研究收在 `appendix/`：

| 檔案                                         | 內容                                       | 規模               |
| -------------------------------------------- | ------------------------------------------ | ------------------ |
| `appendix/r1-vendor-capability-split.md`     | 6 家廠商的門側 App／Web 後台能力切分       | 450 行 / 53 個來源 |
| `appendix/r2-parity-definition-and-drift.md` | parity 的可操作定義 + 6 個可查證的漂移案例 | 500 行 / 33 個來源 |
| `appendix/r3-contract-governance.md`         | 5 種契約治理方案的比較與排名               | 448 行 / 25 個來源 |

本檔只做**綜合**，不重複引用細節。每一條結論都指回 appendix 的段落。

## 5.1 產業不是「mobile 要覆蓋 web 多少 %」，而是「角色 × 場景」

R1 把六家（Eventbrite、Whova、Cvent、zkipster、Expo Pass、Swapcard）放在一起，
得到一個穩定的四層模型（R1 §5）：

| 層         | 典型能力                                                         | 放在哪             |
| ---------- | ---------------------------------------------------------------- | ------------------ |
| 設定層     | 票種、報名表單、badge 設計、欄位結構、角色權限、settings         | Web                |
| 內容層     | agenda／session 建立、speaker 指派、exhibitor／booth、poll 建立  | Web                |
| 現場執行層 | check-in／out、walk-in、掃描、session 掃描、badge 列印、現場付款 | Mobile／tablet     |
| 參與層     | agenda 瀏覽、poll 作答、Q&A、networking、booth                   | Mobile（可選 Web） |

**這直接推翻了一個常見的錯誤問法**：「App 有沒有做到 Web 的 80%？」
業界沒有在用這個指標。Cvent 講的 parity 是「iOS app 與 Android app 之間」
（R1 §5 引 Cvent Android parity 文件），不是「OnArrival 與 Event Management 之間」。

### 把 LinkCard 的 13 個模組放進這個模型

| LinkCard 模組                | 本輪現況     | 對照業界             | 判定                                                                  |
| ---------------------------- | ------------ | -------------------- | --------------------------------------------------------------------- |
| profile、settings、org roles | Web-only     | 設定層               | **刻意差異**（業界一致）                                              |
| ticket types、content、polls | Web-only     | 設定層／內容層       | **刻意差異**（Swapcard 明文 poll 建立只在 Web）                       |
| exhibitors（+import）        | Web-only     | 內容層＋銷售         | **刻意差異**（六家無一放進門側）                                      |
| sessions（CRUD）             | Web-only     | 內容層               | **刻意差異**                                                          |
| sessions（現場報到）         | **App 沒有** | 現場執行層           | **真缺口**（Cvent／Whova／zkipster／Swapcard／Expo Pass 都有）        |
| bank transfers               | Web-only     | 財務                 | **刻意差異**                                                          |
| badge 設計                   | Web-only     | 設定層               | **刻意差異**                                                          |
| badge 現場列印               | **App 沒有** | 現場執行層           | **待確認是否為需求**（Cvent／zkipster／Expo Pass 都有）               |
| registrations（查詢）        | App 有       | 現場執行層           | 一致                                                                  |
| registrations（有限編輯）    | **App 沒有** | 現場執行層（有條件） | **偏保守**（Cvent 正面允許、Expo Pass 條件允許、zkipster 可新增賓客） |
| check-in、walk-in            | App 有       | 現場執行層           | 一致                                                                  |
| NFC bind／read／exchange     | App 有       | —                    | **不尋常（差異化）**：六家公開文件都以 QR／barcode 為主               |
| token／wallet ledger         | App 有       | —                    | **不尋常（差異化）**                                                  |

### 這張表改變了什麼

本輪在 `02-screen-parity.md` 列為「刻意差異」的 9 個 Web-only 模組，**全部通過產業檢驗**。
不需要為它們辯護，也不需要補做——但需要**寫下來**，否則每季會重新吵一次（R2 §3 的
"intentional difference register"）。

真正該補的是兩個**現場執行層**的東西：**session 現場報到**、以及**有限度的報名資料
編輯**。這兩個不是「Web 有所以 App 也要有」，而是「五家競品都放在現場」。

## 5.2 「parity」的正確單位是 capability，不是畫面

R2 §6 的一句話總結值得整段引用：

> Capability parity 問的是「同一個使用者能不能得到同一個結果」；screen parity 問的是
> 「畫面像不像」；endpoint parity 問的是「有沒有打同一條路」。只有第一個能當審計單位，
> 後兩個是證據。

本輪的三層模型（`00-method-and-scope.md`）與這個結論一致，但順序要修正：

- 我把 **endpoint parity** 放在最前面，因為它**可機械判定**——那是方法上的優先，不是
  重要性上的優先。
- R2 的立場是：**capability 才是審計單位**，endpoint 只是最便宜的那個證據。

兩者不衝突。正確的說法是：**用 endpoint parity 當入口（便宜、客觀），用 capability
parity 當結論（對使用者有意義）。**

## 5.3 三個最可能的漂移，以及各一個量測

R2 §5.2 針對「一個 Expo app + 一個 Next.js app + 同一後端、沒有 generated client」
給出三個 failure mode。對照本輪的實際發現：

| #   | Failure mode                           | 本輪是否已發生   | 證據                                                                                                                           |
| --- | -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 路由／請求契約漂移                     | **已發生**       | `checkin/override` 從未存在（S-1）                                                                                             |
| 2   | 欄位契約漂移（server 有、client 沒接） | **已發生，4 處** | `approvedBy` 反向、`balanceAfter`/`sourceType` 漏接、`depositRefunded*` 全缺、`createRegistration` 付款欄位丟失（S-2/S-3/S-5） |
| 3   | 認證／權限在兩個 client 間分岔         | **已發生**       | Web 用 `my-access` 當閘門、App 完全沒接（S-6/S-7）                                                                             |

三種都中了。這不是巧合——R2 描述的正是「兩個手寫介面層各自演化」的必然結果。

R2 另外指出一個**前提**：要能量測這些，請求必須**可被 client 版本切分**。
也就是每個請求要帶 `X-Client-Platform` 與 `X-Client-Version`。
本輪沒有處理這一項（App 目前沒有送版本標頭），列為後續建議。

## 5.4 契約治理：五個方案的排名

R3 §5.1 的排名（小團隊、Express + Prisma、2+ client）：

| 排名  | 做法                                      | 成本     | 擋什麼                        | 不擋什麼                       |
| ----- | ----------------------------------------- | -------- | ----------------------------- | ------------------------------ |
| **1** | **Route inventory guard**                 | 半天     | client 呼叫不存在的路由       | 欄位形狀漂移                   |
| 2     | Zod 單一來源 → OpenAPI → generated client | 1–3 人日 | 形狀漂移 + 型別不同步         | 行為語意漂移                   |
| 3     | Contract testing（Pact）                  | 數人日   | server 行為不符 consumer 期待 | 未被 consumer 覆蓋的路徑       |
| 4     | BFF                                       | 最高     | client 需求分岔               | 路由消失（BFF 一樣會壞）       |
| 5     | Runtime handshake / capabilities          | 中       | rollout 相容性                | 路由存在性（清單本身會 drift） |

R3 明確否決「現在做 BFF」與「用 `/capabilities` 當 drift 防線」，理由是兩者都不解決
路由消失，而且各自多一份會 drift 的真相。

### 與本輪實作的關係（誠實說明）

我在 R3 產出**之前**就選了 route inventory guard（commit `7c19f0a`），理由是它最便宜
且直接對應到本輪唯一那條 P0。R3 的獨立研究把同一個做法排在第一位。

這是**收斂，不是驗證**：兩者從不同前提出發得到同一個答案，比「我說對」更有說服力，
但不代表這個 guard 已經被實證有效——真正的證據是它的負向測試（把死路由塞回去必須失敗），
見 `tests/backend-contract.test.mjs`。

### R3 指出的下一步（本輪未做）

1. 用 Zod 既有的 request schema 產生 OpenAPI（`@asteasolutions/zod-to-openapi` / `zod-openapi`）。
2. CI 加 `openapi-typescript --check`，確保 generated types 沒過期。
3. 用 Orval／openapi-typescript 產生共用 client，放進 shared package。
4. 對 3–5 條關鍵 endpoint 開啟 response 驗證。

這四步與本輪的 guard 是**互補**的：guard 管「路由存在」，schema 同源管「形狀一致」。

## 5.5 對「功能是否完全一致」這個問題的最終回答框架

把三份研究合起來，這個問題要拆成三句回答：

1. **端點層：應該 100% 一致，而且必須可驗證。**
   本輪修完後是 15/15（含 2 條 auth）。守門的是 `npm run check:contract`。
2. **語意層：應該一致，但只能靠逐欄比對。**
   本輪修了 5 處（S-1、S-2、S-3、S-4、S-7），留下 6 處需要產品決策（見 `04-sync-plan.md`）。
3. **功能層：不該一致。**
   9 個 Web-only 模組是業界標準（R1 §5）；真正該補的是 session 現場報到與有限的報名編輯。

換句話說：**「基本上完全一致」在端點層已經達成；在功能層，正確的目標不是一致，而是
「每一處不同都有理由、都被記錄」。**
