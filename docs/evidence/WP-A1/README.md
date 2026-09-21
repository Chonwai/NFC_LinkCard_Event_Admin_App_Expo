# WP-A1 — EAS Build + 真機登入

> 狀態：🟢 **工程完成 / 登入截圖已附**（2026-09-19 Phase 7）  
> 測試帳：`505810824@qq.com`（密碼由本地持有，不入版控）

## Step 1.1 — EAS profile + env

| 項 | 結果 |
| --- | --- |
| `eas.json` development / preview | ✅ 注入 staging `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WEB_URL`（無 `/api`） |
| `eas.json` production | ✅ 注入 production `https://linkcard.xyz` |
| `app.json` `extra.eas.projectId` | ✅ `bebe82e4-5bb2-45a4-9d79-369b5699ef19` |

## Step 1.2 — Build

| 項 | 結果 |
| --- | --- |
| Status | ✅ **FINISHED** |
| Profile | `development` / Android |
| Page | https://expo.dev/accounts/linkcard/projects/linkcard-event-admin/builds/40f74a48-68a1-42b4-81f0-7b683dc485f4 |
| APK | https://expo.dev/artifacts/eas/69XO2sJMgaYRHHoOoYi9uwdomzTJG2uLVBgJ1yvm3t8.apk |
| App ID | `xyz.linkcard.event_admin` |
| Completed | 2026-09-18T07:57:15Z |

> ⚠️ 此 APK 構建於 env 注入與 promoter 登入修正**之前**。JS 改動可用既有 Dev Client + Metro 熱更新驗證；若要驗證「雲端包內建 staging env」，需再跑一次 `eas build --profile development`。

## Step 1.3 — 登入驗證

| 項 | 結果 |
| --- | --- |
| 登入端點 | ✅ 暫用 `POST /api/auth/login` + `GET /api/users/me`（promoter claim **延後**） |
| `tsc` / `lint` | ✅ 全綠（`tsc` 於 2026-09-21 才首次真正執行；見 [evidence/README.md](../README.md) 的 type gate 更正） |
| 真機安裝 | ⏳ 請安裝上方 APK / Dev Client |
| staging 登入截圖 | ✅ `docs/evidence/WP-A1/login-success.png` |

### 建議真機步驟

1. 安裝 APK（或既有 Dev Client）
2. 本機 `npm run start`，Dev Client 掃碼連 Metro（載入最新 JS）
3. Email：`505810824@qq.com` + 密碼登入
4. 確認進入「我的活動」且至少一場活動
5. 截圖存為 `docs/evidence/WP-A1/login-success.png`
