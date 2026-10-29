# R3 — 多客戶端後端的 API contract 治理

> 範圍：一個 Express + Prisma 後端，同時被 2 個以上 client（例如 web 與 mobile）呼叫。
> 問題：如何讓 client 與後端保持對齊，以及「產生 typed client」到底能不能抓到已被移除的 endpoint。
> 本文只做分析與建議，不改動任何 repository。

## 0. 先講結論

三個結論先放在前面，後面再逐項給證據。

1. **「OpenAPI 產生 client」與「contract testing」解的是不同的失敗模式。** 前者保證「client 的程式碼符合 spec」，後者保證「server 的實際行為符合 client 的期待」[1][4][8]。前者可以在 server 已經不服務某條路由時仍然完全通過編譯。
2. **要抓 dead endpoint，最便宜的不是 Pact，也不是 Dredd，而是一個跑在 CI 裡的 route inventory 斷言。** 它把「client 會呼叫的 (method, path) 集合」與「Express router 實際註冊的 (method, path) 集合」直接比對，不需要網路、不需要資料庫、不需要 contract broker [23][24]。
3. **對小團隊，先做「單一 schema 來源 + route guard」，再談 codegen，最後才談 Pact 與 BFF。** BFF 與 runtime handshake 都不是 drift 的解法，前者是架構選項，後者是 rollout 工具 [14][21][22]。

以下每個事實性陳述都附 `[n]`，並在文末 `# 來源` 對應。無法查證或屬個人推論者，會標 `(推論)` 或 `(未能查證)`。

---

## 1. 五種做法的比較

### 1.1 OpenAPI spec as source of truth + generated clients

**做法**：把 OpenAPI document 當成唯一契約，用 `openapi-typescript`、`Orval` 或 `openapi-generator` 產生型別或 client，client 不再手寫 URL 與 payload 形狀。

**採用成本**

- 工具本身便宜：`openapi-typescript` 是純 Node 產生 `.d.ts`，不需要 JVM 或跑 server [1]；`Orval` 從任一合法 OpenAPI v3 / Swagger v2 產生 TypeScript client [5]；`openapi-generator` 可產生 client、server stub、文件與設定 [6]。
- 真正的成本在「spec 誰維護」。若 spec 是手寫的，你會多一份必須同步的資產；若 spec 由程式產生，成本移到「讓程式能產生 spec」這件事上（見第 3 節）。
- 對小團隊的粗略量級：接一個既有 Express 專案、把 spec 產生接進 build，約 1–3 人日；若順便要處理 auth、error envelope、多版本，會再往上加 (推論)。

**預防哪一類 drift**

- 預防「client 打了 spec 上不存在的 path / method / 欄位」。因為 client 的 `paths` 是從 spec 推出來的，呼叫不存在的 key 會在 TypeScript 編譯期就錯 [1]。
- 預防「同一個 response 形狀在兩個 client 被手寫成兩套」。所有人吃同一份 generated types [5][6]。
- 預防「文件與 client 各說各話」——但只在 spec 是權威來源時成立。

**不預防什麼**

- **不預防 spec 與 server 的真實路由脫節。** 這是最關鍵的一點：`openapi-typescript` 只產生靜態型別，不執行任何 runtime 檢查 [1][2]；維護者明確表示這個專案「by its design generates runtime-free static types, and only static types」[4]。
- 不預防 response 的 runtime 形狀錯誤（例如 Prisma 查詢少選了欄位，但 spec 宣告它存在）。
- 不預防「server 加了新路由但 spec 沒更新」——這方向通常不會讓 client 壞掉，但會讓 spec 逐漸失去可信度。

**引用**：`openapi-typescript` 的定位與限制 [1][2][4]；Orval [5]；openapi-generator [6]。

---

### 1.2 Contract testing（Pact、Schemathesis、Dredd）

**做法**：不是比對「文件」，而是實際打出請求、比對回應。

- **Pact**：consumer 端用 mock 寫測試，產生 pact 檔；provider 端把 pact 裡的每個 request 重放一次，比對實際 response 是否至少包含期待內容 [7][9]。
- **Schemathesis**：讀 OpenAPI / GraphQL schema，據此產生請求並檢查 response，會回報 `Undocumented HTTP status code`、`Unsupported methods`、`Response violates schema` 等失敗 [10]。
- **Dredd**：讀 API description，逐條對 backend 發請求，檢查回應是否符合文件描述 [11][12]。

**採用成本**

