# 21 — 純網頁驅動 ACR1555U：方向可行，但流傳的實作是假的

> 產出日期：2026-10-22 ｜ Loop: NFC Gate 1 ｜ 研究部（Neo 直派）
> 關係：`20-*.md` 的連線排錯、藍燈狀態機、OS 驅動結論**仍然有效**，不重複。
> 本文件只補 `17–20` 都沒有回答的一個缺口：**瀏覽器能不能驅動讀卡機**。
> 研究法：只用手一手資料——ACS 官方手冊 PDF、MDN 瀏覽器相容表、Chromium 原始碼
> commit 與 blink-dev 審查記錄。每一條斷言都指回具體章節；查不到的進 §6。
> 品質合約：strict（threshold 93）/ L3

---

## 0. TL;DR

1. **純網頁可以驅動 ACR1555U——走 BLE（Web Bluetooth），不是 USB。**
   `17–20` 之所以得出「只能筆電或原生 App」，是因為四輪都只評估了 USB 與
   原生 SDK，**沒有評估 BLE 的瀏覽器路徑**。
2. **但網路上流傳的那份 Web Bluetooth 教學，實作細節是錯的**：master key 憑空
   捏造、認證指令其實是「設定休眠」、而且完全沒有封包框架。
3. **那段程式碼不要執行。** 原廠手冊明文：錯誤金鑰輸入**超過六次，讀卡機會鎖死
   不可用**。
4. **今天就能做的低風險驗證**：先跑 ACS 官方 `BLETest-0.6.0.apk`，用**原廠自己
   的正確金鑰**確認「平板 → 讀卡機 → 認證 → 讀卡」這條鏈真的通。通了再談自寫。

---

## 1. 這份文件在補什麼洞

前四輪的結論形成了一條錯誤的推論鏈，值得記下來：

| 文件      | 它的結論                                                                      | 它沒有評估的東西                         |
| --------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `14-*.md` | USB 筆電批次寫卡最可行                                                        | 瀏覽器                                   |
| `17-*.md` | ACR 系列可作 Gate 1 硬體                                                      | 瀏覽器                                   |
| `18-*.md` | 公司平板沒有 NFC ⇒ 需要外接                                                   | 平板的 **BLE** 能力                      |
| `19-*.md` | 四條路徑 A/B/B′/C/D（筆電 USB、原廠 APDU App、NDEF 模擬、App 內建、HID 鍵盤） | 瀏覽器                                   |
| `20-*.md` | §Q2 寫「**Android：沒有 App，插了線什麼都不會發生**」                         | 這句話對 **USB** 成立，對 **BLE** 不成立 |

⇒ 缺口是：**四輪都在問「怎麼用線」，沒有問「怎麼用無線」**。而 ACR1555U 的
無線介面（BLE）正好是瀏覽器唯一能碰到的部分。

> **這條推論鏈的教訓**：當一個選項連續四輪都沒出現在選項表裡，
> 通常不是因為它不可行，而是因為**問題框架把它排除在外**了。

---

## 2. 三個瀏覽器 API 的裁決

評估「網頁能不能驅動讀卡機」時，很容易把三個不同的 API 混為一談。它們的結論
完全不同：

| API               | Chrome 桌面 | Chrome Android      | 對 ACR1555U 可用？ | 原因                                                       |
| ----------------- | ----------- | ------------------- | ------------------ | ---------------------------------------------------------- |
| **WebUSB**        | ✅ 61+      | ✅ 61+              | ❌ **不能**        | Chromium 明文封鎖 USB interface class `0x0B`（Smart Card） |
| **WebHID**        | ✅ 89+      | ❌ 不支援           | ❌ **不能**        | Android 不支援；且 HID 模式只吐 UID，固件沒有寫卡指令      |
| **Web Bluetooth** | ⚠️ 部分     | ✅ **56+ 完整支援** | ✅ **可行**        | 走 BLE GATT，與 USB 的 class 封鎖無關                      |

### 2.1 WebUSB 為什麼不行（這條要記住，因為很容易誤解）

