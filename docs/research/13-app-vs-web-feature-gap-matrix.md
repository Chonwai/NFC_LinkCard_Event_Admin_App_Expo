# 13 — App vs Web 功能差距矩陣（Feiteng2015 施工前決策依據）

> **文件類型**：研究部 DISCOVER 階段交付物 — 證據級功能差距矩陣
> **掃描日期**：2026-09-18
> **Quality Mode**：strict（Pass Threshold 93）｜**Depth Level**：L3 Deep Dive
> **交付目標**：供 LinkCard Event Admin App 交棒工程師 feiteng2015 施工前決策使用
> **證據原則**：所有 Critical 結論均附「檔案絕對路徑 + 行號 + 可重跑指令」；快取檔案 `docs/.project-context.md` **僅作定位用途，不作證據**

---

## §1 方法論與證據標準

### 1.1 掃描範圍與 Repo 狀態

本次掃描不依賴任何既有快取結論。`docs/.project-context.md` 標記為 **LOCATOR-ONLY**；其 `Last Updated: 2026-09-13`，而實測已發現至少一處不一致（見 §1.4），故所有結論改以實時讀檔／grep 產出。

實時取得的三個 repo 狀態（掃描日 2026-09-18）：

| Repo | Branch | HEAD (full) | 工作區狀態 |
| --- | --- | --- | --- |
| `LinkCard_Event_Admin_App_Expo` | `main` | `e3c68b88eb630487bd17e9f99c83677905eca712` | clean |
| `LinkCard_Frontend` | `development` | `7138800e4fac49b44763f896f5d5f320a678aa10` | clean |
| `LinkCard_ExpressJS_Backend` | `staging` | `1e20977019ebe908ebf346fb0da6065553fd97db` | 2 modified + 2 untracked（皆屬 `promoter-role-admin` 工作，**與 event 模組無關**） |

驗證指令：

```bash
cd /Users/chonwai/Desktop/Self/Lab/LinkCard
for d in LinkCard_Event_Admin_App_Expo LinkCard_Frontend LinkCard_ExpressJS_Backend; do
  echo "=== $d ==="; git -C "$d" rev-parse HEAD; git -C "$d" branch --show-current; git -C "$d" status --porcelain
done
```

> ⚠️ **Backend 工作區非 clean 的影響範圍**：`scripts/promoter-role-admin.ts` 與 `tests/promoter/promoter-role-admin-anchor-provenance.test.ts` 屬 Promoter 域，不在 `src/events/**` 或 `prisma/schema.prisma` 內，對本文件之 Event 結論**無影響**。此為實測判定，非推論。

### 1.2 實際使用的 grep / rg 指令清單

以下為產出本文件時實際執行、且可由讀者重跑的指令原文。

**App 端（`LinkCard_Event_Admin_App_Expo`）**

```bash
# 全量檔案清單
find src -type f | sort

# NFC 能力實證（react-native-nfc-manager / Ndef / NfcTech）
grep -rnE 'react-native-nfc-manager|NfcManager|NfcTech|requestTechnology|ndef|NDEF' src/

# 相機能力實證（expo-camera / CameraView / onBarcodeScanned）
grep -rnE 'expo-camera|CameraView|useCameraPermissions|onBarcodeScanned' src/

# 執行期證據（DEV_LOG / PROGRESS）
grep -nEi 'nfc|camera|scan|真機|device|expo go|build' DEV_LOG.md
grep -nEi 'nfc|camera|scan|真機|verified|tested' PROGRESS.md

# 是否有自動化測試
ls -la tests
```

**Web 端（`LinkCard_Frontend`）**

```bash
# Web NFC API 是否被使用（word-boundary，避免誤命中 undefined）
grep -rnE '\bNDEFReader\b|\bnavigator\.nfc\b|NDEFMessage|\bndefReader\b|NFCReader' app components lib hooks store
# 預期：無輸出（exit 1）

# 哪些檔案提到 nfc
grep -rlEi 'nfc' app components lib hooks store | sort

# manage 頁面規模
find "app/(event)/manage" -name 'page.tsx' | xargs wc -l | sort -rn

# wallet facade 的消費端
grep -rn "events/wallet" app components lib
```

**Backend（`LinkCard_ExpressJS_Backend`）**

```bash
# 路由掛載鏈（最關鍵：端點存在 ≠ 掛載生效）
cat -n src/events/routes/index.ts

# 端點總清單
grep -rnE "^\s*router\.(get|post|put|patch|delete)\(" src/events/routes/*.ts

# checkin-stats 是否存在（B-7 的真偽）
grep -rc 'checkin-stats' src/ && echo "FOUND" || echo "ABSENT"

# Credential 模型是否存在（B-8 的真偽）
grep -c 'EventCredential' prisma/schema.prisma

# 角色閘門
sed -n '352,380p' src/events/services/EventService.ts    # getEventWriteAccess
sed -n '420,456p' src/events/services/EventService.ts    # getEventOperatorAccess
sed -n '70,95p'  src/events/controllers/EventRegistrationController.ts
```

### 1.3 證據等級定義

本文件所有矩陣格與結論，均標註以下三級之一：

| 等級 | 標記 | 定義 | 可接受作為 Critical 結論依據 |
| --- | --- | --- | --- |
| **L-A 實測** | （無標記） | 本次掃描直接讀取的原始碼行、路由掛載鏈、schema 定義。附檔案路徑 + 行號 | ✅ 是 |
| **L-B 文件宣稱** | `[文件宣稱]` | 來自既有文件（Handoff / Contract Freeze / PROGRESS / DEV_LOG）的敘述。該敘述本身可能是其撰寫時的事實，但**本次未重新驗證** | ⚠️ 需交叉核對 |
| **L-C 推論** | `[UNVERIFIED]` | 無直接證據支持，或需要執行期環境（真機、staging）才能確認。必須註明「為何無法查證」 | ❌ 否 |

**本文件最重要的方法論約束**：`src/**` 中存在某段程式碼 ≠ 該功能可用。因此「可執行性」分為四級，且**第三級與第四級的區分是本文件的核心價值**：

| 可執行性標記 | 判準 | 判準來源 |
| --- | --- | --- |
| ✅ `已實作且已跑通` | 有程式碼 + 有執行期證據（測試通過紀錄／真機紀錄／staging 實測） | `PROGRESS.md` / `DEV_LOG.md` / `tests/` |
| ⚠️ `已實作但從未執行` | 有完整程式碼，但**查無任何執行期證據**（無測試、無真機紀錄） | `ls tests` 為空 + `PROGRESS.md` 自述 |
| 🟡 `部分實作` | 有部分程式碼，但明確缺少規格要求的功能點（缺哪一點須列出） | 逐功能點對照 |
| ❌ `未實作` | 查無程式碼 | grep 無輸出 |

### 1.4 快取失效的實證（為何不得引用快取）

`docs/.project-context.md` 宣稱 `src/utils/` 有 **5 files**。實測為 **6 files**（新增 `event-status.ts`）：

```bash
find src -type f -path '*utils*' | sort
# src/utils/api-error.ts
# src/utils/event-status.ts      ← 快取未收錄
# src/utils/nfc-utils.ts
# src/utils/session-notice.ts
# src/utils/storage.ts
# src/utils/validation.ts
```

快取亦宣稱「無獨立 `docs/` 目錄」，實測 `docs/` 下已有 **18 個既有 `.md`**（含 `research/01`–`12`；加上本文件後共 19）：

```bash
find docs -type f -name '*.md' | wc -l    # → 19（含本文件）
```

此兩處不一致足以證明快取已 stale，故本文件全程採用實時掃描。

### 1.5 本文件的方法論限制（誠實聲明）

1. **多數端點的 runtime 行為未實測**。本文件對 backend 的判定基準是「原始碼 + 掛載鏈」，非「端點實際回應」。凡是「回傳形狀是否如契約所載」一類問題，標記為 `[UNVERIFIED]`。
2. **兩個 module-level 端點在路由掛載上存在覆蓋順序風險**，詳見 §3 與 §4；本文件以 `src/events/routes/index.ts:38-44` 的實際掛載順序為準，但對「同一前綴多 router 疊加時哪條先命中」僅做靜態判定，未做 runtime 探測 → 標記 `[UNVERIFIED]`。
3. **Web NFC 的「結構上不可能」判定基於平台能力 + 程式碼缺位雙重證據**，非單一來源。詳見 §2.3。

---

## §2 四端定位與能力邊界

### 2.1 四端定位對照

模組 A–G 的定義來自 `/Users/chonwai/Desktop/Self/Lab/LinkCard/docs/LinkCard Event related/20260917_LinkCard_Event_Admin_App_Plan_v1.md`（301 行；模組 A 於 `:27`、B 於 `:46`、C 於 `:69`、D 於 `:85`、E 於 `:98`、F 於 `:105`、G 於 `:118`）。該文件 §一（`:8-21`）已給出端的分工原則，本節以實測驗證其實現程度。

| 端 | 定位 | 主要使用者 | 實測承載的模組 | 核心限制 |
| --- | --- | --- | --- | --- |
| **Admin App**（Expo） | 現場作戰終端 | 現場工作人員 / 攤位 / 督導 | A（QR 掃碼）、C（NFC 寫卡）、部分 G（統計卡） | **Android-only 的 NFC 寫入**；無名單頁；無 Token 頁 |
| **Admin Web**（Next.js） | 配置／管理中樞 | 主辦方 / 運營 | D（名單）、F（org-roles）、E（部分）、**A（掃碼）** | **無 NFC 讀寫能力**；無 Token 櫃台 UI |
| **Backend**（Express + Prisma） | 唯一真相來源 | — | A / B / C / D / F 的端點 | `checkin-stats` 不存在；`EventCredential` 模型不存在 |
| **Hardware**（NFC 卡／手帶） | 實體載體 | — | C | 需 Android 裝置 + NDEF 預格式化卡片 |