- Pact 需要兩邊都改：consumer 寫 interaction、provider 跑 verification，還要決定 pact 檔怎麼傳（broker 或檔案）[7][9]。對「只有兩個 client、同一個 repo」的團隊，這個流程偏重 (推論)。
- Schemathesis 對 Python 生態最順；Node/Express 專案要另外處理啟動 server 與測試資料 (推論)。
- Dredd 只需 description + 一個跑得起來的 server，啟動成本最低，但工具本身已於 2024 年 11 月封存，社群維護轉向 fork [13]。

**預防哪一類 drift**

- 預防「server 已經不服務某條路由」。因為請求真的打出去，路由不存在就是 404 / 405，測試會紅 [11][12]。
- 預防「response 形狀或 status code 與文件不符」[10][12]。
- Pact 額外預防「provider 改了行為，但沒有違反目前 consumer 真正用到的部分」——它只驗證 consumer 實際用到的互動，這也是它的設計目的 [7]。

**不預防什麼**

- 不預防「client 根本沒被測到」的情境：Pact 的覆蓋率等於 consumer 寫了多少 interaction；沒寫的呼叫不會被保護 [7]。
- 不預防「spec 與實作一起錯」：Dredd 與 Schemathesis 都以 description 為期待來源，若 description 本身錯，測試只會確認「錯得一致」[11][10]。
- 不預防編譯期問題：這些都是 runtime 測試，client 仍然可以編譯過但行為錯 (推論)。

**引用**：Pact 的 consumer / provider 流程 [7][9]；Pact 對「schema 是靜態 artefact、contract 是 by example」的區分 [8]；Schemathesis 的檢查項目 [10]；Dredd 的定位 [11][12]；Dredd 封存狀態 [13]。

---

### 1.3 BFF / per-client adapter layer

**做法**：每個前端介面各自有一個 backend-for-frontend，BFF 坐在 client 與後端服務之間，為該 client 客製 response [14]。

**採用成本**

- 最高的一類。你多出一個（或每個 client 一個）可部署服務，多了部署、監控、認證、rate limit、版本管理的表面積 [14]。
- 官方文件直接點出：這個 pattern 很可能導致 code duplication，必須在「重複」與「客製體驗」之間取捨 [14]。
- 對小團隊，這是「多一個服務要養」，不是「多一個設定」 (推論)。

**預防哪一類 drift**

- 預防「後端服務的通用 API 被某個 client 的需求綁架」。每個 client 的 BFF 可以獨立演化、獨立釋出 [14]。
- 預防「client 直接耦合到多個 microservice 的內部形狀」——BFF 可以做 aggregation 與 reshape [14]。
- 預防「一個 client 的改動打破另一個 client」：因為路徑不同、部署不同 [14]。

**不預防什麼**

- 不預防 BFF 自己與下游服務脫節。BFF 仍然要呼叫後端，後端拿掉路由時 BFF 一樣會壞 (推論)。
- 不預防「同一份 business logic 在 N 個 BFF 重寫」——這正是文件警告的 code duplication [14]。
- 不預防資料契約錯誤：BFF 只是轉接層，Prisma schema 與 response shape 的落差依然存在 (推論)。

**引用**：Microsoft Azure Architecture Center 的 BFF pattern 定義、適用時機與 code duplication 警告 [14]。

---

### 1.4 Shared typed SDK package inside a monorepo

**做法**：把 generated client（或手寫的 thin wrapper）包成 workspace 內的 private package，例如 `@acme/api-client`，兩個 client 都依賴它。底層通常還是 OpenAPI codegen [5][6]。

**採用成本**

- 比「各自產生 client」低：一份 generation 設定、一份依賴、一次升級。
- 需要 monorepo（或至少 private registry）。若兩個 client 在不同 repo，這個做法會退化成「發版 + 升級依賴」，即下面說的弱點 (推論)。
- 需要處理 version skew：shared package 升版時，兩個 client 不一定同時跟上升級 (推論)。

**預防哪一類 drift**

- 預防「兩個 client 對同一 endpoint 有兩套不同型別」——型別只有一份。
- 預防「client 手寫 URL 拼錯」——呼叫的是 generated function。
- 在 monorepo 裡，**若 CI 會重新產生 SDK 並跑 typecheck**，則可以做到「server 移除路由 → SDK 重新產生 → client 呼叫點編譯失敗」。這是五種做法中最接近「dead endpoint 會在 CI 紅燈」的一種 (推論，機制見第 2 節)。

**不預防什麼**

