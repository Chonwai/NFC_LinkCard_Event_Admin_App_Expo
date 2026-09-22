# WP-A5 — 名單 / 搜尋 / 詳情 / 補報名

> 狀態：🟡 **工程完成 / 條件化**（2026-09-19；Phase 7 複掃）

## Phase 7 結案

| 項           | 說明                                                           |
| ------------ | -------------------------------------------------------------- |
| 已上線可用   | 主辦/協調員：名單分頁、狀態篩選、已載入搜尋/排序、詳情、補報名 |
| 骨架／降級   | 搜尋非全庫（**B-6**）；OPERATOR 403（**T-1**）                 |
| 解鎖後補驗收 | 後端 search/sortBy；OPERATOR 讀名單 200                        |

## 後端現況

| 項                                                | 結果                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /registrations` 分頁、`status`、`visibility` | ✅ 已接                                                                              |
| `search` / `sortBy` / `sortOrder`（B-6）          | ❌ 未上。App 只在**已載入列**裡篩姓名、Email、編號、公司，並在畫面上寫明不是全庫搜尋 |
| 名單權限（T-1）                                   | ❌ 仍是 `getEventWriteAccess`。OPERATOR 會 403，畫面要求改用主辦或協調員             |
| `POST /registrations`                             | ✅ 補報名走與線上同一端點。付費票只顯示「需要付款」，不當成已入場                    |
| NFC 依報名反查、社團                              | ❌ 詳情顯示 —                                                                        |

## 已交付

| Step | 內容                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| 6.1  | 名單無限滾動、下拉刷新、狀態篩選、空/錯/骨架                                           |
| 6.2  | 已載入列即時搜尋（無 debounce）+ 姓名/時間排序；狀態與排序列含 icon                    |
| 6.3  | 詳情：基本資料（Email/電話遮罩）、報名、簽到、Token 流水、NFC/社團空態。簽到結果可進入 |
| 6.4  | 現場補報名表單，成功後可去簽到或寫卡                                                   |
| 品質 | `tsc` / `lint`                                                                         | ✅（`tsc` 於 2026-09-21 才首次真正執行；見 [evidence/README.md](../README.md) 的 type gate 更正） |

## 待補

- [ ] 主辦/協調員帳號的名單與三種已載入搜尋截圖
- [ ] 詳情截圖
- [ ] staging 信箱確認補報名 Email
- [ ] B-6、T-1 上線後改接後端搜尋，並用 OPERATOR 重測

## 主要檔案

- `src/app/(auth)/[eventId]/registrations.tsx`
- `src/app/(auth)/[eventId]/registrant/[registrationId].tsx`
- `src/app/(auth)/[eventId]/walk-in.tsx`
- `src/services/event.service.ts`
- `src/services/registration.service.ts`
