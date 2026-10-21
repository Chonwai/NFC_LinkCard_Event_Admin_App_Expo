# R2 — Feature parity 的操作定義，與次要 client 的漂移

本文回答四個問題：兩個 client（web + native）共用一個 backend 時，「parity」的可引用定義是什麼；capability / screen / endpoint 三種 parity 的差別與正確審計單位；實務上真的在用的 parity 評分法；以及真實世界裡 client drift 是怎麼發生的、怎麼被發現、補了什麼 guard。

判讀規則：

- 定義與框架優先採用 engineering source：martinfowler.com、ThoughtWorks Technology Radar、Google AIP、Microsoft Azure Architecture Center、DORA、Pact、Sentry、GitHub、Shopify 工程文章。
- 「capability parity / screen parity / endpoint parity」不是業界標準術語；本文先給工作定義，再用可引用來源支撐每個定義背後的概念，工作定義本身標 `(推論)`。
- 沒有公開證據的細節標 `(未能查證)`；由來源推出來、但來源沒有明講的判斷標 `(推論)`。
- 引用原文時保留英文片語，不改成中文再回譯。
- 本文只讀公開文件，沒有修改任何 repository。

---

## 0. 先給結論

1. parity 的正確審計單位是 **capability**：一個使用者在特定 entitlement 與資料狀態下，能不能得到同一個可觀察結果。[1][3]
2. **endpoint parity 只能當 evidence，不能當 unit**。endpoint 存在、回 200，不代表語意一致；AIP-180 把這叫 semantic compatibility，並明說它需要 judgment。[3]
3. **screen parity 是最差的 unit**。同一個 backend 的兩個 client 本來就會因為裝置能力、頻寬、互動方式而有不同畫面；BFF 這個 pattern 存在的理由正是承認這件事。[9][10][11]
4. 實務上至少有三種 parity 評分法：weighted capability matrix、RICE-style gap scoring、supported / partial / absent rubric。[21][22][23]
5. 真實 drift 幾乎都不是「程式寫錯」，而是「兩個 client 各自做出局部合理的決定，然後其中一邊先改」。六個可查證案例見第 4 節。[12][13][14][16][29][31]
6. LinkCard（Expo + Next.js + Express，沒有 generated client）最可能的三個 failure mode 是：路由／請求契約漂移、欄位契約漂移、auth/permission 分岔。各有一個單一量測可以曝光，見第 5 節。

---

## 1. 可引用的定義與框架

### 1.1 Feature parity 的原意：複製「現在的樣子」

Fowler 對 feature parity 的定義很直接：用更合適的技術棧重建一個系統，功能與行為和舊系統完全相同；任何人問「新系統應該怎麼做」，答案就是「照舊系統做」。[1]

但要宣稱 parity，必須先能完整描述舊系統在做什麼，再能驗證新系統做一樣的事。Fowler 把「舊系統在做什麼」拆成五類：user actions（角色、看得到的 menu item、可執行的 action、每個 action 涉及哪些 screen、哪些資料、哪些 validation、對使用者有什麼 observable result）、batch processes、interfaces and integrations（含 API contract 與 side effect）、core algorithms（business rules 與計算）、reports/data。[1]

這裡有兩個對本文很重要的細節：

- 「screen」在 Fowler 的框架裡是描述 user action 的一個欄位，不是 parity 的單位。[1]
- 「observable result」才是驗收點；畫面只是其中一種觀察面。[1]

Fowler 與 ThoughtWorks 對這個 pattern 的評價是負面的：ThoughtWorks 在 Technology Radar 把 legacy migration feature parity 放在 Hold，理由是舊系統 bloated、很多功能沒人用（引用 2014 Standish Group 的 50% 數字），照抄是 wasted opportunity。[1][2]

這個警告不等於「不要做 parity audit」。它說的是：不要把「與舊系統 1:1」當成產品目標；audit 要能區分「必須一致的行為」與「可以 intentionally 不同的地方」。這個區分正是後面 parity register 要解決的問題。(推論)

### 1.2 為什麼一個 backend 服務兩個 client 會自然分岔

Sam Newman 描述的 general-purpose API backend 問題是：一個 API 同時服務 desktop web 與 mobile，mobile 的 affordance 不同（螢幕小、連線與電量有限），想做的互動也不同，於是 API 被迫不斷加功能去滿足所有 client；這個 deployable artifact 也變成 rollout 瓶頸。[9]

Microsoft 的 Azure Architecture Center 把解法講得更白：與其用一個 general-purpose backend 服務所有 interface，不如為每個 front-end 建一個 BFF；frontend team 自己管理自己的 BFF，因此可以控制 release cadence 與客製化，代價是重複與額外服務。[11]

SoundCloud 的案例提供了兩個具體教訓：

- 他們一開始讓 web、Android、iOS 共用一個 monolith API，後來發現「common denominator」讓加功能變慢，mobile 的 payload 需求也沒被考慮。[10]
- 他們一開始只用一個 BFF 同時服務 iOS 與 Android；事後回看，應該一個 platform 一個 BFF，因為兩者的 API 需求差異夠大。[10]

也就是說，**分岔不是意外，而是架構的自然結果**。parity audit 的目的不是消滅分岔，而是確保分岔是「有意識、有記錄、可承受」的。(推論)

### 1.3 三層相容性：source / wire / semantic

Google AIP-180 把相容性分成三層：

- **Source compatibility**：對舊版 client library 寫的程式，要能編譯並跑在新版上。[3]
- **Wire compatibility**：序列化與反序列化的期待要對得上，不只是 input/output 的欄位名稱。[3]
- **Semantic compatibility**：舊 client 要繼續得到「大多數合理開發者會期待」的結果；AIP 明說這一層常常需要 judgment。[3]

