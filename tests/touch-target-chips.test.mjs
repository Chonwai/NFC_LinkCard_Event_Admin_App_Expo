/**
 * 觸控目標下限（`F1`）：chip／篩選列不得低於 App 自己的 48px 標準。
 *
 * ## 缺陷長什麼樣
 *
 * `layout.touchMin = 48` 一直是凍結值，而 `registrations` 的篩選列實測是
 * **38px 高**（1280×800、Expo web、CDP 量測）：`20（行高）+ 8×2（padding）
 * + 2（下底線）= 38`。同一畫面上 18 個可點元素全部低於 44，`ChoiceChips`
 * 用在另外 6 個畫面也是同一個模式。
 *
 * 缺陷的性質不是「有人寫錯數字」，而是**高度是副產品**：它從 padding 與行高
 * 加出來，沒有人寫下「這裡至少 48」。所以任何一個 token 調降，控制項就無聲
 * 縮小，測試、型別、lint 全部看不到——只有真的量 DOM 才看得到。
 *
 * ## 為什麼這個測試讀原始碼而不是 render
 *
 * 這個 repo 沒有 jsdom／RN renderer（同 `check-in-write-handoff.test.mjs`、
 * `button-focus-ring.test.mjs` 檔頭），`StyleSheet.create` 的產物也載不進純
 * Node。所以「這個樣式有寫下限」只能用原始碼斷言。
 *
 * 這裡刻意**不**用 `tests/support/source-assertions.mjs`：那支 helper 比對的是
 * 字面子串，而本檔要的是「`key` 這個區塊裡有沒有 `minHeight: layout.touchMin`」
 * ——需要先切出區塊（大括號配對），那是 regex 能力，不是字面搜尋。
 *
 * ## 為什麼是一份清單，而不是自動掃描
 *
 * 「所有叫 `chip` 的 key 都要有 `minHeight`」聽起來更徹底，但它會誤判：
 * `GuestImportModal` 有一個也叫 `chip` 的區塊，那是**靜態標籤**（
 * `<View style={styles.chip}>` 顯示可收票種），不是可點目標——對它要求 48px
 * 是把標籤撐胖，不是修缺陷。區分「標籤」與「目標」需要看 JSX 用法，掃描
 * key 名字做不到，硬做只會製造假紅燈（而假紅燈正是 HEAD `3de09ac` 在處理的
 * 那個問題）。
 *
 * 代價是清單要人工維護。所以下面有一條**反空轉**斷言：清單裡每一項都必須
 * 真的存在（`styleBlock` 找不到就 `fail`），而且每一項都必須真的被檢查到。
 * 改名或搬家會立刻紅，不會靜默變成「掃到 0 個，全部通過」。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readSource = (relative) =>
  readFileSync(path.join(REPO_ROOT, relative), "utf8");

/**
 * 取出 `key: { ... }` 的物件主體（**不含**外層大括號）。
 *
 * 用大括號配對而不是 regex 的 `[^}]*`，因為 `theme.ts` 的 `chip` 有巢狀物件
 * （`inactive` / `active`），`[^}]*` 會在第一個 `}` 就斷掉，於是只檢查到一半
 * 的宣告——那是最糟的假通過。
 *
 * @param {string} source 檔案全文
 * @param {string} key 樣式 key
 * @param {string} file 檔名（錯誤訊息用）
 * @returns {string}
 */
function styleBlock(source, key, file) {
  const opener = new RegExp(`(?:^|[\\s,{])${key}:\\s*\\{`, "m");
  const match = opener.exec(source);
  assert.ok(
    match,
    `${file} 找不到樣式區塊 \`${key}\`；清單已過時，請同步更新本測試`,
  );

  const open = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  assert.fail(`${file} 的 \`${key}\` 區塊沒有閉合`);
}

/**
 * 可點的 chip／篩選列樣式。
 *
 * 每一項都是畫面上真的吃點擊的元素；`GuestImportModal` 的 `chip` 是靜態
 * 標籤，刻意不在清單裡（見檔頭）。
 */
const CHIP_TAP_TARGETS = [
  {
    file: "src/components/ui/ChoiceChips.tsx",
    key: "chip",
    why: "6 個畫面的單選晶片列",
  },
  {
    file: "src/app/(auth)/[eventId]/registrations.tsx",
    key: "filterItem",
    why: "狀態／可見性／email 狀態／押金退款篩選（實測 38px）",
  },
  {
    file: "src/app/(auth)/[eventId]/registrations.tsx",
    key: "sortItem",
    why: "排序選項，寬度也是內容撐出來的（實測 42x38）",
  },
  {
    file: "src/app/(auth)/[eventId]/registrations.tsx",
    key: "ticketChip",
    why: "票種篩選（本已合規，釘住以免被改回去）",
  },
  {
    file: "src/constants/theme.ts",
    key: "chip",
    why: "設計 token 層的同一條規則",
  },
];

/** `minHeight: layout.touchMin`，容忍 `:` 兩側的空白差異。 */
const REFERS_TO_TOUCH_MIN = /minHeight:\s*layout\.touchMin\b/;

test("F1：`layout.touchMin` 本身不得掉到 WCAG 2.5.5 的 44px 以下", () => {
  const theme = readSource("src/constants/theme.ts");
  const match = /touchMin:\s*(\d+)/.exec(theme);
  assert.ok(match, "theme.ts 應有 `touchMin` 這個值");

  const touchMin = Number(match[1]);
  assert.equal(touchMin, 48, "本案凍結門檻是 48（不是 WCAG 下限 44）");
  assert.ok(
    touchMin >= 44,
    `touchMin=${touchMin} 已低於 WCAG 2.5.5 的 44px，任何樣式都救不回來`,
  );
});

test("F1：清單涵蓋的每個 chip 目標都寫了 `minHeight: layout.touchMin`", () => {
  const missing = [];
  for (const { file, key, why } of CHIP_TAP_TARGETS) {
    const block = styleBlock(readSource(file), key, file);
    if (!REFERS_TO_TOUCH_MIN.test(block)) {
      missing.push(`${file} → ${key}（${why}）`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    "以下 chip 樣式沒有 48px 下限，高度會隨著 padding／行高一起縮小：\n" +
      missing.map((line) => `  - ${line}`).join("\n"),
  );
});

test("F1：`ChoiceChips` 撐高後文字必須垂直置中", () => {
  // minHeight 單獨出現是半套修法：多出來的高度會全部落到文字下方，
  // 晶片看起來像文字被裁掉。這兩個屬性是一組的。
  const block = styleBlock(
    readSource("src/components/ui/ChoiceChips.tsx"),
    "chip",
    "ChoiceChips.tsx",
  );
  assert.match(
    block,
    /justifyContent:\s*"center"/,
    '`chip` 需要 `justifyContent: "center"` 搭配 `minHeight`',
  );
});

test("F1：反空轉——清單每一項都真的被抽到區塊", () => {
  // `deepEqual(missing, [])` 在「清單整份讀不到」時也會通過，那是假通過。
  // 這裡逐項確認區塊非空且不含下一層的開頭，確保抽出來的是那個 key 自己。
  assert.ok(CHIP_TAP_TARGETS.length >= 4, "清單不應被縮到只剩象徵性的一兩項");
  for (const { file, key } of CHIP_TAP_TARGETS) {
    const block = styleBlock(readSource(file), key, file);
    assert.ok(
      block.trim().length > 0,
      `${file} 的 \`${key}\` 抽出空區塊，掃描已失去意義`,
    );
  }
});
