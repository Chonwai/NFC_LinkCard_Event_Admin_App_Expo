# NFC Reader Spike — DELTA 複審報告（Re-Review Mode, Round 2）

| 項目               | 值                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------- |
| 審查對象           | `tools/nfc-reader-spike/`                                                           |
| 本輪範圍           | `git --no-pager diff 761acca..HEAD`（2 個 commit：`25f5d7d`、`498a150`）            |
| 上一輪報告         | `.edison/artifacts/review-nfc-drivers-apdu-script.md`（594 行，23 條凍結 findings） |
| 分支               | `feat/nfc-gate1-reader-spike` @ `498a150`                                           |
| 審查員             | smith（Checker；Maker ≠ Checker）                                                   |
| 模式               | `strict`（threshold **93**）                                                        |
| 動作模式           | **`audit_only`**（使用者明示：不改碼、不 commit）                                   |
| 日期               | 2026-10-22                                                                          |
| **修復前**         | **82.6 / 100** → ESCALATE                                                           |
| **修復後（實測）** | **89.1 / 100** → **REPAIRABLE（+6.5）**                                             |

## 0. 本輪方法與 delta 邊界

依 `Re-Review Mode`，只重審「上一輪 findings 對應段落 + delta 範圍 + ≤1 跳下游」，其餘維度做 `unchanged confirmation`。

**delta 檔案清單（8 檔，+246 / −41）：**

| 檔案                          | 變動      | 對應 findings                   |
| ----------------------------- | --------- | ------------------------------- |
| `src/driver-matrix.js`        | +68 / −17 | H1、H2、M2（部分）、L2、L3、L11 |
| `bin/spike.js`                | +65 / −14 | H1、H2（`--transport`）、L2     |
| `src/apdu-script.js`          | +25 / −8  | M1、L1                          |
| `src/ndef.js`                 | +4 / −2   | L4                              |
| `tests/driver-matrix.test.js` | +53 / −10 | H1、H2、L2、L3、M6              |
| `tests/cli.test.js`           | +35 / −10 | H1、H2                          |
| `tests/apdu-script.test.js`   | +35       | M1、L4                          |
| `README.md`                   | +1 / −1   | L8                              |

**未動（因此其 findings 判定為 unchanged）**：`src/ntag.js`、`src/tag-session.js`、`src/reader-model.js`。

**所有驗證皆為實跑**：`npm test`、CLI 逐命令帶 exit code、`node` 直呼 library、以及在 `/tmp` 複本上做 3 個變異測試（不觸碰 repo）。**被審程式碼零修改**（`git status --short` 僅 `.edison/` 未追蹤）。

---

## 1. 逐條 findings 驗證（23 條凍結項）

### 🟠 High（2/2 已修）

| ID                                            | 判定         | 實測證據                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRA-H1** 未知 OS 的 JSON 與 exit code 相反  | ✅ **FIXED** | `drivers --os beos --json` → `exit=1`，payload `"known": false, "installsNeeded": null, "installsNeededByTransport": null`。`drivers --os android --json` → `exit=0`，`"installsNeeded": false`。兩者契約一致，且 `commandDrivers` 改以 `if (!answer.known) return 1;` 決定，**不再依賴 `installsNeeded` 猜語意**                                                                                                                                                                                          |
| **CRA-H2** Windows 的 OS 級答案抹掉 transport | ✅ **FIXED** | `drivers --os windows` → 首行 `windows — install BLE PC/SC Driver installer 1.0.3.1 (bluetooth only)`，`exit=0`；JSON 帶 `"installsNeededByTransport": {"usb": false, "bluetooth": true}`。新增 `--transport` 三態 **完全符合指定值**：`windows --transport usb` → `exit=0`；`windows --transport bluetooth` → `exit=1`；`macos --transport bluetooth` → `exit=1`（訊息 `not a supported route here`，`null` 不當成 `false`）。exit 語意＝「是否存在任何可用 transport」＝remediation 指定的 HOW，**自洽** |