AIP-180 同時規定：舊 client 必須能對新 server 工作（同一個 major version）；新增 component 可以，但 server 原本會填的欄位必須繼續填；移除或改名是 backward incompatible；enum 增加值要小心，因為 client 不一定優雅處理。[3]

這三層直接對應到後面三種 parity 的盲區：

- endpoint parity 大致只看 wire 的「有沒有這個 route」。
- screen parity 只看 UI 有沒有這個入口。
- capability parity 才要求 semantic 的結果一致。[3]

### 1.4 手機 client 的不可回滾性，讓 drift 的成本不對稱

Mobile at Scale 的整理：舊版 app 會在野外存在很多年；除非採取強制升級政策，否則總有一條 long tail。多數使用者幾天內會更新，但有些人關掉自動更新、有些人的裝置或 OS 不支援新版。[8]

同一份來源還指出：**即使是 non-breaking 的 backend change，也可能弄壞舊版 app**，例如改變某個 response 的內容；他們建議用 strongly typed、generated contract（Thrift、GraphQL 之類）取代「REST + 手寫 validation」，因為手寫的介面「is bound to get out of sync」。[8]

這一點和 web 完全不同：web 的 deploy 等於所有使用者同時換版；mobile 的 deploy 只是把新版本放進商店，舊 binary 還在打同一個 backend。[8]

---

## 2. capability parity vs screen parity vs endpoint parity

先給工作定義（標記為推論，因為這三個詞不是標準術語）：

| 單位                  | 工作定義                                                                                                   | 主要證據                                        | 典型問法                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| **Capability parity** | 同一個使用者在同一 entitlement、同一資料狀態下，兩個 client 都能完成同一個 job，並得到語意相同的可觀察結果 | user action + observable result + API semantics | 「這個使用者能不能在兩個 client 上做到同一件事，且結果相同？」 |
| **Screen parity**     | 兩個 client 有對應的畫面、欄位、按鈕與 navigation 路徑                                                     | UI inventory、screen flow                       | 「這兩個 client 的這個畫面長得一樣嗎？」                       |
| **Endpoint parity**   | 兩個 client 呼叫的 backend route / method / payload 集合一致                                               | OpenAPI、route table、request log               | 「這個 client 有沒有打這個 endpoint？」                        |

### 2.1 Capability parity：以「job + 可觀察結果」為單位

Fowler 的 user actions 段落要求記錄：角色、看得到的 feature、可執行的 action、涉及的 screen、資料、validation，以及「What observable result is there for a user taking the action?」[1]

把這句話改寫成 audit 單位，就是 capability：`角色 × job × 前置狀態 → 可觀察結果`。screen 與 endpoint 都只是這個 cell 的實作證據。(推論)

這個定義的好處是它自然包含「語意」：AIP-180 的 semantic compatibility 要求舊 client 得到合理開發者期待的結果，而不是只有 HTTP 200。[3]

### 2.2 Screen parity：把平台差異誤判成缺陷

Screen parity 在實務上很容易量，因為你可以截圖、可以列 component、可以數按鈕。但它有兩個結構性問題：

1. **平台本來就該不同**。Newman 說 mobile 想做的呼叫更少、不同，顯示的資料也更少；BFF 的整個論點就是讓不同 client 有不同 backend。[9][11]
2. **同一個 capability 可以有多個 screen 實作**。Fowler 把 screen 放在 user action 底下，而不是反過來。[1]

所以 screen parity 適合當「UI regression 的 smoke test」，不適合當 parity audit 的主單位。(推論)

Airbnb 的跨平台經驗是一個具體警告：工程師通常會在自己比較熟的那個平台開發，然後假設另一邊也會正常；「Most of the time, this was true... However, it was untrue often enough that it ended up causing frequent issues late in QA cycles or in production.」[30]

這段話同時說明了 screen parity 的誘惑與陷阱：你以為兩邊畫面都在，就等於兩邊能力都在；實際上測試與除錯的注意力只落在一個平台。[30]

### 2.3 Endpoint parity：必要，但會產生大量假陽性

Endpoint parity 的優點是可自動化：比對 route table、OpenAPI、request log 就能算覆蓋率。Pact 的 matrix 與 `can-i-deploy` 就是把「consumer 版本 × provider 版本 × 驗證結果」變成一張可查的表。[6]

但 endpoint parity 有三個假陽性來源：

- **Route 在，語意不在**。AIP-180 的 semantic compatibility 明說，行為或語意的改變即使 wire 沒變，也可能 break 合理的 user code。[3]
- **Route 在，client 沒真的用**。endpoint 被列在 client 的 API wrapper 裡，不代表某個 capability 有走這條路。(推論)
- **Route 不在，capability 還在**。同一個 job 可能經由另一個 endpoint、BFF aggregation、或 GraphQL query 完成。(推論)

反過來，endpoint parity 也有假陰性：兩個 client 都打同一個 endpoint，但其中一邊把 response 欄位丟掉、或把 enum 未預期值當成 default，結果語意不同。[3][17]

Stripe 的做法是把「什麼算 compatible」寫成清單：新增 resource、新增 optional request parameter、新增 response property 都算 backward-compatible；移除或改名欄位則不是。Account 第一次打 API 時會被 pin 到當下的版本，之後除非明確升級，否則不會收到 breaking change。[4][5] 這說明 endpoint 清單本身不是 parity；版本 pinning 才是讓 endpoint 後面的語意可以被信任的機制。[4][5]

所以 endpoint parity 最好的定位是 **evidence layer**：它能快速指出「這裡值得看」，但不能單獨回答「parity 完成了沒」。[3][24]

