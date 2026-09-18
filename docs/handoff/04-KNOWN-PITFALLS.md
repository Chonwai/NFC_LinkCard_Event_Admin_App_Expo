# 04 — 踩雷地圖（必讀！都是真的坑）

> 每個坑都有**實測證據**，不是猜測。出處為 doc 13 / doc 16。

---

## 🔴 5 個「真地雷」（會在現場炸）

|    #    | 地雷                        | 症狀                                           | 出處                                                         |            修復 WP            |
| :-----: | --------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | :---------------------------: |
| **P-1** | **OPERATOR 無法讀名單**     | OPERATOR 登入後 GET `/registrations` 回 403    | doc 13 §4.2 T-1（`EventService.ts:375` 角色集不含 OPERATOR） |       **WP-A2**（1 行）       |
| **P-2** | **by-code 限流 429**        | 開場尖峰多人掃碼 → 全員 429（20 次/5 分鐘/IP） | doc 13 §4.2 T-2（`registrations.routes.ts:12-26`）           |           **WP-A3**           |
| **P-3** | **`idempotencyKey` 不存在** | wallet 有冪等需求但後端**全庫零命中**          | doc 13 §4 M-3                                                |  **WP-A4 前置**（migration）  |
| **P-4** | **wallet 無操作員稽核**     | 交易只記 `approvedBy`，不知道**誰按的**        | doc 13 §4 M-4（`schema.prisma:1336`）                        | **WP-A4**（加 `initiatedBy`） |
| **P-5** | **App 從未 build 過**       | 真機 0 / 自動化測試 0 / EAS build 0            | doc 13 §6.3 U-5                                              |           **WP-A1**           |

## ⚠️ 5 個「小地雷」（浪費時間）

|    #     | 地雷                                 | 解法                                                          |
| :------: | ------------------------------------ | ------------------------------------------------------------- |
| **P-6**  | 用錯登入端點 → 每個 promoter API 401 | 用 `POST /api/v1/promoter/auth/login`，不用 `/api/auth/login` |
| **P-7**  | wallet 扣減用 `redeem` → 404         | 用 **`deduct`**（後端動詞）                                   |
| **P-8**  | `tsc` 過就以為能用                   | **tsc 過 ≠ 可用**；需真機驗證                                 |
| **P-9**  | 忽略 response envelope               | 一律 `res.data.data`；`message` 可選                          |
| **P-10** | 找不到 `nfc/batch/complete` 契約     | 格式未確認（doc 14 U-1）；**先問阿聰**不要自己猜              |

---

## 🗺️ 踩了怎麼辦（升級路徑）

| 卡住點                  | 行動                                 | 升級對象 |
| ----------------------- | ------------------------------------ | -------- |
| 讀寫器未到 / macOS 不認 | 跑 spike（doc 14 §6.1）；換 ACR1252U | 用戶本人 |
| OPERATOR 仍 403         | 檢查登入是否走 promoter 端點（P-6）  | 用戶本人 |
| 尖峰 429                | 確認 WP-A3 已部署 staging            | 用戶本人 |
| backend 端點契約不明    | 讀 API Contract + 問阿聰             | 阿聰     |
| 翻譯缺葡文              | 提早找澳門翻譯                       | PM       |

---

## 🔍 可自行驗證的指令（安裝後跑一次）

```bash
# OPERATOR 403（P-1）— 預期：角色集不含 OPERATOR
grep -n "getEventWriteAccess\|getEventOperatorAccess" \
  ../LinkCard_ExpressJS_Backend/src/events/services/EventService.ts | head

# deduct 動詞（P-7）— 預期：premium.routes.ts 有 /wallet/:registrationId/deduct
grep -n "deduct\|redeem" \
  ../LinkCard_ExpressJS_Backend/src/events/routes/premium.routes.ts

# idempotencyKey（P-3）— 預期：全庫零命中
grep -rn "idempotencyKey" ../LinkCard_ExpressJS_Backend/src \
  ../LinkCard_ExpressJS_Backend/prisma/schema.prisma

# App 從未 build（P-5）— 預期：tests 目錄不存在
ls tests 2>&1
```