> **H2 的偏離（已接受，非扣分）**：remediation 建議 `installsNeeded` 取 OR，作者改用 AND（`usableRows.every(requirement === "vendor")`），理由是與 exit code 保持一致，並以 `installsNeededByTransport` 承載細節。這個選擇在程式碼有註解、有測試、且與 exit 契約一致，**我接受**；但它造成 `installsNeeded` 對今日 5 個 OS **恆為 false**（見 CRA-N3）。

### 🟡 Medium（1 已修、1 降級、5 未修）

| ID                                      | 判定                                   | 實測證據                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRA-M1** 超容量腳本仍可被建構且無警示 | 🟡 **部分修復 → 降級為 CRA-N1（Low）** | `overflow === true` ✅；`renderScript()` 開頭確有 `# DO NOT SEND — payload does not fit this chip.` 六行 banner ✅；`comments:false` 仍保留 banner ✅；正常腳本無 banner ✅。**但**：`buildScript` 仍產出 **107 個 write steps、最高 page 110**（NTAG213 使用者區只到 39），`writePageCommand(110, …)` **仍被接受**（`A2 6E …`）。remediation 的 `throw`／`refusal`／上界三項 VERIFY 條件**均未達成**，只剩「產物顯眼可見」這一層。風險已大幅下降（操作者不可能誤送），故降為 Low |
| **CRA-M2** 「全 unsupported」分支       | ❌ **未修（且語意仍在）**              | 死碼被刪掉，但**計算式沒變**：`installsNeeded = usableRows.length > 0 && usableRows.every(vendor)` → `usableRows = 0` 時仍回 **`false`**，`commandDrivers` 仍回 **exit 0**。以合成資料（ios 全部改 unsupported）驗算：`usableRows = 0` → `installsNeeded = false`。**沒有任何測試覆蓋此狀態**。「沒有路可走」仍被表示成「不用裝」                                                                                                                                                 |
| **CRA-M3** exit code `2` 未定義         | ❌ **未修**                            | `usage()`（`bin/spike.js:339`）仍只有 `Exit codes: 0 = …, 1 = no (or an error was reported).`；`script` 缺 `--url` → 2、`--variant NTAG999` → 2（實測）。README `script` 列（`:71`）仍寫「non-zero exit means: payload too large for the chosen chip」——**參數錯誤被說成容量不足**                                                                                                                                                                                                |
| **CRA-M4** `commandScript` 零測試       | ❌ **未修**                            | `grep -c 'main(\["script"' tests/cli.test.js` → **0**。`--out` 寫檔、超容量拒絕、exit 2 全部仍只靠人工                                                                                                                                                                                                                                                                                                                                                                            |
| **CRA-M5** 「有來源」測試只驗長度       | ❌ **未修**                            | `driver-matrix.test.js:27-28` 仍是 `row.mechanism.length > 20` / `row.evidence.length > 20`。**假綠仍在**：把任一列 evidence 換成 21 個亂碼字元，測試照樣全綠                                                                                                                                                                                                                                                                                                                     |
| **CRA-M6** 測試把 H1 錯誤語意釘死       | ✅ **FIXED**                           | 新測試 `an unknown platform is a third state` 斷言 `known === false`、`installsNeeded === null`；舊的 `assert.equal(unknown.installsNeeded, false)` 已移除。變異測試 MUT3 證明這些斷言有鑑別力                                                                                                                                                                                                                                                                                    |
| **CRA-M7** 三種 exit-code 慣例、無抽象  | ❌ **未修**                            | `grep -c 'return [012];' bin/spike.js` → **21**，無 `EXIT.*` 常數；`drivers`（無 `--os`）實測仍 `exit=0`（即使有平台需安裝）                                                                                                                                                                                                                                                                                                                                                      |

### 🔵 Low（3 修復、11 未修 + 3 新增）

