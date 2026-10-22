# nfc-web-probe

用瀏覽器的 Web Bluetooth 連上 ACR1555U，**只做 GATT 探索，不寫任何資料**。

## 為什麼要這支工具

要在網頁上寫卡，得先知道三件手冊沒講清楚的事：

1. **service UUID 到底是什麼。** 原廠手冊 Table 6/7 給了三個 characteristic
   （`00003971/2/3-…`），但**沒有明列它們所屬的 service UUID**。
2. **哪一條 pipe 支援 notify、哪一條支援 write。** 手冊說 3971 是
   「配對端 → 讀卡機」、3972 是「讀卡機 → 配對端」，但實際 GATT 屬性要量測。
3. **平板斷線後能不能重連。** 這決定現場可不可用。

這支工具不猜，它把裝置實際回報的東西印出來。

## 為什麼只讀不寫

讀卡機在**錯誤認證金鑰嘗試十次後永久鎖死**，而手冊**沒有**重置計數器的指令。
所以探索階段不應該碰認證，也不應該送出任何自行拼湊的訊框。

這支工具**不會**：

- 認證
- 送 APDU
- 寫入卡片
- 送任何 framed command

⇒ 它**不可能**消耗那十次額度。

## 怎麼跑

Web Bluetooth 需要 **secure context**（HTTPS 或 localhost），
而且 `http://192.168.x.x` **不算** secure context。

### 方法 A：直接在平板上開（建議）

平板需要一個 HTTPS 網址。三個做法：

| 做法                                        | 步驟                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Pages / Netlify 拖檔**（最快） | 把 `probe.html` 拖到 [pages.cloudflare.com](https://pages.cloudflare.com) 或 [app.netlify.com/drop](https://app.netlify.com/drop)，取得 HTTPS 網址 |
| **cloudflared tunnel**（本機檔案）          | 見下方                                                                                                                                             |
| **放進現有前端專案的 `public/`**            | 會**部署到生產**，只用於短期測試，測完刪掉                                                                                                         |

#### cloudflared tunnel（不部署、不上生產）

```bash
cd tools/nfc-web-probe
python3 -m http.server 8080
# 另開一個終端
cloudflared tunnel --url http://localhost:8080
# 把 cloudflared 印出的 https://xxx.trycloudflare.com 貼到平板 Chrome
```

### 方法 B：桌機 Chrome（先驗證邏輯）

```bash
cd tools/nfc-web-probe
python3 -m http.server 8080
# 開 http://localhost:8080/probe.html
```

桌機可用來確認頁面本身沒問題；但**桌機的 GATT 行為不代表性**，
最後一定要在平板上跑一次（那才是現場環境）。

## 操作步驟

1. **讀卡機進入 BLE 模式**：長按電源鍵 3 秒開機 → 確認**藍燈閃爍**。
   若綠燈亮但藍燈不閃，再長按 MODE 鍵 3 秒。
2. 在平板開這個頁面 → 按 **「1. 搜尋並連線讀卡機」**。
3. Chrome 彈出裝置清單 → 選你的 ACR1555U。
4. 按 **「2. 列出所有 service 與 characteristic」**。
5. **把輸出複製保存**（貼到 `docs/research/22-*.md` 的實測記錄區）。

## 判讀輸出

```
▸ SERVICE 00003970-817c-48df-8db2-476a8134ede0
    • 00003971-...  [write|writeNR]  ← Commands Request（配對端 → 讀卡機）
    • 00003972-...  [notify]         ← Commands Response（讀卡機 → 配對端）
    • 00003973-...  [notify]         ← Card Notification
```

| 看到的結果                                           | 意思                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `3970` 這個 service 命中，且三條 characteristic 都在 | ✅ service UUID 確認，可以進入下一階段                                     |
| 一個 service 都沒找到                                | service UUID 不是 `3970`；把 `CANDIDATE_SERVICES` 加上手冊提到的其他值再試 |
| 只找到部分 characteristic                            | 正常，某些 pipe 可能需要配對後才可見                                       |
| `SecurityError` / `NotFoundError`                    | 多半是該 service 未被 `optionalServices` 授權                              |

### 找不到裝置時按這個順序排查

1. 藍燈是否**閃爍**（不是長亮）
2. 平板藍牙 + 定位是否都開
3. 讀卡機是否已被其他裝置（例如你的筆電）佔住 → 長按 MODE 鍵約 4 秒清除
4. 換 `filters` 為 `acceptAllDevices: true` 看能不能列出任何裝置

## 這個工具**不是**什麼

它不是寫卡工具，也不是最終功能。它是一個**量測工具**：
存在的目的是讓下一步（認證與寫卡）建立在實測數據上，而不是手冊的推論上。

下一階段見 `docs/research/22-acr1555u-bringup-runbook.md`。
