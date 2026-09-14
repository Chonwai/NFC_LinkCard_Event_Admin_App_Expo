# 03 — 重啟路徑：8 步 + 風險表

> 本文件回答「怎麼重啟？」——把已經完成的骨架從「web 代碼完成」推向「真機可用 + 可部署」的最短路徑。
> 每步包含「做什麼」、「為什麼」、「估時」，依序執行最省力。

---

## 重啟 8 步（建議順序）

### Step 1：建立 Badge 批次資料（Test 前置，~30 分鐘）
**做什麼**：在 staging 用 `POST /nfc/batch`（或 Web 後台 `manage/[eventId]/badges`）建立 10-20 張 UNASSIGNED badge 記錄
**為什麼**：staging 4 個活動皆**零 badge 資料**——Badge 庫存列表（E2E 僅測空狀態）、Badge 綁定（bind API）全部被卡。有了批次資料，才能跑「Badge 列表分頁 → tagUid 查詢 → 綁定 → lookup 驗證」的完整鏈
**估時**：30 分鐘（含確認 Web 後台 badges 頁是否已部署，commit `loop-batch-nfc-api-badge-page` 完成度 96/100）

---

### Step 2：真機 E2E — Android 優先（~2 小時）
**做什麼**：
1. `npx expo run:android`（或 `eas build --profile development --platform android`）
2. 用 staging 帳號登入 → My Events → 進活動
3. **Check-in QR**：掃測試 QR → 確認報到成功
4. **NFC 寫卡完整鏈**：掃 QR（或手動輸入 registrationCode）→ 顯示 attendee 資料 → 放 NTAG 卡 → Android NFC session 寫 NDEF URI → 讀回 tagUid → POST bind → lookup 驗證
5. **Badge 列表**：查詢帶資料的 badge 分頁（非空）
**為什麼**：現場工具的核心價值在真機 NFC + 相機，web 通過不能替代
**估時**：2 小時（含 `npm install`、Android 模擬器/真機設定、準備測試 NTAG 卡 3-5 張）

---

### Step 3：補 Spec 缺頁 + NFC 狀態檢查（~1 小時，2 commits）
**做什麼**：
1. 新建 `src/app/(auth)/[eventId]/settings.tsx`（登出 + Event 切換 + 版本 + NFC 狀態檢查：`NfcManager.isSupported` → 消費 `copy.settings.nfcStatus/nfcSupported/nfcNotSupported`）
2. 在 `[eventId]/_layout.tsx` 註冊此 `Stack.Screen`
**為什麼**：Engineering Spec §4/§5.7 規劃了此頁，目前是**唯一不存在的藍圖頁面**；NFC 狀態檢查是現場工作的關鍵 UX（工作人員要知道手邊裝置有沒有 NFC）
**估時**：1 小時（含 `tsc`/`eslint` 驗證 + 1 commit）

---

### Step 4：iOS 真機驗證（~1 小時）
**做什麼**：
1. `npx expo run:ios`（或 EAS development build）
2. 登入 → My Events → Check-in QR（相機掃描）
3. NFC 寫卡頁：預期行為 = 「iOS 有 NFC 但一次一張 session」→ 驗證正確提示或行為
4. SecureStore：登出再登入 → token 恢復
**為什麼**：iOS 與 Android 平台分支（NFC session、相機權限）需分別驗證
**估時**：1 小時（若已有 Apple Developer + Certs 更快）

---

### Step 5：EAS 初始化 + 金鑰設定（~30 分鐘）
**做什麼**：
1. `eas init`（自動產生 `projectId` 寫入 `app.json` → 解決目前的「無 projectId」問題）
2. `eas build:configure`（確認 development/preview/production 三個 profile 正確，`eas.json` 已有基本配置）
3. 設定 `EXPO_TOKEN`（CI/CD 用）或 `.env.local` staging 資訊
**為什麼**：現在 `eas.json` 存在但 `app.json` 沒 `projectId` → `eas build` 會失敗。此步完成後才能 `eas build --profile preview --platform android`（.apk 內測）或 preview .ipa
**估時**：30 分鐘（`eas init` 互動式 + 確認 `.expo/` 資訊）