不是「作業系統驅動佔用」這種可繞過的問題，是**瀏覽器廠商主動封鎖**：

| 證據                                                         | 內容                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chromium commit `537313cf`（2018-03，Reilly Grant）          | _"Add list of protected USB interfaces classes for WebUSB — Web content will not be allowed to claim interfaces advertising these interface classes."_ |
| blink-dev Intent to Ship「WebUSB Interface Class Filtering」 | 被封鎖類別：Audio、Video、HID、Mass Storage、**Smart Card**、Wireless Controller                                                                       |
| 同一份 Intent 的六平台問答                                   | 適用所有 Blink 平台，只有 Android WebView 例外                                                                                                         |

⇒ 換 OS、換驅動、換瀏覽器版本都不會改變。**這條路是政策性的死路。**

### 2.2 Web Bluetooth 為什麼可行

| 事實                                                                       | 來源                              |
| -------------------------------------------------------------------------- | --------------------------------- |
| `navigator.bluetooth` / `requestDevice` 在 **Chrome Android 56+ 完整支援** | MDN Browser Compat                |
| ACR1555U 的 BLE 介面是 **APDU 透傳**（官方 Android BLE EVK 即用此通道）    | ACS 驅動頁 / `USR-ACR1555U-A1` §3 |
| 它與 USB 完全無關，因此不受 `0x0B` 封鎖影響                                | 架構上無交集                      |

**但仍有三個必要條件**（少一個就動不了）：

1. **HTTPS 或 `localhost`**——Web Bluetooth 限 secure context。
   ⚠️ `http://192.168.x.x` **不是** secure context，會被擋。
2. **Android 定位權限**——BLE 掃描被歸類為可能洩漏位置（Android 12+ 改為
   `BLUETOOTH_SCAN`，Chrome 自行處理，但使用者仍需授權）。
3. **讀卡機在 BLE 可被搜尋狀態**（藍燈閃爍）。這一條 `20-*.md` §Q1 已詳細寫過，
   不重複。

---

## 3. 逐條驗證一份流傳的「Web Bluetooth 教學」

> 這份文件在網路上流通，主張「純前端 JavaScript 用 Web Bluetooth 驅動
> ACR1555U-A1，平板不需安裝 APK」，並附完整 HTML。**方向是對的**，
> 但實作細節大量錯誤。以下逐條對照原廠手冊。

### 3.1 真的部分

| 項目                             | 該文件寫的                             | 驗證結果                                                             |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Service UUID                     | `3c4afff0-4783-3de5-a983-d348718ef133` | ✅ 真（ACS Table 4：Smart Card service）                             |
| 讀卡機 → 網頁                    | `3c4afff1-...`                         | ✅ 正確（Table 5：Send, Reader → Paired device）                     |
| 網頁 → 讀卡機                    | `3c4afff2-...`                         | ✅ 正確（Table 5：Receive, Paired device → Reader）                  |
| 需要 HTTPS／localhost            | 是                                     | ✅ 正確                                                              |
| BLE 掃描需定位權限               | 是                                     | ✅ 正確                                                              |
| AES-128 CBC、16-byte session key | 是                                     | ✅ 正確（原廠：`AES-128 encryption algorithm (CBC ciphering mode)`） |
| `FF CA 00 00 00` 取 UID          | 是                                     | ✅ 正確                                                              |
| `FF B0 00 <page> 10` 讀          | 是                                     | ✅ 正確（Ultralight：4 的倍數、最多 16 bytes）                       |
| `FF D6 00 <page> 04 <4B>` 寫     | 是                                     | ✅ 正確（原廠有同樣例子：`FF D6 00 04 04 00 01 02 03`）              |

**APDU 那一段是真的。** 這一點值得記下來，因為它容易被誤判——我自己第一輪就
懷疑它錯，查完手冊發現是我錯。

> ⚠️ 但要注意手冊寫的是 **MIFARE Ultralight**，不是 NTAG。
> NTAG213/215/216 與 Ultralight 共用同一套記憶體指令（`30` 讀 / `A2` 寫），
> 所以 `FF B0` / `FF D6` **應該**同樣可用——但**手冊沒有直接寫 NTAG**。
> 這一條列在 §6 的 U7，要用實測確認，不要當成已驗證。

