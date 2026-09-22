# Phase 7 — 總驗收與 DoD 勾選

> 日期：2026-09-19  
> 狀態：🟡 **工程條件化結案**（品質全綠；多數 WP 截圖/錄影仍待用戶補齊）

## Step 7.1 — 品質全綠複掃

| Repo                                       | 指令                                                                    | 結果                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `NFC_LinkCard_Event_Admin_App_Expo`        | `npm run typecheck`                                                     | ✅ 0 error                                                                |
| `NFC_LinkCard_Event_Admin_App_Expo`        | `npm run lint`                                                          | ✅ 0 error                                                                |
| `NFC_LinkCard_NextJS`（WP-A4 wallet 三檔） | `npx eslint app/(event)/manage/[eventId]/{wallet/page,layout,page}.tsx` | ✅ 0 error                                                                |
| `NFC_LinkCard_NextJS`                      | `npm run lint`（全倉）                                                  | ⚠️ exit 0，但既有檔有大量 `any` / unused **warning**（非本輪 WP-A4 引入） |

## Step 7.2 — 證據包索引

| WP  | 目錄               | 工程                           | 使用者證據               | 條件化                      |
| --- | ------------------ | ------------------------------ | ------------------------ | --------------------------- |
| A1  | [WP-A1](../WP-A1/) | ✅ EAS APK + 登入路徑          | ✅ `login-success.png`   | —                           |
| A7  | [WP-A7](../WP-A7/) | ✅ 三態 + 震動/音效 + 覆核骨架 | ⏳ 三態截圖待補          | 覆核待 B-2                  |
| A8  | [WP-A8](../WP-A8/) | ✅ 四大卡 + 降級儀表板         | ⏳ 截圖待補              | Web 遷移 DEFERRED           |
| A6  | [WP-A6](../WP-A6/) | ✅ 錯誤分態 + 讀回             | ⏳ Android 錄影待補      | 換卡待 WP-N2                |
| A4  | [WP-A4](../WP-A4/) | ✅ Web 骨架 + App 深鏈         | ⏳ 登入後 Modal 截圖待補 | 送出待 B-1a                 |
| A5  | [WP-A5](../WP-A5/) | ✅ 名單/詳情/補報名            | ⏳ 截圖待補              | 搜尋待 B-6；OPERATOR 待 T-1 |

## Step 7.3 — 條件化結案聲明（一眼區分）

### 已上線可用（工程就緒，待現場證據）

| 能力                | 說明                                            |
| ------------------- | ----------------------------------------------- |
| 登入 + 我的活動     | WP-A1；staging 帳 `505810824@qq.com`            |
| 簽到三態 UI         | WP-A7；VALID / DUPLICATE / INVALID + 音效震動   |
| 概覽導覽            | WP-A8；掃碼簽到 ≤ 2 點；到場率；Token「—」      |
| NFC 首次綁定流程    | WP-A6；寫入→讀回→bind；錯誤分態                 |
| 名單（主辦/協調員） | WP-A5；分頁、狀態篩選、已載入搜尋、詳情、補報名 |

### 骨架待接（不可當正式功能驗收）

| 能力                     | 缺失前置                                | 已交付骨架                                   | 解鎖後補驗收                                           |
| ------------------------ | --------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Token 增值/扣減/流水送出 | **B-1a**（`idempotencyKey` + 發起人欄） | Web 櫃台 UI；確認 Modal **不送出**；App 深鏈 | top-up/deduct 不雙記；流水含操作員；用戶端餘額同步錄影 |
| NFC 換卡/補發/退卡       | **WP-N2**                               | 按鈕 disabled + Banner                       | 換卡錄影；舊卡作廢；新卡可入場                         |
| 簽到覆核二次入場         | **B-2**                                 | 覆核按鈕 + BLOCKED Banner                    | 覆核成功後放行錄影                                     |
| 全庫搜尋/排序            | **B-6**                                 | 僅已載入列 filter/sort                       | 後端 search/sortBy 實測截圖                            |
| OPERATOR 讀名單          | **T-1**                                 | 403 文案引導改帳號                           | OPERATOR 200 + 名單截圖                                |
| Web manage check-in 導覽 | 產品裁決 DEFERRED                       | —                                            | 遷移至 `LinkCard_Frontend` 後補                        |

## Step 7.4 — DoD 勾選建議（審核者用）

- [x] **WP-A1** 工程 + APK + 登入截圖（`login-success.png`）— 若需「雲端包內建 env」可再打一次 EAS
- [ ] **WP-A7** 工程 ✅；**截圖待補** → 正式勾選前補三態圖
- [ ] **WP-A8** 工程 ✅（Web DEFERRED）；**截圖待補**
- [ ] **WP-A6** 首次綁定工程 ✅；換卡 **BLOCKED→骨架**；**真機錄影待補**
- [x] **WP-A4** **BLOCKED + 骨架**（條件化 DoD 允許）
- [ ] **WP-A5** 工程 ✅（B-6/T-1 條件化）；**截圖待補**
- [x] 每個 WP：`tsc` / `lint`（Admin App 全綠；Web wallet 三檔綠）— ⚠️ Admin App 的 `tsc` 於 2026-09-21 才首次真正執行，見 [evidence/README.md](../README.md) 的 type gate 更正
- [ ] 每個 WP：真機/瀏覽器截圖或錄影（多數仍待補，見上表）
- [ ] commit：小步 + WP 編號（Phase 5/6 與近期 UI 優化若尚未提交，請用戶指示後再 commit）

## 建議 commit message（僅在用戶要求提交時）

```
docs(admin-app): Phase 7 acceptance evidence and conditional DoD
```