- 不預防「SDK 產生後沒有被重新產生」。若 CI 只跑 `tsc` 而不重跑 codegen，舊 SDK 仍然可用，server 拿掉路由時不會有任何編譯錯誤 [3][4]。
- 不預防 runtime response 形狀錯誤。
- 不預防「兩個 client 的業務需求分岔」——共用 SDK 反而會讓分岔更難表達，這時才需要 BFF [14]。

**引用**：generated client 的產生機制 [5][6]；`openapi-typescript --check` 可檢查 generated types 是否 up-to-date [3]。

---

### 1.5 Runtime handshake / capability negotiation

**做法**：server 提供 `/capabilities` 或 feature flag 端點，client 啟動時詢問「你支援哪些功能 / 哪些版本」，再決定行為。

**採用成本**

- 端點本身很小，但「讓 client 根據回應分支」會把複雜度散到 client 各處 (推論)。
- 需要版本策略：capability 的命名、語意、向後相容規則。這些沒有免費的標準答案 (推論)。
- Feature flag 若要做得乾淨，通常會引入 OpenFeature 這類 vendor-agnostic 的 evaluation API 與 provider 抽象 [21]。

**預防哪一類 drift**

- 預防「client 在舊 server 上呼叫新功能而爆炸」：client 先問，再決定要不要用 [21]。
- 預防「漸進式 rollout 時新舊行為不一致」：flag 可以按使用者 / 比例開關 [21]。
- 若做得像 GraphQL introspection，還能讓 client 在 runtime 取得 schema 的能力清單 [22]。

**不預防什麼**

- **不預防 dead endpoint。** 這是最容易被誤解的一點：capability 端點是「額外的一次詢問」，不是「路由存在性的保證」。Client 若沒問、或問了但快取過期，仍然會打到已移除的路由 (推論)。
- 不預防 response shape 錯誤。
- 不預防「capability 清單本身說謊」：它也是手寫的，也會 drift (推論)。
- OpenAPI / REST 沒有像 GraphQL `__schema` 那樣的標準 introspection 機制，所以 `/capabilities` 是自訂契約，沒有規範可依 (推論)。

**引用**：OpenFeature 的 vendor-agnostic flag evaluation API [21]；GraphQL introspection 的 `__schema` 與「production 常關閉」的實務 [22]。

---

### 1.6 五種做法對照表

| 做法                          | 採用成本               | 主要擋下的 drift            | 明確不擋            | 對 dead endpoint 的有效性                                   |
| ----------------------------- | ---------------------- | --------------------------- | ------------------- | ----------------------------------------------------------- |
| 1. OpenAPI + generated client | 低—中                  | client 與 spec 的形狀不一致 | spec 與 server 脫節 | 只有 spec 由 server 產生且 CI 重跑 codegen 才有效 [1][3][4] |
| 2. Contract testing           | 中—高                  | server 行為與期待不符       | 沒被寫成測試的呼叫  | 有效，因為真的打請求 [10][11][12]                           |
| 3. BFF                        | 高                     | client 之間互相牽連         | BFF 與下游脫節      | 間接，且成本最高 [14]                                       |
| 4. Shared typed SDK           | 低—中                  | 兩個 client 型別分岔        | 未重新產生的舊 SDK  | 在 monorepo + CI codegen 下有效 (推論)                      |
| 5. Runtime handshake          | 低（端點）／中（分支） | 新功能打到舊 server         | 路由存在性、shape   | 幾乎無效 (推論) [21][22]                                    |

---

## 2. 產生 typed client 到底會不會抓到 dead endpoint？

### 2.1 先把兩個失敗分開

這裡有兩個完全不同的命題，常被混為一談：

- **(A) 型別對齊**：client 的程式碼是否符合 spec？
- **(B) 服務存在**：server 是否真的還服務這條路由？

`openapi-typescript` 這類工具只處理 (A)。它把 OpenAPI document 轉成 `.d.ts`，是純編譯期的 artifact，不帶任何 runtime 行為 [1][2]。維護者在 issue 裡說得很直接：這個專案「by its design generates runtime-free static types, and only static types」[4]。

所以：

- 若 spec 裡還有 `DELETE /v1/users/{id}`，而 server 已經把這條路由刪掉，**client 仍然會編譯成功**，型別也完全正確。錯誤會延後到 runtime 的 404。
- 這正是 issue #1420 的提問動機：「as APIs change or worse diverge from the spec they produce we get either warning or error?」[4]。維護者的回答不是「用我們的 runtime 檢查」，而是「在你的 API 那邊寫 unit test / E2E test」[4]。

