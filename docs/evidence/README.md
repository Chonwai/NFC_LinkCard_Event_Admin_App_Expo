# 驗收證據目錄（Phase 0 建立）

> 對應計畫：`docs/20260918_LinkCard_Admin_APP_Implementation_Plan.md` Step 0.2  
> 規則：每個 WP 一份子目錄；**tsc 過 ≠ 可用**，必須附真機/瀏覽器截圖或錄影。

## 目錄結構

```
docs/evidence/
├── README.md                 ← 本檔
├── PHASE-0/                  ← 開工準備驗收紀錄
├── WP-A1/                    ← EAS build + 真機登入
├── WP-A7/                    ← 簽到三態
├── WP-A8/                    ← 降級儀表板 + App check-in 入口
├── WP-A6/                    ← NFC
├── WP-A4/                    ← Token（Web 主交付；證據可放此或 Frontend repo）
└── WP-A5/                    ← 名單 / 詳情 / 補報名
```

## 每個 WP 目錄建議內容

| 檔案 | 說明 |
| --- | --- |
| `README.md` | build URL / 測試帳號角色 / 步驟 / 已知限制 |
| `*.png` / `*.mp4` | 截圖或錄影（勿提交機密帳密） |

## Commit 約定（已裁決）

- 可直推 `main`
- message 含 WP 編號，例：`feat(admin-app): WP-A7 add success vibration`
- 每子功能一 commit
