# Phase 0 — 開工準備驗收紀錄

> 日期：2026-09-18  
> 執行者：Cursor Agent（feiteng Expo 帳號環境）

## Step 0.1 環境與帳號

| 項 | 結果 |
| --- | --- |
| Node / npm | v22.20.0 / 11.6.2 |
| `npm ci` / `node_modules` | ✅ 已存在，未重裝 |
| `.env.local` | ✅ `EXPO_PUBLIC_API_URL=https://staging-api.link-card.xyz`（無 `/api`）；`EXPO_PUBLIC_WEB_URL=https://staging.link-card.xyz` |
| `npx eas whoami` | ✅ `feiteng`（Owner）+ `linkcard`（Developer） |
| staging API 連通 | ✅ `GET https://staging-api.link-card.xyz/` → HTTP 302 → `/api-docs` |
| `npm run typecheck` | ✅ 0 error（修復被截斷的 `copy.zh-TW.ts` 後） |
| `npm run lint` | ✅ 0 error |
| staging 測試帳登入 | ⏳ **待用戶交付** promoter/OPERATOR 帳號後補驗證 |

## Step 0.2 提交與證據

| 項 | 結果 |
| --- | --- |
| 分支策略 | ✅ 直推 `main`（已裁決） |
| `docs/evidence/` | ✅ 本目錄結構已建立 |

## Step 0.3 後端前置（開工時狀態）

| 前置 ID | 狀態 |
| --- | --- |
| T-1 / WP-A2 | ☐ 未確認 |
| B-5 / WP-A3 | ☐ 未確認 |
| B-2 | ☐ 未確認 |
| B-3 | ☐ 未確認 |
| B-1a | ☐ 未確認 |
| B-6 | ☐ 未確認 |
| WP-N2 | ☐ 未確認 |

## 附註

- EAS development Android build（可作 WP-A1 起點）：  
  https://expo.dev/accounts/linkcard/projects/linkcard-event-admin/builds/40f74a48-68a1-42b4-81f0-7b683dc485f4