### 2.2 App 端能力邊界（實測）

**NFC 寫入：已實作，但僅 Android，且從未在真機執行。**

實測證據：

```bash
grep -rnE 'react-native-nfc-manager|NfcManager|NfcTech|requestTechnology' src/
```

命中集中在 `src/utils/nfc-utils.ts`（唯一實作點）：

| 位置 | 內容 |
| --- | --- |
| `src/utils/nfc-utils.ts:6-12` | 註解明載：`react-native-nfc-manager` 在 web 的 top-level import 會崩潰（`Cannot read properties of undefined (reading 'onDiscoverTag')`）→ 採 **dynamic import** 惰性載入 |
| `src/utils/nfc-utils.ts:17-23` | `loadNfcManager()` — `if (!isNative) throw new Error('NFC is not supported on web')` |
| `src/utils/nfc-utils.ts:52-53` | `NfcManager.requestTechnology(NfcTech.Ndef)` |
| `src/utils/nfc-utils.ts:57` | `NfcManager.ndefHandler.writeNdefMessage(bytes)` |
| `src/utils/nfc-utils.ts:74-75` | `isNfcSupported()` — web 恆回 `false` |
| `src/utils/nfc-utils.ts:84-85` | `startNfc()` — web 直接 no-op |

消費端為 `src/app/(auth)/[eventId]/nfc-bind.tsx`，其 `writeAndBind()` 有一段**硬性平台阻擋**：

```ts
// src/app/(auth)/[eventId]/nfc-bind.tsx:74-78
// iOS 不支援實體寫卡（資訊層提示），主要使用裝置為 Android
if (Platform.OS === 'ios') {
    Alert.alert(copy.nfc.iosWriteNotSupported);
    return;
}
```

驗證指令：

```bash
grep -n 'Platform.OS === '\''ios'\''' -B2 -A4 "src/app/(auth)/[eventId]/nfc-bind.tsx"
# 74-        // iOS 不支援實體寫卡（資訊層提示），主要使用裝置為 Android
# 75:        if (Platform.OS === 'ios') {
# 76-            Alert.alert(copy.nfc.iosWriteNotSupported);
# 77-            return;
# 78-        }
```

**結論**：NFC 寫卡在此 App 中事實上是 **Android-only 功能**。App 亦已正確設定兩平台權限（`app.json`：iOS `NFCReaderUsageDescription`、Android `permissions: [CAMERA, NFC]`）。

**相機（QR 掃碼）：已實作。**

```bash
grep -rnE 'expo-camera|CameraView|onBarcodeScanned' src/
# src/app/(auth)/[eventId]/check-in.tsx:14   import { CameraView } from 'expo-camera';
# src/app/(auth)/[eventId]/check-in.tsx:282  <CameraView
# src/app/(auth)/[eventId]/check-in.tsx:285  onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
```

`check-in.tsx` 有雙模式（`mode: 'scan' | 'manual'`，`:133`）、去重掃描防護（`onBarcodeScanned` 於 `:192` 檢查 `state.phase !== 'idle'` 時 return）、3 秒自動重置（`:180-186`，`setTimeout(..., 3000)`）。

**但 camera 從未在真機執行** — 證據見 §2.5。

### 2.3 Web 端能力邊界：「無 NFC」是結構性的，不是尚未做

**實測：整個 Frontend repo 沒有任何一行 Web NFC API 呼叫。**

```bash
grep -rnE '\bNDEFReader\b|\bnavigator\.nfc\b|NDEFMessage|\bndefReader\b|NFCReader' app components lib hooks store
# → 無輸出（exit 1）
```

> ⚠️ 方法論註記：若以 `grep -i ndef`（無 word boundary）搜尋，會大量誤命中 `undefined`。本文件的結論基於上述 word-boundary 指令。

Web 端與 NFC 相關的檔案僅有 5 個（`grep -rlEi 'nfc' app components lib | sort`）：

| 檔案 | 與 NFC 的關係 | 是否具備讀取能力 |
| --- | --- | --- |
| `lib/events/nfc.ts` | API facade（`bindNfcBadge` 等 HTTP 呼叫） | ❌ 純 HTTP |
| `lib/events/types.ts` | `NfcBadgeType` 型別 | ❌ |
| `app/check-in/[eventId]/nfc/page.tsx` | NFC 綁定表單 | ❌ **uid 靠人手輸入** |
| `app/(event)/manage/[eventId]/badges/page.tsx` | Badge 庫存列表 | ❌ |
| `lib/events/apiClient.ts` | 通用 fetch 封裝 | ❌ |

**最關鍵的一項實證**：Web 的 NFC 綁定頁，`tagUid` 是一個**純文字輸入框**，不是讀取器。

```tsx
// app/check-in/[eventId]/nfc/page.tsx:107-118
<label ...>{t('nfc.tag_uid')}</label>
<input
    type="text"
    value={tagUid}
    onChange={e => setTagUid(e.target.value)}
    placeholder="04:AB:CD:12:34:56:78"
    required
    ...
/>
```

其提交邏輯（`:39`）為 `await bindNfcBadge(eventId, registration.id, tagUid, { badgeType })` — 即 **tagUid 完全由操作者肉眼抄寫／鍵入**。

**結構性原因（雙重證據）**：

1. **程式碼證據**（實測）：Web 端無任何 NDEF／NFC 讀取實作（上表 grep 無輸出）。
2. **平台能力證據**：Web NFC（`NDEFReader`）截至掃描日僅在 Chromium on Android 可用；**iOS Safari 不支援 Web NFC**，而桌面 Chrome 亦不支援。而 `app/check-in/layout.tsx:3-6` 的註解明載此介面是為 **tablet-optimized / outdoor use** 設計。
   > 此平台能力陳述為本文件撰寫時的外部知識，非本次掃描可驗證之程式碼事實 → 標記 `[文件宣稱]`。惟其**結論**（Web 無 NFC 讀寫）由第 1 點的程式碼證據獨立成立。

**因此責任分工的必然結果**：NFC 發卡（模組 C 的寫卡與讀卡）**只能由 App 承擔**。Web 的 `check-in/[eventId]/nfc` 頁面實質是一個 **「手抄 UID 的後備入口」**，無法作為現場發卡主流程。

### 2.4 Web 端的 QR 能力：已實作，且是三個 Check-in 入口之一

實測 Web 的 QR 掃碼使用瀏覽器相機套件：

```bash
grep -n 'react-qr-scanner' "app/check-in/[eventId]/page.tsx"
# :8  import { Scanner } from '@yudiel/react-qr-scanner';
```

依賴版本：`@yudiel/react-qr-scanner ^2.3.1`（`LinkCard_Frontend/package.json`；驗證：`python3 -c "import json;print(json.load(open('package.json'))['dependencies']['@yudiel/react-qr-scanner'])"`）

**重要發現 — Web check-in 路由在導覽中不可達**：

`app/check-in/layout.tsx` 的註解（`:3-6`）說明這是 operator layout（無 header、無 footer、全螢幕深色）。實測 `app/(event)/manage/[eventId]/layout.tsx:167-189` 的導覽項目共 12 項，**不含 check-in**：

```bash
grep -rn 'check-in' app components lib 2>/dev/null | grep -v '^app/check-in/'
# → 無輸出（無任何頁面連結到 /check-in/:eventId）
```

即 Web 的掃碼簽到需要操作者**直接輸入 URL**（例如 `/check-in/<eventId>`）。此為可執行性與可運營性的落差，列入 §5 責任分工。

### 2.5 執行期證據的共同缺口（本節最重要結論）

三個端共通的問題：**絕大多數功能「已實作但從未執行」**。

`PROGRESS.md` 自述（`[文件宣稱]`，但與實測一致）：

```bash
grep -n '驗證真相' PROGRESS.md
# :190  🔴 驗證真相：**真機 0 / EAS build 0 / 自動化測試 0**；12 項 web E2E 全靠 `.env.local` 才成立
```

實測交叉驗證「自動化測試 0」：

```bash
ls -la tests
# ls: tests: No such file or directory
```

且 NFC 寫卡的真機驗證在 `PROGRESS.md` 中仍是**未勾選**狀態：

```bash
grep -n '真機 NFC' PROGRESS.md
# :84  - [ ] **真機 NFC 寫卡**：需 Android + NTAG 卡（web 只能顯示不支援）
```

> `[UNVERIFIED]`：`PROGRESS.md` 為 2026-09-12 更新，其內容是否仍反映 2026-09-18 現況無法從檔案本身判定；但 repo 內**查無任何真機測試紀錄檔**（`logs/`、`tests/` 皆不存在），故「從未執行」的判定在本次掃描中無反例。

---

## §3 逐模組差距矩陣

### 3.0 模組定義與 App 端服務層全貌

模組 A–G 依 `20260917_LinkCard_Event_Admin_App_Plan_v1.md` 定義：A `:27`、B `:46`、C `:69`、D `:85`、E `:98`、F `:105`、G `:118`。

App 服務層**全部**函式（實測，這是判斷 App 能力上限的關鍵）：