### 2.4 為什麼 capability 是 parity audit 的正確單位

四個理由：

1. **它對齊使用者價值，而不是實作**。Fowler 的驗收點是 observable result；ThoughtWorks 對 feature parity 的批評也是「照抄舊功能」而不是「照抄舊畫面」。[1][2]
2. **它容許合法的平台差異**。BFF 的前提就是 mobile 與 web 的需求不同；用 capability 當單位，才不會把「mobile 少一個 table column」誤判成缺陷。[9][11]
3. **它能把 endpoint 與 screen 都收成證據**。一個 capability 可以有多個 screen、多個 endpoint、多個 validation 實作；audit 的任務是確認這些實作合起來能產生同一個結果。(推論)
4. **它可以直接接上嚴重度與優先級**。capability 缺失可以用 reach × impact 來排序；screen 缺失很難，因為不是每個 screen 都對應一個 job。[23]

一句話：**capability 是「什麼必須一致」，screen 與 endpoint 是「你怎麼知道它一致」。** (推論)

### 2.5 什麼時候可以用 screen / endpoint 當 proxy

不是所有團隊都有資源做完整的 capability inventory。可用 proxy 的情境：

- **Early-stage audit**：先用 endpoint 清單找出「兩個 client 呼叫面差異最大」的區域，再人工轉成 capability。[24]
- **UI regression**：screen parity 當 smoke test，確認主要 flow 沒有消失。[30]
- **法規或安全**：某些 capability 有硬性要求（例如 auth、退款、個資），這時可以直接用 endpoint + authorization test 當 gate。[18]

proxy 可以加速，但最後的 release gate 還是要回到 capability。(推論)

---

## 3. 三種 parity-scoring 方法（實務上真的在用）

### 3.1 方法一：Weighted capability matrix

**長相**：列是 capability，欄是 client，cell 是狀態，最後乘上權重。

| Capability | Web  | Expo    | 權重 | 加權缺口      |
| ---------- | ---- | ------- | ---- | ------------- |
| 建立訂單   | full | full    | 5    | 0             |
| 退款       | full | partial | 4    | 4 × 0.5 = 2.0 |
| 批次匯出   | full | absent  | 2    | 2 × 1.0 = 2.0 |
| 深色模式   | full | full    | 1    | 0             |

**狀態定義**（借 VPAT 的四級，見 3.3）：`full / partial / absent / not applicable`。[21][22]

**權重怎麼定**：三個乘積，任何一個為 0 就代表這個 capability 不該進 parity 清單。

- Reach：受影響的使用者或事件數（用真實 product metrics，不要憑感覺）。[23]
- Impact：缺失時對單一使用者的傷害（用固定 scale，例如 3 / 2 / 1 / 0.5 / 0.25）。[23]
- Risk / obligation：安全、法規、退款、金流等不可協商的係數。(推論)

**分數**：`Σ(weight × gap)`，weight = reach × impact × risk，gap = absent 1.0 / partial 0.5 / full 0。(推論，組合自 [21][23])

**優點**：一張表就能跟 PM / 設計 / 工程對話；「partial」不會被隱藏。

**缺點**：權重是估計值，會產生假精確；需要有人對 weight 負責。(推論)

### 3.2 方法二：RICE-style gap scoring

Intercom 的 RICE 是 `(Reach × Impact × Confidence) / Effort`，其中 Impact 用 3 / 2 / 1 / 0.5 / 0.25，Confidence 用 100% / 80% / 50%，Effort 用 person-months 的整數。[23]

套到 parity gap 時，把「專案」換成「缺口」：

- **Reach**：這個缺口影響多少使用者／多少比例的 session。[23]
- **Impact**：缺口發生時，對單一使用者的傷害。[23]
- **Confidence**：你對 reach/impact 的估計有多確定。[23]
- **Effort**：補齊這個缺口的工作量（跨 client、含測試）。[23]

**公式**：`GapScore = (Reach × Impact × Confidence) / Effort`。(推論，套用 [23])

RICE 的價值在於它強迫你把 effort 放進分母：一個「很嚴重但要在兩個 client 各寫一次」的缺口，會自動往後排。[23]

但 RICE 也會掩蓋意圖：低分不代表「不做」，只代表「現在不做」。這正好需要 3.5 的 intentional difference 記錄來承接。(推論)

### 3.3 方法三：Supported / partial / absent rubric（VPAT 四級）

美國政府的 Section 508 採購流程要求廠商用 VPAT 產出 ACR，conformance level 只能填四種：Supports、Partially Supports、Does Not Support、Not Applicable。[21]

定義（Section508.gov 與 ITIC 的版本一致）：

- **Supports**：功能至少有一種方法符合準則，沒有已知缺陷，或提供 equivalent facilitation。[21]
- **Partially Supports**：部分功能不符合準則。[21]
- **Does Not Support**：多數功能不符合準則。[21]
- **Not Applicable**：準則與產品無關。[21]

而且規則要求：填 Partially Supports 或 Does Not Support 時，**Remarks 欄必須寫明哪裡不符合**；填 Supports 時 remarks 是鼓勵但非必要。[21]

把這個 rubric 搬到 parity，有兩個直接可用的設計：

1. `partial` 不是一個模糊詞，它必須附「哪個子功能、哪個 client、什麼缺陷」。[21]
2. `absent` 與 `not applicable` 要分開；前者是缺口，後者是「這個 capability 對這個 client 本來就無意義」。[21]

但要注意：VPAT 的 Not Applicable 是「準則不相關」，不是「我們決定不做」。所以 intentional difference 不能直接塞進 N/A，否則會把「策略選擇」偽裝成「不相關」。(推論)