### 3.2 假的部分（致命）

| #   | 該文件寫的                                                 | 原廠實際                                                                   | 後果                     |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| F1  | Master Key = `ACSROMASTERKEYIN`（`41 43 53 52 4F 4D ...`） | `41 43 52 31 32 35 35 55 2D 4A 31 20 41 75 74 68` = **`ACR1255U-J1 Auth`** | 認證永遠失敗             |
| F2  | `E0 00 00 48 00` = 「開始認證」                            | **Set Sleep Time Interval**（`E0 00 00 48 <Time>`）                        | 送去設定休眠，不是握手   |
| F3  | `E0 00 00 49 10` = 「認證回應」                            | **Set Tx Power**（`E0 00 00 49 <TxPower>`）                                | 送去改發射功率           |
| F4  | 直接送裸 APDU／裸指令                                      | 必須包 **兩層框架**（見 §5.1）                                             | 讀卡機直接丟棄           |
| F5  | 沒有「卡片上電」步驟                                       | 必須先送 `62h` PICC Power On                                               | 後面所有 APDU 都讀不到卡 |
| F6  | APDU 直接放進 write characteristic                         | 必須包在 `6Fh` Exchange APDU 訊框內                                        | 同上                     |

### 3.3 該文件的自我矛盾

它在 master key 後面補了一句「部分批次出廠可能為 16 個 `0x00` 或 16 個 `0xFF`」。
**這是猜測的語氣，不是查證的結果**——原廠手冊給的是明確的 ASCII 字串。凡是
看到「可能」「部分批次」出現在**規格**位置，就應該停下來查原文。

---

## 4. ⚠️ 錯金鑰會鎖死讀卡機（可計數，可預檢）

這是本文件最重要的一條。

### 4.1 門檻：ACR1555U 是 **10 次**

我第一版寫「六次」——**那是 ACR1255U-J1 的數字，不是 1555U 的。**
取得 ACR1555U 原廠手冊後更正：

> `ACR1555U Reference Manual V1.06` §5.2.5：
> **"The reader will be locked and unusable once incorrect authentication keys
> are entered more than ten (10) times."**

⇒ 額度比 1255U-J1 寬，但**仍然是永久性的**，不是「重試就好」。

### 4.2 ✅ 而且可以事先查剩餘額度

手冊 §6.3.23 提供 `Read Authentication Error Counter`：

```
Command:  E0 00 00 72 00
Response: E1 00 00 00 01 <Error Counter Value>
```

**這是本文件最有實用價值的一條。** 它把「不可觀測的風險」變成「可量測的數字」：

- **動任何認證程式之前先讀一次**，記下基線
- 每次認證嘗試後再讀一次，確認只增加了預期次數
- 若計數器已經不為 0，**先停手查原因**，不要繼續試

⚠️ 手冊**沒有**提供「重置計數器」的指令（目錄只有 Read，沒有 Reset）。
⇒ 額度用完就是用完，不能自己歸零。

### 4.3 施工紀律

配上 §3.2 的 F1（假金鑰），如果照那份教學去點「執行 AES-128 握手認證」，
**點十次就可能把唯一一台讀卡機變成廢鐵。**

1. **先用 §4.2 讀一次 error counter，建立基線。**
2. **先用官方 demo app**（`ACS_BT_EVK_Android-1.01/Demo App/BTDemo-1.0.1.apk`）
   ——它內建正確金鑰，可以安全驗證整條鏈。
3. **不要用網路流傳的程式碼「試試看」**——它的金鑰是假的，每次嘗試都在扣額度。
4. 自寫的認證流程，**第一次就要用正確金鑰**；不要「先隨便試」。
5. 認證失敗時**先停手查原因**，不要重試。

---

## 5. 原廠真實協定（給要自寫的人）