### 2.2 什麼情況下「會」抓到

只有當下面三個條件同時成立，generated client 才會在 CI 抓到 dead endpoint：

1. **spec 是從真實路由產生的**，不是手寫的。例如 `tsoa` 以 TypeScript controller 為單一來源，同時產生 spec 與 Express routes [15]。
2. **CI 每次都會重新產生 spec 與 client**，而不是只跑 `tsc`。
3. **client 的呼叫點會被重新 typecheck**。若 SDK 是發佈到 registry 的套件，client 可能還釘在舊版，這時即使 server 改了，client repo 也不會紅 (推論)。

`openapi-typescript` 有 `--check` 旗標，用途是「檢查 generated types 是否 up-to-date」[3]。把這個旗標放進 CI，等於把條件 2 自動化。這是一個便宜且有效的補強，但它仍然只證明「spec 沒變」，不證明「server 符合 spec」。

### 2.3 什麼情況下「不會」抓到

- **spec 手寫、server 另外寫**：兩邊可以任意脫節。這是實務上最常見的失敗模式 (推論)。
- **server 有路由，spec 沒有**：client 不會知道，但這通常不造成 client 壞掉。
- **server 沒有路由，spec 有**：client 編譯過、執行時 404。
- **response shape 變了但 path 沒變**：型別可能仍然「相容」（例如多一個欄位、少一個 optional 欄位），編譯不會錯。
- **HTTP 404 的語意模糊**：`GET /users/123` 回 404 可能是「路由不存在」，也可能是「使用者不存在」。所以「打每個 path 看有沒有 404」這種 smoke test 會產生偽陰性；這也是為什麼第 4 節建議用 router introspection，而不是 live request (推論)。

### 2.4 對照：哪些工具真的會「打到 server」

- **Dredd**：文件說它「step by step validates whether your API implementation replies with responses as they are described」，並且會對 tested API 發出請求 [11][12]。路由不存在 → 請求失敗 → 測試紅。這是真正的 (B)。
- **Schemathesis**：從 schema 產生請求並檢查 response，會抓 `Undocumented HTTP status code`、`Unsupported methods` [10]。也是真正的 (B)。
- **Pact provider verification**：把 pact 裡的請求重放給 provider，比對回應 [7][9]。也是真正的 (B)，但只涵蓋 consumer 寫過的互動。
- **`openapi-typescript` / Orval / openapi-generator**：只產生程式碼，不發請求 [1][5][6]。只做 (A)。

Pact 的文件對這個差異有一句很好的總結：OpenAPI 這類 schema 是「a static artefact that describes all possible states of a resource」，而 Pact contract 是「enforced by executing a collection of test cases」，是「contract by example」[8]。

### 2.5 一句話版本

> Generated typed client 抓的是「你呼叫了 spec 沒宣告的東西」；它不抓「server 不再服務 spec 宣告的東西」。
> 前者是編譯期、免費、每次 build 都跑；後者需要真的打一次請求，或直接讀 server 的 route table。

---

## 3. Express + Prisma + OpenAPI：怎麼做才「誠實」

「誠實」在這裡定義為：**spec 不可能在無人察覺的情況下與實際 routes 脫節**。注意這比「spec 與 response schema 一致」弱，但比「有寫文件」強很多。

### 3.1 五個候選逐一檢查

#### (a) `tsoa`

- **規格來源**：TypeScript controllers 與 models 是 single source of truth；spec 與 routes 都從同一份 controller 產生 [15]。
- **runtime 驗證**：有。文件把「Validate request payloads」列為功能 [15]。
- **response 驗證**：文件只提到 request payload validation，沒有承諾 response 驗證 (推論)。
- **路由與 spec 同源？** 是。`tsoa routes` 產生 Express route 檔，controller 移除 method 時，spec 與 route 一起消失 [15]。
- **誠實度**：結構上最高。在本文檢查的候選中，這是唯一能說「spec 不可能悄悄與 routes 脫節」的 [15]。
- **代價**：要改用 decorator / controller 風格，既有 Express 路由要重寫；Prisma 仍然要自己接 (推論)。

#### (b) `express-openapi-validator`