建議加第五個狀態：`intentional / out of scope`，並且強制填理由、owner、到期日。(推論)

### 3.4 補充：contract-derived evidence layer（不是評分法，但實務上會一起用）

**A. OpenAPI diff**：oasdiff 這類工具把 API 變更分成 ERR / WARN / INFO，`--fail-on` 可以讓 CI 在 breaking change 時失敗；它宣稱覆蓋 773 種變更，且有 `deprecation-days-beta` / `deprecation-days-stable` 的 sunset 檢查。[24]

這量的是 **endpoint 契約的變動**，不是 capability parity；但它可以在 PR 階段就指出「這個 server 變更會讓哪些 client 的假設失效」。[24]

**B. Pact matrix**：consumer 測試產生 contract，provider 驗證後把結果寫回 broker；`can-i-deploy` 查「我這個版本能不能進這個環境」。[6]

Pact 的適用範圍有限：它適合「consumer 與 provider 都受你控制、consumer 數量可管理」的情況；不適合 public API，也不適合純 pass-through 的 BFF，因為它只檢查 response body 是否符合，不檢查 side effect。[7]

**C. Install-base coverage**：mobileatscale 建議在 deprecate endpoint 前先看 app version 分佈與流量，因為舊版會活很久。[8] Google 對 enterprise API 的承諾是最少一年通知，且只要還有人在用就不能移除。[26] AIP-185 對 beta 的建議是 180 天。[27] GitHub GraphQL 則是至少三個月前公告，變更只在每季第一天生效。[15]

這些數字不能直接當 parity 分數，但可以當「這個缺口有多急」的權重。(推論)

### 3.5 如何記錄 intentional differences，避免被反覆重提

核心問題：同一個問題會被不同人問很多次——「為什麼 iOS 沒有這個功能？」「為什麼 web 可以退款，app 不行？」如果答案只存在某個 Slack thread，就會不斷被 re-litigate。(推論)

建議用一張 parity decision record（PDR），一個 capability 一列：

| 欄位            | 內容                                           | 目的                               |
| --------------- | ---------------------------------------------- | ---------------------------------- |
| Capability ID   | 穩定的 slug，例如 `refund.partial`             | 讓討論有共同指涉                   |
| 受影響 client   | web / expo / both                              | 界定範圍                           |
| 狀態            | full / partial / absent / intentional          | 用 3.3 的四級 + 第五級             |
| 理由            | 平台限制、法規、策略、成本                     | 讓後人知道不是漏做                 |
| 證據            | ticket、ADR、設計稿、API 範例                  | 避免口說無憑                       |
| Owner           | 一個人，不是一個團隊                           | 有人要對例外負責                   |
| 決策日 / 覆核日 | 兩個日期                                       | 例外會過期                         |
| 重新開啟條件    | 例如「Expo 市占超過 X%」或「Apple 開放 Y API」 | 把「為什麼現在不做」變成可執行條件 |
| 關聯            | ADR / RFC / PR                                 | 可追溯                             |

三個操作規則：

1. **例外一定要有到期日**。沒有到期日的例外，三年後會變成沒人記得的技術債。(推論)
2. **例外不能只寫「不做」，要寫「什麼條件下會做」**。這讓未來的討論從「為什麼不做」變成「條件到了沒」。(推論)
3. **PDR 變更要進 code review**。把 parity register 放在 repo 裡（例如 `docs/parity.md`），改動就會留下 diff 與審查記錄。(推論)

這套做法和 VPAT 的 Remarks 邏輯一致：不只要填狀態，還要說明為什麼。[21]

---

## 4. 真實 client drift 失敗模式（6 個可查證案例 + 1 個 guideline 案例）

以下每個案例都照同一格式記錄：what drifted、how detected、fix、guard。

### 4.1 GitHub CLI × Projects (classic)：client 呼叫一個正在被關掉的 endpoint

**What drifted**：`gh pr edit --add-project` 背後的 GraphQL 查詢還在打 GitHub 的 Projects (classic) API；GitHub 已公告 Projects (classic) 要被淘汰，並進行了一次 brownout（短暫關閉）。使用者在 2025-03-26 下午開始大量收到錯誤：「Projects (classic) is being deprecated in favor of the new Projects experience」。[16]

**How detected**：使用者回報 issue；CLI 維護者在同一天回覆「There was a brownout of the projects classic API that caught us by surprise. Rather embarrassing for us! It has been reverted」。[16]

**Fix**：GitHub 先 revert brownout，讓 CLI 恢復；後續遷移到新的 Projects API。[16]

**Guard**：GitHub 這一側的 guard 是既有的 deprecation 流程：breaking change 至少三個月前公告、只在每季第一天生效，並且區分 breaking 與 dangerous。[15] 但這個案例暴露了 guard 的盲點：公告存在，不代表每個 client 團隊都有把「我們還在用舊 surface」變成可觀測的訊號；維護者說 brownout「caught us by surprise」。[16] GraphQL 社群的官方建議也是同一方向：先用 `@deprecated` 標記、保留欄位可用、追蹤使用量，使用量降到可接受水準才移除。[28]

**教訓**：deprecation announcement 不是 guard；**brownout 才是真的 integration test**。如果沒有辦法列出「哪個 client 還在打哪個 deprecated endpoint」，公告只是廣播，不是控制。(推論)

### 4.2 Sentry：server 少回一個欄位，大量 app 一起 crash

**What drifted**：Facebook SDK 啟動時會打一個 API 取 server configuration；其中 `restrictiveParams` 被宣告為 nullable，但程式直接對它送 `count` message。當 server 回應裡沒有這個 key，`objectForJSONString:` 回 nil，接著 `restrictiveParams.count` 就 crash。[12]

