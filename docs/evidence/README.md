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

## 每個 WP 目錄建議內容

| 檔案 | 說明 |
| --- | --- |
| `README.md` | build URL / 測試帳號角色 / 步驟 / 已知限制 |
| `*.png` / `*.mp4` | 截圖或錄影（勿提交機密帳密） |

## Commit 約定（已裁決）

- 可直推 `main`
- message 含 WP 編號，例：`feat(admin-app): WP-A7 add success vibration`
- 每子功能一 commit