| ID                                             | 判定                                | 實測證據                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRA-L1** `PASS_THROUGH_CLA/INS` 名不符實     | ⚠️ **改名了，但錯位一格（仍開放）** | 位元組正確（見 §3），但新命名仍不對：`FF 00 00 00 <Lc>` 的 APDU 結構是 `CLA=FF, INS=00, P1=00, P2=00, Lc`。現行 `PASS_THROUGH_P1`（第 2 byte）**其實是 INS**、`PASS_THROUGH_P2`（第 3 byte）**其實是 P1**，真正的 P2 仍是裸 `0x00`。註解寫「the two zero bytes are P1/P2」，但那格frame裡是**三個**零位元組                                                                         |
| **CRA-L2** 未 trim／未正規化 transport         | ✅ **FIXED**                        | `driverAnswer("  windows  ").known === true`；`driverRows("windows","USB").length === 1`；`driverRows("WINDOWS","  bluetooth ").length === 1`                                                                                                                                                                                                                                       |
| **CRA-L3** `ios-usb` 帶 subsystem 破壞不變式   | ✅ **FIXED**                        | typedef 明寫 `unsupported` row MAY name one；新測試斷言 ios-usb 的 subsystem 匹配 `/PIV/`，且所有 unsupported 列的 subsystem 為 `null                                                                                                                                                                                                                                               | string` |
| **CRA-L4** `compressedBytes: -1`               | ✅ **FIXED**                        | `decodeUriMessage(encodeUriMessage("hello")).compressedBytes === 0`；`https://` → `7`（8−1，正確）                                                                                                                                                                                                                                                                                  |
| **CRA-L5** `identify()` 呼叫兩次               | ❌ 未修                             | `tag-session.js` 未動                                                                                                                                                                                                                                                                                                                                                               |
| **CRA-L6** `--out` 顯示相對路徑                | ❌ 未修                             | `bin/spike.js:623` 仍是 `path.relative(process.cwd(), out)`                                                                                                                                                                                                                                                                                                                         |
| **CRA-L7** `hasBinary("pcsctest")` 重複掃 PATH | ❌ 未修                             | `bin/spike.js:271-272` 仍是兩處呼叫（最多 4 次）                                                                                                                                                                                                                                                                                                                                    |
| **CRA-L8** README 測試數字錯                   | ❌ **仍未修（換了一個錯數字）**     | `README.md:92` 寫 **79** tests，實測 **82**（`npm test` → `ℹ tests 82 / pass 82 / fail 0`）。42 → 79 是「改了但沒對」                                                                                                                                                                                                                                                               |
| **CRA-L9** TLV 擴充長度落在讀取窗邊緣          | ❌ 未修                             | `tag-session.js` 未動                                                                                                                                                                                                                                                                                                                                                               |
| **CRA-L10** `FAMILIES` 依陣列順序、無守護      | ❌ 未修                             | `reader-model.js` 未動                                                                                                                                                                                                                                                                                                                                                              |
| **CRA-L11** osLabel 版本號未溯源               | ❌ **未修（修到隔壁列）**           | 被點名的 `android-usb` 仍 `Android 4.3+ (USB host mode)`、evidence 無 4.3；`ios-usb` 仍 `iOS 16.1+ / iPadOS 16+`、evidence 未提 16.1。**改的是沒被點名的 `android-bluetooth`**（4.3+ → 4.4+，該列已溯源）。掃描後仍有 6 列的版本號不在 evidence 內：`windows-usb/bluetooth`（10/11）、`macos-bluetooth`（10.15）、`android-usb`（4.3）、`ios-usb`（16.1/16）、`ios-bluetooth`（16） |
| **CRA-L12** `result.url` 原樣輸出              | ❌ 未修                             | `bin/spike.js:537`                                                                                                                                                                                                                                                                                                                                                                  |
| **CRA-L13** `--url hello` 仍可產生合法腳本     | ❌ 未修                             | `node bin/spike.js script --url hello` → **exit 0**，產出 `NTAG215, 16 bytes over 4 pages` 的完整腳本（`ndef.js`／CLI 皆未加 scheme 檢查）                                                                                                                                                                                                                                          |
| **CRA-L14** `verdictFor` 三層 nested ternary   | ❌ 未修                             | `reader-model.js` 未動；且 delta **新增**一處 nested ternary（`spike.js` 的 transport verdict），同類問題在擴散                                                                                                                                                                                                                                                                     |

---

## 2. delta 新引入的缺陷（3 條，皆 Low）

### 🟡 CRA-N1 — `writePageCommand` 仍無上界；`buildScript` 仍產出超容量 steps

