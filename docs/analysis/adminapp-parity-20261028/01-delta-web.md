# 01 — 10-22 之後，Web 多了什麼

<!-- citations: LinkCard_Frontend -->

比對區間：`b52c08c`（10-22 當日收工）→ `6e58f0a`（今日 HEAD），共 202 個 commit。
其中與本題相關的區域（`app/check-in`、`components/checkin`、`components/nfc`、
`lib/nfc`、`lib/checkin`、`hooks/useNfcReader.ts`、`app/(event)/manage`）合計
62 個檔案、20,907 行新增。

這一節只列會改變「對等判定」的變化，不列內部重構。

## 1.1 報到桌：從「只能掃碼」變成「掃碼＋寫卡＋綁卡＋上鎖」

10-22 那一輪的結論是「Web 寫卡結構性不可能，因為 `NDEFReader` 不存在」。
那個結論當時成立，但它的前提已經被換掉了：Web 不再嘗試用瀏覽器的 NDEF API，而是
自己寫了一個走 Web Bluetooth 的 ACR1555U 讀卡機 client。

證據（皆在 `LinkCard_Frontend@6e58f0a`）：

| 能力                 | 落點                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| 讀卡機連線（含重連） | `hooks/useNfcReader.ts`、`components/checkin/DeskReaderBar.tsx`                       |
| 讀卡機支援度偵測     | `DeskReaderBar.tsx:73-88`（`readerBarState`）                                         |
| 寫卡面板             | `components/checkin/WriteCardPanel.tsx`（524 行）                                     |
| 報到桌狀態機         | `lib/checkin/nfcDesk.ts:29-188`                                                       |
| 現場處置動作         | `lib/checkin/nfcDesk.ts:60`（`retry`／`swap_card`／`skip`／`retry_bind`／`next`）     |
| 失敗分類→操作員文案  | `lib/checkin/nfcDesk.ts:464,522,566`                                                  |
| 卡片上鎖決策         | `lib/checkin/nfcDesk.ts:360-399`（`policy_on`／`policy_off`／`password_unavailable`） |
| 上鎖結果回報         | `lib/checkin/nfcDesk.ts:57`（`locked`／`unlocked`／`lock_failed`）                    |
| 卡片密碼來源         | `app/check-in/[eventId]/page.tsx:90` → `app/api/check-in/card-password/route.ts`      |

`app/check-in/[eventId]/page.tsx` 這一個檔案在區間內新增 684 行，現在是 972 行。

### 這為什麼重要

App 的報到流程是：掃碼 →（成功後）按「接續寫卡」→ 跳到另一個畫面
（`nfc-bind.tsx`）→ 用手機的 NFC 寫入。中間斷一次，卡片狀態要靠人記住。

Web 現在是：掃碼 → 不換頁直接寫卡 → 自動綁卡 → 寫入時一併上鎖 → 失敗時給出
「這張卡要換、要重試、還是可以先跳過」的明確處置。

要講精確的話，「不換頁」指的是**同一個頁面、同一條藍牙連線**：讀卡機狀態條在所有
狀態下都在，寫卡面板要掃到人之後才出現（`app/check-in/[eventId]/page.tsx:717`、
`app/check-in/[eventId]/page.tsx:876`）；上鎖不是對既有的卡另外送一次 `PWD_AUTH`，
而是「寫入 → 逐 byte 讀回 →（上鎖）」這段發卡序列的最後一步
（`hooks/useNfcReader.ts:690-722`）。

`lib/checkin/nfcDesk.ts` 之所以值得指出，不是因為它行數多，而是因為它把「現場可能
出什麼錯、每一種錯該給什麼動作」變成了可測試的純函式，而不是散在 JSX 裡的 if。
這是 App 目前沒有的東西。

## 1.2 卡片上鎖與讀卡機電源：Web 獨有，App 沒有對應層

`lib/nfc/` 在區間內長出這些模組：