- **規格來源**：外部 OpenAPI 3.0.x / 3.1.x 文件（手寫或產生）。
- **runtime 驗證**：有。`validateRequests` 預設 `true`，`validateResponses` 預設 `false`，要明確開啟 [16]。
- **路由與 spec 同源？** 否。它是 unopinionated 中介層，route 由你自己用 Express 定義 [16]。
- **關鍵細節**：source code 顯示，若 request path 不在 OpenAPI 文件裡，validator 直接 `next()` 跳過，不驗證 [17]。也就是說，**「Express 有路由、spec 沒有」這種 drift 它看不見**。
- **誠實度**：中。它能保證「有被記錄的 path，request 形狀是對的」，但不能保證「所有 path 都被記錄」。選項 `operationHandlers` 可以把 OpenAPI endpoint 自動映射到 handler，這才比較接近同源，但不是預設用法 [16]。

#### (c) `@asteasolutions/zod-to-openapi`

- **規格來源**：Zod schemas。作者明說目的是消除「同時維護 zod 與 OpenAPI」的重複，讓 zod 成為 single source of truth [18]。
- **runtime 驗證**：本身不提供 Express middleware。它產生 OpenAPI document；request 驗證要靠你原本的 zod 中介層（例如 `zod-express-middleware`）(推論，文件只描述產生 spec) [18]。
- **路由與 spec 同源？** 部分。Schema 同源，但 path 清單是你在 `OpenAPIRegistry` / `registerPath` 手動登記的，route 也是你另外用 Express 定義的。兩份清單仍然可能不同步 [18]。
- **誠實度**：schema 誠實、route inventory 不誠實。這是它與 tsoa 最大的差別。

#### (d) `zod-openapi`

- **規格來源**：Zod schemas，透過 `createDocument` 產生 OpenAPI 3.1 文件 [19]。
- **runtime 驗證**：核心套件只產生文件。作者另外提供 `fastify-zod-openapi`，那個才包含 schema validation 與 serialization；Express 沒有等價的內建路徑 [19]。
- **路由與 spec 同源？** 否。`paths` 是你手動傳進 `createDocument` 的物件 [19]。
- **誠實度**：與 (c) 同級：schema 同源，route 清單手動。

#### (e) `swagger-jsdoc`

- **規格來源**：程式碼裡的 JSDoc `@openapi` 註解 [20]。
- **runtime 驗證**：沒有。它的 `failOnErrors` 只驗證「產生出來的文件是否合法」，不是驗證流量 [20]。
- **路由與 spec 同源？** 名義上相鄰（註解就寫在 route 旁邊），但沒有任何機制綁定。刪掉 `app.get()` 而忘記刪註解，spec 會繼續說這條路由存在 [20]。
- **誠實度**：最低。它本質上是「文件產生器」，不是契約執行器。

### 3.2 對照表

| 工具                             | Spec 來源            | Request runtime 驗證        | Response runtime 驗證 | Route 與 spec 同源            | 誠實度 |
| -------------------------------- | -------------------- | --------------------------- | --------------------- | ----------------------------- | ------ |
| `tsoa`                           | controllers / models | 有 [15]                     | 未承諾 (推論)         | 是 [15]                       | 高     |
| `express-openapi-validator`      | 外部文件             | 有（預設開）[16]            | 有（預設關）[16]      | 否；未記錄 path 直接跳過 [17] | 中     |
| `@asteasolutions/zod-to-openapi` | Zod                  | 需另接中介層 [18]           | 需另接                | Schema 同源、route 手動 [18]  | 中     |
| `zod-openapi`                    | Zod                  | 核心無；Fastify 外掛有 [19] | Fastify 外掛有 [19]   | 否，paths 手動 [19]           | 中     |
| `swagger-jsdoc`                  | JSDoc 註解           | 無 [20]                     | 無                    | 否                            | 低     |

### 3.3 Prisma 特有的破口

即使選了 tsoa 或 zod 系列，Prisma 這一層仍然是獨立的 drift 來源：

- Prisma 的 `select` / `include` 會改變實際回傳的欄位，但這些不會自動反映到 API schema (推論)。
- `zod-prisma-types` 可以從 Prisma models 產生 zod schemas [25]，但它是以「model 的完整形狀」為基礎；若 handler 只 select 部分欄位，response schema 仍然會對不上 (推論)。
- 因此 Prisma 專案的「誠實」需要多一道：**response 驗證**（用 `express-openapi-validator` 的 `validateResponses`，或測試裡的 zod parse），否則你只保證了 request，沒保證 response (推論) [16]。

### 3.4 小結

