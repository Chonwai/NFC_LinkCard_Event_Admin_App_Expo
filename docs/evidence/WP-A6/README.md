# WP-A6 — NFC 綁定強化

> 狀態：🟡 **工程完成 / 真機錄影待補**（2026-09-19；Phase 7 複掃）  
> 換卡 / 補發 / 退卡：**BLOCKED 骨架**（待 WP-N2，未呼叫作廢端點）

## Phase 7 結案

| 項 | 說明 |
| --- | --- |
| 已上線可用 | 首次綁定：lookup → 寫入 → 讀回 → bind；錯誤分態；Web/iOS 不支援提示 |
| 骨架待接 | 換卡 / 補發 / 退卡 disabled + WP-N2 Banner |
| 缺失前置 | **WP-N2** |
| 解鎖後補驗收 | 換卡錄影；舊卡作廢；新卡可入場 |

## 已交付

| Step | 內容 | 結果 |
| --- | --- | --- |
| 4.1 | 無效 UID、重複綁定、報名已有卡、寫卡失敗、讀回不符、後端 bind 失敗各自有文案與重試 | ✅ |
| 4.1 | 成功（綠）與失敗（紅）分開，失敗不會進成功態 | ✅ |
| 4.1 | Web / iOS 顯示不支援，寫卡按鈕停用 | ✅ |
| 4.2 | NDEF URI 改為 `WEB_BASE_URL/u/:registrationId`（不再寫死 production） | ✅ |
| 4.2 | 寫入後讀回；不符則不呼叫 `POST /nfc/bind` | ✅ |
| 4.2 | 已寫入但 bind 失敗時提示勿發放，並可只重試綁定 | ✅ |
| 4.3 | 換卡 / 補發 / 退卡按鈕 disabled + WP-N2 Banner | ✅ 骨架 |
| 品質 | `tsc` / `lint` | ✅（`tsc` 於 2026-09-21 才首次真正執行；見 [evidence/README.md](../README.md) 的 type gate 更正） |

## 待補

- [ ] Android 真機綁定成功錄影（Dev Build，Expo Go 不可靠）
- [ ] 讀回 URI 指向 staging（`EXPO_PUBLIC_WEB_URL`），不是 production
- [ ] 至少 3 種錯誤路徑截圖
- [ ] WP-N2 就緒後補換卡錄影

## 主要檔案

- `src/app/(auth)/[eventId]/nfc-bind.tsx`
- `src/utils/nfc-utils.ts`
- `src/utils/nfc-bind-errors.ts`
- `src/constants/config.ts`（`WEB_BASE_URL`）
- `src/constants/copy.zh-TW.ts`