```bash
for f in src/services/*.ts; do echo "### $f"; grep -nE 'async [a-zA-Z]+\(' "$f"; done
# ### src/services/auth.service.ts
# 12:    async login(...)      21:    async me(...)
# ### src/services/event.service.ts
# 18:    async getMyManagedEvents(...)   42:    async getRegistrations(...)
# ### src/services/nfc.service.ts
# 12:    async lookup(...)   26:    async listBadges(...)   43:    async bind(...)
# ### src/services/registration.service.ts
# 11:    async getByCode(...)   19:    async checkIn(...)
```

**共 9 個 API 方法**。注意其中**沒有任何 wallet / token 方法** —— 這單一事實即決定了模組 B 在 App 端的判定。

App 逾時設定 `API_TIMEOUT_MS = 15000`（`src/constants/config.ts:40`），fail-closed guard 存在於 `config.ts:16-18`（非 dev 且缺 `EXPO_PUBLIC_API_URL` 即 throw）—— 與 stale 快取所述「無 fail-closed throw」**相反**，此為 W-09 已完成的證據。

---

### 3.1 模組 A — QR 掃碼簽到

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | `src/app/(auth)/[eventId]/check-in.tsx`（428 行）。相依三服務：`registration.service.ts:19 checkIn()`（25 行）、`registration.service.ts:11 getByCode()`。相機：`check-in.tsx:14` import `CameraView`；`:282-285` 渲染 + `onBarcodeScanned`。狀態機：`:28-31`（`idle`/`loading`/`result`）。雙模式：`:133`。去重：`:192`。3 秒重置：`:180-186`。錯誤映射：`:37-42`（4 碼） | ⚠️ **已實作但從未執行**（無真機紀錄、無 `tests/`） |
| **Web** | `app/check-in/[eventId]/page.tsx`（126 行）。`:8` import `@yudiel/react-qr-scanner`；`:44-70` `handleScan` 呼叫 `checkIn`；`:74-77` 3 秒自動重置；`:20-25` 4 碼錯誤映射；`:36-43` 成功卡 | ⚠️ **已實作但從未執行** |
| **Backend** | `POST /api/v1/events/:eventId/registrations/checkin` — `registrations.routes.ts:74`（掛載：`index.ts:39` → `src/events/routes/index.ts:39`；app 層 `src/app.ts:153`）。重複簽到判定：`EventRegistrationService.ts:1042-1044` → `throw new Error('ALREADY_CHECKED_IN')`（**無條件拋出，無 override 參數**）。操作員入帳：`EventRegistrationService.ts:1056` `checkedInBy: operatorUserId` | ✅ 端點已掛載生效（靜態判定） |

**缺口盤點（模組 A，逐功能點對照 Plan `:27-46`）**：

| Plan 要求的功能點 | App | Web | Backend |
| --- | --- | --- | --- |
| 啟動相機即時掃碼 | ✅ `check-in.tsx:282` | ✅ `page.tsx:8` | — |
| ✅ 有效：顯示姓名/公司/票種/報名時間/Token 餘額/簽到狀態 | 🟡 僅姓名/Email/公司/類型/報到時間（`check-in.tsx:99-118` 之 5 列）；**無票種、無 Token 餘額** | 🟡 僅姓名/公司/報到時間 | — |
| ⚠️ 重複簽到：顯示首次時間與**地點**，需**主管覆核**才能二次放行 | ❌ 只顯示錯誤文案（`:38`），無覆核流程 | ❌ 同左 | ❌ `:1044` 無條件拋錯，**無 override**；**無 `gateId` 欄位** |
| ❌ 無效/未報名 → 現場補報名快速通道 | ❌ 無（App 無補報名能力） | 🟡 `POST /registrations`（`registrations.routes.ts:61`）存在，但**不在 check-in 頁內**（無快速通道 UI） | ✅ 端點存在 |
| 震動 + 音效 + 大字綠色畫面 | ❌ `package.json` **無** `expo-audio`/`expo-av`/`expo-haptics`（實測依賴清單） | ❌ 無 | — |
| 單日/單場簽到計數即時顯示 | ❌ | ❌ | ❌ `checkin-stats` 不存在（§4 查核） |
| 寫入時間戳 / **閘口編號** / 操作員 ID | 🟡 時間戳 ✅（`:1055`）、操作員 ✅（`:1056`）；**閘口編號 ❌** | 🟡 同左 | 🟡 無 `gateId` 欄位 |

**11 月可行性**：**高**。三端主流程皆已存在（掃碼 → API → 結果），剩餘為 UI 擴充（票種／餘額／大字）與後端新增欄位（`gateId`、override）。音效是**唯一的套件決策點**，且有「無音效降級」選項，不構成阻斷。

---

### 3.2 模組 B — Token 積分增扣

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | ❌ **完全未實作**。9 個 service 方法中無 wallet；`find` 無 token/wallet 頁面 | ❌ 未實作 |
| **Web** | `lib/events/wallet.ts`（66 行）提供 `getWalletBalance:27`、`listWalletTransactions:34`、`topUpWallet:52`。**唯一消費者**：`app/(event)/my-tickets/[registrationId]/wallet/page.tsx:18` — 這是**參加者自助頁**，不是工作人員櫃台 | 🟡 部分實作（**無工作人員端 UI**） |
| **Backend** | `src/events/routes/premium.routes.ts:13` GET balance、`:14-18` GET transactions、`:19` POST top-up、`:20` POST deduct。掛載：`src/events/routes/index.ts:43` `router.use('/:eventId', premiumRoutes)` → ✅ **已掛載生效** | ✅ 端點已掛載生效 |

驗證掛載（此為 Plan §4 特別要求查核項）：

```bash
cat -n src/events/routes/index.ts | sed -n '38,44p'
# 38  router.use('/:eventId/exhibitors', exhibitorRoutes);
# 39  router.use('/:eventId/registrations', registrationRoutes);
# 40  router.use('/:eventId', eventOpsRoutes);
# 41  router.use('/:eventId', sessionsPollsRoutes);
# 42  router.use('/:eventId', engagementRoutes);
# 43  router.use('/:eventId', premiumRoutes);     ← wallet 在此
# 44  router.use('/', eventsRoutes);
```

**缺口盤點**：

| Plan 要求（`:46-68`） | App | Web | Backend |
| --- | --- | --- | --- |
| 兩種入口（掃碼/NFC、搜尋姓名/手機/Email/編號） | ❌ | ❌（僅能由 URL 帶 `registrationId` 直達） | 🟡 無搜尋端點（B-6） |
| 增值快捷金額（+10/+50/+100）+ 自訂 | ❌ | ❌ | ✅ `top-up` 接受 `amount` |
| 標記來源（攤位購買／活動獎勵／補發／贊助） | ❌ | 🟡 facade 傳 `referenceCode` | 🟡 `WalletTransactionType` 枚舉有 `TOP_UP`/`ADMIN_ADJUSTMENT`/`INITIAL_ALLOCATION`/`DEDUCTION`/`EXPIRY`（`schema.prisma:1306-1312`），但 `sourceType` 為自由字串（`schema.prisma:1325`） |
| 扣減（兌換品項清單、餘額不足置灰） | ❌ | ❌ | ✅ `deduct` 端點存在；❌ 無品項清單概念 |
| 交易流水（時間/操作員/金額/類型/備註） | ❌ | ✅ `listWalletTransactions` | 🟡 `EventWalletTransaction`（`schema.prisma:1320+`） |
| 防呆（二次確認、單筆/單日上限） | ❌ | ❌ | ❌ |
| 冪等 | ❌ | ❌ | ❌（B-1 待做） |

**11 月可行性**：**低（全新建設）**。這是模組 A–G 中**兩端 UI 皆為空白**的唯一模組。後端端點反而最完整（4 個 live），瓶頸在**前端櫃台 UI 從零開始**，且需先解決「找不到帳戶」的搜尋能力（依賴 B-6）。Handoff 的 W-20..W-25 對應此模組（`[文件宣稱]`，見 §4）。

---

### 3.3 模組 C — NFC 手帶／掛牌綁定（發卡）

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | `src/utils/nfc-utils.ts`（85 行，唯一實作點）：`:17-23` `loadNfcManager`（web throw）、`:33` `buildUriNdefMessage`、`:52-63` `writeUriToCard`（requestTechnology Ndef → writeNdefMessage → cancel）、`:74-75` `isNfcSupported`、`:84-85` `startNfc`。流程頁：`src/app/(auth)/[eventId]/nfc-bind.tsx`（302 行）：`:73-78` **iOS 硬阻擋**、`:91-92` 寫入 `WEB_BASE_URL/u/:registrationId`、`:99-101` 綁定 API、`:71` badge type 三選項。能力探測：`src/app/(auth)/settings.tsx:57` | ⚠️ **已實作但從未執行**（Android-only；`PROGRESS.md:84` 未勾選真機驗證） |
| **Web** | `app/check-in/[eventId]/nfc/page.tsx`（145 行）：`:107-118` **tagUid 為純文字輸入框**、`:39` `bindNfcBadge`。Badge 庫存：`app/(event)/manage/[eventId]/badges/page.tsx`（890 行，`:540` 顯示 tagUid） | 🟡 部分實作（**無 NFC 讀寫能力 — 結構性**） |
| **Backend** | `event-ops.routes.ts:60` GET `/nfc/lookup`（**無 auth**）、`:61` POST `/nfc/bind`、`:66` GET `/nfc/badges`、`:67` GET `/nfc/badges/export`、`:68` POST `/nfc/batch`、`:69` POST `/nfc/batch/:batchId/complete`、`:70` POST `/nfc/batch/claim`、`:63` POST `/nfc/exchange`。掛載：`routes/index.ts:40` | ✅ 端點已掛載生效（7 個 nfc 系列端點全部存在） |

