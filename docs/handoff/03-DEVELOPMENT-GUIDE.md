# 03 — 開發指引（Repo 結構 / branch / commit 慣例）

---

## 1. Repo 佈局

```
LinkCard_Event_Admin_App_Expo/        ← 你在這裡（App）
├── src/
│   ├── app/                           expo-router 頁面（含 (auth)/[eventId]/）
│   │   ├── index.tsx                  登入頁
│   │   └── (auth)/
│   │       ├── home.tsx               首頁（活動列表）
│   │       ├── settings.tsx           設定頁
│   │       └── [eventId]/
│   │           ├── overview.tsx       活動總覽（四大功能卡）
│   │           ├── check-in.tsx       掃碼簽到（模組 A）
│   │           ├── badges.tsx         Badge 列表
│   │           ├── nfc-bind.tsx       NFC 綁定（模組 C）
│   ├── components/ui/                 設計系統元件（Button/Card/Icon/...）
│   ├── services/                      API service 層（auth/event/nfc/registration）
│   ├── stores/                        Zustand（auth/event）
│   ├── constants/                     config.ts / copy.zh-TW.ts / theme.ts
│   ├── types/                         api.types.ts（API 型別集中）
│   └── utils/                         api-error / nfc-utils / storage / validation
├── docs/                              所有文件（見 README）
│   └── research/                      研究文件 13–16
└── package.json
```

**對應 repo**：

- Web（Next.js）→ `LinkCard_Frontend`
- Backend（Express + Prisma）→ `LinkCard_ExpressJS_Backend`
- Promoter App（可覆用 NFC 寫卡）→ `LinkCard_Promoter_App_Expo`

---

## 2. Branch 策略

| 規則            | 內容                                              |
| --------------- | ------------------------------------------------- |
| 主分支          | `main`（穩定）／`development`（整合）             |
| 每 WP 開 branch | `wp-a4-token-counter`、`wp-a7-checkin-haptics` 等 |
| 完成後          | 開 PR 給用戶本人覆核                              |
| **禁止**        | 直接 push main / development                      |

---

## 3. Commit 慣例（hackathon 式 — 硬性要求）

```
✅ 好：feat(auth): add promoter login flow (WP-A1)
✅ 好：fix(checkin): handle duplicate scan with override (WP-A7)
✅ 好：docs(api): add wallet endpoints types (WP-A4)
❌ 壞：fix stuff
❌ 壞：update files
```

- **一個子功能 = 一個 commit**（小步前進，不要囤積）
- 同一 WP 內多個 commit 是**鼓勵的**
- **禁止**「一次寫一大包才 commit」

---

## 4. 測試與品質門檻

| 檢查                | 指令               | 門檻                        |
| ------------------- | ------------------ | --------------------------- |
| TypeScript          | `npx tsc --noEmit` | 0 error                     |
| Lint                | `npm run lint`     | 0 error                     |
| 測試                | `npm test`（若有） | 全綠                        |
| **真機/瀏覽器驗證** | 手動               | **必做**（tsc 過 ≠ 可用！） |

> ⚠️ doc 13 §6.1 警示：**「tsc ✅」不等於「可用」**。App 過去從未在真機跑過（真機 0 / 自動化測試 0 / EAS build 0）。每個 WP 完成都要**真機/瀏覽器截圖或錄影**。

---

## 5. 環境變數

`.env.local`（勿 commit）：

```
EXPO_PUBLIC_API_URL=https://staging-api.link-card.xyz
```

> ⚠️ `config.ts` 是 fail-closed + origin-only（安全設定）。改動前先看現有邏輯。

---

## 6. 必讀文件順序

1. `docs/handoff/README.md`（索引）
2. `docs/handoff/00-OVERVIEW.md`（為什麼）
3. `docs/handoff/01-FUNCTIONAL-SUMMARY.md`（做什麼）
4. `docs/handoff/02-API-CONTRACT-GUIDE.md`（API）
5. `docs/handoff/04-KNOWN-PITFALLS.md`（踩雷）
6. `docs/handoff/05-WORK-PACKAGES-QUICK-REF.md`（工作包）
7. 深入時：`docs/research/16-feiteng2015-work-packages.md`（完整規格）