> 以下全部出自 `ACR1255U-J1 Reference Manual V1.13` §5.1.4–§5.1.7 與 §6.2.4。
> ⚠️ 我用的是 **ACR1255U-J1** 的手冊；ACR1555U 的 UUID 家族與本手冊一致，
> 但**它的預設 master key 必須從自己的手冊確認**（見 §6 U2）。

### 5.1 兩層框架（**ACR1555U 版**）

> ⚠️ 我第一版抄的是 ACR1255U-J1 的框架（`05h` … `0Ah`）。**1555U 完全不同。**
> 以下出自 `ACR1555U Reference Manual V1.06` §5.2.3。

**外層（Communication Profile, §5.2.3）**：

```
Start byte + Slot + Len(2) + Reserved(1) + Host Seq(1) + Reader Seq(1)
           + Datablock(N) + Checksum(1) + Stop byte

Start byte = 55h      ← 不是 05h
Stop byte  = AAh
Slot       = 00h (PICC) / 01h (SAM)
```

`Checksum` = `Slot`、`Len`、Frame Type、`Host Seq`、`Reader Seq`、`Data` 全部位元組的
XOR。

> 📌 手冊這一行寫「Frame Type」但表格列的是「Reserved」——編寫不一致。
> 實作時以**實際位元組位置**為準，用讀卡機回傳的訊框反推驗證。

**內層（CCID message body）**：

```
bMessageType(1) + wLength(4, Little Endian) + bSlot(1) + bSeq(1)
                + abRFU(3) + abData(N)
```

注意三個和 1255U-J1 不同的地方：

| 項目            | ACR1255U-J1                     | **ACR1555U**                  |
| --------------- | ------------------------------- | ----------------------------- |
| 外層 Start byte | `05h`                           | **`55h`**                     |
| 外層 Stop byte  | `0Ah`                           | **`AAh`**                     |
| 內層長度欄位    | 2 bytes, Big Endian             | **4 bytes, Little Endian**    |
| 內層固定欄位    | `Slot + Seq + Param + Checksum` | **`bSlot + bSeq + abRFU(3)`** |

### 5.2 命令表（§5.2.4 Table 8 / 9 / 10）

| 送出  | 功能                             | 備註                   |
| ----- | -------------------------------- | ---------------------- |
| `62h` | PICC Power On                    |                        |
| `63h` | PICC Power Off                   |                        |
| `65h` | Get Card Status                  |                        |
| `6Fh` | **Exchange APDU**                | APDU 走這條            |
| `6Bh` | **Escape Command**（認證走這條） |                        |
| `61h` | Set Parameters                   | 1555U 新增，1255U 沒有 |

| 回應  | 功能                    |
| ----- | ----------------------- |
| `80h` | Response to Data Block  |
| `81h` | Response to Slot Status |
| `82h` | Response to Parameters  |
| `83h` | Response to Escape      |
| `53h` | Response to Error       |
| `50h` | Notify Card Status      |
| `52h` | Notify Enter Sleep Mode |

⇒ 對照 §3.2 F4：那份教學送的是 `E0 00 00 48 00` 五個裸 byte，
**外層內層都沒有**，而且用錯了 `05h`/`0Ah` 那一組。

### 5.3 認證流程（§5.1.7）

```
1. 6Bh 訊框，Data = E0 00 00 45 00        ← SPH_to_RDR_ReqAuth
2. 讀卡機回 83h，LEN = 00 15h，內含隨機挑戰碼  ← RDR_to_SPH_AuthRsp1
3. 用 master key 做 AES-128-CBC 加密挑戰碼
4. 6Bh 訊框送回密文                        ← SPH_to_RDR_AuthRsp
5. 讀卡機回 83h                           ← RDR_to_SPH_AuthRsp2
6. 讀卡機回 ACK；雙方各自產生 16-byte Session Key
```

### 5.4 APDU 層（§6.2.4，這部分那份教學是對的）