> Plan §4 特別要求查核 `nfc/batch` 系列是否真實存在並掛載生效 —— **結論：真實存在且已掛載**。`EventNfcBatchController` + `EventNfcBatchService` + `event-nfc-batch.dto.ts` 三層齊備。

**缺口盤點**：

| Plan 要求（`:69-84`） | App | Web | Backend |
| --- | --- | --- | --- |
| 簽到成功後自動跳出「發卡」步驟 | ❌ 需使用者自行從 overview 點入 | ❌ | — |
| 寫入/綁定 NFC UID ↔ Account ID | ✅ `nfc-utils.ts:52-63` + `:99-101` | 🟡 只能手抄 UID 綁定 | ✅ `/nfc/bind` |
| 綁定後成為入場憑證＋錢包載體＋Business Card 入口 | 🟡 寫入 URL `/u/:registrationId`（`nfc-bind.tsx:91`） | — | 🟡 3 者語意未在資料層區分 |
| 換卡（舊卡作廢）/ 補發 / 退卡 | ❌ **完全無** | ❌ | ❌ 無作廢/退卡端點 |
| 發卡紀錄匯出（物料盤點） | ❌ | 🟡 `badges/page.tsx` 有 export icon；端點 `:67` 存在 | ✅ `/nfc/badges/export` |
| 批次建卡 / 認領 | ❌ | ❌ | ✅ `/nfc/batch`、`/batch/:id/complete`、`/batch/claim` |

**11 月可行性**：**中**。寫卡主流程已在 App 完成（含 iOS 阻擋與 web 短路），但**「換卡/補發/退卡」在四端皆不存在**——而 Plan `:80` 明列此為需求。此為 Plan 明載「@待定＋最大未定義區塊」的乾淨證據。

---

### 3.4 模組 D — 參加者名單與現場管理

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | 🟡 **有 service 無頁面**。`event.service.ts:42 getRegistrations()` 存在，但**唯一呼叫端是 `overview.tsx:75-76`，且只用 `limit: 1` 取 total 做統計**。實測 `grep -rn 'getRegistrations' src/` 僅 3 處命中，**無任何列表／詳情頁** | ❌ **未實作**（無 UI） |
| **Web** | `app/(event)/manage/[eventId]/registrations/page.tsx`（**1256 行**）：`:38` Detail Drawer、`:24-32` 7 種狀態色、`:10-18` 消費 hide/archive/unhide/unarchive/markDepositRefund/getRegistrationActivationLink | ✅ 已實作（steam 最完整的一頁） |
| **Backend** | `registrations.routes.ts:64` GET `/`、`:84-86` hide/unhide/archive、`:88` unarchive（`router.post` 於 `:87`）、`:95` deposit-refund（`router.post` 於 `:94`）、`:78` activation-link（`router.get` 於 `:77`）、`event-ops.routes.ts:76` export/exhibitors、`:77` export/attendees、`:45` bank-transfers | ✅ 端點齊備 |

**缺口盤點**：

| Plan 要求（`:85-95`） | App | Web | Backend |
| --- | --- | --- | --- |
| 名單列表：搜尋/篩選/排序 | ❌ 無頁面 | 🟡 列表＋狀態/票種篩選；**無搜尋、無排序 UI** | 🟡 `listRegistrations` 只收 `page/limit/status/ticketTypeId/visibility/depositRefunded`（`EventRegistrationService.ts:1216-1224`）——**無 `search`/`sortBy`** |
| 用戶詳情頁（含 Token 流水、綁定 NFC 編號） | ❌ | 🟡 `:38-190` Drawer 有基本資料/付款/`token_balance`；**❗ Token 流水與 NFC 編號未見** | 🟡 |
| **現場補報名**（建臨時帳戶 → 同款 Email → 立即發卡） | ❌ | 🟡 `createRegistration` 端點存在但**無 walk-in 快速 UI** | ✅ `POST /` |
| 匯出 CSV（簽到名單、Token 消耗報表） | ❌ | 🟡 無匯出按鈕（grep 無 export/CSV 命中） | ✅ `/export/attendees`、`/export/exhibitors` |

> ⚠️ **關鍵風險**：Backend `registrations.routes.ts:64` 的 GET `/` 在 Controller 層以 `getEventWriteAccess` 把關（`EventRegistrationController.ts:78-92`），而 `getEventWriteAccess` 只放 `owner / SUPER_ADMIN / COORDINATOR`（`EventService.ts:375`）。**OPERATOR 會被 403 拒絕**（`'你沒有權限查看報名列表'` / `INSUFFICIENT_PERMISSION`）。相較之下 `getEventOperatorAccess`（`EventService.ts:420-444`，含 OPERATOR）已存在，並用於 check-in / NFC bind。
> **即：閘口 staff 能簽到，但不能看名單。** 這是 Handoff TL;DR 第 6 條的核心地雷，且**本次實測確認仍未修**（見 §4）。

**11 月可行性**：**中（Web 優先）**。Web 已有 1256 行的成熟頁面，缺的是搜尋/排序（依賴後端 B-6）與匯出按鈕。**App 端應判定為「11 月不做名單頁」**——理由是現場 3 秒操作不需完整名單，且行動裝置小螢幕的表格體驗遠劣於 Web。

---

### 3.5 模組 E — 活動憑證／會員體系的 Admin 視角

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | ❌ 無任何憑證頁面 | ❌ 未實作 |
| **Web** | ❌ **無 EventCredential 概念**。實測 `grep -rli 'EventCredential\|eventCredential' app lib components` → **無輸出（exit 1）**。存在的是 `app/(personal)/membership-pass/**` 與 `app/(personal)/dashboard/membership-pass/**`，屬**社團/協會會員**，非活動票務憑證 | ❌ 未實作 |
| **Backend** | ❌ **無模型**。實測 `grep -c 'EventCredential' prisma/schema.prisma` → **0**。相關枚舉僅 `BadgeDisplayMode`（`schema.prisma:1562`）與 `ProfileBadge`（`:1536`） | ❌ 未實作 |

**缺口盤點**：

| Plan 要求（`:98-104`） | 四端狀態 |
| --- | --- |
| Admin App 可**代用戶出示憑證**（用戶手機沒電的現場救援） | ❌ 全端未實作 |
| 可檢視用戶完整身分（社團協會會員憑證 + 活動票務憑證並列） | ❌ 全端未實作（Web 有協會會員概念但無 event 維度） |

**11 月可行性**：**極低**。Plan 已將此列為 🟡 P1（`:96`「11月最好有，可灰度」），Handoff 對應 B-8（2.0 BE 人日）+ W-31，且標記 🚫 阻斷於「Credential 模型未建」。**本次實測確認模型確實不存在**，故模組 E 的判定為：**11 月不應納入承諾範圍**。

---

### 3.6 模組 F — 工作人員帳號與權限

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | ❌ 無角色顯示、無權限門控 UI。App 的所有請求只用 `authMiddleware` 的 JWT，**不做角色判斷** | ❌ 未實作 |
| **Web** | `app/(event)/manage/[eventId]/org-roles/page.tsx`（144 行）；導覽第 11 項（`layout.tsx:187`） | ⚠️ 已實作但從未執行 |
| **Backend** | `EventOrgRoleType` 枚舉：`SUPER_ADMIN / COORDINATOR / OPERATOR / VOLUNTEER / MEDIA`（`schema.prisma:1245-1251`）；`EventOrgRole` 模型（`:1279`）。端點：`engagement.routes.ts:37-40`（list/invite/accept/remove）。閘門：`EventService.ts:352 getEventWriteAccess`（owner/SA/CO）vs `:420 getEventOperatorAccess`（+OPERATOR）；middleware `checkEventAccessPermission.ts:6` 定義三級 `'WRITE' \| 'OPERATOR' \| 'SUPER_ADMIN'` | ✅ 端點與角色模型齊備 |

**缺口盤點**：

| Plan 要求（`:105-117`） | 四端狀態 |
| --- | --- |
| 4 角色 × 6 操作的權限矩陣（閘口/攤位/主管/主辦方） | 🟡 後端有 5 值枚舉但**無 `BOOTH` 概念**；Plan 定義的「攤位 staff」無後端對應角色 |
| 臨時帳號批量建立、QR 邀請加入、即時停用 | 🟡 `invite`/`accept`/`remove` 存在；❌ 無批量、無 QR 邀請、無「離場即停用」 |
| 所有操作綁定操作員 → 可追溯 | 🟡 `checkIn` 有 `checkedInBy`（`EventRegistrationService.ts:1056`）；**wallet 交易的操作員欄位 `[UNVERIFIED]`**（未讀 `EventWalletService`） |
| **OPERATOR 可讀名單** | ❌ 實測仍 403（見 §3.4 與 §4） |

**11 月可行性**：**中**。這是**唯一「後端比前端更超前」的模組**（角色模型 + org-roles 端點已 live），瓶頸是 App 端無角色感知，以及 `getEventWriteAccess` 的 OPERATOR 缺口。

---

### 3.7 模組 G — 即時數據儀表板

| 端 | 現況（檔案:行） | 可執行性 |
| --- | --- | --- |
| **App** | `src/app/(auth)/[eventId]/overview.tsx`（238 行）：`:75-76` 並行呼叫 `getRegistrations({limit:1})` 與 `getRegistrations({limit:1, status:'CHECKED_IN'})`，`:79-83` 由 `pagination.total` 組 3 張統計卡（報名數／已簽到／參展商） | ⚠️ 已實作但從未執行；**且依賴 `limit:1` 的 total 技巧** |
| **Web** | `app/(event)/manage/[eventId]/page.tsx` — **僅 53 行**，無儀表板 | ❌ 未實作 |
| **Backend** | ❌ **無任何 stats/aggregate 端點**（`grep -rnE 'stats\|dashboard' src/events/routes/` 僅命中 `checkin-stats` 的**缺席**） | ❌ 未實作 |