| 欄位 | 內容                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 維度 | CR-D2                                                                                                                                                                                                   |
| 位置 | `src/ntag.js:57-67`（未在 delta 內）、`src/apdu-script.js:118-130`                                                                                                                                      |
| 事實 | `writePageCommand(110, Buffer.alloc(4))` → 回傳 `A2 6E 00 00 00 00`，**不拋錯**；`buildScript(超容量 URL, NTAG213)` 仍回 107 個 write steps（page 4→110）。M1 的「產物層不可用」只做到「頂端加 banner」 |
| 影響 | 直接呼叫 library 的批次 writer 仍可拿到「內容完整、只有 banner 不同」的腳本；若程式只取 `script.lines` 就完全看不到 banner。晶片會以 NAK 拒絕（不會寫壞資料），故為 Low                                 |
| 建議 | `writePageCommand` 收 `capacityPages` 上界；`buildScript` 在 `!fits` 時把 `steps` 清空並回 `refusal` 欄位                                                                                               |

### 🟡 CRA-N2 — `--transport` 用 `in` 判斷，原型鏈上的鍵會被當成合法 transport

| 欄位 | 內容                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 維度 | CR-D5（輸入驗證）                                                                                                                                                                                                                                                                                                                                                  |
| 位置 | `bin/spike.js:684`：`if (!(wantedTransport in byTransport))`                                                                                                                                                                                                                                                                                                       |
| 事實 | `drivers --os windows --transport constructor` → **`windows over constructor: install required`（exit 1）**。`"constructor" in {}` 為 `true`（原型鏈），`byTransport["constructor"]` 是函式（truthy）→ 走進「install required」分支。正確行為應是 `has no constructor row`。`--transport serial` 則正確回 `has no serial row. Supported: usb, bluetooth`（exit 1） |
| 影響 | 只影響錯誤輸入的訊息正確性，exit code 仍為 1（失敗安全）。但這正是本輪要修的「用一個值代表三種狀態」的同型錯誤，在新程式碼裡以另一種形式復發                                                                                                                                                                                                                       |
| 建議 | `Object.prototype.hasOwnProperty.call(byTransport, wantedTransport)`，或改用 `byTransport[wantedTransport] !== undefined`                                                                                                                                                                                                                                          |

### 🟡 CRA-N3 — 公開 driver 契約改了，README 沒跟上

| 欄位 | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 維度 | CR-D1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 位置 | `README.md:68`（`drivers` 列）、`README.md:71`（`script` 列）、`bin/spike.js:330`（usage 只加了一行範例）、`bin/spike.js:339`（Exit codes 只有 0/1）                                                                                                                                                                                                                                                                                                                                 |
| 事實 | ① `--transport` 只出現在 `usage()` 的一行範例，README **完全沒有**這個旗標，也沒有說明三態（`false` / `true` / `null = 沒有這條路`）；② `installsNeeded` 改為 AND 後，今天 **5 個 OS 全部為 `false`**，因此 `drivers --os` 對任何已知平台**永遠 exit 0**，README 那行「non-zero means a platform asked for with `--os` does [need something]」實務上只剩 unknown 會觸發；③ `drivers --transport usb`（不帶 `--os`）**靜默忽略**旗標且 `exit=0`；`--transport ''`（空值）同樣靜默忽略 |
| 影響 | 這是 H1 的同類風險 —— 契約說一件事、實作做另一件事 —— 只是方向相反（這次是文件落後）。在沒有 `--transport` 文件的情況下，操作員只會看到 `exit 0`                                                                                                                                                                                                                                                                                                                                     |
| 建議 | README 補 `--transport` 三態說明；`installsNeeded` 的 AND 語意寫進 commands 表；`--transport` 無 `--os` 時應報 `2`（bad arguments）而非靜默忽略                                                                                                                                                                                                                                                                                                                                      |

---

## 3. 關鍵驗證：`passThrough()` 的位元組（使用者指定重點 #4）

**結論：位元組完全正確、沒有偏移錯誤。** 改寫只動了常數名稱，沒有動位元組順序。

