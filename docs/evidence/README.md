# 驗收證據目錄

> 對應計畫：`docs/20260918_LinkCard_Admin_APP_Implementation_Plan.md`  
> 規則：每個 WP 一份子目錄；**tsc 過 ≠ 可用**，必須附真機/瀏覽器截圖或錄影。  
> **Phase 7 彙總**：見 [PHASE-7/README.md](./PHASE-7/README.md)

## 目錄結構

```
docs/evidence/
├── README.md                 ← 本檔
├── PHASE-0/                  ← 開工準備
├── PHASE-7/                  ← 總驗收 / 條件化 DoD
├── WP-A1/                    ← EAS build + 真機登入
├── WP-A7/                    ← 簽到三態
├── WP-A8/                    ← 降級儀表板 + App check-in 入口
├── WP-A6/                    ← NFC
├── WP-A4/                    ← Token（Web 主交付）
└── WP-A5/                    ← 名單 / 詳情 / 補報名
```

## 狀態速覽（2026-09-19 Phase 7）

| WP | 工程 | 使用者證據 | 條件化 |
| --- | --- | --- | --- |
| A1 | ✅ | ✅ `login-success.png` | — |
| A7 | ✅ | ⏳ | 覆核待 B-2 |
| A8 | ✅ | ⏳ | Web DEFERRED |
| A6 | ✅ | ⏳ | 換卡待 WP-N2 |
| A4 | ✅ 骨架 | ⏳ | 送出待 B-1a |
| A5 | ✅ | ⏳ | B-6 / T-1 |

## ⚠️ type gate 更正（2026-09-21）

`tsconfig.json` 自 scaffold commit `c569f83` 起就帶著 `"ignoreDeprecations": "6.0"`，
這與本地安裝的 **TypeScript 5.9.3** 不相容：

```
$ npx tsc --noEmit
tsconfig.json(9,27): error TS5103: Invalid value for '--ignoreDeprecations'.
# exit 2
```

TS5103 是 **config 層**錯誤，在檢查任何檔案之前就中止。也就是說，
**本目錄下所有 `tsc ✅` 在 2026-09-21 之前都不是量測結果，而是「從未執行」**。
`lint ✅` 不受影響（`npm run lint` 一直是 exit 0）。

移除該鍵之後的實測（TypeScript 5.9.3，2026-09-21，`--listFiles` 顯示讀入 49 個 `src/**` 檔案）：

| 指令 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | **exit 0**（無輸出） |
| 先植入 `const probe: number = "x"` 再跑 | **exit 2**＋`TS2322`（證明這個 gate 有牙齒，不是空跑） |

結論：程式碼本身型別乾淨（0 error）；出問題的是「閘門沒開」，不是「閘門沒過」。
各 WP 子文件的一行 `tsc` 註記已改為指向本節。

## 每個 WP 目錄建議內容

| 檔案 | 說明 |
| --- | --- |
| `README.md` | build URL / 測試帳號角色 / 步驟 / 已知限制 |
| `*.png` / `*.mp4` | 截圖或錄影（勿提交機密帳密） |

## Commit 約定（已裁決）

- 可直推 `main`
- message 含 WP 編號，例：`feat(admin-app): WP-A7 add success vibration`
- 每子功能一 commit