- 想要「結構上不可能脫節」：在本文檢查的五個候選中，`tsoa` 是唯一真正做到 spec 與 routes 同源的 [15]。
- 想留在現有 Express 寫法：`@asteasolutions/zod-to-openapi` 或 `zod-openapi` 可以讓 schema 同源，但你仍然需要一個 route inventory guard 來補「route 清單」這一塊 [18][19]。
- `swagger-jsdoc` 只 document，不 validate；把它當契約會失望 [20]。

---

## 4. 最便宜的 CI guard

### 4.1 為什麼不能只靠 typecheck

Typecheck 的輸入是「已經產生好的 `.d.ts`」。若產生步驟沒跑，或 spec 沒更新，typecheck 永遠是綠的 [1][3][4]。所以 guard 必須直接看 **server 的 route table**，或直接對 server 發請求。

### 4.2 那個 guard：Route inventory assertion

**一句話**：在 CI 裡 import 真正用來啟動 server 的 `createApp()`，把 Express router 的 (method, path pattern) 全部攤平，與 client 會呼叫的 (method, path pattern) 集合做比對。

不需要資料庫、不需要啟動 HTTP server、不需要 Pact broker。Express 5 的 application 本身就有內建 router [23]；走訪 `app.router.stack`（Express 4 是 `app._router.stack`）時要注意 v5 的 layer 形狀已改變 [24]。

概念程式碼：

```ts
// tests/route-inventory.test.ts
import { createApp } from "../src/app"; // 與 src/server.ts 同一個 factory
import { clientRoutes } from "../src/generated/routes"; // 由 openapi 或 generated client 匯出

const app = createApp(); // 不 listen
const serverRoutes = collectRoutes(app.router.stack); // 遞迴展開 mounted router

// normalize: '/users/:id' -> '/users/{id}'，去掉 trailing slash，接上 mount prefix
expect(serverRoutes).toEqual(expect.arrayContaining(normalize(clientRoutes)));
```

### 4.3 它必須斷言什麼（逐條）

1. **對每一個 client 可呼叫的 (method, path)，server 必須有對應的註冊路由。** 這是唯一直接阻擋 dead endpoint 的斷言。
2. **path parameter 以「位置與數量」比對，不以名稱為準。** `/users/:id/posts/:postId` 要能匹配 `/users/{userId}/posts/{postId}`。
3. **mounted router 必須帶上前綴展開。** `app.use('/v1', usersRouter)` 底下的 `/users` 要變成 `/v1/users`。
4. **catch-all / middleware layer 不算覆蓋。** `app.use('*', handler)` 或 `app.use(express.json())` 不能讓任何具體 path 通過斷言。
5. **反向檢查先當 warning。** 「server 有、client/spec 沒有」的路由先印出來，不要一開始就讓 build 紅；等清乾淨再轉成 error (推論)。
6. **失敗訊息要列出缺失的 (method, path) 清單**，而不是只說 `expected true to be false`。
7. **跑的是 production 啟動路徑的 `createApp()`**，不是測試專用的簡化 app；否則 guard 會保護一個不存在的 server。

### 4.4 成本

- 一個測試檔 + 一個 `collectRoutes` helper，大約半天 (推論)。
- 真正的成本可能在「把 app 建立與 DB 連線拆開」。若現在的 `app.ts` 一 import 就连 Prisma，需要先抽出 `createApp()`；這通常是 2–4 小時的重構 (推論)。
- 執行時間：毫秒級，不需要 service container [23][24]。

### 4.5 為什麼不用「打每個 path 看 404」

- 404 有兩種意思：路由不存在，或資源不存在 (推論)。
- 打 `GET /users/999999` 得到 404 是正確行為，但你的 guard 會誤判成 dead endpoint。
- 打 `OPTIONS /path` 可以避開部分資料依賴，但 Express 的 `Allow` 行為與 middleware 順序會讓結果不穩 (推論)。
- 因此：**要抓「路由是否存在」，就讀路由表；要抓「行為是否正確」，才發請求。** 兩件事不要用同一個測試硬湊。

### 4.6 這個 guard 不抓什麼

- 不抓 response shape（需要 response validation 或 contract test）。
- 不抓 auth / 權限邏輯。
- 不抓「同一條 path 但 method 語意改變」（例如 PUT 改成 PATCH 的語意）。
- 不抓 client 端的商業邏輯錯誤。

對「dead endpoint」這個單一目標，它是成本最低且訊號最乾淨的。

---

# 建議

## 5.1 排名（以小團隊、Express + Prisma、2 個以上 client 為前提）

