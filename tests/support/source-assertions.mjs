/**
 * 原始碼「有沒有這段東西」的斷言工具（R6）。
 *
 * ## 問題
 *
 * 這個 repo 沒有 jsdom／RN renderer（見 `check-in-write-handoff.test.mjs` 檔頭），
 * 所以畫面行為只能靠讀原始碼斷言。但直接 `source.includes("label={x}")` 或
 * `assert.match(source, /label=\{x\}/)` 的測試鎖的是**排版**，不是**程式**：
 * prettier 把 `label={x}` 寫成 `label={ x }`、或把一行拆成兩行，測試就紅，
 * 而程式碼的語意一個字都沒變。這種紅燈的代價不只是修一次——它訓練人把原始碼
 * 掃描測試當成雜訊，於是真正的回歸也一起被忽略。
 *
 * ## 選了哪一種做法，以及為什麼
 *
 * 題目給了兩條路：把 `\s*` 塞進 JSX 邊界，或比對前正規化空白。**選後者。**
 *
 * 理由：要自動把 `\s*` 塞到「正確的」位置，得先知道哪些字元是 JSX 邊界、哪些
 * 是識別字的一部分——那是 JSX parser 的工作。用猜的（例如「每個 `{` 後面都補
 * `\s*`」）會產生兩種壞掉的方式：
 *
 * 1. **誤判為通過**：`\s*` 落在不該容忍的地方，`label = {x}` 與 `label={x}` 都
 *    算過，測試變寬，卻沒有人知道寬在哪裡。
 * 2. **誤判為失敗**：邊界猜錯（例如字串常值裡的 `{`），正則語意被悄悄改寫。
 *
 * 正規化則是**對 source 與 snippet 兩邊做同一件事**，比對本身仍然是純字面子集
 * 搜尋（`includes`），所以「通過」的意思從頭到尾一致。
 *
 * ## 正規化做了什麼
 *
 * 1. 所有空白（換行、縮排、prettier 的斷行）壓成單一個空格。
 * 2. 再把 `{} () [] , ;` 這些**邊界字元**兩側的空白拿掉：`label={ x }` →
 *    `label={x}`、`f( a, b )` → `f(a,b)`。
 * 3. 拿掉 `)` 與 `}` 前面的 trailing comma。
 *
 * 第 3 條是實測出來的，不是猜的（R6 的反例探針直接抓到）：把 `printWidth` 改窄
 * 重排兩個畫面後，`profilePathLabel(outcome.registration.profileUrl)` 被拆成
 * 三行並**多了一個逗號**：
 *
 * ```ts
 * profilePathLabel(\n  outcome.registration.profileUrl,\n)
 * ```
 *
 * 那個逗號不是空白，是 token。prettier 的 `trailingComma` 設定改變時也會大規模
 * 發生。只忽略空白的話，這一類假紅照樣存在，所以一併處理。
 *
 * **`]` 刻意不處理**：`[1,,]` 與 `[1,]` 在 JS 裡不等價（前者兩個元素、後者一個），
 * 所以 `]` 前的逗號**不是** no-op。`}` 前的逗號在物件／解構／import 裡則是無語意
 * 的，`f(a,)` 在參數列裡同理。
 *
 * ## 它仍然**不**容忍什麼（重要）
 *
 * 兩個識別字之間的空白仍會影響比對：snippet 寫 `const foo`、原始碼寫 `const
 *  foo` 沒問題（都是空白，規則 1 會壓成一個），但 snippet 寫 `constfoo` 就不會
 * 命中 `const foo`。這是刻意的——把所有空白都刪掉會讓 `a b` 命中 `ab`，那是
 * **假通過**，比紅燈更糟。
 *
 * 另外：snippet 是**字面字串**，不是正則。需要 `.*`／alternation／`[^}]*` 這類
 * 真 regex 能力的斷言（例如「這段區塊裡不得出現 X」）請留在 `assert.match` /
 * `.test()`，不要硬塞進來。
 */

/**
 * 把原始碼／片段收斂成「與排版無關」的形式。
 *
 * 兩邊都必須經過這一步，否則比對不對稱。
 */
export function normalizeSource(text) {
  return (
    String(text)
      .replace(/\s+/g, " ")
      .replace(/\s*([{}()[\],;])\s*/g, "$1")
      // prettier 的 trailing comma 是 token 變動，不是空白；`)`／`}` 前的逗號無語意。
      .replace(/,\s*([)}])/g, "$1")
      .trim()
  );
}

/**
 * `source` 是否包含 `snippet`（忽略排版造成的空白差異）。
 *
 * @param {string} source 檔案全文
 * @param {string} snippet 要尋找的**字面**片段
 * @returns {boolean}
 */
export function matchesIgnoringWhitespace(source, snippet) {
  if (typeof snippet !== "string" || snippet.trim() === "") {
    // 空 snippet 會恆真（`"".includes("")`），那是靜默的空轉——寧可炸。
    throw new TypeError(
      "matchesIgnoringWhitespace 需要非空的字面片段（空字串會恆真）",
    );
  }
  return normalizeSource(source).includes(normalizeSource(snippet));
}

/**
 * 這支 helper 尚未套用到的測試檔（R6 的待辦清單）。
 *
 * 產生方式：
 *
 * ```
 * grep -rln 'readFileSync' tests/*.mjs | sort
 * ```
 *
 * 共 29 個檔；本次只改了 `check-in-write-handoff.test.mjs` 與
 * `nfc-lock-after-write.test.mjs`，剩下 27 個列在下面。
 *
 * ⚠️ 這份清單**不是**「27 個檔都需要改」。它只是「還在用
 * `readFileSync` + 原始字串／正則斷言」的集合，其中有些是讀資料或登記表
 * （`parity-registry`、`backend-contract`、`parity-citations` 之類），本來就
 * 不做原始碼存在性斷言，改成 whitespace-insensitive 沒有意義。逐檔套用前先確認
 * 它真的是在鎖「某段程式碼在不在」。
 *
 * 也**不要**一次改完：一次改 27 個檔的斷言，紅燈時分不出是「helper 有問題」還是
 * 「某個檔本來就在鎖排版」。
 */
export const FILES_STILL_USING_RAW_SOURCE_ASSERTIONS = [
  "tests/backend-contract.test.mjs",
  "tests/badge-contract.test.mjs",
  "tests/bank-transfer-contract.test.mjs",
  "tests/button-focus-ring.test.mjs",
  "tests/check-in-account-status.test.mjs",
  "tests/check-in-desk-lookup.test.mjs",
  "tests/check-in-display.test.mjs",
  "tests/check-in-valid-hold.test.mjs",
  "tests/content-contract.test.mjs",
  "tests/copy-routing.test.mjs",
  "tests/count-display.test.mjs",
  "tests/event-create-contract.test.mjs",
  "tests/event-list-phase.test.mjs",
  "tests/exhibitor-contract.test.mjs",
  "tests/lookup-timeout.test.mjs",
  "tests/nfc-bind-default-badge-type.test.mjs",
  "tests/org-role-contract.test.mjs",
  "tests/parity-citations.test.mjs",
  "tests/parity-registry.test.mjs",
  "tests/poll-contract.test.mjs",
  "tests/profile-settings-contract.test.mjs",
  "tests/reveal-focus-ring.test.mjs",
  "tests/session-contract.test.mjs",
  "tests/ticket-type-contract.test.mjs",
  "tests/ticket-type-form-schema.test.mjs",
  "tests/walk-in-ticket-group.test.mjs",
  "tests/walk-in-wiring.test.mjs",
];