**How detected**：Sentry 的工程文章分析了這起「大量行動 app 啟動即 crash」的事件；文章描述「Facebook made a change in its SDK that caused a ridiculous number of mobile applications to crash」。[12]

**Fix**：問題是 server-side change 造成的，所以也在 server-side 解：把資料補回去。文章明說 SDK 的程式碼其實沒有改，因此「if the server were to return bad data, all applications using this SDK would crash again」。[12]

**Guard**：文章建議的 guard 是 defensive programming：預期 JSON parsing 會失敗、預期欄位會是 null 或不存在的、預期型別會錯；用 schema validation，但「don't reject data you don't know about yet」；另外要小心 retry storm，不要讓全體 client 一起重試把後端打爆。[12]

**教訓**：這是最典型的「server 端以為是 additive change，client 端卻是 fatal」。[12] AIP-180 也提醒：server 原本會填的欄位必須繼續填，即使看起來冗餘。[3]

### 4.3 Totara 10：mobile 專用的 auth endpoint 被移除，只有 mobile 壞掉

**What drifted**：Totara Learn 10 移除了 Moodle mobile tool 與 token-based authentication endpoint。這兩個東西是 mobile app 用來「協商設定、取得 token、後續通訊」的入口；移除後，使用 Moodle mobile app 或自建 mobile app 的站台，使用者無法登入，app 也無法 negotiate。[13]

**How detected**：文件說這個決定「was never communicated with the Partners or community」，後來才補了一份說明，並請受影響者回報。[13]

**Fix**：受影響的站台必須自行 restore Moodle mobile tool 與 authentication entry point，才能繼續用 app。[13]

**Guard**：事後補文件、說明決策理由與影響，並提供支援管道。[13] 這是補救，不是預防。(推論)

**教訓**：這是一個 auth divergence 的具體形狀——web 用 session，mobile 用 token endpoint（推論：Totara 主體是 web）；當團隊只看 web 的登入流程，就會低估移除 mobile auth 入口的 blast radius。[13] OWASP 也要求 server 對「每一個」endpoint 一致地驗證登入與授權，不能假設某個 client 的 flow 不會被直接呼叫。[18]

### 4.4 OneBusAway Android：legacy endpoint 回 404，app 卻「黏」在舊 URL

**What drifted**：App 內有一條向後相容路徑，會在某些失敗條件下改用舊版 OpenTripPlanner 的 URL 格式。某次 Sound Transit 的 server 設定變動，讓舊 URL 短暫可用後又消失；app 一旦成功用過舊 URL，就會繼續用，直到使用者重裝。[14]

**How detected**：多位 Tampa 使用者在同一時間寄出 error report，內容是舊 URL 的 404；維護者一開始以為是 server-side 問題，後來才發現是 app 的 fallback 邏輯把使用者卡住。[14]

**Fix**：維護者決定重新檢視這段相容程式碼，並在確認 Puget Sound 已使用新 URL 後「yank out the compatibility code」。[14]

**Guard**：issue 後續 reopen，因為「Bus only」參數又觸發同一條舊路徑；這表示 guard 不是一次性移除，而是要有測試涵蓋「fallback 不會被永久採用」。[14]

**教訓**：endpoint 的「存在」不是二元狀態；對舊 client 來說，一次成功的 200 就可能把錯誤路徑寫進 local state。(推論)

### 4.5 Shopify Checkout SDK：同一套商業規則在每個平台重寫，能力就分岔

**What drifted**：Shopify 的 Ilya Grigorik 描述 checkout 的複雜度：merchant 的 business rules 不只在 backend，也編碼在 UI 裡（哪些條款、優惠、內容要顯示、動態回應 buyer context）。如果只提供 API，讓每個平台自己實作，「At best, you're stuck reimplementing logic across every platform. More likely, you're juggling a patchwork of inconsistent capabilities and a hefty recurring dev+maintenance bill.」[29]

**How detected**：這是架構層級的觀察，不是單一 incident；來源描述的是合作夥伴與 merchant 在 API-only checkout 上的長期痛苦。[29] `(推論)`：實際 detection 多半來自 merchant 回報「某一邊的 checkout 行為不同」。

**Fix**：Shopify 的做法是把 web checkout 包成 managed runtime，再用 iOS / Android SDK 暴露同一個 runtime；來源說結果是「consistent across all platforms, always in sync」。[29]

**Guard**：單一 runtime + SDK 版本化，讓商業規則只有一份；而不是靠兩個 client 團隊「記得同步」。[29]

**同類風險的 security 版本**：AppSecEngineer 的案例裡，split payment 的 UI 在 group settled 後把 chat 關掉，但 API 仍接受 `comment_add`，因為 server 沒有檢查 group status；測試者只要重放請求、改 UUID 就能在已結算的群組發言。[20] 這是「同一條規則在 UI 與 API 各寫一次」的直接後果，修法是 server-side authorization check，並確保 UI 與 backend 狀態同步。[20]

**教訓**：商業規則只要被複製到第二個地方，就有第二個真相；「兩邊都寫了 validation」不是 defense in depth，而是兩個獨立的 bug 來源。[29][20] Airbnb 的 React Native 經驗是另一個成本證據：他們最後發現自己是在維持三個平台而不是兩個，最後決定停止新功能並逐步轉回 native。[33]

### 4.6 RevenueCat：同一條 transfer 規則，iOS 與 Android 行為不同

