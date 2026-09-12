# LinkCard Event Admin App — PROGRESS

> 更新：2026-09-12（Review + Web 實測後）
> 藍圖依據：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md` + `20260912_LinkCard_Batch_Write_Trigger_Admin_App_Design.md`

---

## ✅ 完成狀態（12 commits）

| # | Commit | 內容 | 驗證 |
|---|---|---|---|
| 1 | `c569f83`/`53bc571` | **scaffold**：Expo app + theme.ts（100% 對齊 Promoter 三層 tokens）+ config + types + app.json 權限 | tsc ✅ |
| 2 | `919cf5d` | **auth**：Login 頁 + auth.store + api.ts（JWT interceptor + terminal auth）+ RootLayout auth guard | tsc ✅ |
| 3 | `5292ece` | **home**：My Events 列表（GET /my-managed）+ event.service/store + Bottom Tabs + status badge | tsc ✅ |
| 4 | `40578ff` | **event**：overview（統計卡 + 快速操作）+ [eventId] Stack layout + settings + placeholder | tsc ✅ |
| 5 | `f20f158` | **check-in**：CameraView QR 掃描 + 手動輸入 + 3s auto-reset + 錯誤映射 | tsc ✅ |
| 6 | `f794974` | **nfc**：walk-in 寫卡（writeUriToCard）+ nfc.service（lookup/bind）+ badge type 選擇 | tsc ✅ |
| 7 | `c076189` | **badges**：tagUid 查詢 + 庫存列表分頁（GET /nfc/badges） | tsc ✅ |
| 8 | `e590209` | **fix**：react-hooks pattern 對齊 Promoter + lint 全綠 | tsc+eslint ✅ |
| 9 | `a3b7d2e` | **fix**：nfc-utils web-safe（dynamic import）+ ScreenHeader paths + staging env | ✅ |
| 10 | `e7112af` | **fix**：Logo branding（Promoter→Event Admin）+ CORS port 對齊 | ✅ |

## 🧪 Web 實測（2026-09-12）

| 測試 | 結果 | 發現 |
|---|---|---|
| Expo Web 啟動（port 8088/8082） | ✅ | — |
| 登入頁渲染 | ✅ | 修復前 web 崩潰（nfc-manager top-level import）→ 已修 |
| Login API 呼叫 staging | ✅ | CORS 錯誤（port 8088 不在 allowlist）→ 改用 8082 ✅ |
| 401 錯誤處理 | ✅ | 正確顯示「帳號或密碼錯誤」（InlineBanner） |
| Logo 品牌 | ✅ | 「LinkCard Event Admin」 |

## 🔄 已知限制 / 待辦

- [ ] **登入測試帳號**：staging 需建立 QA 帳號（`marcus.cheung@test.com` 等 seed 不存在於 staging-api）
- [ ] **P1 功能**：離線模式、Attendee 搜尋、現場統計
- [ ] **app icon/splash 客製化**：目前用 Promoter 資產（`assets/` 複製）
- [ ] **真機 NFC 測試**：需 Android + NTAG 卡（TC1-TC7 清單）
- [ ] **EAS Build → TestFlight**：需 Apple Developer 帳號

## 🔗 相關文件

- Engineering Spec：`.edison/traces/event-admin-app/01-engineering-spec.md`
- Loop State：`.edison/state/loop-event-admin-app-dev.md`
- 藍圖：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md`