| 探針                               | 輸出                                                                        | 判定                                                                |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `passThrough(Buffer.from([0x60]))` | `FF 00 00 00 01 60`（len 6）                                                | ✅ 符合 `FF 00 00 00 <Lc> <cmd>`                                    |
| `passThrough(A2 04 00 00 00 00)`   | `FF 00 00 00 06 A2 04 00 00 00 00`（len 11，`Lc` 位元組 = 6）               | ✅ `Lc === command.length`、`total === 5 + Lc`（不變式實測 `true`） |
| `passThrough(空 Buffer)`           | throws `passThrough expects a non-empty command Buffer`                     | ✅                                                                  |
| `passThrough(256 B)`               | throws `command too long for one APDU: 256 bytes`                           | ✅ `Lc` 上界守住                                                    |
| 渲染後的檔案首行                   | `# Format: FF 00 00 00 <Lc> <ISO14443 command> (Reference Manual §5.5.4.1)` | ✅ 文件與實作一致                                                   |

**但命名仍錯（CRA-L1 未真正修好）**：`FF 00 00 00 <Lc>` 的 ISO 7816-4 欄位序是 `CLA INS P1 P2 Lc`。現行常數配置：

```
Buffer.from([ PASS_THROUGH_CLA(FF), PASS_THROUGH_P1(00), PASS_THROUGH_P2(00), 0x00, command.length ])
             └ CLA ✅            └ 實際是 INS ❌      └ 實際是 P1 ❌        └ 實際是 P2（無名）
```

比起舊版（`0x00` 被叫作 CLA、`0x00` 被叫作 INS），這次是**把錯位往後移一格**，而不是消除。位元組無風險，但下一位讀者若照名字去「修正」，仍可能在錯誤位置下手。建議：`PASS_THROUGH_INS`、`PASS_THROUGH_P1`、`PASS_THROUGH_P2` 三個名字對齊 `CLA INS P1 P2 Lc`，或直接寫 `Buffer.from([0xff, 0x00, 0x00, 0x00, command.length])` 並註解「vendor pseudo-APDU，四個 header 位元組全為固定值」。

---

## 4. 測試：82/82 全綠，且**新測試不是假綠**

```
ℹ tests 82   ℹ pass 82   ℹ fail 0
```

`eslint tools/nfc-reader-spike` → **0 error / 1 warning**（`PAGE_SIZE` 未使用，該 warning 在 `761acca` 即存在，非本輪引入）。`prettier --check` 全部通過。

**鑑別力自檢（在 `/tmp` 複本上做 3 個變異，repo 零污染）**：

| 變異                                                   | 結果                                                                       | 判定            |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------- |
| `overflow: !plan.fits` → `overflow: false`             | `pass 81 / fail 1`                                                         | ✅ 新測試抓得到 |
| `Math.max(0, prefix.length - 1)` → `prefix.length - 1` | `pass 81 / fail 1`（`a bare-hostname URL reports zero bytes saved…` 轉紅） | ✅              |
| `installsNeeded` 改回 `vendorRows.length > 0`          | `pass 79 / fail 3`（含 CLI 的 transport 測試）                             | ✅              |

**本輪新增的 7 個測試都有實質斷言**，不是「跑過就算」。但 **M4／M5 指出的兩個結構性缺口仍在**：`commandScript` 依舊 0 個 CLI 測試；「有來源」依舊只驗字串長度。

---

## 5. Delta Scorecard（可重算）

計分規則沿用上一輪：每維度自 100 起扣，`High −12`、`Medium −6`、`Low −2`；`CR-D3` 為 N/A 並自加權中排除，以剩餘權重歸一化。