**What drifted**：使用者回報「Transfer if there are no active subscriptions」這個 restoration 策略在 iOS 與 Android 不一致：iOS 會正確阻止 transfer 並回 `RECEIPT_ALREADY_IN_USE_ERROR`；Android 雖然回錯誤，但 transfer event 仍然發生。[31]

**How detected**：使用者在社群論壇提供完整重現步驟（兩個使用者、同一裝置、logout/login、restorePurchases），並指出 sandbox 也重現。[31]

**Fix**：RevenueCat support 回覆「transfer behavior should largely behave similarly」，但指出 Google 與 Apple 的 receipt 技術細節不同，請使用者開 ticket、提供 app user IDs 以便內部追查。[31]

**Guard**：來源沒有公開後續 guard，`(未能查證)`。

**教訓**：即使你以為自己在實作「同一條規則」，只要規則的輸入來自兩個平台供應商，就可能變成兩套語意。這種 drift 不會出現在你的程式碼 diff 裡。[31] `(推論)`

### 4.7 Zalando API guidelines：client 把不認識的欄位在 PUT 時消滅

**What drifted**：Zalando 的 guideline issue 描述一個常見實作：client 先 GET，映射成 domain object，編輯，再映射回 JSON 做 PUT。如果 client 在 GET 時忽略未知欄位，PUT 時又只送自己認識的欄位，server 上那些「client 不認識但有意義」的資料就會被清掉。[17]

**How detected**：這是 guideline review 時辨識出的 failure mode，不是 production incident。[17] `(推論)`

**Fix**：guideline 要求 client 對 response 的未知欄位要 tolerant，但「do not eliminate them from payload if needed for subsequent PUT requests」。[17]

**Guard**：把「保留未知欄位」寫進 API guideline 與 review checklist；技術上可用「raw JSON merge」而不是「domain object round-trip」。[17] `(推論)`

**教訓**：additive change 只有在 client 願意保留未知資料時才真的 additive；否則「新增欄位」在下一次寫入時會變成「刪除欄位」。[17][3]

### 4.8 案例對照

| 案例                               | Drift 的形狀                      | 偵測方式                    | Fix                     | Guard                                                  |
| ---------------------------------- | --------------------------------- | --------------------------- | ----------------------- | ------------------------------------------------------ |
| GitHub CLI × Projects classic [16] | client 打已 deprecate 的 endpoint | 使用者回報錯誤              | revert brownout、遷移   | 三個月公告 + 每季變更窗口 [15]；但缺 client 端使用盤點 |
| Sentry / Facebook SDK [12]         | server 少回欄位，client crash     | crash 監控                  | server 補資料           | defensive parsing、schema validation、不拒絕未知資料   |
| Totara 10 [13]                     | mobile 專用 auth endpoint 被移除  | 事後 partner/community 回報 | restore tool + endpoint | 事後補文件（補救型）                                   |
| OneBusAway [14]                    | 舊 endpoint 404，fallback 卡住    | 使用者 error report         | 移除相容路徑            | 重新開啟 issue、補測試                                 |
| Shopify Checkout [29]              | 商業規則在每個平台重寫            | 架構觀察 / merchant 痛點    | 單一 managed runtime    | 共用 runtime + SDK                                     |
| RevenueCat [31]                    | 同一規則在 iOS/Android 語意不同   | 使用者重現步驟              | 開 ticket 追查          | 未公開 `(未能查證)`                                    |
| Zalando [17]                       | client 在 PUT 時消滅未知欄位      | guideline review            | 保留未知欄位            | guideline + review checklist                           |

---

# 對 LinkCard 的含意

## 5.1 前提

- 一個 Expo app（native，binary 已在外，無法強制回滾）。
- 一個 Next.js app（web，deploy 與 backend 大致同步）。
- 同一個 Express backend。
- **沒有 generated client**：兩邊各有一層手寫的 fetch wrapper + DTO / type。

這個組合的關鍵風險不是「程式碼品質」，而是「兩個手寫介面層會各自演化」。[8] Mobile at Scale 明確說，手寫 REST validation 的介面「is bound to get out of sync」，建議用 generated contract。[8]

## 5.2 三個最可能的 failure mode，以及各一個單一量測

#### Failure mode 1：路由／請求契約漂移（endpoint 消失或語意改變）

**長相**：Express 改了 route 名稱、method、query param 語意，或把某個 handler 搬走；Next.js 因為一起 deploy 而立刻修好，Expo 舊版還在打舊路徑，得到 404 / 405 / 400。這和 GitHub CLI 的形狀一樣：client 還在用一個 server 已經不要的 surface。[16]

**為什麼最可能**：web 與 backend 同一個 release cadence，會把「舊路徑不用了」的訊號掩蓋掉；mobile 的 long tail 讓舊路徑仍然有流量。[8]

**單一量測**：

> **`old_client_4xx_rate[route]` = 該 route 上，`X-Client-Version` 不在最近 N-1 個版本的請求中，回 404/405/400 的比例。**

這個數字會直接指出「哪一條 route 正在被舊 Expo 打，而且已經壞了」。它需要兩個前提：每個請求帶 `X-Client-Platform` 與 `X-Client-Version`；以及一份「目前支援哪些版本」的清單。[8]

（若沒有版本標頭，先用量測 0：`% of requests with client version header`。這個數字不到 100%，後面三個量測都不可信。）(推論)

#### Failure mode 2：欄位契約漂移（server 加了欄位，client 沒接；或 client 寫回時丟掉）

**長相**：Express 回傳新增的 `refundEligible`、`feeBreakdown`、新的 enum value；Next.js 的 DTO 有更新，Expo 的 mapper 沒有，於是畫面「少一個功能」但不 crash。反過來，Expo 在 PUT 時只送自己認識的欄位，把 server 的新欄位消滅。[17][32]