| 排名 | 做法                                                 | 為什麼排在這裡                                                          | 何時該升級                                              |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | **Route inventory guard**                            | 半天成本、直接解 dead endpoint、無外部依賴 [23][24]                     | 永遠留著，當第一道門                                    |
| 2    | **Zod 單一來源 → OpenAPI → shared generated client** | 一份 schema 同時餵 request 驗證與文件，兩個 client 共用型別 [18][19][5] | 當 client 數 > 2 或出現非 TS client                     |
| 3    | **Contract testing（Pact）**                         | 唯一能保證「server 行為符合 consumer 實際期待」的做法 [7][9]            | 當 client 與 server 分屬不同團隊 / 不同 release cadence |
| 4    | **BFF**                                              | 解決的是「client 需求分岔」，不是 drift；成本最高 [14]                  | 當 mobile 與 web 的 response 需求真的開始互斥           |
| 5    | **Runtime handshake / capabilities**                 | 是 rollout 與相容性工具，不是 drift 防線 [21][22]                       | 當你需要灰度發佈或長期支援多個 client 版本              |

注意排名 1 與 2 是互補的，不是二選一：guard 管「路由存在」，schema 同源管「形狀一致」。

## 5.2 兩個被否決的替代方案

**否決一：現在就做 BFF。**

- 理由：BFF 會多出每個 client 一個可部署服務，官方文件自己就警告 code duplication 是 probable outcome [14]。
- 它不解決 dead endpoint：BFF 一樣要呼叫後端，後端移除路由時 BFF 會壞 (推論)。
- 對小團隊，先把契約與 guard 做起來，遠比多養一層服務划算；等 client 需求真的互斥，再拆 BFF [14]。

**否決二：用 `/capabilities` 或 feature flag 當 drift 控制。**

- 理由：capability 端點是「client 主動詢問」，不是「路由存在性的保證」；沒問、快取過期、或清單本身寫錯，都會失效 (推論)。
- OpenAPI / REST 沒有標準的 runtime introspection，`/capabilities` 是自訂契約，等於又多一份會 drift 的文件 (推論) [22]。
- Feature flag 適合 rollout 與 kill switch，不適合當「防止 client 呼叫已刪除路由」的機制 [21]。
- 若只是要灰度，用 OpenFeature 的 flag evaluation 就好，不要把它包裝成 contract 治理 [21]。

**另外一個不推薦的工具：Dredd。** 定位正確（真的打 backend）[11][12]，但原專案已於 2024 年 11 月封存，社群維護轉向 fork [13]。新專案不建議押在上面。

## 5.3 接下來兩週要做什麼

第一週先把「真相」建立起來：把 `app.ts` 拆出 `createApp()`，確認它可以在不連 DB 的情況下被 import；寫 `collectRoutes()` 遞迴展開 Express 5 的 `app.router.stack`（留意 v5 layer 形狀與 v4 不同）[24]；把 client 目前會呼叫的 (method, path) 清單匯出成一個陣列；寫一個 route inventory 測試，斷言 server 路由集合包含 client 路由集合，並在 CI 跑。這一步的目標不是完美，而是「今天之後，任何人刪掉一條被 client 使用的路由，CI 會紅」。

第二週再把「形狀」接上：把既有的 zod request schemas 用 `@asteasolutions/zod-to-openapi` 或 `zod-openapi` 產生 OpenAPI document [18][19]；在 CI 加 `openapi-typescript --check`，確保 generated types 沒有過期 [3]；用 Orval 或 openapi-typescript 產生 client，放進 monorepo 的 shared package [5][1]；最後，選 3–5 個最關鍵的 endpoint 開啟 response 驗證（`express-openapi-validator` 的 `validateResponses`，或測試裡的 zod parse）[16]。兩週結束時，你會有：一個擋 dead endpoint 的 guard、一份由程式產生的 spec、一份兩個 client 共用的型別，以及關鍵路徑的 response 檢查。Pact 與 BFF 都還不需要 [7][14]。

---

## 6. 驗證狀態與限制

- 本文引用的工具行為，以官方文件與官方 repo 的 README / source 為準 [1]–[25]。
- 「adoption cost 半天 / 1–3 人日 / 2–4 小時」屬於工程估算，非引用數據，已標 `(推論)`。
- Express router 的內部結構不是穩定的 public API；v5 已改變 layer 形狀 [24]。若你的 Express 版本升級，`collectRoutes()` 需要重新驗證。
- 本文沒有實際跑過任何 repository 的測試，也沒有量測 CI 時間；所有效能與成本描述皆為估算 (推論)。
- Dredd 的封存狀態來社群 fork 的說明頁，未直接向 Apiary 官方確認 (未能查證原始公告日期，僅知 2024 年 11 月) [13]。