---

### Step 6：Build preview + 內測分發（~1 小時）
**做什麼**：
1. `eas build --profile preview --platform all`（產生 .apk + .ipa，beta 用）
2. Android：直接傳 .apk 給同事測試
3. iOS：需 Apple Developer 帳號才能 TestFlight（Spec §9 已標為需求）
**為什麼**：目前只跑過 `expo export web`，但你需要的是**真機 preview build** 驗證 iOS/Android 原生行為
**估時**：1 小時（build 本身 ~10-20 分鐘/平台；TestFlight 審核需額外時間）

---

### Step 7：品牌資產收尾（~1 小時）
**做什麼**：
1. 客製 `assets/` 資產（icon/splash/android adaptive icon）—— 替換 Promoter 複製資產
2. `app.json` 更新 `icon`/`adaptiveIcon`/`splash` 路徑
3. `theme.ts:1` 檔頭改「LinkCard Event Admin App」（現在寫「LinkCard Promoter App」）
**為什麼**：目前 assets/ 仍是 Promoter 複製（PROGRESS 自認），app 上架或發同事測試時會混淆
**估時**：1 小時（含設計 asset + commit）

---

### Step 8：補測試基建（可選，~2 小時，若要走遠）
**做什麼**：
1. 加入 `vitest`（promoter 同棧）+ 最小 `__tests__/`（`api-error` 分類、`nfc-utils` normalizeTagUid、`event.service` `_meta` unwrap）
2. `package.json` 加 `test` script + CI 加 `npm test`
**為什麼**：目前專案 0 個自有測試；若要長期維護，至少覆蓋 utils + service 層的關鍵邏輯
**估時**：2 小時（可放到 Step 1-7 完成後再決定）

---

## 風險表（重啟時需注意）

| 風險 | 嚴重度 | 緩解 |
|---|---|---|
| **CORS 白名單**：Admin App origin（mobile app 的 expo://deep link 或 web origin）是否在 backend `cors({ origin: [...] })` 白名單 | 高 | Step 2 真機前確認；staging 同源 = `staging-api.link-card.xyz` |
| **iOS NFC session 限制**：每張卡需重新開 session → walk-in 速度慢 | 中 | 藍圖已考量（少量 walk-in only）；批量由 ACR122U 桌面工具處理 |
| **Badge 批次資料建置**：Web 後台 `POST /nfc/batch` 需先確認 staging 有權限 | 中 | Step 1 建立；若 API 未部署，用 backend seed script 替代 |
| **Apple Developer 帳號**：TestFlight 需要付費帳號 | 中 | Step 6 提及；可先只發 Android .apk 內測 |
| **NFC 卡空白/已綁**：測試用 NTAG 需確認是空白或可重複覆蓋 | 低 | 準備 5+ 張空白 NTAG213 |
| **`linkcard-event-admin` slug 衝突**：Expo 帳號是否已有同名 project | 低 | `eas init` 時衝突會明確報錯，改 slug 即可 |

---

## 預估總時程

| 階段 | 步驟 | 估時 | 累計 |
|---|---|---|---|
| **Test 前置** | Step 1（Badge 批次） | 30 分 | 30 分 |
| **真機驗證** | Step 2（Android）+ Step 4（iOS） | 3 小時 | 3.5 小時 |
| **代碼補完** | Step 3（settings 頁） | 1 小時 | 4.5 小時 |
| **部署基礎** | Step 5（EAS）+ Step 6（preview build） | 1.5 小時 | 6 小時 |
| **品牌收尾** | Step 7（icon/splash） | 1 小時 | 7 小時 |
| **測試基建**（可選） | Step 8 | 2 小時 | 9 小時 |

> **最快路徑（MVP：Android 真機驗證）**：Step 1 + 2 + 3 + 5 = **~4 小時**，就能跑完「真機 NFC 寫卡 → 綁定 → lookup」完整鏈，有可 demo 的 MVP。