這比 crash 更難發現，因為沒有 error。[12][17]

**為什麼最可能**：沒有 generated client，就沒有單一 schema 可以比對；兩邊的 type 是手寫的，新增欄位不會讓任何一邊編譯失敗。[8]

**單一量測**：

> **`contract_drift_count` = 每晚以 OpenAPI（或 Express route schema）為基準，對每個 client 的 DTO / field map 做 diff，計算「server 有、client 沒有」+「client 有、server 沒有」+「型別不同」的欄位數。**

分類用 AIP-180 的規則：新增 optional 欄位是 compatible；移除、改名、改型別、把 optional 變 required 是 breaking；enum 新增值要標 dangerous。[3] oasdiff 這類工具已經把這些規則自動化，可以直接放進 CI。[24]

**輔助量測（production）**：對每個 response 欄位記 `present_rate`，對每個 client 記 `read_rate`（如果有 instrument）；兩者差距最大的欄位就是「server 給了但 client 沒用」的候選。(推論)

#### Failure mode 3：auth / permission 分岔

**長相**：Next.js 用 httpOnly cookie session（含 CSRF 保護），Expo 用 bearer token（含 refresh）；兩邊的 middleware、role check、resource ownership check 是分開寫的。結果可能是：某個 endpoint 只在 web 的 middleware 被保護，Expo 直接打就繞過；或某個 role 在 web 被擋、在 Expo 被放行。[18][19]

**為什麼最可能**：auth 是最容易被「各自實作」的一層，因為兩個 client 的 token 取得方式本來就不同；而 server 的檢查如果依賴 client 傳來的 context（而不是自己重算），就會出現 divergence。[18][19]

**單一量測**：

> **`authz_differential_pass_rate` = 對「endpoint × role × client transport」的矩陣，用同一組請求分別以 web session 與 Expo bearer token 重放，比較 HTTP status 與 response body；分母是矩陣 cell 數，分子是兩邊結果一致的 cell 數。**

這個量測的邏輯和 Pact matrix 一樣：把「誰能打什麼」變成一張可檢查的表。[6] 不同的是它測 authorization，不是 response schema。

**輔助 guard**：server 端對每個 request 都重新做 authentication + authorization，不信任 client 傳來的 role / user id；這是 OWASP 對 mobile API 的明確要求。[18] Reversec 的案例更極端：DBD+ 用一個寫在 client 裡的 signing key 當授權依據，server 沒有用 session token 檢查權限，結果可以對別人的鎖發動任意請求。[19]

## 5.3 三個 failure mode 的優先級

| Failure mode           | 使用者感受                       | 偵測難度           | 建議順序               |
| ---------------------- | -------------------------------- | ------------------ | ---------------------- |
| 路由／請求契約漂移     | 立刻壞、看得到                   | 低（4xx 就有訊號） | 1                      |
| Auth / permission 分岔 | 可能被利用、也可能只是功能不能用 | 中（需要矩陣測試） | 2                      |
| 欄位契約漂移           | 安靜地少功能或資料被清掉         | 高（沒有 error）   | 3（但 guard 要做最早） |

順序的理由：路由漂移最容易觀測，先用 log 止血；auth 分岔的 blast radius 最大，但需要測試基礎建設；欄位漂移最安靜，所以要用 CI 的 schema diff 提前擋，而不是等 production。[16][18][17]

## 5.4 最小 parity register（LinkCard 版）

不用一開始就做完整 capability inventory。先做三張表：

1. **Capability list**：10–20 個使用者 job，每個 job 一行；欄位是 `job / web / expo / 權重 / 證據`。[1]
2. **Contract list**：每個 capability 對應的 endpoint + response 欄位；用來跑 `contract_drift_count`。[24]
3. **Authz matrix**：endpoint × role × client transport；用來跑 `authz_differential_pass_rate`。[6][18]

每張表都要有 owner 與 review date；intentional difference 用 3.5 的 PDR 記錄。(推論)

## 5.5 不建議做的事

- **不要用 screen 截圖當 parity 的完成定義**。Expo 與 web 的 navigation、gesture、螢幕尺寸本來就不同；用截圖比對會把資源花在錯的地方。[9][11]
- **不要用 endpoint 覆蓋率當 release gate 的唯一條件**。route 存在不代表語意一致；AIP-180 的 semantic compatibility 需要另外測。[3]
- **不要讓兩個 client 各自實作同一條商業規則**。Shopify 的結論是：API-only 會導致每個平台重寫，最後得到 inconsistent capabilities；解法是共用 runtime 或至少共用 schema。[29]
- **不要只發 deprecation 公告就移除 endpoint**。GitHub 的 brownout 案例顯示，公告不等於 client 團隊知道自己還在用；要有「誰在打舊 surface」的盤點。[15][16]

## 5.6 30 天內可以做的量測

1. 讓所有請求帶 `X-Client-Platform` / `X-Client-Version` / `X-Request-Id`；先量覆蓋率。[8]
2. 從 Express route table 產生 OpenAPI（或至少 JSON schema），跑第一次 `contract_drift_count`。[24]
3. 用 staging 跑一次 `authz_differential_pass_rate`，先只涵蓋 5 個高風險 endpoint（退款、訂單、個資、後台、邀請）。[18]
4. 把三個數字放進同一張 dashboard，每週看趨勢；不要等到 release 才看。(推論)
5. 把因 parity drift 造成的 rollback / hotfix 記成 change failure，並追 failed deployment recovery time；這會把「漂移的維修成本」變成 DORA 儀表板上看得到的數字。[25]

---

## 6. 一句話總結