---

# 來源

1. openapi-typescript — Introduction（runtime-free types、支援 3.0/3.1）  
   https://openapi-ts.dev/introduction
2. openapi-typescript — npm README（"This library does NOT validate your schema"）  
   https://www.npmjs.com/package/openapi-typescript
3. openapi-typescript — CLI（`--check`：檢查 generated types 是否 up-to-date）  
   https://openapi-ts.dev/cli
4. openapi-typescript — Issue #1420 "Runtime validation"（維護者：只產生 runtime-free static types；契約問題應在 API 端以 unit/E2E test 解決）  
   https://github.com/openapi-ts/openapi-typescript/issues/1420
5. Orval — Docs overview（從 OpenAPI v3 / Swagger v2 產生 type-safe TypeScript client）  
   https://orval.dev/docs/
6. OpenAPI Generator — README（產生 client libraries、server stubs、documentation）  
   https://github.com/OpenAPITools/openapi-generator
7. Pact — How Pact works（consumer interaction、provider verification 重放請求）  
   https://docs.pact.io/getting_started/how_pact_works
8. Pact — Introduction（OAS 是 static artefact；Pact 是 contract by example）  
   https://docs.pact.io/
9. Pact — Verifying Pacts（重放 pact 中的每個 request 並比對 response）  
   https://docs.pact.io/getting_started/verifying_pacts
10. Schemathesis — Quick Start（從 schema 產生請求、檢查 response；列出 Undocumented HTTP status code 等失敗）  
    https://schemathesis.readthedocs.io/en/latest/quick-start
11. Dredd — 官網（language-agnostic，驗證 API description 與 backend implementation 是否一致）  
    https://dredd.org/en/latest/
12. Dredd — How It Works（對 tested API 發請求、比對 documented responses）  
    https://github.com/apiaryio/dredd/blob/master/docs/how-it-works.rst
13. Dredd fork — npm.io 頁面（原專案 2024-11-08 封存、維護轉向 fork 的說明）  
    https://npm.io/package/@antimatter-studios/dredd
14. Microsoft Azure Architecture Center — Backends for Frontends pattern（每個 frontend 一個 BFF；code duplication 警告）  
    https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends
15. tsoa — Introduction（controllers/models 為 single source of truth；同時產生 OpenAPI spec 與 routes；validate request payloads）  
    https://tsoa-community.github.io/docs/introduction.html
16. express-openapi-validator — npm README（validateRequests 預設 true、validateResponses 預設 false；optional auto-map operationHandlers）  
    https://www.npmjs.com/package/express-openapi-validator
17. express-openapi-validator — `openapi.request.validator.ts`（path 不在 spec 時直接 `next()` 跳過）  
    https://github.com/cdimascio/express-openapi-validator/blob/master/src/middlewares/openapi.request.validator.ts
18. @asteasolutions/zod-to-openapi — README（以 Zod 為 single source of truth 產生 OpenAPI）  
    https://github.com/asteasolutions/zod-to-openapi
19. zod-openapi — README（`createDocument` 從 Zod 產生 OpenAPI v3.x；Fastify 外掛另提供 validation 與 serialization）  
    https://github.com/samchungy/zod-openapi
20. swagger-jsdoc — README（讀 JSDoc 產生 OpenAPI；`failOnErrors` 只驗證文件）  
    https://github.com/Surnet/swagger-jsdoc
21. OpenFeature — Flag Evaluation API（vendor-agnostic 的 feature flag evaluation 抽象）  
    https://openfeature.dev/specification/sections/flag-evaluation/
22. GraphQL — Introspection（`__schema` 查詢 runtime schema；實務上 production 常關閉）  
    https://graphql.org/learn/introspection/
23. Express 5 — Router API（每個 application 都有內建 app router）  
    https://expressjs.com/en/5x/api/router/
24. Express — Discussion #5961 "List All Routes in express app (v5)"（v5 layer 形狀改變；走訪 `app._router.stack` / `router.stack` 與 nested `handle.stack`）  
    https://github.com/expressjs/express/discussions/5961
25. zod-prisma-types — npm README（從 Prisma models 產生 zod schemas）  
    https://www.npmjs.com/package/zod-prisma-types