| 維度                  |    R1    | 扣分項（R2 現況）                         | **R2**  |  權重   |      加權 |  Δ  |
| --------------------- | :------: | ----------------------------------------- | :-----: | :-----: | --------: | :-: |
| CR-D1 Plan Compliance |    54    | M3 −6、M4 −6、M5 −6、L8 −2、L11 −2、N3 −2 | **76**  |   20%   |     15.20 | +22 |
| CR-D2 Architecture    |    88    | N1 −2、L1 −2、L10 −2                      | **94**  |   15%   |     14.10 | +6  |
| CR-D3 DB/ORM Schema   |   N/A    | N/A（無 DB / ORM / migration）            | **N/A** |  (15%)  |         — |  —  |
| CR-D4 Cross-Module    |    88    | M2 −6、L9 −2                              | **92**  |   15%   |     13.80 | +4  |
| CR-D5 Security/OWASP  |    94    | L6 −2、L12 −2、L13 −2、N2 −2              | **92**  |   20%   |     18.40 | −2  |
| CR-D6 Performance     |    96    | L5 −2、L7 −2                              | **96**  |   10%   |      9.60 |  0  |
| CR-D7 Design Pattern  |    92    | M7 −6、L14 −2                             | **92**  |   5%    |      4.60 |  0  |
| **合計**              | **82.6** |                                           |         | **85%** | **75.70** |     |

$$\text{R2 Score} = \frac{75.70}{85} \times 100 = 89.06 \approx \mathbf{89.1}\qquad(\text{R1} = 82.59)$$

**Gate Decision（strict, 93）**

| 判準                          | 值        | 結果 |
| ----------------------------- | --------- | ---- |
| Score ≥ 93                    | 89.1 ≥ 93 | ❌   |
| Score ≥ 83（REPAIRABLE 下限） | 89.1 ≥ 83 | ✅   |
| Score < 83                    | 89.1 < 83 | ❌   |

→ **`REPAIRABLE`**（strict Round 2：路由回 paired author；Round 3 若仍未 PASS 才強制 PM 對話）。

**距離 93 的精確差距**：需要加權總分 ≥ `0.93 × 85 = 79.05`，現為 `75.70`，**差 3.35**。而在 CR-D1 內修好 M3 + M4 + M5 + L8（`−20 → D1 = 96`，加權 `+4.00`）即可到 `79.70 / 85 = 93.8`。但要滿足 strict 的質性條件（**Low 全清**），仍須清掉其餘 14 條 Low。

---

## 6. 裁定與可交付性

| 問題                     | 回答                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 修復前分數               | **82.6 / 100**（ESCALATE）                                                                                                                                                                |
| 修復後實測分數           | **89.1 / 100**（REPAIRABLE，+6.5）                                                                                                                                                        |
| 仍未修的 findings        | **Medium 5 條**：CRA-M2、CRA-M3、CRA-M4、CRA-M5、CRA-M7；**Low 14 條**：CRA-L1、L5、L6、L7、L8、L9、L10、L11、L12、L13、L14、CRA-N1、N2、N3（M1 已降級為 N1）                             |
| 是否可 DELIVER           | **不可**（89.1 < 93；strict 要求零 High + ≤1 已修 Medium + Low 全清，現況 5 Medium + 14 Low 未清）                                                                                        |
| 是否可 deploy 的實務判斷 | **兩個 High 已確實關閉**，且通過突變測試與 CLI 實測。若產品決策者願意接受「Medium 進 backlog」，本範圍的**硬體風險已可接受**；但 `audit_only` 的 strict 判決是 **REPAIRABLE**，不由我放行 |

### 這輪修得好的地方（該給的分）

1. **H1/H2 不是敷衍**：不是把 exit code 改掉讓測試變綠，而是把「三態」真正建模進資料結構（`known` / `installsNeededByTransport` / `usableTransports`），並讓 `null` 明確表示「這條路不存在」。`macos --transport bluetooth` 回 `not a supported route here` 而不是 `nothing to install`，正是 H1 的病根被拔掉。
2. **`--transport` 的三態實測值與指定完全一致**（usb 0／windows bluetooth 1／macos bluetooth 1）。
3. **新增測試有鑑別力**：3 個突變全部轉紅，沒有一個是靠「測到實作」過關的空斷言。
4. **`passThrough` 位元組零偏移**：這是本輪最關鍵的一行，實測 `Lc === command.length`、`total === 5 + Lc`、空與超長皆拋錯。

### 下一輪最小修復清單（依 ROI）

