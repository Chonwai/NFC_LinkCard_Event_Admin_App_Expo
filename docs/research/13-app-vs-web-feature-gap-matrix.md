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