**缺口盤點**：

| Plan 要求（`:118-126`） | 四端狀態 |
| --- | --- |
| 報名數／已簽到數／到場率 | 🟡 App 有前兩者（`:79-82`）；**無到場率** |
| **依時段曲線** | ❌ 無任何時間序列能力 |
| Token 總發放／總消耗／剩餘負債／兌換排行 | ❌ 無 |
| 各閘口／各攤位工作量 | ❌ 無（且無 `gateId` 欄位，見 §3.1） |
| 會後結案報告 | ❌ 無 |

**11 月可行性**：**低（完整版）／高（降級版）**。App 已有一個**可用的降級版**：用 `/registrations` 的 `pagination.total` 取兩個標量。若接受「總簽到而非今日簽到」與「無時段曲線」，則模組 G 的 MVP 可在 App 端以現有端點完成，**不需後端新增**。完整版（曲線、Token 聚合、閘口維度）則需後端新增 aggregate 端點，且`gateId` 欄位尚不存在。

---

### 3.8 矩陣總結表

| 模組 | App | Web | Backend | 主要缺口 | 11 月可行性 |
| --- | --- | --- | --- | --- | --- |
| **A** QR 掃碼簽到 | ⚠️ 已實作未執行 | ⚠️ 已實作未執行 | ✅ live | 三態覆核、閘口編號、音效 | **高** |
| **B** Token 增扣 | ❌ 未實作 | 🟡 僅參加者自助 | ✅ 4 端點 live | 工作人員櫃台 UI（兩端皆缺） | **低**（全新建設） |
| **C** NFC 發卡 | ⚠️ 已實作未執行（Android-only） | 🟡 手抄 UID | ✅ 7 端點 live | 換卡/補發/退卡（四端皆無） | **中** |
| **D** 名單與現場管理 | ❌ 無頁面 | ✅ 1256 行 | ✅ live（OPERATOR 403） | 搜尋排序（B-6）、App 端不做 | **中**（Web 優先） |
| **E** 憑證/會員 | ❌ | ❌ | ❌ 無模型 | 全端從零 | **極低**（11 月不做） |
| **F** 權限 | ❌ 無角色感知 | ⚠️ 已實作未執行 | ✅ live | OPERATOR 讀名單 403 | **中** |
| **G** 儀表板 | ⚠️ 降級版已實作 | ❌ | ❌ 無 stats 端點 | 時段曲線、Token 聚合、閘口 | **低**（完整）／**高**（降級） |

---

## §4 交接文件的 stale claim 更正表

### 4.0 核對方法與範圍

核對對象：
- `docs/20260915_AdminApp_Handoff_for_feiteng2015.md`（724 行）— W-01..W-33、B-1..B-8
- `docs/20260915_AdminApp_API_Contract_Freeze_v1.md`（635 行）— A-1..A-4、CHK-01..04、REG-01/02、WAL-01..10、NFC-03/08、CRD-01、C-1..C-18

**核對原則**：Handoff 與 Contract 的**行號引用本身已自我聲明會漂移**（Contract `§2` 前言：「`file.ts:NN` 僅為 2026-09-15 的輔助行號，會隨開發漂移」；Handoff TL;DR #15 同旨）。因此本節**只判定語意真偽**，不因行號漂移而判為 stale。

**重要前置發現**：本次核對的最大類別不是「文件寫錯」，而是**「App repo 在文件撰寫後（9/15–9/17）已超前完成部分工作項」**。故 stale claim 以「已被實作超越」為主。

---

### 4.1 已解決（文件宣稱「待做」，實測已完成）

| # | 原文 claim（含出處） | 實測結果 | 差異性質 | 建議更正文字 |
| :---: | --- | --- | --- | --- |
| S-1 | Handoff §3「批次 1 前置：**W0 內必須完成**……否則 W-01 阻塞」；TL;DR #1「**W-09 需用戶先交**」（`:19`, `:491`） | ✅ **W-09 三項子任務全部完成**：① `.env.example` 已存在（2958 bytes，2026-09-17 01:59）；② fail-closed guard 已實作於 `src/constants/config.ts:16-18`；③ `API_BASE_URL` 已改 origin-only（`config.ts:26` 預設 `'https://linkcard.xyz'`，無尾 `/api`） | **已解決** | 「W-09 已於 2026-09-17 完成（`.env.example` + fail-closed + origin-only）。批次 1 前置條件解除，**無需用戶交任何東西即可開工**。」 |
| S-2 | Handoff W-11「硬編值清理（**26 行中文 / 4 個頁面檔**：`home` 6 ＋ `badges` 11 ＋ `nfc-bind` 8 ＋ `overview` 1）」 | ✅ **已完成**。實測 `grep -rnE "'[^']*[一-龥]{2,}[^']*'" src/app/ \| grep -vE 'copy\.'` → **零命中**。且 `overview.tsx:158` 留有完成註記：「A6/A8：原為 `copy.event.quickActions ?? '快速操作'`，硬編中文 fallback 已移除」 | **已解決** | 「W-11 已完成，全 `src/app/` 無硬編中文殘留。」 |
| S-3 | Handoff W-12「四態補齊（overview / check-in / nfc-bind 空態、settings loading+error、`+not-found`）」 | ✅ **已完成**。`check-in.tsx:222` 空態（`testID="check-in-empty"`）、`nfc-bind.tsx:124,126,142`（`hasEventId` 早退 + `testID="nfc-bind-empty"`）、`overview.tsx:56,103,112`（`hasEventId` + `EmptyState`）、`src/app/+not-found.tsx` 存在 | **已解決** | 「W-12 已完成；`eventId` 缺失已有明確空態（不再是靜默死路）。」 |
| S-4 | Handoff W-26「AC 增補：**消費 `checkIn` 回傳值**，結果卡顯示姓名/公司/票種/報到時間」 | 🟡 **已部分完成**。`check-in.tsx:99-118` 的 `CheckInAttendeeBlock` 已固定渲染 **5 列**（姓名/Email/公司/類型/報到時間），並有 D-2 契約漂移的相容處理（`:64-72` `firstNonEmpty`） | **已解決（但有語意落差）** | 「W-26 已完成姓名/Email/公司/類型/報到時間 5 列。**但「票種」仍未顯示** —— 契約要求的 6 項中缺票種與 Token 餘額。建議改述為『已完成 5/6 欄位』。」 |
| S-5 | Handoff W-13「真死碼清理（**僅**「可清理」子集）」 | 🟡 **部分完成且產生新的不一致**。`nfc-utils.ts:24` 註解寫「W-13：降為 module-private（**唯一**呼叫端為同檔的 `writeUriToCard()`）」——**此註解已不成立**：`nfc-bind.tsx:27` 亦 import 並於 `:101` 呼叫 `normalizeTagUid` | **已解決 + 新矛盾** | 「W-13 已完成清理。**惟 `nfc-utils.ts:24` 的註解已 stale**：`normalizeTagUid` 現有 `nfc-bind.tsx:27,101` 第二個消費者，不再是 module-private。請更正該註解，否則下一位讀者會誤判可內聯。」 |

---

### 4.2 仍成立（實測確認文件正確，**這些是真實風險，不可略過**）

> 這一節的價值在於：Handoff 列出的地雷**經 2026-09-18 實測仍然存在**。交棒時應完整保留，不可因「文件已舊」而一併作廢。

