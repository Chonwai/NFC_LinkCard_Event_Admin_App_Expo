# LinkCard Event Admin App — Dev Log

> 開發環境：macOS / Node v22.21.1 / npm 10.9.4 | Expo SDK 57 / RN 0.86.2
> Quality Contract: strict (93) / L3 Deep Dive

## 2026-09-12 — Commit 1: scaffold

- 手動建立完整 Expo 結構（比 `npx create-expo-app` 更精確控制，兩個 commit 內可完成 scaffold + theme）
- `theme.ts` 從 Promoter App **100% 複製**（diff 驗證 OK）
- `config.ts`：API_BASE_URL = `https://linkcard.xyz/api`（production），EXPO_PUBLIC_API_URL 可覆寫
- backend 契約確認（只讀）：
  - `POST /api/auth/login` → `{ success, data: { token, user } }`（Web Frontend 共用認證）
  - `GET /api/v1/events/my-managed`（authMiddleware）
  - `GET /api/v1/events/:eventId/registrations/by-code/:code`（公開 + rate limit 20/5min）
  - `POST /api/v1/events/:eventId/registrations/checkin` body `{ registrationCode }`（authMiddleware）
  - `GET /api/users/me`（userController.getCurrentUser）
- @ 路徑 alias 對齊 Promoter
- android.package 用 `xyz.linkcard.event_admin`（Expo 不允許連字號）

<!-- 每個 commit 完成後在此追加記錄 -->