| #   | 動作                                                                                     | 對應 | 分數影響                             |
| --- | ---------------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| 1   | `usage()` 補 `2 = bad arguments`；README `script` 列改「1 = 容量不足、2 = 參數錯」       | M3   | D1 +6                                |
| 2   | `cli.test.js` 補 4 個 `main(["script", …])`（成功／`--out`／超容量不落檔／缺 `--url`→2） | M4   | D1 +6                                |
| 3   | 「有來源」測試改為可機械判定的形狀（`/https?:\/\|                                        | §\d  | v\d/`），並斷言 evidence ≠ mechanism | M5  | D1 +6 |
| 4   | README 測試數字改 82（或拿掉數字）                                                       | L8   | D1 +2                                |
| 5   | `osLabel` 版本號要出現在 `evidence`，否則標「推論」                                      | L11  | D1 +2                                |
| 6   | README／usage 補 `--transport` 三態；無 `--os` 時報 2                                    | N3   | D1 +2                                |
| 7   | 「全 unsupported」改 `installsNeeded: null` + exit 1，並補合成資料測試                   | M2   | D4 +6                                |
| 8   | `Object.prototype.hasOwnProperty.call(...)` 取代 `in`                                    | N2   | D5 +2                                |
| 9   | `writePageCommand` 加 `capacityPages` 上界；`buildScript` 不 fit 即 `refusal`            | N1   | D2 +2                                |
| 10  | `EXIT.*` 常數表收斂 21 個裸 return                                                       | M7   | D7 +6                                |
| 11  | `PASS_THROUGH_INS/P1/P2` 命名對齊欄位序                                                  | L1   | D2 +2                                |
| 12  | 其餘 Low（L5、L6、L7、L9、L10、L12、L13、L14）                                           | —    | 逐步收斂                             |

---

## 7. 凍結與下一輪契約

```yaml
delta_rereview:
  round: 2
  gate_mode: audit_only
  result: REPAIRABLE # 89.1 >= 83 且 < 93
  code_modified: false # 已驗證 git status 僅 .edison/ 未追蹤
  verified_by_execution:
    - "npm test → 82/82 pass"
    - "node bin/spike.js drivers --os beos --json → exit 1, installsNeeded null"
    - "node bin/spike.js drivers --os android --json → exit 0, installsNeeded false"
    - "drivers --os windows → exit 0, summary 含 '(bluetooth only)'"
    - "drivers --transport usb/bluetooth → 0/1；macos --transport bluetooth → 1"
    - "buildScript(超容量) → overflow true；renderScript 含 DO NOT SEND"
    - "passThrough([60]) → FF 00 00 00 01 60；A2 命令 → Lc=6, total=11"
    - "突變測試 3 組 → 全部轉紅（新測試非假綠）"
  fixed: [CRA-H1, CRA-H2, CRA-M6, CRA-L2, CRA-L3, CRA-L4]
  downgraded: [CRA-M1 -> CRA-N1]
  still_open:
    medium: [CRA-M2, CRA-M3, CRA-M4, CRA-M5, CRA-M7]
    low:
      [
        CRA-L1,
        CRA-L5,
        CRA-L6,
        CRA-L7,
        CRA-L8,
        CRA-L9,
        CRA-L10,
        CRA-L11,
        CRA-L12,
        CRA-L13,
        CRA-L14,
      ]
  new_findings: [CRA-N1, CRA-N2, CRA-N3]
```

```yaml
next_round_budget:
  expected_score_ceiling: 93.8 # 修完 M3+M4+M5+L8（D1 76→96）即可過線（數值面）
  qualitative_gate: "strict 需 Low 全清；本輪仍有 14 條 Low"
  stop_rule: "strict Round 3 仍未 PASS → 強制 PM 對話"
```

```yaml
review_telemetry:
  mirror_drift_flag: false
  repair_mode_used: none # audit_only（使用者明示不改碼）
  evidence_method: >-
    全部為實跑：npm test、CLI 逐命令 capture exit code、node 直呼 library、
    /tmp 複本上 3 組突變測試（不觸碰被審程式碼）、grep 計數確認未動段落。
  assumptions:
    - "『計畫』以 README + usage() + JSDoc + commit message 為準"
    - "外部事實（ACS/Microsoft/Apple 文件字串）未做網路查證，僅驗證內文一致性"
```