| 操作     | APDU                            | 備註                                 |
| -------- | ------------------------------- | ------------------------------------ |
| 取 UID   | `FF CA 00 00 00`                |                                      |
| 讀 block | `FF B0 00 <Block> <Len>`        | Ultralight：Len 為 4 的倍數，最多 16 |
| 寫 block | `FF D6 00 <Block> <Len> <Data>` | 原廠例：`FF D6 00 04 04 00 01 02 03` |

⚠️ 這些 APDU 必須包在 `6Fh` Exchange APDU 訊框內（§5.2），不能直接放進 write
characteristic。

---

## 6. 還沒驗證、不要當定論（U 清單）

| 代號 | 未驗證                                                                   | 怎麼驗                                                                   |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| U1   | **ACR1555U 的 Service UUID 是否與 ACR1255U-J1 完全相同**                 | 下載 ACR1555U 自己的 Reference Manual 對照 Table 4                       |
| U2   | **ACR1555U 的預設 master key**                                           | 同上，查 §Authentication。**這是全文件最高風險的未知項**——錯六次鎖機     |
| U3   | 平板（Redmi / Honor）的 Chrome 能否穩定完成 BLE 配對與斷線重連           | 跑官方 `BLETest-0.6.0.apk`                                               |
| U4   | ACS Android BLE EVK 是否內建 NDEF 包裝 API，或只到 APDU 層               | 讀 EVK 的 AAR 與 sample                                                  |
| U5   | 「不要先在 Android 系統設定手動配對」這個說法是否正確                    | 原廠通篇用 "paired device"，HID 模式明確需要 bonding。**存疑，傾向相反** |
| U6   | Web Bluetooth 在平板上寫入 >20 bytes 時的分片行為                        | 寫一張完整的 NDEF URI 觀察                                               |
| U7   | **`FF B0` / `FF D6` 在 NTAG213/215/216 上是否與 MIFARE Ultralight 一致** | 手冊只寫 Ultralight。拿一張 NTAG215 讀 Page 4、寫回、再讀回驗證          |

> U1/U2 沒有確認之前，**不要對實體讀卡機做認證**（見 §4）。

---

## 7. 建議的施工順序

| 順位  | 做什麼                                                        | 風險             | 工期      |
| ----- | ------------------------------------------------------------- | ---------------- | --------- |
| **1** | 下載 ACR1555U 官方 Reference Manual，確認 U1/U2               | 零               | 30 分     |
| **2** | 跑官方 `BLETest-0.6.0.apk`，驗證平板 → 認證 → 讀卡            | 零（官方金鑰）   | 1 小時    |
| **3** | 決定路線：網頁 Web Bluetooth / App 內建 BLE EVK / 買 NFC 手機 | —                | 1 小時    |
| 4a    | 若走網頁：用 §5 的規格自寫，先做 `read` 再做 `write`          | 中（鎖機、分片） | 4–7 人日  |
| 4b    | 若走 App：包 ACS Android BLE EVK                              | 中               | 5–10 人日 |
| 4c    | 若求快：買有 NFC 的 Android 手機，用現有 App                  | 低               | 0 人日    |

**第 2 步是關鍵分水嶺。** 它用官方工具證明硬體鏈沒問題，之後所有失敗都只可能
是我們自己的程式問題——這會省下大量排查時間。

---

## 8. 來源

| 來源                                                                                         | 用途                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ACS `ACR1255U-J1 Reference Manual V1.13` §5.1.3 / §5.1.4 / §5.1.5 / §5.1.6 / §5.1.7 / §6.2.4 | 框架、命令表、認證、預設金鑰、APDU                                      |
| ACS 驅動頁（ACR1555U）                                                                       | Android EVK（USB v1.1.8 / BLE EVK v0.6.2）、iOS BLE EVK、PC/SC 驅動清單 |
| ACS `USR-ACR1555U-A1-1.02` §3                                                                | BLE Test app 安裝步驟、HID 模式說明                                     |
| Chromium commit `537313cf` + blink-dev「WebUSB Interface Class Filtering」                   | `0x0B` 封鎖                                                             |
| MDN `Web_Bluetooth_API` / `USB` / `WebHID_API` / `NDEFReader` 相容表                         | 三個 API 的平台支援                                                     |
