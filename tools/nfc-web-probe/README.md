# nfc-web-probe

用瀏覽器的 Web Bluetooth 連上 ACR1555U，**只做 GATT 探索，不寫任何資料**。

> ## ⚠️ 這支單檔工具已被前端 `/nfc` 取代（2026-10-22）
>
> 平板請用 **`LinkCard_Frontend` 的 `/nfc` 路由**，不要用這個 HTML 檔。
>
> 原因很具體：這個檔案要靠某個 HTTPS 服務才能開，而平板連「本機 HTML 檔」都開不
> 起來，用區網 IP（`http://192.168.x.x`）又**不算 secure context**，Web
> Bluetooth 直接不可用。前端專案本來就有 Vercel 的 HTTPS，開個路由就解決。
>
> | 環境                    | 網址                        | 預設狀態 |
> | ----------------------- | --------------------------- | -------- |
> | Vercel preview／staging | `https://<preview-url>/nfc` | ✅ 開啟  |
> | 本機 `npm run dev`      | `http://localhost:3005/nfc` | ✅ 開啟  |
> | production              | `https://link-card.xyz/nfc` | ❌ 關閉  |
>
> 前端版本多了：訊框組裝（含 checksum）、`6Fh` Exchange APDU、取 UID／讀取／
> 寫入（含系統頁硬性阻擋與讀回驗證）、以及完整的兩層協定單元測試。
>
> **這個檔案仍然有價值，但角色變了**：它是零相依的參考實作，適合貼給原廠或貼進
> issue。要看「最小可運作的 Web Bluetooth 範例」時讀它比讀整個前端快。

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

> **後續釐清（2026-10-22）**：上面的限制是 `V1.06` 的說法。`V2.02` §5.2.5 已改成
> 「**如果啟用了強制加密**」才需要認證，而且認證保護的是**讀卡機內部的安全資料**，
> 不是卡片記憶體。⇒ 讀寫卡片走明文即可，不需要認證。詳見
> `docs/research/21-web-bluetooth-and-tablet-only-verdict.md` §4.3a。
> 這一段保留原文，因為它仍是「探索階段先不要碰認證」的正確紀律。

這支工具**不會**：

- 認證
- 送 APDU
- 寫入卡片
- 送任何 framed command

⇒ 它**不可能**消耗那十次額度。

## 怎麼跑

> 平板請直接用前端 `/nfc`（見上方）。以下方法只在你要**單獨測這個 HTML 檔**時用。

Web Bluetooth 需要 **secure context**（HTTPS 或 localhost），
而且 `http://192.168.x.x` **不算** secure context。

### 方法 A：在平板上開

> 平板請用前端 `/nfc`（見文件最上方）。這個 HTML 檔本身要另外找 HTTPS 託管，
> 下面三種都還是有效，但**都不該是預設做法**了。

平板需要一個 HTTPS 網址。三個做法：

| 做法                                | 步驟                                                                                                                                               | 現況                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Cloudflare Pages / Netlify 拖檔** | 把 `probe.html` 拖到 [pages.cloudflare.com](https://pages.cloudflare.com) 或 [app.netlify.com/drop](https://app.netlify.com/drop)，取得 HTTPS 網址 | 只在要單獨驗證這個單檔時用            |
| **cloudflared tunnel**（本機檔案）  | 見下方                                                                                                                                             | 同上                                  |
| **放進現有前端專案的 `public/`**    | 會**部署到生產**                                                                                                                                   | ⚠️ **不要**——改用 `app/nfc/` 那條路由 |

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
