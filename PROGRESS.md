# LinkCard Event Admin App — PROGRESS

> 更新：2026-09-14（交接前開發藍圖 — 見 `docs/research/05-handover-blueprint.md`）
> 藍圖依據：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md` + `20260912_LinkCard_Batch_Write_Trigger_Admin_App_Design.md`

---

## 📌 交接前狀態（2026-09-14 審計更新）

> 完整分析見 `docs/research/`（05 份報告 + 本藍圖）

**現況一行**：Web 後台功能完整（12 個 manage 頁全在），Admin App 骨架完成（10 頁面、tsc/eslint/web export 全過）；**真機驗證 0、Deploy 0**。

**交接前必做 4 件事**（~10 小時）：
1. `[eventId]/settings.tsx` 補頁（登出 + Event 切換 + 版本 + NFC 狀態檢查，30 分）
2. Registrations 列表頁（status filter + 分頁 + 查看，2 小時）— `eventService.getRegistrations` 已存在
3. EAS 初始化 + projectId（30 分）
4. 真機 E2E（Android 優先：Check-in QR → NFC 寫卡 → 綁定 → Badge 查詢 → Registrations 列表；3 小時）

**關鍵發現**：後端 `GET /registrations` 無 search 參數（只支援 page/limit/status/ticketTypeId/visibility/depositRefunded，`EventRegistrationController.ts:70-150`）— by name/email 搜尋需新建 backend API，留給下個工程師。

**不適合移植到 App 的 Web 功能**（桌面管理面）：org-roles / ticket-types / bank-transfers / content / polls / profile / badges 批次管理。

---

## ✅ 完成狀態（16 commits）

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
| 11 | `99ace15` | **fix**：service 路徑 `/api` prefix + `_meta` unwrap + 隱藏 `[eventId]` tab | tsc+eslint ✅ |
| 12 | `e647ddb` | **fix**：check-in 錯誤碼 unwrap（getApiErrorCode） | tsc+eslint ✅ |
| 13 | `040ebd4` | **fix**：overview 已報到統計真實查詢 CHECKED_IN | tsc+eslint ✅ |

## 🧪 完整端到端實測（2026-09-12，staging 真實帳號 chonwaiun@gmail.com）

| # | 測試 | 結果 | 備註 |
|---|---|---|---|
| 1 | 登入（email/password → staging） | ✅ | 成功導向 /home |
| 2 | My Events 列表 | ✅ | 4 活動顯示（role/報名人數正確）——修復 `/api` prefix bug |
| 3 | Tab bar | ✅ | 只剩 我的活動/設定（`[eventId]` 隱藏） |
| 4 | Event Overview | ✅ | 統計卡 + 快速操作（Check-in/NFC 寫卡/Badge） |
| 5 | Check-in 手動輸入（CONFIRMED code） | ✅ | 「報到成功」 |
| 6 | Check-in 重複報到 | ✅ | 「此報名已報到過」 |
| 7 | Check-in PENDING_PAYMENT | ✅ | 「此報名尚未確認」——修復錯誤碼 unwrap |
| 8 | Overview 已報到統計 | ✅ | 0→1 即時更新——修復硬編碼 0 |
| 9 | Badge 頁（空狀態） | ✅ | 「尚無 Badge」+ tagUid 查詢錯誤處理 |
| 10 | NFC 寫卡（查詢→選類型→寫入） | ✅ | Web 正確顯示「不支援」提示；重新輸入返回 |
| 11 | Settings + 登出 | ✅ | 回到登入頁 |
| 12 | 重新登入（auth guard） | ✅ | 完整 loop 通過 |

## 🔄 已知限制 / 待辦

- [x] **登入測試帳號**：staging 真實帳號驗證通過
- [ ] **Badge 綁定實測**：staging 4 活動皆無 badge 資料，待建立批次後驗證列表/綁定
- [ ] **真機 NFC 寫卡**：需 Android + NTAG 卡（web 只能顯示不支援）
- [ ] **P1 功能**：離線模式、Attendee 搜尋、現場統計
- [ ] **app icon/splash 客製化**：目前用 Promoter 資產（`assets/` 複製）
- [ ] **EAS Build → TestFlight**：需 Apple Developer 帳號

## 🔗 相關文件

- Engineering Spec：`.edison/traces/event-admin-app/01-engineering-spec.md`
- Loop State：`.edison/state/loop-event-admin-app-dev.md`
- 藍圖：`docs/LinkCard Event related/20260911_LinkCard_Event_Admin_App_Deep_Research_v2.md`