- `globalPassword.ts`（195 行）／`globalPasswordClient.ts`：NTAG21x 的 `PWD_AUTH`
- `protection.ts`（512 行）：卡片保護狀態；探測邏輯的測試在
  `__tests__/probeProtection.test.ts`（410 行）
- `powerSettings.ts`（878 行）：讀卡機的休眠與自動斷電計時器
- `issue.ts`（387 行）：現場問題回報
- `statusWord.ts`、`session.ts`、`apdu.ts`：APDU 層的狀態字與連線生命週期

App 端對照：`src/utils/nfc-utils.ts`（274 行）只做 NDEF URI 寫入，
全檔沒有 lock／pwd／protect 字樣。

**判定：卡片上鎖與讀卡機電源屬於 `WEB_ONLY` 能力，不是 App 的缺口。** 理由見
`03-capability-matrix.md` §3.5：手機的 `react-native-nfc-manager` 可以送 raw APDU，
技術上不是不可能，但那個能力只有在「有讀卡機的桌面站」才有意義；App 的價值在於
沒有讀卡機時仍然能報到。

## 1.3 報到頁面現在在導覽裡了

`app/(event)/manage/[eventId]/layout.tsx:180`：

```
{ label: t('layout.checkIn'), href: `/check-in/${eventId}`, icon: QrCode },
```

上一輪記錄「Web 的 check-in 路由在 12 項 manage 導覽中不可達，修正成本極低、價值
高」。這一項已經修好，導覽現在是 13 個模組。

## 1.4 總覽頁從「三張導覽卡」變成「帶數字的入口」

`app/(event)/manage/[eventId]/page.tsx` 的檔頭自己寫了原因（QA EV-07）：原本這一頁
一個數字都沒有。現在每張入口卡都帶自己的數字，全部來自單一
`GET /events/:eventId/manage-stats`（`hooks/events/useManageStats.ts`）。

檔頭同時寫明兩件刻意的決定，值得 App 抄：

1. 未載入或失敗顯示 `—`，**不顯示 0**。0 會被讀成「沒有人報名」。
2. 已載入而該狀態沒有資料才顯示 `0`。

App 的 `overview.tsx` 在同一件事上做法相反：它為了拿 `pagination.total`，去打了
兩次受寫入權限保護的名單端點。OPERATOR 會看到活動、點進來、然後兩個請求都 403。
這一點是本輪唯一被判定為 `ALIGNED_DEFECT` 的模組。

## 1.5 名單頁的動作變多

`app/(event)/manage/[eventId]/registrations/page.tsx` 在區間內 +50 行，現有動作：

- `hide`／`unhide`／`archive`／`unarchive`，含 undo
  （`app/(event)/manage/[eventId]/registrations/page.tsx:101`）
- 退款登記 modal（`app/(event)/manage/[eventId]/registrations/page.tsx:106`）
- CSV 匯出 `exportAttendeesCsv`（`app/(event)/manage/[eventId]/registrations/page.tsx:29`）
- 狀態更正、`depositRefundFilter`（`app/(event)/manage/[eventId]/registrations/page.tsx:94`）

檔案層級的預設 repo 寫在本檔頂端的 `citations` 標記裡；路徑本身仍然寫完整，
因為縮寫過的引用是上一輪對不上的主要原因。

App 的名單頁有狀態篩選、搜尋、排序、分頁，沒有上述任何一項。

## 1.6 這一節對判定的淨影響

上一輪的 9 項「刻意差異」裡，**check-in 與 overview 兩項的判定被推翻**：

| 模組     | 上一輪                     | 本輪             | 為什麼                                               |
| -------- | -------------------------- | ---------------- | ---------------------------------------------------- |
| Check-in | 基本一致，App 多一顆死按鈕 | `APP_GAP`        | Web 已成為超集（寫卡＋綁卡＋上鎖）                   |
| Overview | App 更強                   | `ALIGNED_DEFECT` | Web 改成單請求且對每個角色誠實；App 對 OPERATOR 會壞 |

其餘 7 項刻意差異維持原判，理由不變。
