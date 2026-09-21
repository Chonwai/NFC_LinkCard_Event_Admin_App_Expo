/**
 * `NEW-D2-04` 的類別鎖定：`src/` 底下的使用者可見中文，一律只能住在
 * `src/constants/copy.zh-TW.ts`。
 *
 * 這個類別先前只修了被點名的兩處（`CRA-V1-023` 的重新整理鈕、check-in 的
 * rate-limited 文案）就結案，類別本身從未掃過，於是活動列表的六個狀態標籤、
 * 三個共用元件的讀屏標籤、store 的失敗訊息都還留在原地。這支測試把「類別」
 * 變成可執行的斷言：之後新增中文只能寫進 copy 模組。
 *
 * 判準是**字串字面值**（`'` / `"` / `` ` ``）裡的漢字：
 * - 註解不算（本專案到處都是中文註解，掃進去會變 noise）。
 * - JSX 的文字節點也不在判準內；掃描當時 `src/` 裡這種節點是 0 個，
 *   所以沒有第三條規則可寫。
 *
 * 第二支測試是**空轉守衛**：如果掃描器壞掉（例如整支找不到字面值），
 * 第一支測試會「通過」得毫無意義，所以這裡要求 copy 模組本身必須被掃出
 * 大量中文字面值。第三支測試鎖住收斂時最容易弄丟的東西：活動列表原本就
 * 顯示得出 `REGISTRATION_OPEN`，改成共用映射後不得掉回原始 enum。
 *
 * 後面幾支測試直接載入 `@/utils/event-status`——那支模組的 `semantic` 是
 * type-only import，不拉 `react-native`（`theme.ts` 頂層就會用
 * `StyleSheet.hairlineWidth`），所以這裡不需要 mock react-native。
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, getEventStatusLabel } =
  await import("@/utils/event-status");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SRC = path.join(REPO_ROOT, "src");
const COPY_MODULE = path.join(SRC, "constants/copy.zh-TW.ts");

const HAN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 掃出字串字面值（含模板字串原文）；行註解與區塊註解跳過。 */
function stringLiterals(source) {
  const found = [];
  let i = 0;
  let line = 1;
  while (i < source.length) {
    const c = source[i];
    if (c === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === "*" && source[i + 1] === "/")
      ) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      const startLine = line;
      let j = i + 1;
      let text = "";
      while (j < source.length) {
        if (source[j] === "\\") {
          text += source[j] + (source[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (source[j] === quote) break;
        if (source[j] === "\n") line += 1;
        text += source[j];
        j += 1;
      }
      found.push({ line: startLine, text });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return found;
}

test("src/ 底下的中文只住在 copy.zh-TW.ts", () => {
  const offenders = [];

  for (const file of walk(SRC)) {
    if (file === COPY_MODULE) continue;
    for (const literal of stringLiterals(readFileSync(file, "utf8"))) {
      if (HAN.test(literal.text)) {
        offenders.push(`${path.relative(REPO_ROOT, file)}:${literal.line}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "使用者可見中文必須走 src/constants/copy.zh-TW.ts：\n" +
      offenders.join("\n"),
  );
});

test("掃描器真的有掃到東西（空轉守衛）", () => {
  const inCopy = stringLiterals(readFileSync(COPY_MODULE, "utf8")).filter(
    (literal) => HAN.test(literal.text),
  );

  assert.ok(
    inCopy.length > 50,
    `copy 模組應該有大量中文字面值，實測 ${inCopy.length}——若掉到 0 附近，` +
      "代表掃描器壞了，上一支測試的「通過」沒有意義",
  );
});

test("活動列表原本顯示得出的 REGISTRATION_OPEN 不得掉回原始 enum", () => {
  assert.equal(getEventStatusLabel("REGISTRATION_OPEN"), "報名中");
  assert.equal(getEventStatusLabel("DRAFT"), "草稿");
  assert.equal(getEventStatusLabel("PUBLISHED"), "已發布");
  assert.equal(getEventStatusLabel("ONGOING"), "進行中");
  assert.equal(getEventStatusLabel("COMPLETED"), "已結束");
  assert.equal(getEventStatusLabel("CANCELLED"), "已取消");
});

test("狀態徽章色在收斂後維持原樣（含 REGISTRATION_OPEN）", () => {
  assert.equal(EVENT_STATUS_TONE.REGISTRATION_OPEN, "success");
  assert.equal(EVENT_STATUS_TONE.PUBLISHED, "available");
  assert.equal(EVENT_STATUS_TONE.CANCELLED, "warning");

  for (const status of Object.keys(EVENT_STATUS_LABEL)) {
    assert.ok(
      EVENT_STATUS_LABEL[status].length > 0,
      `${status} 的顯示文字不得為空`,
    );
  }
});

test("未知狀態仍回退為原始值，不吞掉資訊", () => {
  assert.equal(getEventStatusLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(getEventStatusLabel(""), "");
  assert.equal(getEventStatusLabel(null), "");
  assert.equal(getEventStatusLabel(undefined), "");
});
