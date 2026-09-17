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
