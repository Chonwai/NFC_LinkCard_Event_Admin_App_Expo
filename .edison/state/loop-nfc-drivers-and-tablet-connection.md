# Loop State — nfc-drivers-and-tablet-connection

- **Goal（Done Contract）**：回答使用者三個問題（① 平板連不上是不是做法錯 ② 是不是一定要裝驅動 ③ 廠商是否四系統都有驅動），並用可重跑的程式碼與一手官方文件佐證；同時更正上一輪寫錯的「平板零程式碼寫卡」結論。
- **Quality Mode**：strict（threshold 93）／**Depth**：L3 Deep Dive
- **Snapshot Cache**：`NONE`（本輪不需 codebase 快取定位；改動集中在 `tools/nfc-reader-spike/` 與 `docs/research/`）
- **Branch**：`feat/nfc-gate1-reader-spike`

## Stage Round Counters

| Stage                           | Rounds | Stop Rule | 狀態                           |
| ------------------------------- | ------ | --------- | ------------------------------ |
| DISCOVER（morpheus）            | 1      | 3         | ✅ 完成（doc 20）              |
| EXECUTE（trinity/Neo 直接執行） | 3      | 3         | ✅ 完成（8+3 commits）         |
| VERIFY（smith，strict）         | 3      | 3         | ⚠️ **達 Stop Rule** → 升級人類 |

## Iterations

| #   | 動作                                                                      | measured                                                |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| V1  | smith 首審 `6e2c397..761acca`                                             | **82.6**（0 Critical / 2 High / 7 Medium / 14 Low）     |
| R1  | 修 CRA-H1／H2（三態、per-transport、exit code）、L2／L3／L11              | —                                                       |
| R2  | 修 CRA-M1（DO NOT SEND banner）、L1／L4／L8                               | —                                                       |
| V2  | smith delta 複審                                                          | **89.1**（REPAIRABLE；仍未修 5 Medium + 14 Low）        |
| R3  | 修 M2／M3／M4／M5／N2／N3／L1／L8／L11（新增 7 個測試、9 組突變驗鑑別力） | —                                                       |
| V3  | smith delta 複審 r3                                                       | **94.4**（0 Critical / 0 High；1 Medium + 14 Low 未修） |

## Circuit Breaker / 升級理由

- 數值 94.4 ≥ 93 → 客觀達標
- 但 strict 附加條件（Medium ≤1 且已修、Low 全清）未達
- VERIFY 已跑滿 3 輪 → 依 Stop Rule **不由 Neo 放行**，交由使用者在「繼續打磨 CLI 細節」與「接受現狀」之間決定

## 未修 findings（交人類裁決）

- `CRA-M7`：exit code 慣例分散在 22 個裸 `return`，無 `EXIT` 常量表
- `CRA-L5/L6/L7/L9/L10/L12/L13/L14`、`CRA-N1/N3/N4/N5/N6/N7`：多為可讀性、路徑顯示、TLV 邊界讀取、註解與守門測試等

## 已驗證不可回歸的關鍵契約

- `passThrough()` 輸出必須是 `FF 00 00 00 <Lc> <command>`（Lc = command 長度、總長 5+Lc）
- 未知／不存在路由必須是 `null`，不得是 `false`
- 超容量腳本必帶 `DO NOT SEND` banner，且 CLI 必須在寫檔之前擋下