| # | 原文 claim（含出處） | 實測結果 | 差異性質 | 建議更正文字 |
| :---: | --- | --- | --- | --- |
| T-1 | Handoff TL;DR #6「🔴 最大地雷：`GET /registrations` 目前**擋掉 OPERATOR**（`EventService.getEventWriteAccess()` 只放 owner/SA/CO）。你若照現在的服務層寫名單頁，閘口 staff 會看到按鈕但按下去 403」 | ✅ **完全正確，且仍未修**。`EventRegistrationController.ts:78` 呼叫 `getEventWriteAccess`；`:87-92` 回 403 `INSUFFICIENT_PERMISSION`（「你沒有權限查看報名列表」）。`EventService.ts:352` `getEventWriteAccess` 的角色集合為 `[SUPER_ADMIN, COORDINATOR]`（`EventService.ts:375`）——**不含 OPERATOR**。對照組：`getEventOperatorAccess`（`EventService.ts:420`，角色集合含 `OPERATOR`，`:441-444`）**已存在**，且已用於 `checkIn`（`EventRegistrationController.ts` checkIn 內 `getEventOperatorAccess`，`access !== 'ALLOWED'` → `'操作員權限不足'`） | **仍成立（真地雷）** | 保留原述，**並補強**：「修法已明確——把 `listRegistrations` 的 `getEventWriteAccess` 換成既有的 `getEventOperatorAccess`（後者已含 OPERATOR 且已在 checkIn 使用）。這是 **1 行改動 + 迴歸測試**，不是新設計。裁決 C-4 選 (a)。」 |
| T-2 | Handoff TL;DR #7「🔴 第二大地雷：`by-code` 限流是 **20 次/5 分鐘/IP**（`registrationCodeLookupRateLimiter`，`registrations.routes.ts:12-26`）。展館 WiFi NAT 共用出口 IP → 開場尖峰必爆」 | ✅ **完全正確，行號亦準確**。`registrations.routes.ts:12-26`：`windowMs: 5 * 60 * 1000`、`limit: 20`、`keyGenerator: (req) => ipKeyGenerator(req.ip \|\| 'unknown')`。套用於 `:67-71` 的 `GET /by-code/:code` | **仍成立（真地雷）** | 保留原述。**補充**：因 `keyGenerator` 為 IP，簽到第一步（by-code 查詢）在全場共用 NAT 下會 429，而**這是模組 A 的必要前置**。B-5 應列為模組 A 的**硬依賴**而非並行項。 |
| T-3 | Handoff TL;DR #8「簽到要『震動＋音效＋大字綠畫面』，但 `package.json` **沒有任何音效套件**（`expo-av` / `expo-audio` 皆未安裝）」 | ✅ **正確**。實測 App `package.json` 依賴共 20 項，**無** `expo-audio`／`expo-av`／`expo-haptics`。 | **仍成立** | 保留原述。**補充**：`expo-clipboard ^57.0.1` **已安裝**（見 S 系列無關，但 C-10 的套件盤點未提及），故 W-15 的「tagUid 複製」不需新套件。 |
| T-4 | Handoff §4.1 W-04「`search` / `sortBy` 參數後端**尚未實作**（`EventRegistrationService.listRegistrations()` 只接受 page/limit/status/ticketTypeId/visibility/depositRefunded）」 | ✅ **正確**。`EventRegistrationService.ts:1216-1224` 的 options 型別實測為 `page, limit, status?, ticketTypeId?, visibility?, depositRefunded?` ——**無 `search`／`sortBy`／`sortOrder`** | **仍成立** | 保留原述。B-6 仍需 0.75 BE 人日。 |
| T-5 | Handoff B-7 / Contract CHK-04「新增端點 `/checkin-stats`」 | ✅ **確認不存在**。`grep -rc 'checkin-stats' src/` 全庫零命中 | **仍成立（待建）** | 保留原述。**補充降級方案已可用**：App `overview.tsx:75-76` 已用 `getRegistrations({limit:1})` + `{limit:1,status:'CHECKED_IN'}` 取 `pagination.total`，即 C-7/C-12 的 (b) fallback **已經在 App 內實作**。 |
| T-6 | Handoff B-8 / Contract C-13「Credential 統一模型（後端 `EventCredential` 未建；實證 `schema.prisma` 無 `EventCredential`）」 | ✅ **確認不存在**。`grep -c 'EventCredential' prisma/schema.prisma` → `0` | **仍成立（待建）** | 保留原述。模組 E 應維持「11 月不做」的判定（見 §5）。 |
| T-7 | Handoff C-10 / W-28「`expo-av` 已被 Expo 標記 deprecated **且已於 SDK 55 移除**，本專案為 `expo ~57.0.13`，**該套件不存在**」 | ✅ **邏輯正確**。實測 `expo ~57.0.13`，依賴清單中確無 `expo-av` | **仍成立** | 保留原述。 |
| T-8 | Contract §7「簽到顯示『地點』：無 gate/location 欄位（`EventRegistration` 只有 `checkedInAt` / `checkedInBy`，`schema.prisma:802-803`）」 | ✅ **完全正確，行號亦準確**。`schema.prisma:802` `checkedInAt`、`:803` `checkedInBy`；全模型無 `gateId`／`location` | **仍成立** | 保留原述。B-3 仍需新增欄位。 |
| T-9 | Contract §2.B CHK-02「`POST /registrations/checkin`，Auth = `EventService.getEventOperatorAccess()`（owner/SA/CO/**OP**）」 | ✅ **正確**。`EventRegistrationController.checkIn()` 實測：`const access = await this.eventService.getEventOperatorAccess(eventId, req.user.id);` → `if (access !== 'ALLOWED') return ApiResponse.forbidden(res, '操作員權限不足', 'INSUFFICIENT_PERMISSION')`。`EventService.ts:420-444` 角色集合確含 `OPERATOR` | **仍成立（文件準確）** | 無需更正。此為**對照組**：checkIn 用 Operator 級、listRegistrations 用 Write 級 —— 兩者不一致即是 T-1 的根因。 |

---

### 4.3 矛盾／需更正（文件敘述與 backend 實況不符）

| # | 原文 claim（含出處） | 實測結果 | 差異性質 | 建議更正文字 |
| :---: | --- | --- | --- | --- |
| M-1 | Handoff §3.1 批次 2 前置「🔴 **B-1** 帳務層：**6 端點**+冪等」；W-22 依賴「🔴 **B-1a**：`top-up`（**強化**）+ **`redeem`**」 | 🟡 **方向正確但用詞與實況不符**。實測 `premium.routes.ts` **已有 4 個 live 端點**（`:13` balance、`:14-18` transactions、`:19` **top-up**、`:20` **deduct**），且已掛載（`routes/index.ts:43`）。① **`redeem` 不存在** —— 後端命名為 **`deduct`**；② B-1a 的「新增 🟢」應改為「**既有端點強化**」 | **矛盾（命名與語意）** | 「B-1a 現況：`balance` / `transactions` / `top-up` / `deduct` **四個端點已 live 並掛載**。**注意後端動詞是 `deduct` 不是 `redeem`**——前端 facade 與 i18n key 若用 `redeem` 會與 API 脫節。B-1a 的實際工作 = **冪等 + 上限防呆**，非新增端點。B-1b（`adjust` / `approve` / `reject`）才需新增。」 |
| M-2 | Handoff §1 TL;DR #4「全 W-ID 逐項合計 **19.25 人日**」——未區分「端點是否已存在」 | 🟡 數字本身非本文件核對範圍，但**其隱含假設「B-1 全部是新增工作」已被 M-1 證偽** | **矛盾（成本高估）** | 「B-1a 有 2 個端點已存在（`top-up`/`deduct`），實際 BE 人日應低於原估。建議以 M-1 的端點清單重算。」 |
| M-3 | Handoff W-25「冪等鍵 + 雙擊防護。依賴 後端 B-1（**`idempotencyKey` 欄位** + `P2002` 處理）」 | 🟡 **欄位不存在，且範圍比文件所述更大**。實測 `grep -rn 'idempotencyKey' src/ prisma/schema.prisma` → **全庫零命中**（不只 wallet 沒有，整個 backend 都沒有此欄位） | **矛盾（依賴範圍低估）** | 「`idempotencyKey` **在整個 backend 不存在**（非僅 wallet）。B-1 需**新增 Prisma migration**（schema + unique index），這是跨 schema 變更，非 service 層實作。W-25 應標記為 **依賴 DB migration**，排程需含 migration review 時間。」 |
| M-4 | Handoff §3.1 W-22b「需 **B-1b**（`adjust` / `approve` / `reject`）→ 等 **10/17** 才能做」；Contract WAL-06/07/08/09「管理調整／審批佇列」 | 🟡 **「所有操作綁定操作員 → 可追溯」（Plan `:113-117` 模組 F 要求）在 wallet 上無法完全達成**。實測 `EventWalletTransaction`（`schema.prisma:1320-1346`）欄位為 `approvedBy`（`:1336`）**但無發起人欄位**（無 `operatorUserId` / `createdBy`）。`EventWalletService.ts:68` 雖接收 `operatorUserId` 參數，`:104` 卻只寫入 `approvedBy` | **矛盾（稽核能力缺口）** | 「⚠️ **wallet 交易只記錄 `approvedBy`（審批者），不記錄發起者。** Plan 模組 F 要求『所有操作綁定操作員』，而 maker-checker 的 maker 身分無法追溯。B-1b 應一併新增 `initiatedBy`（或 `createdBy`）欄位，否則會後對帳無法回答『這筆 +100 是誰按的』。**對照組**：簽到有 `checkedInBy`（`schema.prisma:803`），NFC 綁定有 `registrationId @unique` —— 只有 wallet 缺。」 |
| M-5 | Handoff §3.1 W-09 標記「**用戶**（移交前 W0）」為負責人 | ✅ 事實已變（見 S-1）。W-09 三項已完成 | **矛盾（負責人已無意義）** | 「W-09 已由 repo 持有者完成，**移除該 W-ID 或標記 DONE**，不要留在待辦清單中由用戶交付。」 |

---

### 4.4 新增發現：文件**未提及**但對施工有影響的事實

| # | 發現 | 證據 | 為何重要 |
| :---: | --- | --- | --- |
| N-1 | **Backend schema 已有「離線模式」雛形**，雖 Plan 將離線模式列為 🟢 P2（`Plan:129-136`） | `EventWalletTransaction` 含 `offlineSeqNum`（`schema.prisma:1332`）、`syncStatus`（`:1333`，型別 `WalletSyncStatus` = `SYNCED/PENDING_SYNC/CONFLICT`，`:1314-1318`）、`terminalId`（`:1334`）、`syncedAt`（`:1335`） | 澳門展館訊號差是 Plan 明載痛點。**schema 已為離線做好準備**，若 11 月要加離線，成本低於預期。反之若長期不用，這是 4 個死欄位。應在裁決中明示取捨。 |
| N-2 | **Web 的掃碼簽到頁在導覽中完全不可達** | `grep -rn 'check-in' app components lib \| grep -v '^app/check-in/'` → 零命中；`app/(event)/manage/[eventId]/layout.tsx:167-189` 的 12 項導覽不含 check-in | Web 已有可用的掃碼簽到（含相機），但操作者需**手動輸入 URL**。這是「有功能但無法運營」的典型 —— 修正成本極低（加一個導覽項或入口按鈕），價值極高。**兩份權威文件皆未提及。** |
| N-3 | **App 已有 role 資料但無任何 UI 消費** | `event.service.ts:28-36` 主動 unwrap `_meta.userRole` 到 top-level `userRole`；backend `EventService.ts:525-526`（`userRole: 'OWNER'`）與 `:541-542`（org role）均回傳 | 模組 F（權限）的**資料層已通**，缺口純在 UI。W-30 的實際工作量比「等 B-4 + D12 裁決」所暗示的小。 |
| N-4 | **`/nfc/lookup` 無 auth**（`event-ops.routes.ts:60` 無 `authMiddleware`），而 `/nfc/bind` 有（`:61`） | `event-ops.routes.ts:60` vs `:61` | Contract §2.E 標記 NFC-01/02 為 🟢/🟡，但未強調此不對稱。**已知悉即可**；因 `lookupBadge` 需 `eventId` + uid，屬受限枚舉，風險可接受但應在安全審查中明示。 |
| N-5 | App 有 **`typecheck` script**（`tsc --noEmit`），且 PROGRESS 記錄多個 W-ID 以「tsc ✅」為完成判準 | `package.json` scripts 含 `"typecheck": "tsc --noEmit"`；`PROGRESS.md:53,54,55` 的完成欄皆為「tsc ✅」 | **「tsc ✅」不是執行期證據。** 這是 §2.5「真機 0」與「已實作但從未執行」評級普遍化的制度性原因 —— 交棒前應明示：tsc 通過 ≠ 功能可用。 |

---

### 4.5 §4 小結（給交棒時的優先序）

1. **可安全刪除的待辦**：W-09（S-1）、W-11（S-2）、W-12（S-3）。
2. **必須保留的地雷**：T-1（OPERATOR 403）、T-2（by-code 限流）、T-3（無音效套件）。
3. **必須改寫的敘述**：M-1（`redeem` → `deduct`；B-1a 是強化非新增）、M-3（`idempotencyKey` 全庫不存在，需 migration）、M-4（wallet 無發起人欄位，稽核斷鏈）。
4. **文件完全沒提但影響施工**：N-1（離線 schema 已備）、N-2（Web check-in 路由不可達）、N-5（tsc ≠ 可用）。

---

## §5 Web-only／App-only 本質差異與責任分工建議

### 5.1 分類原則

本節的分類**不依「哪一端先做」，而依「哪一端的物理／平台限制使其成為唯一可行選項」**。這是為了避免 Plan §一（`:18-21`）已警告的「雙端重複開發拖垮 11 月排期」。

三條判準：
1. **平台不可能** — 該端的 API／硬體根本不存在（如 Web 無 NFC 讀寫）
2. **物理環境約束** — 現場條件（單手、3 秒、嘈雜、陽光直射、無桌）
3. **操作風險** — 誤觸成本高者應遠離隨身裝置（如批次匯入、權限分派）

### 5.2 只在 Web（App 不應做）

| 功能 | 為何只在 Web | 證據 |
| --- | --- | --- |
| **活動建立 / 編輯 / 頁面內容** | 長表單 + 富文本；現場無此需求 | `app/(event)/manage/[eventId]/{page,content,profile,ticket-types}.tsx`（53/376/380/1289 行）；App 對應頁面 **不存在** |
| **報名欄位設計（formFieldsJson）** | 需所見即所得編輯器 | `ticket-types/page.tsx` 1289 行為 manage 最大頁；`lib/events/fieldTemplates.ts`、`formPresets.ts`、`registrationFormContract.ts` 皆在 Frontend |
| **權限分派（org-roles 邀請/移除）** | 誤授權成本高，須在受控環境操作 | `manage/[eventId]/org-roles/page.tsx`（144 行）+ `engagement.routes.ts:37-40`；App 無角色 UI |
| **批次匯出 / 對帳報表** | 檔案落地、Excel 後處理 | `event-ops.routes.ts:76-77`（export/exhibitors、export/attendees）、`:67`（nfc/badges/export）；`markDepositRefund`（`registrations.routes.ts:95`） |
| **押金退款追蹤** | 財務動作，需二次核對與稽核視圖 | `registrations/page.tsx` 的 `markDepositRefund` + `RegistrationDetailDrawer`（`:38`） |
| **議程 / 投票管理** | 配置性質 | `sessions/page.tsx`（422）、`polls/page.tsx`（323）；App 無 |
| **完整名單管理（搜尋、排序、細節）** | 大表格在小螢幕不可用；且 OPERATOR 403 缺口修好後，此頁屬 COORDINATOR+ 職能 | `registrations/page.tsx`（1256 行）；App `getRegistrations()` **僅用於取 total**（`overview.tsx:75-76`） |

### 5.3 只在 App（Web 不應做，或平台不可能）

| 功能 | 為何只在 App | 證據 |
| --- | --- | --- |
| **NFC 寫卡（發卡）** | **平台不可能** —— Web 無 NFC 讀寫；實測零 `NDEFReader` | `grep -rnE '\bNDEFReader\b\|\bnavigator\.nfc\b' app components lib hooks store` → 無輸出；Web 的 tagUid 是文字輸入框（`check-in/[eventId]/nfc/page.tsx:107-118`） |
| **NFC 感應讀取（碰卡查人）** | 同上 | 同上 |
| **相機掃碼（現場 3 秒）** | 物理環境 —— 手持、單手、即時回饋 | `check-in.tsx:282-285`（`CameraView` + `onBarcodeScanned`）；App 另有手動模式（`:133`） |
| **真機震動 / 大字綠畫面** | 現場嘈雜 + 陽光直射 | Plan `:41`；App 有 design token（`theme.ts`）可支撐大字，震動可用 RN 內建 `Vibration`（無需新套件） |
| **Android-only 的實體卡片操作** | iOS 不支援寫卡 | `nfc-bind.tsx:74-78` 硬阻擋 iOS |

> ⚠️ **反直覺但重要**：Web **已有**一套可用的相機掃碼簽到（`@yudiel/react-qr-scanner`，`app/check-in/[eventId]/page.tsx`）。因此「掃碼」**不是 App 獨佔**。App 的不可替代性在**NFC**，而掃碼是「雙端皆可、但現場體驗 App 較優」。此結論與 Plan §一「Web 全功能」一致，但需明示以免交棒時誤以為掃碼是 App 專屬。

### 5.4 必須雙端共用同一 API，但 UI 不同

| 功能 | 共用端點 | App UI | Web UI |
| --- | --- | --- | --- |
| 掃碼簽到 | `POST /:eventId/registrations/checkin`（`registrations.routes.ts:74`） | 全螢幕相機 + 底部結果卡（現場單手） | 置中大字結果卡 + 3 秒自動重置（`page.tsx:74-77`）（可能為平板/收銀台） |
| NFC 綁定 | `POST /:eventId/nfc/bind`（`event-ops.routes.ts:61`） | **實際寫卡**（`writeUriToCard`）再綁定 | **手抄 UID** 再綁定（後備入口） |
| 報名查詢 | `GET /:eventId/registrations/by-code/:code`（`registrations.routes.ts:67-71`，路徑於 `:68`） | 掃碼時隱式呼叫 | 掃碼時隱式呼叫 |
| Badge 查詢 | `GET /:eventId/nfc/lookup`（`event-ops.routes.ts:60`，**無 auth**） | 可擴充為碰卡即查 | `badges/page.tsx` 手動輸入 tagUid 查 |
| 統計數字 | `GET /:eventId/registrations`（`registrations.routes.ts:64`） | 3 張統計卡（`overview.tsx:79-83`） | 目前無儀表板 |

### 5.5 兩端都不做（外部工具／紙本降級）

| 功能 | 為何不做 | 降級方案 |
| --- | --- | --- |
| **Token 收款** | Plan `:64-67` 已定調「收款在外部完成、App 只做入帳」 | MPay / 現金在外部；App 記帳 |
| **時段曲線 / 到場率分析** | 需後端 aggregate 端點，11 月前無排期 | App 現有 `pagination.total` 取標量（`overview.tsx:75-76`）作為 MVP |
| **Token 總負債 / 兌換排行** | 同上 | 會後從 DB 出報表 |
| **離線模式** | Plan `:129-136` 列 🟢 P2（**但 schema 已備**，見 N-1） | 紙本登記 + 會後補錄 |
| **支付串接（MPay 直扣）** | Plan 列 P2 | — |
| **攤位端獨立模式（Booth Mode）** | Plan 列 P2 | 用 App 現有流程 |
| **多主辦方租戶化** | Plan 列 P2，SaaS 前提 | — |
| **Undo（5 秒撤銷）** | Contract §7 明載 v11.3 **不做 undo** | 二次確認 + 反向 adjust（`EventWalletTransaction.type` 有 `ADMIN_ADJUSTMENT`） |

### 5.6 責任分工建議（一句話版）

> **NFC 寫卡與讀卡歸 App；名單、匯出、權限、配置、退款歸 Web；掃碼簽到與 Token 記帳是雙端共用 API 但 UI 各自最適化；Token 櫃台 UI 目前兩端皆空白，須指定單一端先行。**

**Token 櫃台（模組 B）的分工建議**：**應優先做 Web，不做 App**。理由：
1. 現場「攤位扣點」需要**餘額查詢 + 品項清單 + 流水**，屬資訊密集型，小螢幕體驗差；
2. Web 已有 `lib/events/wallet.ts` facade（3 個函式）與參加者錢包頁可複用；
3. 若必須在 App 做，則需新增第 4 個 service 檔 + 完整流程頁，而**後端已有 4 個 live 端點**，前端是唯一瓶頸 —— 投入到已有 8 成基礎的 Web 效益更高。

---

## §6 結論與 feiteng2015 施工範圍初判

### 6.1 一句話回答

> **現有 App 已具備「骨架交棒」條件，但尚未具備「功能交棒」條件。** 骨架（10 頁面、5 service、design token、auth 閉環、tsc/eslint 全過）品質足以讓工程師立刻開工；但**缺三樣東西**：① 任何執行期證據（真機 0 / 自動化測試 0）；② 模組 B（Token 櫃台）與 D（名單）的 App 端 UI **完全不存在**；③ 一個會計入關鍵路徑的後端前置（`by-code` 限流，T-2）未解，會讓模組 A 在開場尖峰直接 429。

### 6.2 可直接交棒開發（無前置依賴）

| 功能 | 為何可直接開工 | 主要檔案 |
| --- | --- | --- |
| **W-26 補完：簽到結果卡加票種 + Token 餘額** | 端點 live；`CheckInResult` 的 `registration` 已含 `tokenBalance`（實測 `listRegistrations` 的 select 含 `tokenBalance`，`EventRegistrationService.ts:1284`） | `check-in.tsx:99-118` |
| **W-28：震動 + 大字綠畫面** | 震動用 RN 內建 `Vibration`（無新套件）；大字用現有 `type` token | `check-in.tsx`、`theme.ts` |
| **模組 C 擴充：Badge 篩選 + tagUid 複製** | `expo-clipboard ^57.0.1` **已安裝**（T-3 補充）；`/nfc/badges` 端點 live | `badges.tsx` |
| **模組 G 降級版強化** | `pagination.total` 技巧已在 App 內運作（`overview.tsx:75-76`）；C-7/C-12 的 (b) fallback 已實作 | `overview.tsx` |
| **App 角色感知 UI（模組 F 前半）** | **資料層已通** —— `event.service.ts:28-36` 已 unwrap `_meta.userRole`（N-3），只需 UI 消費 | `home.tsx`、`overview.tsx` |
| **Web check-in 入口修正（N-2）** | 純前端，加導覽項即可 | `app/(event)/manage/[eventId]/layout.tsx:167-189` |
| **App 端 NFC 換卡/補發/退卡之錯誤路徑** | 現有 `nfc-bind.tsx` 已有 4 態流程與 badge type 選擇，可擴充；但見 6.3 的後端依賴 | `nfc-bind.tsx` |

### 6.3 須先解決前置依賴才能交棒

| 功能 | 前置依賴 | 類型 | 風險等級 |
| --- | --- | --- | --- |
| **模組 A 現場可用（開場不 429）** | **B-5：`by-code` 限流改 key + 放寬**（`registrations.routes.ts:12-26`，現為 20/5min/IP，NAT 共用必爆） | Backend 小改 | 🔴 **高**（阻斷模組 A 主流程） |
| **W-21/W-22/W-23/W-24 Token 櫃台** | **B-1a 冪等**（`idempotencyKey` **全庫不存在**，需 Prisma migration，見 M-3）；**M-4 發起人欄位** | Backend + **DB migration** | 🔴 **高** |
| **W-04 名單搜尋/排序** | **B-6**：`listRegistrations` 新增 `search`/`sortBy`/`sortOrder`（`EventRegistrationService.ts:1216-1224` 確認未實作） | Backend 小改 | 🟡 中 |
| **W-03/W-30 名單頁供 OPERATOR 使用** | **T-1：`getEventWriteAccess` → `getEventOperatorAccess`**（1 行改動 + 迴歸測試） | Backend 極小改 | 🔴 **高**（雖改動小，但錯則現場人員全數 403） |
| **W-27 重複簽到覆核** | **B-2**：`checkIn` 需 override 參數（`EventRegistrationService.ts:1042-1044` 現為無條件拋錯）＋ **B-3** `gateId` 欄位 | Backend + **DB migration** | 🟡 中 |
| **W-29 單日簽到計數** | **B-7** `/checkin-stats`（確認不存在）—— 或用 (b) fallback（已可用） | Backend 新端點 | 🟢 低（有降級） |
| **W-31 Credential** | **B-8** `EventCredential` 模型（確認不存在） | Backend + schema | 🟢 低（**建議 11 月不做**，見 §5.5） |
| **模組 C 換卡/補發/退卡** | 後端**無作廢/退卡端點**（§3.3 缺口盤點） | Backend 新端點 | 🟡 中 |
| **任何真機上線** | **EAS build 從未執行**（`PROGRESS.md:190`）；`app.json` **無 `extra.eas.projectId`**（快取所述，本次未重新驗證 → `[UNVERIFIED]`） | 帳號/憑證設定 | 🔴 **高** |

### 6.4 最需要用戶先拍板的 3 項

1. **Token 櫃台做在哪一端？**（§5.6 建議：**Web**）— 此決定直接決定 feiteng2015 的工作量是 ~3.75 人日（Web，複用 facade）還是 ~5+ 人日（App，從零）。
2. **音效套件（C-10）** — `expo-audio` 或無音效降級。無此決定則 W-28 無法驗收。
3. **模組 E（Credential）是否 11 月交付（C-13）** — 本次實測確認模型不存在，建議 **(b) 延後**，以釋放 2.0 BE 人日到 T-1/M-3/M-4。

### 6.5 本文件的信心邊界

| 結論類型 | 信心 | 理由 |
| --- | --- | --- |
| 端點存在性與掛載（§3 的 Backend 欄） | **高** | 直讀 `routes/index.ts` + `src/app.ts:153` 掛載鏈 |
| 模型/欄位存在性（§3.5, §4 M-3/M-4, N-1） | **高** | 直讀 `prisma/schema.prisma` |
| App/Web 程式碼缺位（§2.3, §3.2, §3.5） | **高** | word-boundary grep 零命中 |
| 「從未執行」評級（§2.5） | **中高** | 有 `PROGRESS.md:190` 自述 + `tests/` 不存在雙證據；但非 runtime 探測 |
| 端點回應形狀是否如契約（各處 payload） | **低** | **未實測**，一律以 `[UNVERIFIED]` 標記 |
| 平台能力陳述（Web NFC 不支援 iOS） | **中** | 屬外部知識 `[文件宣稱]`；惟其結論由程式碼零命中獨立成立 |

---

## 附錄 A：`[UNVERIFIED]` 項目清單

| # | 項目 | 位置 | 為何無法查證 |
| :---: | --- | --- | --- |
| U-1 | Wallet 交易端點的回應形狀是否如 `lib/events/wallet.ts` 註解所述（`{balance, transactionId}`） | Frontend `lib/events/wallet.ts:8-11` | 需實際呼叫 staging；本次僅讀程式碼 |
| U-2 | `top-up` / `deduct` 的權限閘門級別 | Backend `premium.routes.ts:19-20` | 路由僅見 `authMiddleware`；**未追入 `EventWalletController` 的角色判斷**（超出本次掃描預算） |
| U-3 | `GET /registrations` 在 OPERATOR 情境下的實際 HTTP 回應 | Backend | 靜態判定為 403；未以 OPERATOR token 實測 |
| U-4 | 同一前綴多 router 疊加（`routes/index.ts:40-43` 四個 router 同掛 `/:eventId`）時的實際命中順序 | Backend `src/events/routes/index.ts:40-43` | 靜態判定為依註冊序；**未做 runtime 路由探測** |
| U-5 | `app.json` 是否仍無 `extra.eas.projectId` | App `app.json` | 本次未重新讀取該欄位（§6.3 沿用快取敘述） |
| U-6 | `PROGRESS.md:190`「真機 0 / EAS build 0」在 9/18 是否仍成立 | App `PROGRESS.md:190` | 該檔最後更新 9/12；repo 內無反例但亦無更新證據 |
| U-7 | Web `check-in` 頁在真機瀏覽器（含 iOS Safari）的相機權限行為 | Frontend `app/check-in/[eventId]/page.tsx` | 需真實裝置；`@yudiel/react-qr-scanner` 的 iOS 支援未驗證 |
| U-8 | `nfc/batch` 三個端點的實際可用性（回應、錯誤碼） | Backend `event-ops.routes.ts:68-70` | 端點存在且已掛載，但**未有前端消費端**（四端皆無 UI），從未執行 |
| U-9 | `checkIn` 是否真的會寫入 `checkedInBy`（vs 僅 schema 有欄位） | Backend `EventRegistrationService.ts:1055-1056` | 讀到 `checkedInBy: operatorUserId` 的 update 語句，但未實測落庫 |
| U-10 | `EventWalletService` 的 `top-up` 是否有單筆/單日上限防呆 | Backend `EventWalletService.ts` | 本次僅讀至 `:104`，未通讀上限邏輯 |

---

## 附錄 B：章節 commit 對照

| 章節 | Commit |
| --- | --- |
| §1 方法論與證據標準 | `6173965` |
| §2 四端定位與能力邊界 | `a75e23e` |
| §3 逐模組差距矩陣 | `edb956a` |
| §4 stale claim 更正表 | `2a28343` |
| §5 + §6 責任分工與結論 | （本 commit） |

驗證指令：

```bash
cd /Users/chonwai/Desktop/Self/Lab/LinkCard/LinkCard_Event_Admin_App_Expo
git log --oneline -6 -- docs/research/13-app-vs-web-feature-gap-matrix.md
```

---

**文件結束** ｜ 掃描日 2026-09-18 ｜ 證據基準：App `e3c68b8` / Frontend `7138800` / Backend `1e20977`