Capability parity 問的是「同一個使用者能不能得到同一個結果」；screen parity 問的是「畫面像不像」；endpoint parity 問的是「有沒有打同一條路」。只有第一個能當審計單位，後兩個是證據。[1][3][9]

LinkCard 沒有 generated client，所以三個量測都必須建立在「請求可被 client 版本切分」這個前提上；先把版本標頭做出來，再談 parity。[8]

---

# 來源

1. Martin Fowler — Feature Parity（Patterns of Legacy Displacement, 2021）. https://martinfowler.com/articles/patterns-legacy-displacement/feature-parity.html
2. ThoughtWorks Technology Radar — Legacy migration feature parity（Hold）. https://www.thoughtworks.com/radar/techniques/legacy-migration-feature-parity
3. Google AIP-180 — Backwards compatibility. https://google.aip.dev/180
4. Stripe Blog — APIs as infrastructure: future-proofing Stripe with versioning（Brandur Leach, 2017）. https://stripe.com/blog/api-versioning
5. Stripe Docs — API versions（compatible vs breaking changes）. https://docs.stripe.com/api-versions
6. Pact Docs — Can I Deploy（Pact Matrix）. https://docs.pact.io/pact_broker/can_i_deploy
7. Pact Docs — When to use Pact. https://docs.pact.io/getting_started/what_is_pact_good_for
8. Gergely Orosz — The Long Tail of Old App Versions（Building Mobile Apps at Scale）. https://www.mobileatscale.com/content/posts/03-the-long-tail-of-app-versions-copy-2/
9. Sam Newman — Backends For Frontends（2015）. https://samnewman.io/patterns/architectural/bff/
10. ThoughtWorks — BFF pattern: How SoundCloud uses backend for frontends（2015）. https://www.thoughtworks.com/insights/blog/bff-soundcloud
11. Microsoft Learn — Backends for Frontends pattern（Azure Architecture Center）. https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends
12. Sentry Blog — Crash by API（Armin Ronacher, 2020）. https://blog.sentry.io/crash-by-api/
13. Totara — Totara 10 removal of the Moodle mobile tool and authentication endpoint（2020）. https://totara.atlassian.net/wiki/spaces/DEV/pages/121184012/Totara+10+removal+of+the+Moodle+mobile+tool+and+authentication+endpoint
14. OneBusAway Android — Issue #896: Legacy OTP code can exacerbate connectivity issues. https://github.com/OneBusAway/onebusaway-android/issues/896
15. GitHub Docs — GraphQL breaking changes. https://docs.github.com/en/graphql/overview/breaking-changes
16. GitHub CLI — Issue #10681: `gh pr edit` returns an error with `--add-project`（2025）. https://github.com/cli/cli/issues/10681
17. Zalando RESTful API Guidelines — Issue #792: Best Practices for implementing APIs（unknown fields on PUT）. https://github.com/zalando/restful-api-guidelines/issues/792
18. OWASP MASTG — Testing Authentication and Session Management. https://mas.owasp.org/MASTG/0x04e-Testing-Authentication-and-Session-Management/
19. Reversec Labs — Advisory: Insecure Authorization Scheme for API Requests in DBD+（2023）. https://labs.reversec.com/advisories/2023/03/insecure-authorization-scheme-for-api-requests-in-dbd-mobile-companion-application-for-megafeis-smart-locks
20. AppSecEngineer — Breaking Bad: The Business Logic Vulnerability. https://www.appsecengineer.com/blog/breaking-bad-the-business-logic-vulnerability
21. Section508.gov — How to Create an Accessibility Conformance Report Using a VPAT. https://www.section508.gov/sell/how-to-create-acr-with-vpat/
22. ITI — VPAT 2.5（conformance levels: supports / partially supports / does not support / not applicable）. https://www.itic.org/policy/accessibility/vpat/
23. Intercom — RICE: Simple Prioritization for Product Managers. https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
24. oasdiff — Breaking changes / GitHub Action. https://www.oasdiff.com/docs/github-action
25. DORA — DORA's software delivery performance metrics. https://dora.dev/guides/dora-metrics/
26. Google Cloud Blog — New API stability tenets govern Google Enterprise APIs（2021）. https://cloud.google.com/blog/topics/inside-google-cloud/new-api-stability-tenets-govern-google-enterprise-apis
27. Google AIP-185 — API Versioning（beta deprecation 180 days）. https://google.aip.dev/185
28. GraphQL.org — Schema Change Management（deprecate before removal; track usage）. https://www.graphql.org/learn/governance-versioning/
29. Shopify / Ilya Grigorik — Shopify Mobile Checkout SDKs for iOS and Android（2023）. https://www.linkedin.com/pulse/shopify-mobile-checkout-sdks-ios-android-ilya-grigorik-prvgc
30. Airbnb Tech Blog — Building a Cross-Platform Mobile Team（Gabriel Peal, 2018）. https://medium.com/airbnb-engineering/building-a-cross-platform-mobile-team-3e1837b40a88
31. RevenueCat Community — Inconsistency in "Transfer if there are no active subscriptions" behavior on Android vs. iOS（2026）. https://community.revenuecat.com/general-questions-7/inconsistency-in-transfer-if-there-are-no-active-subscriptions-behavior-on-android-vs-ios-7549
32. Martin Fowler — Refactoring Code to Load a Document（`FAIL_ON_UNKNOWN_PROPERTIES`）. https://martinfowler.com/articles/refactoring-document-load.html
33. Airbnb Tech Blog — Sunsetting React Native（Gabriel Peal, 2018）. https://medium.com/airbnb-engineering/sunsetting-react-native-1868ba28e30a
